import React, { useState, useEffect } from 'react';
import { useElectron } from '../../hooks/useElectron';
import { SpeakerProfile } from '../../types';

const SPEAKER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

interface SpeakerRenamePanelProps {
  speakers: string[];
  speakerNames: Record<string, string>;
  onSave: (names: Record<string, string>) => void;
  onClose: () => void;
}

const SpeakerRenamePanel: React.FC<SpeakerRenamePanelProps> = ({
  speakers,
  speakerNames,
  onSave,
  onClose,
}) => {
  const { getSpeakerProfiles } = useElectron();
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [draftNames, setDraftNames] = useState<Record<string, string>>(() => {
    const draft: Record<string, string> = {};
    for (const speaker of speakers) {
      draft[speaker] = speakerNames[speaker] || '';
    }
    return draft;
  });

  // Load existing profiles for dropdown suggestions
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const p = await getSpeakerProfiles();
        setProfiles(p);
      } catch {
        // Profiles not available
      }
    };
    loadProfiles();
  }, [getSpeakerProfiles]);

  const handleChange = (speakerId: string, name: string) => {
    setDraftNames(prev => ({ ...prev, [speakerId]: name }));
  };

  const handleSave = () => {
    // Only include non-empty names
    const names: Record<string, string> = {};
    for (const [key, value] of Object.entries(draftNames)) {
      if (value.trim()) {
        names[key] = value.trim();
      }
    }
    onSave(names);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="speaker-rename-panel">
      <div className="speaker-rename-header">
        <span className="speaker-rename-title">Rename Speakers</span>
        <button className="speaker-rename-close" onClick={onClose} title="Close">
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="speaker-rename-rows">
        {speakers.map((speaker, index) => (
          <div key={speaker} className="speaker-rename-row">
            <span
              className="speaker-color-dot"
              style={{ backgroundColor: SPEAKER_COLORS[index % SPEAKER_COLORS.length] }}
            />
            <span className="speaker-original-id">{speaker}</span>
            <i className="fas fa-arrow-right speaker-rename-arrow"></i>
            <div className="speaker-name-input-group">
              <input
                type="text"
                className="speaker-name-input"
                value={draftNames[speaker] || ''}
                onChange={(e) => handleChange(speaker, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter name..."
                list={`profiles-${speaker}`}
              />
              {profiles.length > 0 && (
                <datalist id={`profiles-${speaker}`}>
                  {profiles.map(p => (
                    <option key={p.id} value={p.displayName} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="speaker-rename-actions">
        <button className="speaker-rename-save" onClick={handleSave}>
          <i className="fas fa-check"></i> Save
        </button>
      </div>
    </div>
  );
};

export default SpeakerRenamePanel;
