const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  transcribeFile: (filePath, customName) => ipcRenderer.invoke('transcribe-file', filePath, customName),
  generateSummary: (transcription) => ipcRenderer.invoke('generate-summary', transcription),
  generateInsights: (transcription) => ipcRenderer.invoke('generate-insights', transcription),
  askQuestion: (transcription, question) => ipcRenderer.invoke('ask-question', transcription, question),
  getTranscriptions: () => ipcRenderer.invoke('get-transcriptions'),
  updateTranscriptionName: (folderName, newName) => ipcRenderer.invoke('update-transcription-name', folderName, newName),

  // LLM Management APIs
  initializeLLM: () => ipcRenderer.invoke('initialize-llm'),
  loadTranscriptionIntoContext: (transcription) => ipcRenderer.invoke('load-transcription-into-context', transcription),
  clearLLMContext: () => ipcRenderer.invoke('clear-llm-context'),
  getLLMStatus: () => ipcRenderer.invoke('get-llm-status'),

  // New LLM Configuration APIs
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  getExternalAPIModels: (apiEndpoint, apiKey) => ipcRenderer.invoke('get-external-api-models', apiEndpoint, apiKey),
  testLLMConnection: () => ipcRenderer.invoke('test-llm-connection'),
  updateLLMConfiguration: (config) => ipcRenderer.invoke('update-llm-configuration', config),

  // Streaming APIs
  generateSummaryStream: (transcription, onChunk, onComplete, onError) => {
    const streamId = Math.random().toString(36).substring(7);
    
    // Set up listeners
    ipcRenderer.on(`llm-stream-chunk-${streamId}`, (event, chunk) => {
      onChunk(chunk);
    });
    
    ipcRenderer.on(`llm-stream-complete-${streamId}`, (event, result) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onComplete(result);
    });
    
    ipcRenderer.on(`llm-stream-error-${streamId}`, (event, error) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onError(error);
    });
    
    // Start the streaming
    ipcRenderer.invoke('generate-summary-stream', transcription, streamId);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
    };
  },

  askQuestionStream: (transcription, question, onChunk, onComplete, onError) => {
    const streamId = Math.random().toString(36).substring(7);
    
    // Set up listeners
    ipcRenderer.on(`llm-stream-chunk-${streamId}`, (event, chunk) => {
      onChunk(chunk);
    });
    
    ipcRenderer.on(`llm-stream-complete-${streamId}`, (event, result) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onComplete(result);
    });
    
    ipcRenderer.on(`llm-stream-error-${streamId}`, (event, error) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onError(error);
    });
    
    // Start the streaming
    ipcRenderer.invoke('ask-question-stream', transcription, question, streamId);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
    };
  },

  generateInsightsStream: (transcription, onChunk, onComplete, onError) => {
    const streamId = Math.random().toString(36).substring(7);
    
    // Set up listeners
    ipcRenderer.on(`llm-stream-chunk-${streamId}`, (event, chunk) => {
      onChunk(chunk);
    });
    
    ipcRenderer.on(`llm-stream-complete-${streamId}`, (event, result) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onComplete(result);
    });
    
    ipcRenderer.on(`llm-stream-error-${streamId}`, (event, error) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
      onError(error);
    });
    
    // Start the streaming
    ipcRenderer.invoke('generate-insights-stream', transcription, streamId);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(`llm-stream-chunk-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`llm-stream-error-${streamId}`);
    };
  },

  // User preferences APIs
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  updateUserPreferences: (preferences) => ipcRenderer.invoke('update-user-preferences', preferences),

  // Diarization APIs
  checkDiarizationEnvironment: (backend) => ipcRenderer.invoke('check-diarization-environment', backend),
  getDiarizationConfig: () => ipcRenderer.invoke('get-diarization-config'),
  updateDiarizationConfig: (config) => ipcRenderer.invoke('update-diarization-config', config),

  transcribeFileWithDiarization: (filePath, customName, onProgress, onComplete, onError, speakerHints) => {
    const streamId = Math.random().toString(36).substring(7);

    // Set up listeners
    ipcRenderer.on(`diarization-progress-${streamId}`, (event, message) => {
      onProgress(message);
    });

    ipcRenderer.on(`diarization-complete-${streamId}`, (event, result) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`diarization-progress-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-error-${streamId}`);
      onComplete(result);
    });

    ipcRenderer.on(`diarization-error-${streamId}`, (event, error) => {
      // Clean up listeners
      ipcRenderer.removeAllListeners(`diarization-progress-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-error-${streamId}`);
      onError(error);
    });

    // Start the diarization
    ipcRenderer.invoke('transcribe-file-with-diarization', filePath, customName, streamId, speakerHints);

    // Return cleanup function
    return () => {
      ipcRenderer.removeAllListeners(`diarization-progress-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-complete-${streamId}`);
      ipcRenderer.removeAllListeners(`diarization-error-${streamId}`);
    };
  }
}); 