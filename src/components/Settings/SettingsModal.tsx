import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import { LLMConfig, AIModel, DiarizationConfig, DiarizationEnvironmentCheck } from '../../types';
import SpeakerProfileManager from '../SpeakerProfiles/SpeakerProfileManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigurationSaved?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onConfigurationSaved }) => {
  const { dispatch } = useAppContext();
  const {
    getLLMStatus,
    updateLLMConfiguration,
    getAvailableModels,
    getExternalAPIModels,
    testLLMConnection,
    getDiarizationConfig,
    updateDiarizationConfig,
    checkDiarizationEnvironment
  } = useElectron();

  // State
  const [currentConfig, setCurrentConfig] = useState<LLMConfig | null>(null);
  const [formData, setFormData] = useState<Partial<LLMConfig>>({});
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [externalAPIModels, setExternalAPIModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isQueryingModels, setIsQueryingModels] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [modelQueryResult, setModelQueryResult] = useState<{ success: boolean; message: string } | null>(null);

  // Diarization state
  const [diarizationConfig, setDiarizationConfig] = useState<DiarizationConfig | null>(null);
  const [diarizationEnvCheck, setDiarizationEnvCheck] = useState<DiarizationEnvironmentCheck | null>(null);
  const [isCheckingDiarizationEnv, setIsCheckingDiarizationEnv] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadModels();
      loadDiarizationSettings();
    }
  }, [isOpen]);

  const loadDiarizationSettings = async () => {
    try {
      const config = await getDiarizationConfig();
      setDiarizationConfig(config);
      // Check environment for current backend
      const envCheck = await checkDiarizationEnvironment(config.backend);
      setDiarizationEnvCheck(envCheck);
    } catch (error) {
      console.warn('Failed to load diarization settings:', error);
    }
  };

  const handleDiarizationBackendChange = async (backend: 'fluidaudio' | 'pyannote') => {
    setDiarizationConfig(prev => prev ? { ...prev, backend } : { enabled: false, backend, hfToken: '' });
    setIsCheckingDiarizationEnv(true);
    try {
      const envCheck = await checkDiarizationEnvironment(backend);
      setDiarizationEnvCheck(envCheck);
    } catch (error) {
      setDiarizationEnvCheck({ ready: false, message: `Error: ${error}`, details: { backend, whisperReady: false } });
    } finally {
      setIsCheckingDiarizationEnv(false);
    }
  };

  const handleDiarizationHfTokenChange = (hfToken: string) => {
    setDiarizationConfig(prev => prev ? { ...prev, hfToken } : { enabled: false, backend: 'fluidaudio', hfToken });
  };

  const handleCheckDiarizationEnvironment = async () => {
    if (!diarizationConfig) return;
    setIsCheckingDiarizationEnv(true);
    try {
      const envCheck = await checkDiarizationEnvironment(diarizationConfig.backend);
      setDiarizationEnvCheck(envCheck);
    } catch (error) {
      setDiarizationEnvCheck({ ready: false, message: `Error: ${error}`, details: { backend: diarizationConfig.backend, whisperReady: false } });
    } finally {
      setIsCheckingDiarizationEnv(false);
    }
  };

  const loadSettings = async () => {
    try {
      const status = await getLLMStatus();
      setCurrentConfig(status.config);
      setFormData(status.config);
    } catch (error) {
      console.error('Failed to load settings:', error);
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: 'Failed to load settings',
          type: 'error'
        }
      });
    }
  };

  const loadModels = async () => {
    try {
      const models = await getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  // Handle form changes
  const handleInputChange = useCallback((field: keyof LLMConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setTestResult(null); // Clear test result when config changes
    setModelQueryResult(null); // Clear model query result when config changes
    setExternalAPIModels([]); // Clear external API models when config changes
  }, []);

  // Query external API models
  const handleQueryModels = useCallback(async () => {
    if (!formData.apiEndpoint || !formData.apiKey) {
      setModelQueryResult({
        success: false,
        message: 'Please provide API endpoint and key to query available models'
      });
      return;
    }

    setIsQueryingModels(true);
    setModelQueryResult(null);
    setExternalAPIModels([]);

    try {
      const models = await getExternalAPIModels(formData.apiEndpoint, formData.apiKey);
      setExternalAPIModels(models);
      setModelQueryResult({
        success: true,
        message: `Found ${models.length} available models`
      });
    } catch (error) {
      setModelQueryResult({
        success: false,
        message: `Failed to query models: ${error}`
      });
    } finally {
      setIsQueryingModels(false);
    }
  }, [formData.apiEndpoint, formData.apiKey, getExternalAPIModels]);

  // Test connection
  const handleTestConnection = useCallback(async () => {
    if (!formData.useLocalModel && (!formData.apiEndpoint || !formData.apiKey)) {
      setTestResult({
        success: false,
        message: 'Please provide API endpoint and key for external API testing'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Temporarily update configuration for testing
      await updateLLMConfiguration(formData);
      const result = (await testLLMConnection()) as any;
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection test failed: ${error}`
      });
    } finally {
      setIsTesting(false);
    }
  }, [formData, updateLLMConfiguration, testLLMConnection]);

  // Save settings
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = (await updateLLMConfiguration(formData)) as any;

      // Also save diarization config
      if (diarizationConfig) {
        await updateDiarizationConfig(diarizationConfig);
      }

      if (result && result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: result.message || 'Settings saved successfully!',
            type: 'success'
          }
        });
        onConfigurationSaved?.();
        // Emit event to notify other components about configuration change
        window.dispatchEvent(new CustomEvent('llm-configuration-changed'));
        onClose();
      } else {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: (result && result.message) || 'Failed to save settings',
            type: 'error'
          }
        });
      }
    } catch (error) {
      dispatch({
        type: 'ADD_TOAST',
        payload: {
          id: Date.now().toString(),
          message: `Failed to save settings: ${error}`,
          type: 'error'
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, [formData, diarizationConfig, updateLLMConfiguration, updateDiarizationConfig, dispatch, onClose]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setFormData(currentConfig || {});
    setTestResult(null);
    setModelQueryResult(null);
    setExternalAPIModels([]);
  }, [currentConfig]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-content">
            <div className="settings-title">
              <i className="fas fa-cog"></i>
              <h2>AI Settings</h2>
            </div>
            <p className="settings-subtitle">
              Configure your preferred AI engine and connection settings
            </p>
          </div>
          <button className="settings-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {/* Default Engine Selection */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Default AI Engine</h3>
              <p>Choose your preferred AI engine. You can still switch between engines from their respective tabs.</p>
            </div>

            <div className="engine-options">
              {/* Local Model Option */}
              <div className={`engine-option ${formData.useLocalModel === true ? 'selected' : ''}`}>
                <div className="engine-option-header" onClick={() => handleInputChange('useLocalModel', true)}>
                  <div className="engine-radio">
                    <input
                      type="radio"
                      name="modelType"
                      checked={formData.useLocalModel === true}
                      onChange={() => handleInputChange('useLocalModel', true)}
                    />
                    <div className="radio-custom"></div>
                  </div>
                  <div className="engine-info">
                    <div className="engine-icon">
                      <i className="fas fa-desktop"></i>
                    </div>
                    <div className="engine-details">
                      <h4>Local Qwen3 Model</h4>
                      <p>Run AI models locally on your machine</p>
                      <div className="engine-badges">
                        <span className="badge badge-primary">Privacy</span>
                        <span className="badge badge-secondary">Offline</span>
                      </div>
                    </div>
                  </div>
                </div>

                {formData.useLocalModel && (
                  <div className="engine-config">
                    <div className="config-field">
                      <label htmlFor="selectedModel">Local Model</label>
                      <div className="select-wrapper">
                        <select
                          id="selectedModel"
                          value={formData.selectedModel || ''}
                          onChange={(e) => handleInputChange('selectedModel', e.target.value)}
                          className="modern-select"
                        >
                          <option value="">Select a model...</option>
                          {availableModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down select-arrow"></i>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* External API Option */}
              <div className={`engine-option ${formData.useLocalModel === false ? 'selected' : ''}`}>
                <div className="engine-option-header" onClick={() => handleInputChange('useLocalModel', false)}>
                  <div className="engine-radio">
                    <input
                      type="radio"
                      name="modelType"
                      checked={formData.useLocalModel === false}
                      onChange={() => handleInputChange('useLocalModel', false)}
                    />
                    <div className="radio-custom"></div>
                  </div>
                  <div className="engine-info">
                    <div className="engine-icon">
                      <i className="fas fa-cloud"></i>
                    </div>
                    <div className="engine-details">
                      <h4>External API</h4>
                      <p>Connect to OpenAI, Ollama, or any OpenAI-compatible API</p>
                      <div className="engine-badges">
                        <span className="badge badge-primary">Powerful</span>
                        <span className="badge badge-secondary">Latest Models</span>
                      </div>
                    </div>
                  </div>
                </div>

                {formData.useLocalModel === false && (
                  <div className="engine-config">
                    <div className="config-grid">
                      <div className="config-field">
                        <label htmlFor="apiEndpoint">API Endpoint</label>
                        <input
                          type="text"
                          id="apiEndpoint"
                          value={formData.apiEndpoint || ''}
                          onChange={(e) => handleInputChange('apiEndpoint', e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="modern-input"
                        />
                      </div>

                      <div className="config-field">
                        <label htmlFor="apiKey">API Key</label>
                        <div className="input-wrapper">
                          <input
                            type="password"
                            id="apiKey"
                            value={formData.apiKey || ''}
                            onChange={(e) => handleInputChange('apiKey', e.target.value)}
                            placeholder="Enter your API key"
                            className="modern-input"
                          />
                          <i className="fas fa-key input-icon"></i>
                        </div>
                      </div>

                      <div className="config-field">
                        <label htmlFor="modelName">Model Name</label>
                        <input
                          type="text"
                          id="modelName"
                          value={formData.modelName || ''}
                          onChange={(e) => handleInputChange('modelName', e.target.value)}
                          placeholder="gpt-4o-mini"
                          className="modern-input"
                        />
                        <button
                          type="button"
                          className="btn btn-outline query-models-btn"
                          onClick={handleQueryModels}
                          disabled={isQueryingModels || !formData.apiEndpoint || !formData.apiKey}
                        >
                          <i className={`fas ${isQueryingModels ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
                          {isQueryingModels ? 'Querying...' : 'Query Models'}
                        </button>
                      </div>

                      <div className="config-field">
                        <label htmlFor="maxTokens">Max Tokens</label>
                        <input
                          type="number"
                          id="maxTokens"
                          value={formData.maxTokens || 4096}
                          onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value) || 4096)}
                          min="1"
                          max="32000"
                          className="modern-input"
                        />
                      </div>
                    </div>

                    {externalAPIModels.length > 0 && (
                      <div className="model-dropdown">
                        <label>Available Models:</label>
                        <div className="select-wrapper">
                          <select
                            value={formData.modelName || ''}
                            onChange={(e) => handleInputChange('modelName', e.target.value)}
                            className="modern-select"
                          >
                            <option value="">Select a model...</option>
                            {externalAPIModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                          <i className="fas fa-chevron-down select-arrow"></i>
                        </div>
                      </div>
                    )}

                    <div className="config-field">
                      <label htmlFor="temperature">Temperature: <span className="temperature-value">{formData.temperature || 0.7}</span></label>
                      <div className="slider-container">
                        <input
                          type="range"
                          id="temperature"
                          min="0"
                          max="2"
                          step="0.1"
                          value={formData.temperature || 0.7}
                          onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                          className="modern-slider"
                        />
                        <div className="slider-labels">
                          <span>Focused</span>
                          <span>Creative</span>
                        </div>
                      </div>
                    </div>

                    <div className="connection-test">
                      <button
                        className="btn btn-outline test-btn"
                        onClick={handleTestConnection}
                        disabled={isTesting || !formData.apiEndpoint || !formData.apiKey}
                      >
                        <i className={`fas ${isTesting ? 'fa-spinner fa-spin' : 'fa-plug'}`}></i>
                        {isTesting ? 'Testing Connection...' : 'Test Connection'}
                      </button>

                      {testResult && (
                        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                          <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                          <span>{testResult.message}</span>
                        </div>
                      )}

                      {modelQueryResult && (
                        <div className={`test-result ${modelQueryResult.success ? 'success' : 'error'}`}>
                          <i className={`fas ${modelQueryResult.success ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                          <span>{modelQueryResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diarization Settings Section */}
          <div className="settings-section">
            <div className="section-header">
              <h3>Speaker Diarization</h3>
              <p>Configure speaker identification for transcriptions</p>
            </div>

            <div className="diarization-settings">
              <div className="config-field">
                <label htmlFor="diarizationBackend">Diarization Backend</label>
                <div className="select-wrapper">
                  <select
                    id="diarizationBackend"
                    value={diarizationConfig?.backend || 'fluidaudio'}
                    onChange={(e) => handleDiarizationBackendChange(e.target.value as 'fluidaudio' | 'pyannote')}
                    className="modern-select"
                  >
                    <option value="fluidaudio">FluidAudio (Fast, macOS only)</option>
                    <option value="pyannote">Pyannote (Accurate, needs HF token)</option>
                  </select>
                  <i className="fas fa-chevron-down select-arrow"></i>
                </div>
              </div>

              {diarizationConfig?.backend === 'pyannote' && (
                <div className="config-field">
                  <label htmlFor="hfToken">Hugging Face Token</label>
                  <div className="input-wrapper">
                    <input
                      type="password"
                      id="hfToken"
                      value={diarizationConfig?.hfToken || ''}
                      onChange={(e) => handleDiarizationHfTokenChange(e.target.value)}
                      placeholder="hf_..."
                      className="modern-input"
                    />
                    <i className="fas fa-key input-icon"></i>
                  </div>
                  <span className="field-hint">Required for pyannote.audio models</span>
                </div>
              )}

              <div className="config-field">
                <label>Speaker Count Hints</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={diarizationConfig?.minSpeakers ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        setDiarizationConfig(prev => prev ? { ...prev, minSpeakers: val } : null);
                      }}
                      min="1"
                      max="20"
                      placeholder="Min (auto)"
                      className="modern-input"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={diarizationConfig?.maxSpeakers ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        setDiarizationConfig(prev => prev ? { ...prev, maxSpeakers: val } : null);
                      }}
                      min="1"
                      max="20"
                      placeholder="Max (auto)"
                      className="modern-input"
                    />
                  </div>
                </div>
                <span className="field-hint">Hint the expected number of speakers. Helps with video call audio where auto-detection struggles.</span>
              </div>

              <div className="connection-test">
                <button
                  className="btn btn-outline test-btn"
                  onClick={handleCheckDiarizationEnvironment}
                  disabled={isCheckingDiarizationEnv}
                >
                  <i className={`fas ${isCheckingDiarizationEnv ? 'fa-spinner fa-spin' : 'fa-check-circle'}`}></i>
                  {isCheckingDiarizationEnv ? 'Checking...' : 'Check Environment'}
                </button>

                {diarizationEnvCheck && (
                  <div className={`test-result ${diarizationEnvCheck.ready ? 'success' : 'error'}`}>
                    <i className={`fas ${diarizationEnvCheck.ready ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    <span>{diarizationEnvCheck.message}</span>
                  </div>
                )}
              </div>

              {diarizationEnvCheck && !diarizationEnvCheck.ready && (
                <div className="setup-instructions">
                  {diarizationConfig?.backend === 'fluidaudio' ? (
                    <div className="instruction-box">
                      <p><strong>FluidAudio Setup (macOS only):</strong></p>
                      <code>cd scripts/diarization && bash setup-fluidaudio.sh</code>
                    </div>
                  ) : (
                    <div className="instruction-box">
                      <p><strong>Pyannote Setup:</strong></p>
                      <code>cd scripts/diarization && bash setup-pyannote.sh</code>
                      <p className="mt-2">Then add your Hugging Face token above.</p>
                    </div>
                  )}
                </div>
              )}
              <div className="config-field" style={{ marginTop: '12px' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowProfileManager(true)}
                  style={{ width: '100%' }}
                >
                  <i className="fas fa-users"></i>
                  Manage Speaker Profiles
                </button>
                <span className="field-hint">View, rename, merge, or delete speaker voice profiles used for cross-session matching</span>
              </div>
            </div>
          </div>
        </div>

        {/* Speaker Profile Manager */}
        <SpeakerProfileManager
          isOpen={showProfileManager}
          onClose={() => setShowProfileManager(false)}
        />

        {/* Footer */}
        <div className="settings-footer">
          <div className="footer-actions">
            <button
              className="btn btn-outline"
              onClick={handleReset}
            >
              <i className="fas fa-undo"></i>
              Reset
            </button>
            <div className="primary-actions">
              <button
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isLoading}
              >
                <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                {isLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;