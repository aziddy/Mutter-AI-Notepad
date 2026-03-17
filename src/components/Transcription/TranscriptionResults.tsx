import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext, getCurrentTranscriptionAIState } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import { useTextSearch } from '../../hooks/useTextSearch';
import AudioPlayer, { AudioPlayerRef } from '../Audio/AudioPlayer';
import SRTViewer from './SRTViewer';
import SpeakerRenamePanel from './SpeakerRenamePanel';
import LocalAISection from '../AI/LocalAISection';
import APISection from '../AI/APISection';
import AIResults from '../AI/AIResults';
import SearchBar from '../Search/SearchBar';
import HighlightedText from '../Search/HighlightedText';
import { SRTEntry } from '../../types';

// Parse SRT content into structured entries
const parseSRTContent = (srtContent: string): SRTEntry[] => {
  if (!srtContent) return [];

  const entries: SRTEntry[] = [];
  const blocks = srtContent.trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length < 3) continue;

    // Skip the sequence number (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);

    // Parse time line (format: "00:00:00,000 --> 00:00:00,000")
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const startTime = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]) + parseFloat(timeMatch[4]) / 1000;
    const endTime = parseFloat(timeMatch[5]) * 3600 + parseFloat(timeMatch[6]) * 60 + parseFloat(timeMatch[7]) + parseFloat(timeMatch[8]) / 1000;
    const text = textLines.join(' ').trim();

    entries.push({ startTime, endTime, text });
  }

  return entries;
};

interface TranscriptionResultsProps {
  onSettingsClick?: () => void;
}

const TranscriptionResults: React.FC<TranscriptionResultsProps> = ({ onSettingsClick }) => {
  const { state, dispatch } = useAppContext();
  const { getUserPreferences, updateUserPreferences, updateSpeakerNames, updateSpeakerSegments, exportTranscription } = useElectron();

  // Ref for AudioPlayer to enable seeking from SRT entry clicks
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  // Parse SRT content and populate state when it changes
  useEffect(() => {
    if (state.srtContent) {
      const entries = parseSRTContent(state.srtContent);
      dispatch({ type: 'SET_SRT_ENTRIES', payload: entries });
    } else {
      dispatch({ type: 'SET_SRT_ENTRIES', payload: [] });
    }
  }, [state.srtContent, dispatch]);

  // AI Results state - using local streaming state, but persistent results come from context
  const [streamingResult, setStreamingResult] = useState<{
    title: string;
    content: string;
    isStreaming: boolean;
  } | null>(null);

  // Get current transcription's AI state
  const currentAIState = getCurrentTranscriptionAIState(state);

  // AI tab state
  const [activeAITab, setActiveAITab] = useState<'local' | 'api'>('local');

  // AI panel collapse state
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(true);

  // SRT view mode state
  const [srtViewMode, setSrtViewMode] = useState<'segmented' | 'continuous'>('segmented');

  // Text view mode state
  const [textViewMode, setTextViewMode] = useState<'plain' | 'speakers'>('plain');

  // Speaker rename panel state
  const [showSpeakerRename, setShowSpeakerRename] = useState(false);

  // Resolve speaker name from mapping
  const resolveSpeakerName = useCallback((speakerId: string): string => {
    return state.currentJsonData?.speakerNames?.[speakerId] || speakerId;
  }, [state.currentJsonData?.speakerNames]);

  // Compute searchable text based on current view
  const searchableText = useMemo(() => {
    if (state.activeTab === 'srt') {
      return state.srtEntries.map(e => e.text).join(' ');
    } else if (textViewMode === 'speakers' && state.currentJsonData?.speakerSegments?.length) {
      // Generate speaker transcript inline for search
      const segments = state.currentJsonData.speakerSegments;
      const lines: string[] = [];
      let currentSpeaker: string | null = null;
      let currentText: string[] = [];

      for (const segment of segments) {
        const speaker = segment.speaker || 'UNKNOWN';
        if (speaker !== currentSpeaker) {
          if (currentSpeaker && currentText.length > 0) {
            lines.push(`[${resolveSpeakerName(currentSpeaker)}] ${currentText.join(' ')}`);
          }
          currentSpeaker = speaker;
          currentText = [segment.text.trim()];
        } else {
          currentText.push(segment.text.trim());
        }
      }
      if (currentSpeaker && currentText.length > 0) {
        lines.push(`[${resolveSpeakerName(currentSpeaker)}] ${currentText.join(' ')}`);
      }
      return lines.join('\n');
    }
    return state.currentTranscription || '';
  }, [state.activeTab, state.srtEntries, textViewMode, state.currentJsonData?.speakerSegments, state.currentTranscription, resolveSpeakerName]);

  // Text search functionality
  const search = useTextSearch(searchableText);

  // Scroll to current match when it changes
  useEffect(() => {
    if (search.isSearchOpen && search.totalMatches > 0) {
      const matchElement = document.querySelector(
        `[data-match-index="${search.currentMatchIndex}"]`
      );
      if (matchElement) {
        matchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [search.currentMatchIndex, search.isSearchOpen, search.totalMatches]);

  // Generate formatted speaker transcript from speakerSegments
  const generateSpeakerTranscript = useCallback(() => {
    const segments = state.currentJsonData?.speakerSegments;
    if (!segments || segments.length === 0) return '';

    const lines: string[] = [];
    let currentSpeaker: string | null = null;
    let currentText: string[] = [];

    for (const segment of segments) {
      const speaker = segment.speaker || 'UNKNOWN';
      if (speaker !== currentSpeaker) {
        if (currentSpeaker && currentText.length > 0) {
          lines.push(`[${resolveSpeakerName(currentSpeaker)}] ${currentText.join(' ')}`);
        }
        currentSpeaker = speaker;
        currentText = [segment.text.trim()];
      } else {
        currentText.push(segment.text.trim());
      }
    }
    if (currentSpeaker && currentText.length > 0) {
      lines.push(`[${resolveSpeakerName(currentSpeaker)}] ${currentText.join(' ')}`);
    }
    return lines.join('\n');
  }, [state.currentJsonData?.speakerSegments, resolveSpeakerName]);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await getUserPreferences();
        setActiveAITab(preferences.preferredAITab);
      } catch (error) {
        console.warn('Failed to load user preferences:', error);
        // Keep default value
      }
    };

    loadPreferences();
  }, [getUserPreferences]);

  // Handle AI tab change and save preference
  const handleAITabChange = useCallback(async (tab: 'local' | 'api') => {
    setActiveAITab(tab);
    try {
      await updateUserPreferences({ preferredAITab: tab });
    } catch (error) {
      console.warn('Failed to save AI tab preference:', error);
    }
  }, [updateUserPreferences]);

  const handleCopyTranscription = () => {
    let contentToCopy = '';

    // Copy content based on current view
    if (state.activeTab === 'srt') {
      contentToCopy = state.srtContent || '';
    } else if (textViewMode === 'speakers' && state.currentJsonData?.speakerSegments?.length) {
      contentToCopy = generateSpeakerTranscript();
    } else {
      contentToCopy = state.currentTranscription || '';
    }

    if (!contentToCopy) return;

    navigator.clipboard.writeText(contentToCopy).then(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Copied to clipboard!',
          type: 'success'
        }
      });
    }).catch(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Failed to copy',
          type: 'error'
        }
      });
    });
  };

  const handleExportTranscription = async () => {
    let content = '';
    let suffix = '';

    const segments = state.currentJsonData?.speakerSegments;
    if (segments && segments.length > 0) {
      // Always export in speaker transcript format with ALL CAPS names
      const lines: string[] = [];
      let currentSpeaker: string | null = null;
      let currentText: string[] = [];

      for (const segment of segments) {
        const speaker = segment.speaker || 'UNKNOWN';
        if (speaker !== currentSpeaker) {
          if (currentSpeaker && currentText.length > 0) {
            lines.push(`[${resolveSpeakerName(currentSpeaker).toUpperCase()}] ${currentText.join(' ')}`);
          }
          currentSpeaker = speaker;
          currentText = [segment.text.trim()];
        } else {
          currentText.push(segment.text.trim());
        }
      }
      if (currentSpeaker && currentText.length > 0) {
        lines.push(`[${resolveSpeakerName(currentSpeaker).toUpperCase()}] ${currentText.join(' ')}`);
      }
      content = lines.join('\n');
      suffix = '-speakers.txt';
    } else {
      content = state.currentTranscription || '';
      suffix = '.txt';
    }

    if (!content) return;

    const baseName = state.currentJsonData?.metadata?.customName || 'transcription';
    const defaultFileName = `${baseName}${suffix}`;

    try {
      const result = await exportTranscription(content, defaultFileName);
      if (result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: { id: Date.now().toString(), message: `Exported to ${result.filePath}`, type: 'success' }
        });
      }
    } catch {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to export transcription', type: 'error' }
      });
    }
  };

  // Handle SRT entry click (jump to time in audio)
  const handleSRTEntryClick = useCallback((entry: SRTEntry) => {
    audioPlayerRef.current?.seekTo(entry.startTime);
  }, []);

  // Handle current playing entry change
  const handlePlayingEntryChange = useCallback((entry: SRTEntry | null) => {
    dispatch({ type: 'SET_CURRENT_PLAYING_ENTRY', payload: entry });
  }, [dispatch]);

  // Handle AI results
  const handleAIResult = useCallback((title: string, content: string, isStreaming = false) => {
    if (isStreaming) {
      // For streaming, use local state
      setStreamingResult({ title, content, isStreaming });
    } else {
      // For completed results, store in per-transcription state
      setStreamingResult(null); // Clear streaming state
      if (state.currentTranscriptionId) {
        dispatch({
          type: 'SET_TRANSCRIPTION_AI_RESULTS',
          payload: {
            transcriptionId: state.currentTranscriptionId,
            title,
            content
          }
        });
      }
    }
  }, [state.currentTranscriptionId, dispatch]);

  // Handle streaming cancellation
  const handleStreamingCancel = useCallback(() => {
    setStreamingResult(null);
  }, []);

  // Handle settings modal open
  const handleConfigureClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

  // Handle speaker rename save
  const handleSpeakerNamesSave = useCallback(async (names: Record<string, string>) => {
    const folderPath = state.transcriptions.find(
      t => t.fileName === state.currentTranscriptionId
    )?.folderPath;
    const folderName = folderPath?.split(/[\\/]/).pop();
    if (!folderName) return;

    try {
      await updateSpeakerNames(folderName, names);
      dispatch({ type: 'SET_SPEAKER_NAMES', payload: names });
      setShowSpeakerRename(false);
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Speaker names updated!', type: 'success' }
      });
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to update speaker names', type: 'error' }
      });
    }
  }, [state.transcriptions, state.currentTranscriptionId, updateSpeakerNames, dispatch]);

  // Handle speaker reassignment for an SRT entry
  const handleSpeakerChange = useCallback(async (entryStartTime: number, entryEndTime: number, newSpeaker: string) => {
    const segments = state.currentJsonData?.speakerSegments;
    if (!segments) return;

    // Find the single best matching segment (max overlap) to avoid affecting adjacent split halves
    let bestIdx = -1;
    let maxOverlap = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const overlapStart = Math.max(entryStartTime, seg.start);
      const overlapEnd = Math.min(entryEndTime, seg.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return;

    const updatedSegments = segments.map((seg: { speaker: string; originalSpeaker?: string; start: number; end: number }, i: number) => {
      if (i === bestIdx) {
        return {
          ...seg,
          originalSpeaker: seg.originalSpeaker ?? seg.speaker,
          speaker: newSpeaker,
        };
      }
      return seg;
    });

    dispatch({ type: 'UPDATE_SPEAKER_SEGMENTS', payload: updatedSegments });

    // Persist to disk
    const folderPath = state.transcriptions.find(
      t => t.fileName === state.currentTranscriptionId
    )?.folderPath;
    const folderName = folderPath?.split(/[\\/]/).pop();
    if (folderName) {
      try {
        await updateSpeakerSegments(folderName, updatedSegments);
      } catch (error) {
        console.error('Failed to persist speaker segment change:', error);
      }
    }
  }, [state.currentJsonData?.speakerSegments, state.transcriptions, state.currentTranscriptionId, updateSpeakerSegments, dispatch]);

  // Handle splitting a segment at a word boundary
  const handleSplitSegment = useCallback(async (entryStartTime: number, entryEndTime: number, wordIndex: number) => {
    const segments = state.currentJsonData?.speakerSegments;
    if (!segments) return;

    // Find the segment that best matches this SRT entry by time overlap
    let bestIdx = -1;
    let maxOverlap = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const overlapStart = Math.max(entryStartTime, seg.start);
      const overlapEnd = Math.min(entryEndTime, seg.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return;

    const seg = segments[bestIdx];
    // Strip speaker prefix before splitting
    const cleanText = seg.text.replace(/^\[(SPEAKER_\d+|UNKNOWN)\]\s*/, '');
    const words = cleanText.split(/\s+/).filter((w: string) => w.length > 0);
    if (wordIndex <= 0 || wordIndex >= words.length) return;

    const totalWords = words.length;
    const fraction = wordIndex / totalWords;
    const splitTime = seg.start + fraction * (seg.end - seg.start);

    // Determine the next segment's speaker for the split-off portion
    let nextSpeaker = seg.speaker;
    if (bestIdx + 1 < segments.length) {
      nextSpeaker = segments[bestIdx + 1].speaker;
    }

    const splitId = `split-${Date.now()}`;
    const firstHalf = {
      ...seg,
      text: words.slice(0, wordIndex).join(' '),
      end: splitTime,
      splitFrom: splitId,
    };
    const secondHalf = {
      ...seg,
      text: words.slice(wordIndex).join(' '),
      start: splitTime,
      speaker: nextSpeaker,
      originalSpeaker: seg.originalSpeaker ?? seg.speaker,
      splitFrom: splitId,
    };

    const updatedSegments = [
      ...segments.slice(0, bestIdx),
      firstHalf,
      secondHalf,
      ...segments.slice(bestIdx + 1),
    ];

    dispatch({ type: 'UPDATE_SPEAKER_SEGMENTS', payload: updatedSegments });

    // Regenerate SRT content from updated segments
    const newSrtContent = updatedSegments.map((s: { start: number; end: number; speaker?: string; text: string }, i: number) => {
      const startH = Math.floor(s.start / 3600);
      const startM = Math.floor((s.start % 3600) / 60);
      const startS = Math.floor(s.start % 60);
      const startMs = Math.round((s.start % 1) * 1000);
      const endH = Math.floor(s.end / 3600);
      const endM = Math.floor((s.end % 3600) / 60);
      const endS = Math.floor(s.end % 60);
      const endMs = Math.round((s.end % 1) * 1000);
      const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:${String(startS).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(endS).padStart(2, '0')},${String(endMs).padStart(3, '0')}`;
      const speakerPrefix = s.speaker ? `[${s.speaker}] ` : '';
      return `${i + 1}\n${startStr} --> ${endStr}\n${speakerPrefix}${s.text}`;
    }).join('\n\n');

    dispatch({ type: 'SET_SRT_CONTENT', payload: newSrtContent });

    // Persist to disk
    const folderPath = state.transcriptions.find(
      t => t.fileName === state.currentTranscriptionId
    )?.folderPath;
    const folderName = folderPath?.split(/[\\/]/).pop();
    if (folderName) {
      try {
        await updateSpeakerSegments(folderName, updatedSegments);
      } catch (error) {
        console.error('Failed to persist segment split:', error);
      }
    }

    dispatch({
      type: 'ADD_TOAST',
      payload: { id: Date.now().toString(), message: 'Segment split successfully', type: 'success' }
    });
  }, [state.currentJsonData?.speakerSegments, state.transcriptions, state.currentTranscriptionId, updateSpeakerSegments, dispatch]);

  // Handle undoing a manual split (merge two halves back together)
  const handleUndoSplit = useCallback(async (entryStartTime: number, entryEndTime: number) => {
    const segments = state.currentJsonData?.speakerSegments;
    if (!segments) return;

    // Find the segment matching this entry by time overlap
    let matchIdx = -1;
    let maxOverlap = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const overlapStart = Math.max(entryStartTime, seg.start);
      const overlapEnd = Math.min(entryEndTime, seg.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        matchIdx = i;
      }
    }
    if (matchIdx === -1) return;

    const matchedSeg = segments[matchIdx];
    if (!matchedSeg.splitFrom) return;

    const splitId = matchedSeg.splitFrom;

    // Find all segments with this splitFrom ID
    const splitIndices: number[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].splitFrom === splitId) {
        splitIndices.push(i);
      }
    }
    if (splitIndices.length < 2) return;

    // Sort by start time to merge in order
    splitIndices.sort((a, b) => segments[a].start - segments[b].start);

    const firstSeg = segments[splitIndices[0]];
    const lastSeg = segments[splitIndices[splitIndices.length - 1]];

    // Merge: combine text, use full time range, restore original speaker if available
    const mergedSeg = {
      ...firstSeg,
      text: splitIndices.map(i => segments[i].text).join(' '),
      start: firstSeg.start,
      end: lastSeg.end,
      speaker: firstSeg.originalSpeaker || firstSeg.speaker,
      splitFrom: undefined,
      originalSpeaker: undefined,
    };

    // Build new segments array, replacing split halves with merged segment
    const updatedSegments = [];
    let inserted = false;
    for (let i = 0; i < segments.length; i++) {
      if (splitIndices.includes(i)) {
        if (!inserted) {
          updatedSegments.push(mergedSeg);
          inserted = true;
        }
        // Skip other split halves
      } else {
        updatedSegments.push(segments[i]);
      }
    }

    dispatch({ type: 'UPDATE_SPEAKER_SEGMENTS', payload: updatedSegments });

    // Regenerate SRT content
    const newSrtContent = updatedSegments.map((s: { start: number; end: number; speaker?: string; text: string }, i: number) => {
      const startH = Math.floor(s.start / 3600);
      const startM = Math.floor((s.start % 3600) / 60);
      const startS = Math.floor(s.start % 60);
      const startMs = Math.round((s.start % 1) * 1000);
      const endH = Math.floor(s.end / 3600);
      const endM = Math.floor((s.end % 3600) / 60);
      const endS = Math.floor(s.end % 60);
      const endMs = Math.round((s.end % 1) * 1000);
      const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:${String(startS).padStart(2, '0')},${String(startMs).padStart(3, '0')}`;
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(endS).padStart(2, '0')},${String(endMs).padStart(3, '0')}`;
      const speakerPrefix = s.speaker ? `[${s.speaker}] ` : '';
      return `${i + 1}\n${startStr} --> ${endStr}\n${speakerPrefix}${s.text}`;
    }).join('\n\n');

    dispatch({ type: 'SET_SRT_CONTENT', payload: newSrtContent });

    // Persist to disk
    const folderPath = state.transcriptions.find(
      t => t.fileName === state.currentTranscriptionId
    )?.folderPath;
    const folderName = folderPath?.split(/[\\/]/).pop();
    if (folderName) {
      try {
        await updateSpeakerSegments(folderName, updatedSegments);
      } catch (error) {
        console.error('Failed to persist undo split:', error);
      }
    }

    dispatch({
      type: 'ADD_TOAST',
      payload: { id: Date.now().toString(), message: 'Split undone — segments merged', type: 'success' }
    });
  }, [state.currentJsonData?.speakerSegments, state.transcriptions, state.currentTranscriptionId, updateSpeakerSegments, dispatch]);

  // Handle AI panel collapse toggle
  const handleToggleAIPanel = useCallback(() => {
    setIsAIPanelCollapsed(!isAIPanelCollapsed);
  }, [isAIPanelCollapsed]);

  return (
    <div className="results-section">
      <div className="results-header">
        <h2>Transcription Results</h2>
        <div className="results-actions">
          <button
            className="btn btn-icon"
            title="Copy to clipboard"
            onClick={handleCopyTranscription}
          >
            <i className="fas fa-copy"></i>
          </button>
          <button
            className="btn btn-icon"
            title="Export to file"
            onClick={handleExportTranscription}
          >
            <i className="fas fa-file-export"></i>
          </button>
        </div>
      </div>

      {/* Transcription Metadata */}
      {state.currentJsonData?.metadata && (
        <div className="transcription-metadata">
          <div className="metadata-grid">
            <div className="metadata-item">
              <i className="fas fa-clock"></i>
              <span>
                Duration: {state.currentJsonData.metadata.duration 
                  ? `${Math.floor(state.currentJsonData.metadata.duration / 60)}:${Math.floor(state.currentJsonData.metadata.duration % 60).toString().padStart(2, '0')}`
                  : '--'
                }
              </span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-language"></i>
              <span>Language: {state.currentJsonData.language || 'en'}</span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-file-alt"></i>
              <span>Words: {state.currentJsonData.metadata.wordCount || state.currentTranscription.split(/\s+/).length}</span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-calendar"></i>
              <span>
                Date: {new Date(state.currentJsonData.metadata.transcribedAt).toLocaleDateString()} at {new Date(state.currentJsonData.metadata.transcribedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {state.currentJsonData.metadata.audioSourceFile && (
              <div className="metadata-item">
                <i className="fas fa-music"></i>
                <span>Audio: {state.currentJsonData.metadata.audioSourceFile.split(/[\\/]/).pop()}</span>
              </div>
            )}
            {state.currentJsonData.speakers && state.currentJsonData.speakers.length > 0 && (
              <div className="metadata-item">
                <i className="fas fa-users"></i>
                <span>Speakers: {state.currentJsonData.speakers.length}</span>
                <button
                  className="speaker-rename-btn"
                  onClick={() => setShowSpeakerRename(!showSpeakerRename)}
                  title="Rename speakers"
                >
                  <i className="fas fa-pen"></i>
                </button>
              </div>
            )}
          </div>
          {showSpeakerRename && state.currentJsonData.speakers && state.currentJsonData.speakers.length > 0 && (
            <SpeakerRenamePanel
              speakers={state.currentJsonData.speakers}
              speakerNames={state.currentJsonData.speakerNames || {}}
              onSave={handleSpeakerNamesSave}
              onClose={() => setShowSpeakerRename(false)}
            />
          )}
        </div>
      )}

      {/* Transcription Content */}
      <div className="transcription-content">
        <div className="transcription-tabs">
          <button
            className={`tab-btn ${state.activeTab === 'text' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'text' })}
          >
            <i className="fas fa-align-left"></i>
            Text View
          </button>
          <button
            className={`tab-btn ${state.activeTab === 'srt' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'srt' })}
          >
            <i className="fas fa-closed-captioning"></i>
            SRT View
          </button>
        </div>

        <div className={`tab-content ${state.activeTab === 'text' ? 'active' : ''}`}>
          {/* Search Bar */}
          <SearchBar
            isOpen={search.isSearchOpen}
            searchQuery={search.searchQuery}
            onSearchChange={search.setSearchQuery}
            onClose={search.closeSearch}
            onNext={search.goToNextMatch}
            onPrevious={search.goToPreviousMatch}
            currentMatch={search.currentMatchIndex}
            totalMatches={search.totalMatches}
            caseSensitive={search.caseSensitive}
            onToggleCaseSensitive={search.toggleCaseSensitivity}
          />
          {/* View mode selector (only when speakers available) */}
          {state.currentJsonData?.speakerSegments && state.currentJsonData.speakerSegments.length > 0 && (
            <div className="text-view-mode-select">
              <label htmlFor="text-view-mode">View:</label>
              <select
                id="text-view-mode"
                value={textViewMode}
                onChange={(e) => setTextViewMode(e.target.value as 'plain' | 'speakers')}
              >
                <option value="plain">Plain Text</option>
                <option value="speakers">Speaker Transcript</option>
              </select>
            </div>
          )}
          <div className="transcription-text">
            {search.isSearchOpen && search.searchQuery ? (
              <HighlightedText
                text={textViewMode === 'speakers' && state.currentJsonData?.speakerSegments && state.currentJsonData.speakerSegments.length > 0
                  ? generateSpeakerTranscript()
                  : state.currentTranscription || ''
                }
                searchQuery={search.searchQuery}
                caseSensitive={search.caseSensitive}
                currentMatchGlobalIndex={search.currentMatchIndex}
                matchStartIndex={0}
              />
            ) : (
              textViewMode === 'speakers' && state.currentJsonData?.speakerSegments && state.currentJsonData.speakerSegments.length > 0
                ? generateSpeakerTranscript()
                : state.currentTranscription
            )}
          </div>
        </div>

        <div className={`tab-content ${state.activeTab === 'srt' ? 'active' : ''}`}>
          {/* Search Bar */}
          <SearchBar
            isOpen={search.isSearchOpen}
            searchQuery={search.searchQuery}
            onSearchChange={search.setSearchQuery}
            onClose={search.closeSearch}
            onNext={search.goToNextMatch}
            onPrevious={search.goToPreviousMatch}
            currentMatch={search.currentMatchIndex}
            totalMatches={search.totalMatches}
            caseSensitive={search.caseSensitive}
            onToggleCaseSensitive={search.toggleCaseSensitivity}
          />
          {/* Audio Player and View Mode Select */}
          <div className="srt-controls">
            {state.currentJsonData?.metadata?.audioSourceFile && state.activeTab === 'srt' && (
              <AudioPlayer
                ref={audioPlayerRef}
                audioSource={state.currentJsonData.metadata.audioSourceFile}
                srtEntries={state.srtEntries}
                onPlayingEntryChange={handlePlayingEntryChange}
              />
            )}
            <div className="srt-view-mode-select">
              <label htmlFor="srt-view-mode">View:</label>
              <select
                id="srt-view-mode"
                value={srtViewMode}
                onChange={(e) => setSrtViewMode(e.target.value as 'segmented' | 'continuous')}
              >
                <option value="segmented">Segmented</option>
                <option value="continuous">Continuous</option>
              </select>
            </div>
          </div>

          {/* SRT Viewer */}
          <SRTViewer
            srtContent={state.srtContent}
            currentPlayingEntry={state.currentPlayingEntry}
            onEntryClick={handleSRTEntryClick}
            viewMode={srtViewMode}
            speakerSegments={state.currentJsonData?.speakerSegments}
            speakerNames={state.currentJsonData?.speakerNames}
            speakers={state.currentJsonData?.speakers}
            onSpeakerChange={handleSpeakerChange}
            onSplitSegment={handleSplitSegment}
            onUndoSplit={handleUndoSplit}
            searchQuery={search.isSearchOpen ? search.searchQuery : undefined}
            caseSensitive={search.caseSensitive}
            currentMatchIndex={search.currentMatchIndex}
          />
        </div>
      </div>

      {/* AI Features */}
      <div className={`ai-features ${isAIPanelCollapsed ? 'collapsed' : ''}`}>
        <div className="ai-header">
          <h3><i className="fas fa-robot"></i> AI Features</h3>
          <button
            className="btn btn-icon ai-collapse-btn"
            onClick={handleToggleAIPanel}
            title={isAIPanelCollapsed ? 'Expand AI Panel' : 'Collapse AI Panel'}
          >
            <i className={`fas ${isAIPanelCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          </button>
        </div>
        {/* Collapsible AI Content */}
        {!isAIPanelCollapsed && (
          <div className="ai-collapsible-content">
            {/* AI Tabs */}
            <div className="ai-tabs transcription-tabs">
              <button
                className={`tab-btn ${activeAITab === 'local' ? 'active' : ''}`}
                onClick={() => handleAITabChange('local')}
              >
                <i className="fas fa-desktop"></i>
                Local Model
              </button>
              <button
                className={`tab-btn ${activeAITab === 'api' ? 'active' : ''}`}
                onClick={() => handleAITabChange('api')}
              >
                <i className="fas fa-cloud"></i>
                External API
              </button>
            </div>

            {/* AI Content */}
            <div className="ai-content">
              <div className={`tab-content ${activeAITab === 'local' ? 'active' : ''}`}>
                {activeAITab === 'local' && (
                  <LocalAISection
                    onAIResult={handleAIResult}
                    onStreamingCancel={handleStreamingCancel}
                  />
                )}
              </div>

              <div className={`tab-content ${activeAITab === 'api' ? 'active' : ''}`}>
                {activeAITab === 'api' && (
                  <APISection
                    onAIResult={handleAIResult}
                    onConfigureClick={handleConfigureClick}
                    onStreamingCancel={handleStreamingCancel}
                  />
                )}
              </div>
            </div>

            {/* AI Results */}
            <AIResults
              title={streamingResult?.title || currentAIState.aiResults.title}
              content={streamingResult?.content || currentAIState.aiResults.content}
              visible={!!streamingResult || currentAIState.aiResults.visible}
              isStreaming={streamingResult?.isStreaming || false}
              onCancel={handleStreamingCancel}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionResults;