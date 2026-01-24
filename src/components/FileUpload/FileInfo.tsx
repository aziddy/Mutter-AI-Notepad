import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import { DiarizationConfig } from '../../types';

const FileInfo: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { transcribeFile, getTranscriptions, getDiarizationConfig, checkDiarizationEnvironment, transcribeFileWithDiarization } = useElectron();
  const [customName, setCustomName] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [diarizationAvailable, setDiarizationAvailable] = useState<boolean | null>(null);
  const [diarizationConfig, setDiarizationConfig] = useState<DiarizationConfig | null>(null);

  const selectedFilePath = state.selectedFilePath;

  // Check diarization availability on mount
  useEffect(() => {
    const checkDiarization = async () => {
      try {
        const config = await getDiarizationConfig();
        setDiarizationConfig(config);
        const envCheck = await checkDiarizationEnvironment(config.backend);
        setDiarizationAvailable(envCheck.ready);
      } catch (error) {
        console.warn('Diarization not available:', error);
        setDiarizationAvailable(false);
      }
    };
    checkDiarization();
  }, [getDiarizationConfig, checkDiarizationEnvironment]);



  const handleTranscribe = async () => {
    if (!selectedFilePath) return;

    try {
      setIsTranscribing(true);
      dispatch({ type: 'SHOW_PROGRESS', payload: 'Initializing transcription...' });

      if (enableDiarization && diarizationAvailable) {
        // Use diarization pipeline
        const cleanup = transcribeFileWithDiarization(
          selectedFilePath,
          customName.trim() || undefined,
          (message) => {
            dispatch({ type: 'SHOW_PROGRESS', payload: message });
          },
          async (result) => {
            dispatch({
              type: 'SET_CURRENT_TRANSCRIPTION',
              payload: {
                transcription: result.transcription,
                jsonData: result.jsonData,
                srtContent: result.srt || '',
                transcriptionId: result.fileName
              }
            });

            if (result.jsonData?.metadata?.audioSourceFile) {
              dispatch({ type: 'SET_AUDIO_FILE', payload: result.jsonData.metadata.audioSourceFile });
            }

            dispatch({ type: 'HIDE_PROGRESS' });
            dispatch({ type: 'SHOW_RESULTS' });
            dispatch({ type: 'HIDE_FILE_INFO' });

            try {
              const transcriptions = await getTranscriptions();
              dispatch({ type: 'SET_TRANSCRIPTIONS', payload: transcriptions });
            } catch (error) {
              console.warn('Failed to refresh transcriptions list:', error);
            }

            dispatch({
              type: 'ADD_TOAST',
              payload: {
                id: Date.now().toString(),
                message: `Transcription with speaker diarization completed!`,
                type: 'success'
              }
            });
            setIsTranscribing(false);
          },
          (error) => {
            dispatch({ type: 'HIDE_PROGRESS' });
            dispatch({
              type: 'ADD_TOAST',
              payload: {
                id: Date.now().toString(),
                message: `Diarization failed: ${error}`,
                type: 'error'
              }
            });
            setIsTranscribing(false);
          }
        );

        // Store cleanup function if needed
        return () => cleanup();
      } else {
        // Standard transcription without diarization
        setTimeout(() => dispatch({ type: 'SHOW_PROGRESS', payload: 'Converting audio format...' }), 1000);
        setTimeout(() => dispatch({ type: 'SHOW_PROGRESS', payload: 'Loading Whisper model...' }), 3000);
        setTimeout(() => dispatch({ type: 'SHOW_PROGRESS', payload: 'Transcribing audio...' }), 5000);

        const result = await transcribeFile(selectedFilePath, customName.trim() || undefined);

        dispatch({
          type: 'SET_CURRENT_TRANSCRIPTION',
          payload: {
            transcription: result.transcription,
            jsonData: result.jsonData,
            srtContent: result.srt || '',
            transcriptionId: result.fileName
          }
        });

        if (result.jsonData?.metadata?.audioSourceFile) {
          dispatch({ type: 'SET_AUDIO_FILE', payload: result.jsonData.metadata.audioSourceFile });
        }

        dispatch({ type: 'HIDE_PROGRESS' });
        dispatch({ type: 'SHOW_RESULTS' });
        dispatch({ type: 'HIDE_FILE_INFO' });

        try {
          const transcriptions = await getTranscriptions();
          dispatch({ type: 'SET_TRANSCRIPTIONS', payload: transcriptions });
        } catch (error) {
          console.warn('Failed to refresh transcriptions list:', error);
        }

        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: `Transcription completed! Saved as ${result.fileName}`,
            type: 'success'
          }
        });
        setIsTranscribing(false);
      }
    } catch (error) {
      dispatch({ type: 'HIDE_PROGRESS' });
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Transcription failed: ${error}`,
          type: 'error'
        }
      });
      setIsTranscribing(false);
    }
  };

  // For demo purposes, we'll show a placeholder FileInfo
  const fileName = selectedFilePath ? selectedFilePath.split(/[\\/]/).pop() || 'Unknown file' : 'No file selected';

  return (
    <div className="file-info">
      <div className="file-details">
        <i className="fas fa-file-audio"></i>
        <span>{fileName}</span>
      </div>
      <div className="transcription-name-input">
        <label htmlFor="transcriptionNameInput">Transcription Name:</label>
        <input
          type="text"
          id="transcriptionNameInput"
          placeholder="Enter a name for this transcription"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
      </div>
      <div className="diarization-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={enableDiarization}
            onChange={(e) => setEnableDiarization(e.target.checked)}
            disabled={!diarizationAvailable}
          />
          <span className="toggle-text">
            <i className="fas fa-users"></i>
            Speaker Diarization
          </span>
        </label>
        <span className="toggle-hint">
          {diarizationAvailable === null
            ? 'Checking availability...'
            : diarizationAvailable
            ? `Identify speakers (${diarizationConfig?.backend || 'fluidaudio'})`
            : 'Not available - check Settings'}
        </span>
      </div>
      <button
        className="btn btn-secondary"
        disabled={!selectedFilePath || isTranscribing}
        onClick={handleTranscribe}
      >
        <i className="fas fa-play"></i>
        Start Transcription
      </button>
    </div>
  );
};

export default FileInfo;