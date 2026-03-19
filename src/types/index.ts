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
  // AI-specific state for this transcription
  aiState?: TranscriptionAIState;
}

// AI state specific to each transcription
export interface TranscriptionAIState {
  hasContext: boolean;
  aiResults: {
    title: string;
    content: string;
    visible: boolean;
  };
  lastContextLoadTime?: Date;
}

export interface TranscriptionJsonData {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  metadata: TranscriptionMetadata;
  // Speaker diarization data (optional)
  speakers?: string[];
  speakerSegments?: SpeakerSegment[];
  speakerNames?: Record<string, string>;
  diarizationMetadata?: {
    backend: string;
    processingTimeSeconds: number;
    numSpeakers: number;
  };
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

// Speaker diarization types
export interface DiarizationConfig {
  enabled: boolean;
  backend: 'fluidaudio' | 'pyannote';
  hfToken?: string;
  minSpeakers?: number | null;
  maxSpeakers?: number | null;
}

export interface DiarizationEnvironmentCheck {
  ready: boolean;
  message: string;
  details: {
    backend: string;
    whisperReady: boolean;
    fluidaudioReady?: boolean;
    pyannoteScript?: boolean;
    venvExists?: boolean;
    hfTokenSet?: boolean;
  };
}

export interface SpeakerSegment {
  speaker: string;
  originalSpeaker?: string;
  splitFrom?: string;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface SRTEntryWithSpeaker extends SRTEntry {
  speaker?: string;
  speakerConfidence?: number;
}

// Speaker profile types (cross-session identification)
export interface SpeakerProfile {
  id: string;
  displayName: string;
  centroid: number[];
  sampleCount: number;
  appearances: SpeakerAppearance[];
  createdAt: string;
  updatedAt: string;
}

export interface SpeakerAppearance {
  transcriptionFolder: string;
  speakerId: string;
  matchConfidence: number;
  confirmedByUser: boolean;
}

export interface SpeakerMatchSuggestion {
  transcriptionSpeakerId: string;
  profileId: string;
  profileName: string;
  similarity: number;
}

export interface SpeakerProfilesConfig {
  similarityThreshold: number;
}

export interface EmbeddingChunk {
  chunkIndex: number;
  speakerIndex: number;
  startTime: number;
  endTime: number;
  embedding256: number[];
  rho128: number[];
  cluster: number;
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

export interface UserPreferences {
  preferredAITab: 'local' | 'api';
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
    onError: (error: string) => void,
    speakerHints?: { minSpeakers?: number | null; maxSpeakers?: number | null }
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
  updateSpeakerNames: (folderName: string, speakerNames: Record<string, string>) => Promise<{
    success: boolean;
    message: string;
  }>;
  updateSpeakerSegments: (folderName: string, speakerSegments: SpeakerSegment[]) => Promise<{
    success: boolean;
    message: string;
  }>;

  // Export
  exportTranscription: (content: string, defaultFileName: string) => Promise<{
    success: boolean;
    filePath?: string;
  }>;

  // User preferences management
  getUserPreferences: () => Promise<UserPreferences>;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<{
    success: boolean;
    message: string;
  }>;

  // Speaker profile methods
  getSpeakerProfiles: () => Promise<SpeakerProfile[]>;
  createSpeakerProfile: (data: {
    displayName: string;
    embeddings: EmbeddingChunk[];
    transcriptionFolder: string;
    speakerId: string;
  }) => Promise<SpeakerProfile>;
  updateSpeakerProfile: (id: string, updates: { displayName?: string }) => Promise<{
    success: boolean;
    message: string;
  }>;
  deleteSpeakerProfile: (id: string) => Promise<{ success: boolean; message: string }>;
  mergeSpeakerProfiles: (idA: string, idB: string) => Promise<{
    success: boolean;
    profile?: SpeakerProfile;
    message?: string;
  }>;
  confirmSpeakerMatch: (
    profileId: string,
    transcriptionFolder: string,
    speakerId: string,
    embeddings: EmbeddingChunk[]
  ) => Promise<{ success: boolean; message: string }>;
  getSpeakerProfilesConfig: () => Promise<SpeakerProfilesConfig>;
  updateSpeakerProfilesConfig: (config: Partial<SpeakerProfilesConfig>) => Promise<{
    success: boolean;
    message: string;
  }>;
  getTranscriptionEmbeddings: (folderName: string) => Promise<EmbeddingChunk[] | null>;

  // Diarization methods
  checkDiarizationEnvironment: (backend: string) => Promise<DiarizationEnvironmentCheck>;
  getDiarizationConfig: () => Promise<DiarizationConfig>;
  updateDiarizationConfig: (config: Partial<DiarizationConfig>) => Promise<{
    success: boolean;
    message: string;
  }>;
  transcribeFileWithDiarization: (
    filePath: string,
    customName: string | undefined,
    onProgress: (message: string) => void,
    onComplete: (result: {
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
    }) => void,
    onError: (error: string) => void,
    speakerHints?: { minSpeakers?: number | null; maxSpeakers?: number | null }
  ) => () => void; // Returns cleanup function
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}