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
  const [minSpeakers, setMinSpeakers] = useState<number | null>(null);
  const [maxSpeakers, setMaxSpeakers] = useState<number | null>(null);

  const selectedFilePath = state.selectedFilePath;

  // Check diarization availability on mount
  useEffect(() => {
    const checkDiarization = async () => {
      try {
        const config = await getDiarizationConfig();
        setDiarizationConfig(config);
        setMinSpeakers(config.minSpeakers ?? null);
        setMaxSpeakers(config.maxSpeakers ?? null);
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
          async (result: any) => {

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

            // Set speaker match suggestions if available
            if (result.matchSuggestions && result.matchSuggestions.length > 0) {
              dispatch({ type: 'SET_SPEAKER_MATCH_SUGGESTIONS', payload: result.matchSuggestions });
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
          },
          { minSpeakers, maxSpeakers }
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
        {enableDiarization && diarizationAvailable && (
          <div className="speaker-hints">
            <label className="speaker-hints-label">Speaker Count Hints</label>
            <div className="speaker-hints-inputs">
              <input
                type="number"
                value={minSpeakers ?? ''}
                onChange={(e) => setMinSpeakers(e.target.value ? parseInt(e.target.value) : null)}
                min="1"
                max="20"
                placeholder="Min (auto)"
                className="speaker-hint-input"
              />
              <input
                type="number"
                value={maxSpeakers ?? ''}
                onChange={(e) => setMaxSpeakers(e.target.value ? parseInt(e.target.value) : null)}
                min="1"
                max="20"
                placeholder="Max (auto)"
                className="speaker-hint-input"
              />
            </div>
            <span className="speaker-hints-hint">Helps with video call audio where auto-detection struggles.</span>
          </div>
        )}
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