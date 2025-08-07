import { useCallback } from 'react';
import { TranscriptionData, LLMStatus, LLMConfig, AIModel } from '../types';

export const useElectron = () => {
  // File operations
  const selectFile = useCallback(async (): Promise<string> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.selectFile();
  }, []);

  const transcribeFile = useCallback(async (filePath: string, customName?: string) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.transcribeFile(filePath, customName);
  }, []);

  // LLM operations
  const initializeLLM = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.initializeLLM();
  }, []);

  const loadTranscriptionIntoContext = useCallback(async (transcription: string) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.loadTranscriptionIntoContext(transcription);
  }, []);

  const clearLLMContext = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.clearLLMContext();
  }, []);

  const getLLMStatus = useCallback(async (): Promise<LLMStatus> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.getLLMStatus();
  }, []);

  const updateLLMConfiguration = useCallback(async (config: Partial<LLMConfig>) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.updateLLMConfiguration(config);
  }, []);

  const getAvailableModels = useCallback(async (): Promise<AIModel[]> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.getAvailableModels();
  }, []);

  const getExternalAPIModels = useCallback(async (apiEndpoint: string, apiKey: string): Promise<AIModel[]> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.getExternalAPIModels(apiEndpoint, apiKey);
  }, []);

  const testLLMConnection = useCallback(async () => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.testLLMConnection();
  }, []);

  // Streaming AI operations
  const generateSummaryStream = useCallback((
    transcription: string | null,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.generateSummaryStream(transcription, onChunk, onComplete, onError);
  }, []);

  const generateInsightsStream = useCallback((
    transcription: string | null,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.generateInsightsStream(transcription, onChunk, onComplete, onError);
  }, []);

  const askQuestionStream = useCallback((
    transcription: string | null,
    question: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.askQuestionStream(transcription, question, onChunk, onComplete, onError);
  }, []);

  // Transcription management
  const getTranscriptions = useCallback(async (): Promise<TranscriptionData[]> => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.getTranscriptions();
  }, []);

  const updateTranscriptionName = useCallback(async (folderName: string, newName: string) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.updateTranscriptionName(folderName, newName);
  }, []);

  return {
    // File operations
    selectFile,
    transcribeFile,

    // LLM operations
    initializeLLM,
    loadTranscriptionIntoContext,
    clearLLMContext,
    getLLMStatus,
    updateLLMConfiguration,
    getAvailableModels,
    getExternalAPIModels,
    testLLMConnection,

    // Streaming AI operations
    generateSummaryStream,
    generateInsightsStream,
    askQuestionStream,

    // Transcription management
    getTranscriptions,
    updateTranscriptionName,
  };
};