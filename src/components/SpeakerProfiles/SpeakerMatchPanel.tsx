import React, { useState, useEffect } from 'react';
import { useElectron } from '../../hooks/useElectron';
import { useAppContext } from '../../contexts/AppContext';
import { SpeakerMatchSuggestion, EmbeddingChunk } from '../../types';

const SPEAKER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

interface SpeakerMatchPanelProps {
  suggestions: SpeakerMatchSuggestion[];
  speakers: string[];
  speakerNames: Record<string, string>;
  folderName: string;
  onDismiss: () => void;
}

const SpeakerMatchPanel: React.FC<SpeakerMatchPanelProps> = ({
  suggestions,
  speakers,
  speakerNames,
  folderName,
  onDismiss,
}) => {
  const { dispatch } = useAppContext();
  const {
    confirmSpeakerMatch,
    createSpeakerProfile,
    updateSpeakerNames,
    getTranscriptionEmbeddings,
  } = useElectron();

  const [embeddings, setEmbeddings] = useState<EmbeddingChunk[] | null>(null);
  const [processedSpeakers, setProcessedSpeakers] = useState<Set<string>>(new Set());
  const [newProfileNames, setNewProfileNames] = useState<Record<string, string>>({});

  // Load embeddings on mount
  useEffect(() => {
    const loadEmbeddings = async () => {
      try {
        const embs = await getTranscriptionEmbeddings(folderName);
        setEmbeddings(embs);
      } catch (error) {
        console.warn('Could not load embeddings:', error);
      }
    };
    loadEmbeddings();
  }, [folderName, getTranscriptionEmbeddings]);

  const getEmbeddingsForSpeaker = (speakerId: string): EmbeddingChunk[] => {
    if (!embeddings) return [];
    // Map SPEAKER_XX to cluster index
    const match = speakerId.match(/SPEAKER_(\d+)/);
    if (!match) return [];
    const clusterIdx = parseInt(match[1], 10);
    return embeddings.filter(e => e.cluster === clusterIdx);
  };

  const handleAcceptMatch = async (suggestion: SpeakerMatchSuggestion) => {
    const speakerEmbeddings = getEmbeddingsForSpeaker(suggestion.transcriptionSpeakerId);

    try {
      await confirmSpeakerMatch(
        suggestion.profileId,
        folderName,
        suggestion.transcriptionSpeakerId,
        speakerEmbeddings
      );

      // Update speaker names locally
      const updatedNames = {
        ...speakerNames,
        [suggestion.transcriptionSpeakerId]: suggestion.profileName,
      };
      await updateSpeakerNames(folderName, updatedNames);
      dispatch({ type: 'SET_SPEAKER_NAMES', payload: updatedNames });

      setProcessedSpeakers(prev => new Set(prev).add(suggestion.transcriptionSpeakerId));

      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: `Matched ${suggestion.transcriptionSpeakerId} to ${suggestion.profileName}`, type: 'success' }
      });
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to confirm match', type: 'error' }
      });
    }
  };

  const handleRejectMatch = (speakerId: string) => {
    setProcessedSpeakers(prev => new Set(prev).add(speakerId));
  };

  const handleCreateProfile = async (speakerId: string) => {
    const name = newProfileNames[speakerId]?.trim();
    if (!name) return;

    const speakerEmbeddings = getEmbeddingsForSpeaker(speakerId);
    if (speakerEmbeddings.length === 0) {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'No embeddings available for this speaker', type: 'error' }
      });
      return;
    }

    try {
      await createSpeakerProfile({
        displayName: name,
        embeddings: speakerEmbeddings,
        transcriptionFolder: folderName,
        speakerId,
      });

      // Update speaker names locally
      const updatedNames = { ...speakerNames, [speakerId]: name };
      await updateSpeakerNames(folderName, updatedNames);
      dispatch({ type: 'SET_SPEAKER_NAMES', payload: updatedNames });

      setProcessedSpeakers(prev => new Set(prev).add(speakerId));

      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: `Created profile for ${name}`, type: 'success' }
      });
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to create profile', type: 'error' }
      });
    }
  };

  // Build a map of which speakers have suggestions
  const suggestionMap = new Map<string, SpeakerMatchSuggestion>();
  for (const s of suggestions) {
    suggestionMap.set(s.transcriptionSpeakerId, s);
  }

  // Speakers that haven't been processed yet
  const remainingSpeakers = speakers.filter(s => !processedSpeakers.has(s));

  if (remainingSpeakers.length === 0) {
    return null;
  }

  return (
    <div className="speaker-match-panel">
      <div className="speaker-match-header">
        <span className="speaker-match-title">
          <i className="fas fa-user-check"></i> Speaker Profile Matching
        </span>
        <button className="speaker-match-close" onClick={onDismiss} title="Dismiss">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="speaker-match-rows">
        {remainingSpeakers.map((speakerId) => {
          const suggestion = suggestionMap.get(speakerId);
          const speakerIndex = speakers.indexOf(speakerId);
          const color = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];

          return (
            <div key={speakerId} className="speaker-match-row">
              <span className="speaker-color-dot" style={{ backgroundColor: color }} />
              <span className="speaker-match-id">{speakerNames[speakerId] || speakerId}</span>

              {suggestion ? (
                <div className="speaker-match-suggestion">
                  <span className="speaker-match-arrow">
                    <i className="fas fa-arrow-right"></i>
                  </span>
                  <span className="speaker-match-name">{suggestion.profileName}</span>
                  <span className="speaker-match-confidence">
                    {Math.round(suggestion.similarity * 100)}%
                  </span>
                  <button
                    className="speaker-match-accept"
                    onClick={() => handleAcceptMatch(suggestion)}
                    title="Accept match"
                  >
                    <i className="fas fa-check"></i>
                  </button>
                  <button
                    className="speaker-match-reject"
                    onClick={() => handleRejectMatch(speakerId)}
                    title="Reject match"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ) : (
                <div className="speaker-match-new">
                  <input
                    type="text"
                    className="speaker-match-new-input"
                    placeholder="New profile name..."
                    value={newProfileNames[speakerId] || ''}
                    onChange={(e) => setNewProfileNames(prev => ({ ...prev, [speakerId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateProfile(speakerId);
                    }}
                  />
                  <button
                    className="speaker-match-create"
                    onClick={() => handleCreateProfile(speakerId)}
                    disabled={!newProfileNames[speakerId]?.trim()}
                    title="Create profile"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                  <button
                    className="speaker-match-skip"
                    onClick={() => handleRejectMatch(speakerId)}
                    title="Skip"
                  >
                    <i className="fas fa-forward"></i>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpeakerMatchPanel;
