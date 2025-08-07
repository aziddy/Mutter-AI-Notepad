import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';

interface LocalAISectionProps {
  onAIResult: (title: string, content: string, isStreaming?: boolean) => void;
  onStreamingCancel?: () => void;
}

const LocalAISection: React.FC<LocalAISectionProps> = ({
  onAIResult,
  onStreamingCancel,
}) => {
  const { state, dispatch } = useAppContext();
  const {
    initializeLLM,
    updateLLMConfiguration,
    loadTranscriptionIntoContext,
    clearLLMContext,
    getLLMStatus,
    generateSummaryStream,
    generateInsightsStream,
    askQuestionStream,
  } = useElectron();

  const [llmStatus, setLlmStatus] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [question, setQuestion] = useState('');
  const [streamingCancel, setStreamingCancel] = useState<(() => void) | null>(null);

  // Load LLM status
  const loadLLMStatus = useCallback(async () => {
    try {
      const status = await getLLMStatus();
      setLlmStatus(status);
    } catch (error) {
      console.error('Failed to load LLM status:', error);
    }
  }, [getLLMStatus]);

  useEffect(() => {
    loadLLMStatus();
  }, [loadLLMStatus]);

  // Initialize local LLM
  const handleInitialize = useCallback(async () => {
    try {
      setIsInitializing(true);
      // Ensure we are in local model mode before initializing
      await updateLLMConfiguration({ useLocalModel: true });
      const result = await initializeLLM();

      if (result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: result.message,
            type: 'success'
          }
        });
        await loadLLMStatus();
      } else {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: result.message,
            type: 'error'
          }
        });
      }
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to initialize LLM: ${error}`,
          type: 'error'
        }
      });
    } finally {
      setIsInitializing(false);
    }
  }, [initializeLLM, updateLLMConfiguration, dispatch, loadLLMStatus]);

  // Load transcription into context
  const handleLoadContext = useCallback(async () => {
    if (!state.currentTranscription) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'No transcription available. Please transcribe a file first.',
          type: 'error'
        }
      });
      return;
    }

    try {
      setIsLoadingContext(true);
      const result = await loadTranscriptionIntoContext(state.currentTranscription);

      if (result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: result.message,
            type: 'success'
          }
        });

        if (result.acknowledgment) {
          onAIResult('LLM Context Loaded', result.acknowledgment);
        }

        await loadLLMStatus();
      } else {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: 'Failed to load transcription into context',
            type: 'error'
          }
        });
      }
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to load transcription: ${error}`,
          type: 'error'
        }
      });
    } finally {
      setIsLoadingContext(false);
    }
  }, [state.currentTranscription, loadTranscriptionIntoContext, dispatch, onAIResult, loadLLMStatus]);

  // Clear context
  const handleClearContext = useCallback(async () => {
    try {
      const result = await clearLLMContext();

      if (result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: result.message,
            type: 'success'
          }
        });
        await loadLLMStatus();
      } else {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: 'Failed to clear context',
            type: 'error'
          }
        });
      }
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to clear context: ${error}`,
          type: 'error'
        }
      });
    }
  }, [clearLLMContext, dispatch, loadLLMStatus]);

  // Generate summary with streaming
  const handleGenerateSummary = useCallback(async () => {
    if (!state.currentTranscription && !llmStatus?.hasTranscriptionLoaded) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'No transcription available or loaded in context.',
          type: 'error'
        }
      });
      return;
    }

    let streamedContent = '';
    onAIResult('Summary', '', true);

    const cleanup = generateSummaryStream(
      llmStatus?.hasTranscriptionLoaded ? null : state.currentTranscription,
      // onChunk
      (chunk: string) => {
        streamedContent += chunk;
        onAIResult('Summary', streamedContent, true);
      },
      // onComplete
      (result: string) => {
        onAIResult('Summary', result, false);
        setStreamingCancel(null);
      },
      // onError
      (error: string) => {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: `Failed to generate summary: ${error}`,
            type: 'error'
          }
        });
        setStreamingCancel(null);
      }
    );

    setStreamingCancel(() => cleanup);
  }, [state.currentTranscription, llmStatus, generateSummaryStream, onAIResult, dispatch]);

  // Generate insights with streaming
  const handleGenerateInsights = useCallback(async () => {
    if (!state.currentTranscription && !llmStatus?.hasTranscriptionLoaded) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'No transcription available or loaded in context.',
          type: 'error'
        }
      });
      return;
    }

    let streamedContent = '';
    onAIResult('Insights & Analysis', '', true);

    const cleanup = generateInsightsStream(
      llmStatus?.hasTranscriptionLoaded ? null : state.currentTranscription,
      // onChunk
      (chunk: string) => {
        streamedContent += chunk;
        onAIResult('Insights & Analysis', streamedContent, true);
      },
      // onComplete
      (result: string) => {
        onAIResult('Insights & Analysis', result, false);
        setStreamingCancel(null);
      },
      // onError
      (error: string) => {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: `Failed to generate insights: ${error}`,
            type: 'error'
          }
        });
        setStreamingCancel(null);
      }
    );

    setStreamingCancel(() => cleanup);
  }, [state.currentTranscription, llmStatus, generateInsightsStream, onAIResult, dispatch]);

  // Ask question with streaming
  const handleAskQuestion = useCallback(async () => {
    if (!question.trim()) return;
    if (!state.currentTranscription && !llmStatus?.hasTranscriptionLoaded) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'No transcription available or loaded in context.',
          type: 'error'
        }
      });
      return;
    }

    const questionText = question.trim();
    let streamedContent = '';
    onAIResult(`Q: ${questionText}`, '', true);

    const cleanup = askQuestionStream(
      llmStatus?.hasTranscriptionLoaded ? null : state.currentTranscription,
      questionText,
      // onChunk
      (chunk: string) => {
        streamedContent += chunk;
        onAIResult(`Q: ${questionText}`, streamedContent, true);
      },
      // onComplete
      (result: string) => {
        onAIResult(`Q: ${questionText}`, result, false);
        setQuestion('');
        setStreamingCancel(null);
      },
      // onError
      (error: string) => {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: `Failed to answer question: ${error}`,
            type: 'error'
          }
        });
        setStreamingCancel(null);
      }
    );

    setStreamingCancel(() => cleanup);
  }, [question, state.currentTranscription, llmStatus, askQuestionStream, onAIResult, dispatch]);

  // Cancel streaming
  const handleCancelStreaming = useCallback(() => {
    if (streamingCancel) {
      streamingCancel();
      setStreamingCancel(null);
      onStreamingCancel?.();
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Generation cancelled',
          type: 'info'
        }
      });
    }
  }, [streamingCancel, onStreamingCancel, dispatch]);

  const isReady = llmStatus?.isInitialized && llmStatus?.config?.useLocalModel;
  const hasContext = llmStatus?.hasTranscriptionLoaded;

  return (
    <div className="ai-section local-ai-section">
      <div className="section-header">
        <h4><i className="fas fa-desktop"></i> Local Qwen3 Model</h4>
        <div className="section-status">
          <span className={`status-indicator ${isReady ? 'ready' : ''}`}>
            {isReady ? 'Model Ready' : 'Not Loaded'}
          </span>
        </div>
      </div>

      <div className="section-content">
        <div className="model-management">
          <button
            className="btn btn-primary"
            onClick={handleInitialize}
            disabled={isInitializing || isReady}
          >
            <i className={`fas ${isInitializing ? 'fa-spinner fa-spin' : isReady ? 'fa-check' : 'fa-power-off'}`}></i>
            {isInitializing ? 'Loading Model...' : isReady ? 'Model Loaded' : 'Load Local Model'}
          </button>

          <button
            className="btn btn-outline"
            onClick={handleLoadContext}
            disabled={!isReady || isLoadingContext}
          >
            <i className={`fas ${isLoadingContext ? 'fa-spinner fa-spin' : hasContext ? 'fa-check' : 'fa-upload'}`}></i>
            {isLoadingContext ? 'Loading...' : hasContext ? 'Context Loaded' : 'Load Transcription into Context'}
          </button>

          <button
            className="btn btn-outline"
            onClick={handleClearContext}
            disabled={!hasContext}
          >
            <i className="fas fa-trash"></i>
            Clear Context
          </button>
        </div>

        <div className="ai-actions">
          <button
            className="btn btn-outline"
            onClick={handleGenerateSummary}
            disabled={!isReady || (!state.currentTranscription && !hasContext) || !!streamingCancel}
          >
            <i className="fas fa-list"></i>
            Generate Summary
          </button>

          <button
            className="btn btn-outline"
            onClick={handleGenerateInsights}
            disabled={!isReady || (!state.currentTranscription && !hasContext) || !!streamingCancel}
          >
            <i className="fas fa-lightbulb"></i>
            Generate Insights
          </button>
        </div>

        <div className="question-section">
          <div className="question-input">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask any question (general or about transcription)..."
              disabled={!isReady || !!streamingCancel}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAskQuestion();
                }
              }}
            />
            <button
              className="btn btn-outline"
              onClick={handleAskQuestion}
              disabled={!isReady || !question.trim() || !!streamingCancel}
            >
              <i className="fas fa-question"></i>
              Ask
            </button>
          </div>
        </div>

        {streamingCancel && (
          <div className="streaming-controls">
            <button
              className="btn btn-outline btn-small"
              onClick={handleCancelStreaming}
            >
              <i className="fas fa-times"></i>
              Cancel Generation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalAISection;