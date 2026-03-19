import React, { useState, useEffect, useCallback } from 'react';
import { useElectron } from '../../hooks/useElectron';
import { useAppContext } from '../../contexts/AppContext';
import { SpeakerProfile, SpeakerProfilesConfig } from '../../types';

interface SpeakerProfileManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SpeakerProfileManager: React.FC<SpeakerProfileManagerProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useAppContext();
  const {
    getSpeakerProfiles,
    updateSpeakerProfile,
    deleteSpeakerProfile,
    mergeSpeakerProfiles,
    getSpeakerProfilesConfig,
    updateSpeakerProfilesConfig,
  } = useElectron();

  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [config, setConfig] = useState<SpeakerProfilesConfig>({ similarityThreshold: 0.75 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [isMergeMode, setIsMergeMode] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getSpeakerProfiles(), getSpeakerProfilesConfig()]);
      setProfiles(p);
      setConfig(c);
    } catch (error) {
      console.warn('Failed to load speaker profiles:', error);
    }
  }, [getSpeakerProfiles, getSpeakerProfilesConfig]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateSpeakerProfile(id, { displayName: editName.trim() });
      setEditingId(null);
      setEditName('');
      await loadData();
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Profile renamed', type: 'success' }
      });
    } catch {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to rename profile', type: 'error' }
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteSpeakerProfile(id);
      await loadData();
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: `Deleted profile "${name}"`, type: 'success' }
      });
    } catch {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to delete profile', type: 'error' }
      });
    }
  };

  const handleMergeToggle = (id: string) => {
    setMergeSelection(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMerge = async () => {
    if (mergeSelection.length !== 2) return;
    try {
      await mergeSpeakerProfiles(mergeSelection[0], mergeSelection[1]);
      setMergeSelection([]);
      setIsMergeMode(false);
      await loadData();
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Profiles merged', type: 'success' }
      });
    } catch {
      dispatch({
        type: 'ADD_TOAST',
        payload: { id: Date.now().toString(), message: 'Failed to merge profiles', type: 'error' }
      });
    }
  };

  const handleThresholdChange = async (value: number) => {
    setConfig(prev => ({ ...prev, similarityThreshold: value }));
    try {
      await updateSpeakerProfilesConfig({ similarityThreshold: value });
    } catch {
      // Revert on failure
    }
  };

  if (!isOpen) return null;

  return (
    <div className="speaker-profile-manager-overlay" onClick={onClose}>
      <div className="speaker-profile-manager" onClick={e => e.stopPropagation()}>
        <div className="speaker-profile-manager-header">
          <h3><i className="fas fa-users"></i> Speaker Profiles</h3>
          <button className="speaker-profile-manager-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="speaker-profile-empty">
            No speaker profiles yet. Profiles are created when you name speakers after diarization.
          </div>
        ) : (
          <>
            {isMergeMode && (
              <div style={{ marginBottom: 12, fontSize: '0.8rem', color: '#6B7280' }}>
                Select 2 profiles to merge, then click "Merge Selected".
                {mergeSelection.length === 2 && (
                  <button
                    className="speaker-profile-action-btn"
                    style={{ marginLeft: 8 }}
                    onClick={handleMerge}
                  >
                    <i className="fas fa-compress-arrows-alt"></i> Merge Selected
                  </button>
                )}
                <button
                  className="speaker-profile-action-btn"
                  style={{ marginLeft: 8 }}
                  onClick={() => { setIsMergeMode(false); setMergeSelection([]); }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="speaker-profile-list">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className={`speaker-profile-card ${isMergeMode && mergeSelection.includes(profile.id) ? 'selected' : ''}`}
                  onClick={isMergeMode ? () => handleMergeToggle(profile.id) : undefined}
                  style={isMergeMode ? { cursor: 'pointer' } : undefined}
                >
                  {isMergeMode && (
                    <input
                      type="checkbox"
                      checked={mergeSelection.includes(profile.id)}
                      onChange={() => handleMergeToggle(profile.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <div className="speaker-profile-info">
                    {editingId === profile.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(profile.id); }}
                          className="speaker-match-new-input"
                          autoFocus
                        />
                        <button
                          className="speaker-profile-action-btn"
                          onClick={() => handleRename(profile.id)}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                        <button
                          className="speaker-profile-action-btn"
                          onClick={() => { setEditingId(null); setEditName(''); }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="speaker-profile-name">{profile.displayName}</div>
                        <div className="speaker-profile-meta">
                          {profile.sampleCount} samples &middot; {profile.appearances.length} appearance{profile.appearances.length !== 1 ? 's' : ''}
                        </div>
                      </>
                    )}
                  </div>

                  {!isMergeMode && editingId !== profile.id && (
                    <div className="speaker-profile-actions">
                      <button
                        className="speaker-profile-action-btn"
                        onClick={() => { setEditingId(profile.id); setEditName(profile.displayName); }}
                        title="Rename"
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                      <button
                        className="speaker-profile-action-btn danger"
                        onClick={() => handleDelete(profile.id, profile.displayName)}
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isMergeMode && profiles.length >= 2 && (
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <button
                  className="speaker-profile-action-btn"
                  onClick={() => setIsMergeMode(true)}
                >
                  <i className="fas fa-compress-arrows-alt"></i> Merge Profiles
                </button>
              </div>
            )}
          </>
        )}

        <div className="speaker-profile-settings">
          <h4>Matching Settings</h4>
          <div className="speaker-profile-threshold">
            <label>Similarity Threshold</label>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={config.similarityThreshold}
              onChange={e => handleThresholdChange(parseFloat(e.target.value))}
            />
            <span className="threshold-value">{Math.round(config.similarityThreshold * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakerProfileManager;
