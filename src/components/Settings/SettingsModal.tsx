import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useElectron } from '../../hooks/useElectron';
import { LLMConfig, AIModel } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useAppContext();
  const {
    getLLMStatus,
    updateLLMConfiguration,
    getAvailableModels,
    getExternalAPIModels,
    testLLMConnection
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

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadModels();
    }
  }, [isOpen]);

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

      if (result && result.success) {
        dispatch({
          type: 'ADD_TOAST',
          payload: {
            id: Date.now().toString(),
            message: 'Settings saved successfully!',
            type: 'success'
          }
        });
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
  }, [formData, updateLLMConfiguration, dispatch, onClose]);

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
                      <label htmlFor="localModelPath">Model Path</label>
                      <div className="select-wrapper">
                        <select
                          id="localModelPath"
                          value={formData.localModelPath || ''}
                          onChange={(e) => handleInputChange('localModelPath', e.target.value)}
                          className="modern-select"
                        >
                          <option value="">Select a model...</option>
                          {availableModels.map((model) => (
                            <option key={model.id} value={model.path}>
                              {model.name} ({model.size})
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
        </div>

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