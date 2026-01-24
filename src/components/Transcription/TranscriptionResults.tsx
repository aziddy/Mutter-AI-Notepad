import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useAppContext, getCurrentTranscriptionAIState } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import AudioPlayer, { AudioPlayerRef } from '../Audio/AudioPlayer';
import SRTViewer from './SRTViewer';
import LocalAISection from '../AI/LocalAISection';
import APISection from '../AI/APISection';
import AIResults from '../AI/AIResults';
import { SRTEntry } from '../../types';

// Parse SRT content into structured entries
const parseSRTContent = (srtContent: string): SRTEntry[] => {
  if (!srtContent) return [];

  const entries: SRTEntry[] = [];
  const blocks = srtContent.trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length < 3) continue;

    // Skip the sequence number (first line)
    const timeLine = lines[1];
    const textLines = lines.slice(2);

    // Parse time line (format: "00:00:00,000 --> 00:00:00,000")
    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const startTime = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]) + parseFloat(timeMatch[4]) / 1000;
    const endTime = parseFloat(timeMatch[5]) * 3600 + parseFloat(timeMatch[6]) * 60 + parseFloat(timeMatch[7]) + parseFloat(timeMatch[8]) / 1000;
    const text = textLines.join(' ').trim();

    entries.push({ startTime, endTime, text });
  }

  return entries;
};

interface TranscriptionResultsProps {
  onSettingsClick?: () => void;
}

