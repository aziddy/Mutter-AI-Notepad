import React, { useCallback, useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import AudioPlayer from '../Audio/AudioPlayer';
import SRTViewer from './SRTViewer';
import LocalAISection from '../AI/LocalAISection';
import APISection from '../AI/APISection';
import AIResults from '../AI/AIResults';
import { SRTEntry } from '../../types';

interface TranscriptionResultsProps {
  onSettingsClick?: () => void;
}

const TranscriptionResults: React.FC<TranscriptionResultsProps> = ({ onSettingsClick }) => {
  const { state, dispatch } = useAppContext();
  
  // AI Results state
  const [aiResult, setAIResult] = useState<{
    title: string;
    content: string;
    isStreaming: boolean;
  } | null>(null);
  
  // AI tab state
  const [activeAITab, setActiveAITab] = useState<'local' | 'api'>('local');

  const handleCopyTranscription = () => {
    if (!state.currentTranscription) return;

    navigator.clipboard.writeText(state.currentTranscription).then(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Transcription copied to clipboard!',
          type: 'success'
        }
      });
    }).catch(() => {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Failed to copy transcription',
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
    // This will be handled by the AudioPlayer component
    console.log('Jump to SRT entry:', entry);
  }, []);

  // Handle current playing entry change
  const handlePlayingEntryChange = useCallback((entry: SRTEntry | null) => {
    dispatch({ type: 'SET_CURRENT_PLAYING_ENTRY', payload: entry });
  }, [dispatch]);

  // Handle AI results
  const handleAIResult = useCallback((title: string, content: string, isStreaming = false) => {
    setAIResult({ title, content, isStreaming });
  }, []);

  // Handle streaming cancellation
  const handleStreamingCancel = useCallback(() => {
    setAIResult(null);
  }, []);

  // Handle settings modal open
  const handleConfigureClick = useCallback(() => {
    onSettingsClick?.();
  }, [onSettingsClick]);

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
          <div className="transcription-text">
            {state.currentTranscription}
          </div>
        </div>

        <div className={`tab-content ${state.activeTab === 'srt' ? 'active' : ''}`}>
          {/* Audio Player */}
          {state.currentJsonData?.metadata?.audioSourceFile && state.activeTab === 'srt' && (
            <AudioPlayer
              audioSource={state.currentJsonData.metadata.audioSourceFile}
              srtEntries={state.srtEntries}
              onPlayingEntryChange={handlePlayingEntryChange}
            />
          )}
          
          {/* SRT Viewer */}
          <SRTViewer
            srtContent={state.srtContent}
            currentPlayingEntry={state.currentPlayingEntry}
            onEntryClick={handleSRTEntryClick}
          />
        </div>
      </div>

      {/* AI Features */}
      <div className="ai-features">
        <div className="ai-header">
          <h3><i className="fas fa-robot"></i> AI Features</h3>
        </div>
        
        {/* AI Tabs */}
        <div className="ai-tabs transcription-tabs">
          <button
            className={`tab-btn ${activeAITab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveAITab('local')}
          >
            <i className="fas fa-desktop"></i>
            Local Model
          </button>
          <button
            className={`tab-btn ${activeAITab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveAITab('api')}
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
          title={aiResult?.title || ''}
          content={aiResult?.content || ''}
          visible={!!aiResult}
          isStreaming={aiResult?.isStreaming || false}
          onCancel={handleStreamingCancel}
        />
      </div>
    </div>
  );
};

export default TranscriptionResults;