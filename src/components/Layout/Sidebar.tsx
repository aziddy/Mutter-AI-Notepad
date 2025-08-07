import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import { TranscriptionData } from '../../types';
import LoadingState from '../UI/LoadingState';

const Sidebar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { selectFile, getTranscriptions, updateTranscriptionName } = useElectron();
  
  // Rename state
  const [renamingItem, setRenamingItem] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  
  // Loading states
  const [isLoadingTranscriptions, setIsLoadingTranscriptions] = useState(true);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  useEffect(() => {
    loadTranscriptions();
  }, []);

  const loadTranscriptions = async () => {
    try {
      setIsLoadingTranscriptions(true);
      setTranscriptionError(null);
      const transcriptions = await getTranscriptions();
      dispatch({ type: 'SET_TRANSCRIPTIONS', payload: transcriptions });
    } catch (error) {
      console.error('Failed to load transcriptions:', error);
      setTranscriptionError(`Failed to load transcriptions: ${error}`);
    } finally {
      setIsLoadingTranscriptions(false);
    }
  };

  const handleSelectFile = async () => {
    try {
      const filePath = await selectFile();
      if (filePath) {
        dispatch({ type: 'SHOW_FILE_INFO', payload: filePath });
      }
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Error selecting file: ${error}`,
          type: 'error'
        }
      });
    }
  };

  const handleTranscriptionClick = (transcription: TranscriptionData) => {
    // Don't load if currently renaming
    if (renamingItem) return;
    
    dispatch({ type: 'HIDE_WELCOME_SCREEN' });
    dispatch({
      type: 'SET_CURRENT_TRANSCRIPTION',
      payload: {
        transcription: transcription.content,
        jsonData: transcription.jsonData,
        srtContent: transcription.srtData || ''
      }
    });
    
    // Set audio file if available
    if (transcription.jsonData?.metadata?.audioSourceFile) {
      dispatch({ type: 'SET_AUDIO_FILE', payload: transcription.jsonData.metadata.audioSourceFile });
    }
    
    dispatch({ type: 'SHOW_RESULTS' });
  };

  // Handle rename start
  const handleRenameStart = useCallback((e: React.MouseEvent, transcription: TranscriptionData) => {
    e.stopPropagation(); // Prevent transcription click
    setRenamingItem(transcription.fileName);
    setRenameValue(transcription.customName || transcription.fileName);
  }, []);

  // Handle rename submit
  const handleRenameSubmit = useCallback(async (transcription: TranscriptionData) => {
    if (!renameValue.trim()) {
      setRenamingItem(null);
      return;
    }

    try {
      await updateTranscriptionName(transcription.fileName, renameValue.trim());
      
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Transcription renamed successfully!',
          type: 'success'
        }
      });

      // Reload transcriptions to reflect changes
      await loadTranscriptions();
      
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to rename transcription: ${error}`,
          type: 'error'
        }
      });
    }

    setRenamingItem(null);
    setRenameValue('');
  }, [renameValue, updateTranscriptionName, dispatch]);

  // Handle rename cancel
  const handleRenameCancel = useCallback(() => {
    setRenamingItem(null);
    setRenameValue('');
  }, []);

  // Handle rename key events
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent, transcription: TranscriptionData) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(transcription);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  return (
    <aside className="sidebar">
      <div className="upload-section">
        <button 
          className="btn btn-primary"
          onClick={handleSelectFile}
        >
          <i className="fas fa-upload"></i>
          Select Audio/Video File
        </button>
      </div>

      <div className="transcriptions-list">
        <h3>Recent Transcriptions</h3>
        <div className="transcriptions">
          <LoadingState
            loading={isLoadingTranscriptions}
            error={transcriptionError}
            loadingText="Loading transcriptions..."
            isEmpty={state.transcriptions.length === 0}
            emptyState={{
              icon: 'fa-microphone',
              title: 'No transcriptions yet',
              description: 'Start by selecting an audio or video file to transcribe',
              action: {
                text: 'Select File',
                onClick: handleSelectFile
              }
            }}
          >
            {state.transcriptions.map((transcription) => {
              const preview = transcription.content.substring(0, 100) + 
                (transcription.content.length > 100 ? '...' : '');
              const date = new Date(transcription.createdAt).toLocaleDateString();
              const time = new Date(transcription.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              });

              const displayName = transcription.customName || transcription.fileName;

              const isRenaming = renamingItem === transcription.fileName;

              return (
                <div
                  key={transcription.fileName}
                  className={`transcription-item ${isRenaming ? 'renaming' : ''}`}
                  onClick={() => handleTranscriptionClick(transcription)}
                >
                  <div className="transcription-item-header">
                    <div className="transcription-name-section">
                      {isRenaming ? (
                        <div className="rename-input-container">
                          <input
                            type="text"
                            className="rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameSubmit(transcription)}
                            onKeyDown={(e) => handleRenameKeyDown(e, transcription)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="rename-actions">
                            <button
                              className="rename-confirm-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameSubmit(transcription);
                              }}
                              title="Confirm rename"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              className="rename-cancel-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameCancel();
                              }}
                              title="Cancel rename"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="transcription-name" title={displayName}>
                            {displayName}
                          </h4>
                          <button 
                            className="rename-btn" 
                            title="Rename transcription"
                            onClick={(e) => handleRenameStart(e, transcription)}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="indicators">
                      {transcription.hasJson && (
                        <span className="json-indicator" title="Has detailed segments and metadata">
                          <i className="fas fa-code"></i>
                        </span>
                      )}
                      {transcription.hasSrt && (
                        <span className="srt-indicator" title="Has SRT subtitle file">
                          <i className="fas fa-closed-captioning"></i>
                        </span>
                      )}
                      {transcription.jsonData?.metadata?.audioSourceFile && (
                        <span className="audio-indicator" title="Has audio source file">
                          <i className="fas fa-music"></i>
                        </span>
                      )}
                    </div>
                  </div>
                  <p>{preview}</p>
                  <div className="transcription-item-footer">
                    <div className="date">{date} at {time}</div>
                    <div className="format-indicator">
                      {transcription.hasJson ? 'JSON + TXT' : 'TXT only'}
                      {transcription.hasSrt ? ' + SRT' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </LoadingState>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;