const TranscriptionResults: React.FC<TranscriptionResultsProps> = ({ onSettingsClick }) => {
  const { state, dispatch } = useAppContext();
  const { getUserPreferences, updateUserPreferences } = useElectron();

  // Ref for AudioPlayer to enable seeking from SRT entry clicks
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  // Parse SRT content and populate state when it changes
  useEffect(() => {
    if (state.srtContent) {
      const entries = parseSRTContent(state.srtContent);
      dispatch({ type: 'SET_SRT_ENTRIES', payload: entries });
    } else {
      dispatch({ type: 'SET_SRT_ENTRIES', payload: [] });
    }
  }, [state.srtContent, dispatch]);

  // AI Results state - using local streaming state, but persistent results come from context
  const [streamingResult, setStreamingResult] = useState<{
    title: string;
    content: string;
    isStreaming: boolean;
  } | null>(null);

  // Get current transcription's AI state
  const currentAIState = getCurrentTranscriptionAIState(state);

  // AI tab state
  const [activeAITab, setActiveAITab] = useState<'local' | 'api'>('local');

  // AI panel collapse state
  const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(false);

  // SRT view mode state
  const [srtViewMode, setSrtViewMode] = useState<'segmented' | 'continuous'>('segmented');

  // Text view mode state
  const [textViewMode, setTextViewMode] = useState<'plain' | 'speakers'>('plain');

  // Generate formatted speaker transcript from speakerSegments
  const generateSpeakerTranscript = useCallback(() => {
    const segments = state.currentJsonData?.speakerSegments;
    if (!segments || segments.length === 0) return '';

    const lines: string[] = [];
    let currentSpeaker: string | null = null;
    let currentText: string[] = [];

    for (const segment of segments) {
      const speaker = segment.speaker || 'UNKNOWN';
      if (speaker !== currentSpeaker) {
        if (currentSpeaker && currentText.length > 0) {
          lines.push(`[${currentSpeaker}] ${currentText.join(' ')}`);
        }
        currentSpeaker = speaker;
        currentText = [segment.text.trim()];
      } else {
        currentText.push(segment.text.trim());
      }
    }
    if (currentSpeaker && currentText.length > 0) {
      lines.push(`[${currentSpeaker}] ${currentText.join(' ')}`);
    }
    return lines.join('\n');
  }, [state.currentJsonData?.speakerSegments]);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await getUserPreferences();
        setActiveAITab(preferences.preferredAITab);
      } catch (error) {
        console.warn('Failed to load user preferences:', error);
        // Keep default value
      }
    };

    loadPreferences();
  }, [getUserPreferences]);

  // Handle AI tab change and save preference
  const handleAITabChange = useCallback(async (tab: 'local' | 'api') => {
    setActiveAITab(tab);
    try {
      await updateUserPreferences({ preferredAITab: tab });
    } catch (error) {
      console.warn('Failed to save AI tab preference:', error);
    }
  }, [updateUserPreferences]);

  const handleCopyTranscription = () => {
    let contentToCopy = '';

    // Copy content based on current view
    if (state.activeTab === 'srt') {
      contentToCopy = state.srtContent || '';
    } else if (textViewMode === 'speakers' && state.currentJsonData?.speakerSegments?.length) {
      contentToCopy = generateSpeakerTranscript();
    } else {
      contentToCopy = state.currentTranscription || '';
    }

    if (!contentToCopy) return;

    navigator.clipboard.writeText(contentToCopy).then(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Copied to clipboard!',
          type: 'success'
        }
      });
    }).catch(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Failed to copy',
          type: 'error'
        }
      });
    });
  };

  const handleSaveTranscription = () => {
    dispatch({
      type: 'ADD_TOAST',
      payload: {
        id: Date.now().toString(),
        message: 'Transcription is automatically saved!',
        type: 'info'
      }
    });
  };

  // Handle SRT entry click (jump to time in audio)
  const handleSRTEntryClick = useCallback((entry: SRTEntry) => {
    audioPlayerRef.current?.seekTo(entry.startTime);
  }, []);

  // Handle current playing entry change
  const handlePlayingEntryChange = useCallback((entry: SRTEntry | null) => {
    dispatch({ type: 'SET_CURRENT_PLAYING_ENTRY', payload: entry });
  }, [dispatch]);

  // Handle AI results
  const handleAIResult = useCallback((title: string, content: string, isStreaming = false) => {
    if (isStreaming) {
      // For streaming, use local state
      setStreamingResult({ title, content, isStreaming });
    } else {
      // For completed results, store in per-transcription state
      setStreamingResult(null); // Clear streaming state
      if (state.currentTranscriptionId) {
        dispatch({
          type: 'SET_TRANSCRIPTION_AI_RESULTS',
          payload: {
            transcriptionId: state.currentTranscriptionId,
            title,
            content
          }
        });
      }
    }
  }, [state.currentTranscriptionId, dispatch]);

  // Handle streaming cancellation
  const handleStreamingCancel = useCallback(() => {
    setStreamingResult(null);
  }, []);

  // Handle settings modal open
  const handleConfigureClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

  // Handle AI panel collapse toggle
  const handleToggleAIPanel = useCallback(() => {
    setIsAIPanelCollapsed(!isAIPanelCollapsed);
  }, [isAIPanelCollapsed]);

  return (
    <div className="results-section">
      <div className="results-header">
        <h2>Transcription Results</h2>
        <div className="results-actions">
          <button
            className="btn btn-icon"
            title="Copy to clipboard"
            onClick={handleCopyTranscription}
          >
            <i className="fas fa-copy"></i>
          </button>
          <button
            className="btn btn-icon"
            title="Save to file"
            onClick={handleSaveTranscription}
          >
            <i className="fas fa-save"></i>
          </button>
        </div>
      </div>

      {/* Transcription Metadata */}
      {state.currentJsonData?.metadata && (
        <div className="transcription-metadata">
          <div className="metadata-grid">
            <div className="metadata-item">
              <i className="fas fa-clock"></i>
              <span>
                Duration: {state.currentJsonData.metadata.duration 
                  ? `${Math.floor(state.currentJsonData.metadata.duration / 60)}:${Math.floor(state.currentJsonData.metadata.duration % 60).toString().padStart(2, '0')}`
                  : '--'
                }
              </span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-language"></i>
              <span>Language: {state.currentJsonData.language || 'en'}</span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-file-alt"></i>
              <span>Words: {state.currentJsonData.metadata.wordCount || state.currentTranscription.split(/\s+/).length}</span>
            </div>
            <div className="metadata-item">
              <i className="fas fa-calendar"></i>
              <span>
                Date: {new Date(state.currentJsonData.metadata.transcribedAt).toLocaleDateString()} at {new Date(state.currentJsonData.metadata.transcribedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {state.currentJsonData.metadata.audioSourceFile && (
              <div className="metadata-item">
                <i className="fas fa-music"></i>
                <span>Audio: {state.currentJsonData.metadata.audioSourceFile.split(/[\\/]/).pop()}</span>
              </div>
            )}
            {state.currentJsonData.speakers && state.currentJsonData.speakers.length > 0 && (
              <div className="metadata-item">
                <i className="fas fa-users"></i>
                <span>Speakers: {state.currentJsonData.speakers.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transcription Content */}
      <div className="transcription-content">
        <div className="transcription-tabs">
          <button
            className={`tab-btn ${state.activeTab === 'text' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'text' })}
          >
            <i className="fas fa-align-left"></i>
            Text View
          </button>
          <button
            className={`tab-btn ${state.activeTab === 'srt' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'srt' })}
          >
            <i className="fas fa-closed-captioning"></i>
            SRT View
          </button>
        </div>

        <div className={`tab-content ${state.activeTab === 'text' ? 'active' : ''}`}>
          {/* View mode selector (only when speakers available) */}
          {state.currentJsonData?.speakerSegments && state.currentJsonData.speakerSegments.length > 0 && (
            <div className="text-view-mode-select">
              <label htmlFor="text-view-mode">View:</label>
              <select
                id="text-view-mode"
                value={textViewMode}
                onChange={(e) => setTextViewMode(e.target.value as 'plain' | 'speakers')}
              >
                <option value="plain">Plain Text</option>
                <option value="speakers">Speaker Transcript</option>
              </select>
            </div>
          )}
          <div className="transcription-text">
            {textViewMode === 'speakers' && state.currentJsonData?.speakerSegments && state.currentJsonData.speakerSegments.length > 0
              ? generateSpeakerTranscript()
              : state.currentTranscription
            }
          </div>
        </div>

        <div className={`tab-content ${state.activeTab === 'srt' ? 'active' : ''}`}>
          {/* Audio Player and View Mode Select */}
          <div className="srt-controls">
            {state.currentJsonData?.metadata?.audioSourceFile && state.activeTab === 'srt' && (
              <AudioPlayer
                ref={audioPlayerRef}
                audioSource={state.currentJsonData.metadata.audioSourceFile}
                srtEntries={state.srtEntries}
                onPlayingEntryChange={handlePlayingEntryChange}
              />
            )}
            <div className="srt-view-mode-select">
              <label htmlFor="srt-view-mode">View:</label>
              <select
                id="srt-view-mode"
                value={srtViewMode}
                onChange={(e) => setSrtViewMode(e.target.value as 'segmented' | 'continuous')}
              >
                <option value="segmented">Segmented</option>
                <option value="continuous">Continuous</option>
              </select>
            </div>
          </div>

          {/* SRT Viewer */}
          <SRTViewer
            srtContent={state.srtContent}
            currentPlayingEntry={state.currentPlayingEntry}
            onEntryClick={handleSRTEntryClick}
            viewMode={srtViewMode}
            speakerSegments={state.currentJsonData?.speakerSegments}
          />
        </div>
      </div>

      {/* AI Features */}
      <div className={`ai-features ${isAIPanelCollapsed ? 'collapsed' : ''}`}>
        <div className="ai-header">
          <h3><i className="fas fa-robot"></i> AI Features</h3>
          <button
            className="btn btn-icon ai-collapse-btn"
            onClick={handleToggleAIPanel}
            title={isAIPanelCollapsed ? 'Expand AI Panel' : 'Collapse AI Panel'}
          >
            <i className={`fas ${isAIPanelCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          </button>
        </div>
        {/* Collapsible AI Content */}
        {!isAIPanelCollapsed && (
          <div className="ai-collapsible-content">
            {/* AI Tabs */}
            <div className="ai-tabs transcription-tabs">
              <button
                className={`tab-btn ${activeAITab === 'local' ? 'active' : ''}`}
                onClick={() => handleAITabChange('local')}
              >
                <i className="fas fa-desktop"></i>
                Local Model
              </button>
              <button
                className={`tab-btn ${activeAITab === 'api' ? 'active' : ''}`}
                onClick={() => handleAITabChange('api')}
              >
                <i className="fas fa-cloud"></i>
                External API
              </button>
            </div>

            {/* AI Content */}
            <div className="ai-content">
              <div className={`tab-content ${activeAITab === 'local' ? 'active' : ''}`}>
                {activeAITab === 'local' && (
                  <LocalAISection
                    onAIResult={handleAIResult}
                    onStreamingCancel={handleStreamingCancel}
                  />
                )}
              </div>

              <div className={`tab-content ${activeAITab === 'api' ? 'active' : ''}`}>
                {activeAITab === 'api' && (
                  <APISection
                    onAIResult={handleAIResult}
                    onConfigureClick={handleConfigureClick}
                    onStreamingCancel={handleStreamingCancel}
                  />
                )}
              </div>
            </div>

            {/* AI Results */}
            <AIResults
              title={streamingResult?.title || currentAIState.aiResults.title}
              content={streamingResult?.content || currentAIState.aiResults.content}
              visible={!!streamingResult || currentAIState.aiResults.visible}
              isStreaming={streamingResult?.isStreaming || false}
              onCancel={handleStreamingCancel}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionResults;