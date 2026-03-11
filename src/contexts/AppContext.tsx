import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TranscriptionData, LLMStatus, TabType, ToastMessage, SRTEntry, TranscriptionAIState } from '../types';

// State interface
interface AppState {
  currentTranscription: string;
  currentJsonData: any;
  currentAudioFile: string | null;
  srtEntries: SRTEntry[];
  srtContent: string;
  currentPlayingEntry: SRTEntry | null;
  currentTranscriptionId: string | null; // Track which transcription is currently loaded

  // UI State
  activeTab: TabType;
  showWelcomeScreen: boolean;
  showProgressSection: boolean;
  showResultsSection: boolean;
  showFileInfo: boolean;
  selectedFilePath: string;

  // Transcriptions
  transcriptions: TranscriptionData[];

  // LLM State
  llmStatus: LLMStatus | null;
  // aiResults moved to per-transcription state

  // Toast messages
  toastMessages: ToastMessage[];
}

// Action types
type AppAction =
  | { type: 'SET_CURRENT_TRANSCRIPTION'; payload: { transcription: string; jsonData: any; srtContent?: string; transcriptionId: string } }
  | { type: 'SET_AUDIO_FILE'; payload: string | null }
  | { type: 'SET_SRT_ENTRIES'; payload: SRTEntry[] }
  | { type: 'SET_SRT_CONTENT'; payload: string }
  | { type: 'SET_CURRENT_PLAYING_ENTRY'; payload: SRTEntry | null }
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SHOW_WELCOME_SCREEN' }
  | { type: 'HIDE_WELCOME_SCREEN' }
  | { type: 'SHOW_PROGRESS'; payload: string }
  | { type: 'HIDE_PROGRESS' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'HIDE_RESULTS' }
  | { type: 'SHOW_FILE_INFO'; payload: string }
  | { type: 'HIDE_FILE_INFO' }
  | { type: 'SET_TRANSCRIPTIONS'; payload: TranscriptionData[] }
  | { type: 'SET_LLM_STATUS'; payload: LLMStatus }
  | { type: 'UPDATE_TRANSCRIPTION_AI_STATE'; payload: { transcriptionId: string; aiState: Partial<TranscriptionAIState> } }
  | { type: 'SET_TRANSCRIPTION_CONTEXT'; payload: { transcriptionId: string; hasContext: boolean } }
  | { type: 'SET_TRANSCRIPTION_AI_RESULTS'; payload: { transcriptionId: string; title: string; content: string } }
  | { type: 'HIDE_TRANSCRIPTION_AI_RESULTS'; payload: { transcriptionId: string } }
  | { type: 'SET_SPEAKER_NAMES'; payload: Record<string, string> }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string };

// Initial state
const initialState: AppState = {
  currentTranscription: '',
  currentJsonData: null,
  currentAudioFile: null,
  srtEntries: [],
  srtContent: '',
  currentPlayingEntry: null,
  currentTranscriptionId: null,

  activeTab: 'text',
  showWelcomeScreen: true,
  showProgressSection: false,
  showResultsSection: false,
  showFileInfo: false,
  selectedFilePath: '',

  transcriptions: [],

  llmStatus: null,

  toastMessages: [],
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_TRANSCRIPTION':
      return {
        ...state,
        currentTranscription: action.payload.transcription,
        currentJsonData: action.payload.jsonData,
        srtContent: action.payload.srtContent || '',
        currentTranscriptionId: action.payload.transcriptionId,
      };

    case 'SET_AUDIO_FILE':
      return {
        ...state,
        currentAudioFile: action.payload,
        currentPlayingEntry: null,
      };

    case 'SET_SRT_ENTRIES':
      return {
        ...state,
        srtEntries: action.payload,
      };

    case 'SET_SRT_CONTENT':
      return {
        ...state,
        srtContent: action.payload,
      };

    case 'SET_CURRENT_PLAYING_ENTRY':
      return {
        ...state,
        currentPlayingEntry: action.payload,
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };

    case 'SHOW_WELCOME_SCREEN':
      return {
        ...state,
        showWelcomeScreen: true,
        showFileInfo: false,
        showProgressSection: false,
        showResultsSection: false,
      };

    case 'HIDE_WELCOME_SCREEN':
      return {
        ...state,
        showWelcomeScreen: false,
      };

    case 'SHOW_PROGRESS':
      return {
        ...state,
        showProgressSection: true,
        showFileInfo: false,
        showResultsSection: false,
      };

    case 'HIDE_PROGRESS':
      return {
        ...state,
        showProgressSection: false,
      };

    case 'SHOW_RESULTS':
      return {
        ...state,
        showResultsSection: true,
        showProgressSection: false,
      };

    case 'HIDE_RESULTS':
      return {
        ...state,
        showResultsSection: false,
      };

    case 'SHOW_FILE_INFO':
      return {
        ...state,
        showFileInfo: true,
        showWelcomeScreen: false,
        selectedFilePath: action.payload,
      };

    case 'HIDE_FILE_INFO':
      return {
        ...state,
        showFileInfo: false,
        selectedFilePath: '',
      };

    case 'SET_TRANSCRIPTIONS':
      return {
        ...state,
        transcriptions: action.payload,
      };

    case 'SET_LLM_STATUS':
      return {
        ...state,
        llmStatus: action.payload,
      };

    case 'UPDATE_TRANSCRIPTION_AI_STATE':
      return {
        ...state,
        transcriptions: state.transcriptions.map(transcription =>
          transcription.fileName === action.payload.transcriptionId
            ? {
                ...transcription,
                aiState: {
                  hasContext: false,
                  aiResults: { title: '', content: '', visible: false },
                  ...transcription.aiState,
                  ...action.payload.aiState,
                }
              }
            : transcription
        ),
      };

    case 'SET_TRANSCRIPTION_CONTEXT':
      return {
        ...state,
        transcriptions: state.transcriptions.map(transcription =>
          transcription.fileName === action.payload.transcriptionId
            ? {
                ...transcription,
                aiState: {
                  aiResults: { title: '', content: '', visible: false },
                  ...transcription.aiState,
                  hasContext: action.payload.hasContext,
                  lastContextLoadTime: action.payload.hasContext ? new Date() : transcription.aiState?.lastContextLoadTime,
                }
              }
            : transcription
        ),
      };

    case 'SET_TRANSCRIPTION_AI_RESULTS':
      return {
        ...state,
        transcriptions: state.transcriptions.map(transcription =>
          transcription.fileName === action.payload.transcriptionId
            ? {
                ...transcription,
                aiState: {
                  hasContext: transcription.aiState?.hasContext ?? false,
                  ...transcription.aiState,
                  aiResults: {
                    title: action.payload.title,
                    content: action.payload.content,
                    visible: true,
                  },
                }
              }
            : transcription
        ),
      };

    case 'HIDE_TRANSCRIPTION_AI_RESULTS':
      return {
        ...state,
        transcriptions: state.transcriptions.map(transcription =>
          transcription.fileName === action.payload.transcriptionId
            ? {
                ...transcription,
                aiState: {
                  ...transcription.aiState,
                  hasContext: transcription.aiState?.hasContext || false,
                  aiResults: {
                    ...transcription.aiState?.aiResults,
                    title: transcription.aiState?.aiResults?.title || '',
                    content: transcription.aiState?.aiResults?.content || '',
                    visible: false,
                  },
                }
              }
            : transcription
        ),
      };

    case 'SET_SPEAKER_NAMES':
      return {
        ...state,
        currentJsonData: state.currentJsonData
          ? { ...state.currentJsonData, speakerNames: action.payload }
          : state.currentJsonData,
      };

    case 'ADD_TOAST':
      return {
        ...state,
        toastMessages: [...state.toastMessages, action.payload],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toastMessages: state.toastMessages.filter(toast => toast.id !== action.payload),
      };

    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Helper function to get current transcription's AI state
export function getCurrentTranscriptionAIState(state: AppState): TranscriptionAIState {
  if (!state.currentTranscriptionId) {
    return {
      hasContext: false,
      aiResults: { title: '', content: '', visible: false }
    };
  }

  const transcription = state.transcriptions.find(t => t.fileName === state.currentTranscriptionId);
  return transcription?.aiState || {
    hasContext: false,
    aiResults: { title: '', content: '', visible: false }
  };
}