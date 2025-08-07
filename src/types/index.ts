// Core application types
export interface TranscriptionData {
  fileName: string;
  customName?: string;
  content: string;
  jsonData: TranscriptionJsonData | null;
  srtData: string | null;
  createdAt: Date;
  size: number;
  hasJson: boolean;
  hasSrt: boolean;
  folderPath: string;
}

export interface TranscriptionJsonData {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  metadata: TranscriptionMetadata;
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionMetadata {
  originalFile: string;
  transcribedAt: string;
  duration?: number;
  wordCount: number;
  audioSourceFile?: string;
  customName?: string;
}

export interface SRTEntry {
  startTime: number;
  endTime: number;
  text: string;
}

// Audio Player types
export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoaded: boolean;
}

export interface AudioPlayerControls {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

// LLM and AI types
export interface LLMStatus {
  isInitialized: boolean;
  hasTranscriptionLoaded: boolean;
  config: LLMConfig;
}

export interface LLMConfig {
  useLocalModel: boolean;
  selectedModel?: string;
  apiEndpoint?: string;
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  localModelPath?: string;
}

export interface AIModel {
  id: string;
  name: string;
  path?: string;
  size?: string;
  type?: 'local' | 'api';
}

// UI State types
export type TabType = 'text' | 'srt';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  message: string;
  type: ToastType;
  id: string;
}

// Electron API types
export interface ElectronAPI {
  selectFile: () => Promise<string>;
  transcribeFile: (filePath: string, customName?: string) => Promise<{
    transcription: string;
    jsonData: TranscriptionJsonData;
    srt: string;
    savedPath: string;
    jsonPath: string;
    srtPath: string | null;
    fileName: string;
    jsonFileName: string;
    srtFileName: string;
    folderPath: string;
  }>;

  // LLM methods
  initializeLLM: () => Promise<{ success: boolean; message: string }>;
  loadTranscriptionIntoContext: (transcription: string) => Promise<{
    success: boolean;
    message: string;
    acknowledgment?: string;
  }>;
  clearLLMContext: () => Promise<{ success: boolean; message: string }>;
  getLLMStatus: () => Promise<LLMStatus>;
  updateLLMConfiguration: (config: Partial<LLMConfig>) => Promise<void>;
  getAvailableModels: () => Promise<AIModel[]>;
  getExternalAPIModels: (apiEndpoint: string, apiKey: string) => Promise<AIModel[]>;
  testLLMConnection: () => Promise<{ success: boolean; message: string }>;

  // Streaming AI methods
  generateSummaryStream: (
    transcription: string | null,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => () => void; // Returns cleanup function

  generateInsightsStream: (
    transcription: string | null,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => () => void;

  askQuestionStream: (
    transcription: string | null,
    question: string,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void,
    onError: (error: string) => void
  ) => () => void;

  // Transcription management
  getTranscriptions: () => Promise<TranscriptionData[]>;
  updateTranscriptionName: (folderName: string, newName: string) => Promise<{
    success: boolean;
    message: string;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}