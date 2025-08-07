import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';

interface APISectionProps {
  onAIResult: (title: string, content: string, isStreaming?: boolean) => void;
  onConfigureClick: () => void;
  onStreamingCancel?: () => void;
}

const APISection: React.FC<APISectionProps> = ({
  onAIResult,
  onConfigureClick,
  onStreamingCancel,
}) => {
  const { state, dispatch } = useAppContext();
  const {
    initializeLLM,
    loadTranscriptionIntoContext,
    clearLLMContext,
    getLLMStatus,
    generateSummaryStream,
    generateInsightsStream,
    askQuestionStream,
  } = useElectron();

  const [llmStatus, setLlmStatus] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
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

  // Connect to API
  const handleConnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      await initializeLLM();
      await loadLLMStatus();
      
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'API connected successfully',
          type: 'success'
        }
      });
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to connect API: ${error}`,
          type: 'error'
        }
      });
    } finally {
      setIsConnecting(false);
    }
  }, [initializeLLM, dispatch, loadLLMStatus]);

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
          onAIResult('API Context Loaded', result.acknowledgment);
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

  const isConfigured = llmStatus?.config?.apiEndpoint && llmStatus?.config?.apiKey;
  const isConnected = llmStatus?.isInitialized && !llmStatus?.config?.useLocalModel;
  const hasContext = llmStatus?.hasTranscriptionLoaded;

  return (
    <div className="ai-section external-ai-section">
      <div className="section-header">
        <h4><i className="fas fa-cloud"></i> External API</h4>
        <div className="section-status">
          <span className={`status-indicator ${isConnected ? 'ready' : ''}`}>
            {isConnected ? 'Connected' : isConfigured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </div>

      <div className="section-content">
        <div className="api-config">
          <div className="api-info">
            <p>Connect to OpenAI, Ollama, or any OpenAI-compatible API</p>
          </div>
          <div className="api-buttons">
            <button
              className="btn btn-outline"
              onClick={onConfigureClick}
            >
              <i className="fas fa-cog"></i>
              Configure API
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={!isConfigured || isConnecting || isConnected}
            >
              <i className={`fas ${isConnecting ? 'fa-spinner fa-spin' : isConnected ? 'fa-check' : 'fa-plug'}`}></i>
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Connect'}
            </button>
          </div>
        </div>

        <div className="api-context-management">
          <button
            className="btn btn-outline"
            onClick={handleLoadContext}
            disabled={!isConfigured || isLoadingContext}
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

        <div className="api-actions">
          <button
            className="btn btn-outline"
            onClick={handleGenerateSummary}
            disabled={!isConfigured || (!state.currentTranscription && !hasContext) || !!streamingCancel}
          >
            <i className="fas fa-list"></i>
            Generate Summary
          </button>
          
          <button
            className="btn btn-outline"
            onClick={handleGenerateInsights}
            disabled={!isConfigured || (!state.currentTranscription && !hasContext) || !!streamingCancel}
          >
            <i className="fas fa-lightbulb"></i>
            Generate Insights
          </button>
        </div>

        <div className="api-question-section">
          <div className="question-input">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask any question (general or about transcription)..."
              disabled={!isConfigured || !!streamingCancel}
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
              disabled={!isConfigured || !question.trim() || !!streamingCancel}
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

export default APISection;