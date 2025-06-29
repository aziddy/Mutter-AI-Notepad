const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  transcribeFile: (filePath) => ipcRenderer.invoke('transcribe-file', filePath),
  generateSummary: (transcription, apiKey) => ipcRenderer.invoke('generate-summary', transcription, apiKey),
  generateInsights: (transcription, apiKey) => ipcRenderer.invoke('generate-insights', transcription, apiKey),
  askQuestion: (transcription, question, apiKey) => ipcRenderer.invoke('ask-question', transcription, question, apiKey),
  getTranscriptions: () => ipcRenderer.invoke('get-transcriptions')
}); 