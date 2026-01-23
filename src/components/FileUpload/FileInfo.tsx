import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';

const FileInfo: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { transcribeFile, getTranscriptions } = useElectron();
  const [customName, setCustomName] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const selectedFilePath = state.selectedFilePath;



  const handleTranscribe = async () => {
    if (!selectedFilePath) return;

    try {
      setIsTranscribing(true);
      dispatch({ type: 'SHOW_PROGRESS', payload: 'Initializing transcription...' });

      // Update progress messages
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

      // Set audio file if available
      if (result.jsonData?.metadata?.audioSourceFile) {
        dispatch({ type: 'SET_AUDIO_FILE', payload: result.jsonData.metadata.audioSourceFile });
      }

      dispatch({ type: 'HIDE_PROGRESS' });
      dispatch({ type: 'SHOW_RESULTS' });

      // Clear the selected file since transcription is complete
      dispatch({ type: 'HIDE_FILE_INFO' });

      // Refresh transcriptions list to show the new transcription
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
    } finally {
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