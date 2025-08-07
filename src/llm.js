const path = require("path");
const fs = require('fs');
const OpenAI = require('openai');

class LLMService {
  constructor() {
    this.llama = null;
    this.model = null;
    this.context = null;
    this.session = null;
    this.LlamaChatSession = null; // Store the imported class
    this.isInitialized = false;
    this.hasTranscriptionLoaded = false;
    this.currentTranscription = null;
    this.tokenCounts = {
      contextTokens: 0,
      promptTokens: 0,
      responseTokens: 0,
      totalTokens: 0
    };
    
    // New properties for API configuration
    this.apiClient = null;
    this.apiConfig = {
      useLocalModel: true,
      apiEndpoint: '',
      apiKey: '',
      selectedModel: '',
      availableModels: []
    };
    
    // Load saved configuration
    this.loadConfiguration();
  }

  // Configuration management
  loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'llm-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.apiConfig = { ...this.apiConfig, ...config };
      }
    } catch (error) {
      console.warn('Failed to load LLM configuration:', error);
    }
  }

  saveConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'llm-config.json');
      fs.writeFileSync(configPath, JSON.stringify(this.apiConfig, null, 2));
    } catch (error) {
      console.error('Failed to save LLM configuration:', error);
    }
  }

  updateConfiguration(newConfig) {
    this.apiConfig = { ...this.apiConfig, ...newConfig };
    this.saveConfiguration();
    
    // Reset initialization if configuration changed
    if (this.isInitialized) {
      this.cleanup();
    }
    
    return { success: true, message: 'Configuration updated successfully' };
  }

  async getAvailableModels() {
    if (!this.apiConfig.useLocalModel && this.apiConfig.apiEndpoint && this.apiConfig.apiKey) {
      try {
        if (!this.apiClient) {
          this.apiClient = new OpenAI({
            baseURL: this.apiConfig.apiEndpoint,
            apiKey: this.apiConfig.apiKey,
            dangerouslyAllowBrowser: true
          });
        }
        
        const models = await this.apiClient.models.list();
        return models.data.map(model => ({
          id: model.id,
          name: model.id,
          type: 'api'
        }));
      } catch (error) {
        console.error('Failed to fetch available models:', error);
        return [];
      }
    } else {
      // Return local model options
      return [
        { id: 'qwen3-1.7b-q4_0', name: 'Qwen3 1.7B (Q4_0)', type: 'local' },
        { id: 'qwen3-1.7b-q8_0', name: 'Qwen3 1.7B (Q8_0)', type: 'local' },
        { id: 'qwen3-0.6b-q8_0', name: 'Qwen3 0.6B (Q8_0)', type: 'local' }
      ];
    }
  }

  async getExternalAPIModels(apiEndpoint, apiKey) {
    if (!apiEndpoint || !apiKey) {
      throw new Error('API endpoint and key are required');
    }

    try {
      const client = new OpenAI({
        baseURL: apiEndpoint,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
      
      const models = await client.models.list();
      return models.data.map(model => ({
        id: model.id,
        name: model.id,
        type: 'api'
      }));
    } catch (error) {
      console.error('Failed to fetch external API models:', error);
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
  }

  async testConnection() {
    if (this.apiConfig.useLocalModel) {
      return { success: true, message: 'Local model configuration is valid' };
    }

    if (!this.apiConfig.apiEndpoint || !this.apiConfig.apiKey) {
      return { success: false, message: 'API endpoint and key are required' };
    }

    try {
      const client = new OpenAI({
        baseURL: this.apiConfig.apiEndpoint,
        apiKey: this.apiConfig.apiKey,
        dangerouslyAllowBrowser: true
      });

      // Test by fetching models endpoint (should return 200)
      const models = await client.models.list();
      
      return { 
        success: true, 
        message: `Connection successful - Found ${models.data.length} models`,
        modelCount: models.data.length
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Connection failed: ${error.message}` 
      };
    }
  }

  cleanup() {
    this.isInitialized = false;
    this.hasTranscriptionLoaded = false;
    this.currentTranscription = null;
    this.apiClient = null;
    
    // Clean up local model resources
    if (this.session) {
      try {
        this.session.setChatHistory([]);
      } catch (error) {
        console.warn('Error cleaning up session:', error);
      }
    }
    
    if (this.context) {
      try {
        this.context.dispose();
      } catch (error) {
        console.warn('Error disposing context:', error);
      }
    }
    
    this.session = null;
    this.context = null;
    this.model = null;
  }

  // Helper method to count tokens in text
  async countTokens(text) {
    if (this.apiConfig.useLocalModel) {
      if (!this.model) {
        console.warn("Model not initialized, cannot count tokens");
        return 0;
      }
      try {
        const tokens = await this.model.tokenize(text);
        return tokens.length;
      } catch (error) {
        console.warn("Error counting tokens:", error);
        return 0;
      }
    } else {
      // For API models, use a rough estimation (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  // Helper method to log token usage
  logTokenUsage(operation, inputTokens, outputTokens = 0) {
    const totalTokens = inputTokens + outputTokens;
    this.tokenCounts.promptTokens += inputTokens;
    this.tokenCounts.responseTokens += outputTokens;
    this.tokenCounts.totalTokens += totalTokens;
    
    console.log(`🔢 Token Usage - ${operation}:`);
    console.log(`   Input tokens: ${inputTokens}`);
    console.log(`   Output tokens: ${outputTokens}`);
    console.log(`   Total for operation: ${totalTokens}`);
    console.log(`   Cumulative totals - Prompt: ${this.tokenCounts.promptTokens}, Response: ${this.tokenCounts.responseTokens}, Overall: ${this.tokenCounts.totalTokens}`);
  }

  async initialize() {
    if (this.isInitialized) {
      return { success: true, message: "LLM already initialized" };
    }

    try {
      if (this.apiConfig.useLocalModel) {
        return await this.initializeLocalModel();
      } else {
        return await this.initializeAPIClient();
      }
    } catch (error) {
      console.error("Error initializing LLM:", error);
      this.isInitialized = false;
      return { success: false, message: `Failed to initialize LLM: ${error.message}` };
    }
  }

  async initializeLocalModel() {
    // Dynamic import for ES module
    const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
    
    // Store the imported classes for use in other methods
    this.LlamaChatSession = LlamaChatSession;
    
    // Model path based on selected model
    let modelPath;
    switch (this.apiConfig.selectedModel) {
      case 'qwen3-1.7b-q8_0':
        modelPath = path.join(__dirname, "..", "models", "qwen3-1.7b", "qwen3-1.7b.q8_0.gguf");
        break;
      case 'qwen3-0.6b-q8_0':
        modelPath = path.join(__dirname, "..", "models", "qwen3-0.6b", "qwen3-0.6b.q8_0.gguf");
        break;
      default:
        modelPath = path.join(__dirname, "..", "models", "qwen3-1.7b", "qwen3-1.7b.q4_0.gguf");
    }
    
    console.log("Model path:", modelPath);

    // Check if model file exists
    if (!fs.existsSync(modelPath)) {
      console.error("Model file not found at:", modelPath);
      console.log("Available files in models directory:");
      const modelsDir = path.join(__dirname, "..", "models");
      if (fs.existsSync(modelsDir)) {
        console.log(fs.readdirSync(modelsDir, { recursive: true }));
      }
      throw new Error("Qwen3 model file not found. Please ensure the model is downloaded.");
    }

    console.log("Model file found, initializing LLM...");

    // Initialize the LLM with node-llama-cpp
    this.llama = await getLlama();
    
    // Try different GPU configurations for M2 Pro
    const modelConfig = {
      temperature: 0.3,
      modelPath: modelPath,
      contextSize: 16384,
      threads: 8, // Optimized for M2 Pro (8 performance + 2 efficiency cores)
      useMlock: false,
      useMmap: true,
      gpuLayers: 30,
      useMetal: true,
      batchSize: 2048,
    };

    console.log("Model config:", modelConfig);
    
    const startTime = Date.now();
    this.model = await this.llama.loadModel(modelConfig);
    
    const loadTime = Date.now() - startTime;
    console.log(`Model loaded in ${loadTime}ms`);

    this.context = await this.model.createContext();
    this.session = new this.LlamaChatSession({
      contextSequence: this.context.getSequence()
    });

    this.isInitialized = true;
    console.log("Local LLM loaded successfully!");
    return { success: true, message: `Local LLM initialized successfully in ${loadTime}ms` };
  }

  async initializeAPIClient() {
    if (!this.apiConfig.apiEndpoint || !this.apiConfig.apiKey) {
      throw new Error("API endpoint and key are required for API mode");
    }

    // Test connection to verify the endpoint is valid
    const testResult = await this.testConnection();
    if (!testResult.success) {
      throw new Error(testResult.message);
    }

    this.apiClient = new OpenAI({
      baseURL: this.apiConfig.apiEndpoint,
      apiKey: this.apiConfig.apiKey,
      dangerouslyAllowBrowser: true
    });

    this.isInitialized = true;
    console.log("API client initialized successfully!");
    return { success: true, message: "API client initialized successfully" };
  }

  async loadTranscriptionIntoContext(transcription) {
    if (!this.isInitialized) {
      throw new Error("LLM not initialized. Please initialize the model first.");
    }

    try {
      if (this.apiConfig.useLocalModel) {
        return await this.loadTranscriptionIntoLocalContext(transcription);
      } else {
        return await this.loadTranscriptionIntoAPIContext(transcription);
      }
    } catch (error) {
      console.error('Error loading transcription into context:', error);
      this.hasTranscriptionLoaded = false;
      throw new Error(`Failed to load transcription: ${error.message}`);
    }
  }

  async loadTranscriptionIntoLocalContext(transcription) {
    // Instead of disposing and recreating, just clear the chat history
    // This is more reliable and avoids "No sequences left" errors
    if (this.session) {
      this.session.setChatHistory([]);
    } else {
      // Create initial session if it doesn't exist
      this.session = new this.LlamaChatSession({
        contextSequence: this.context.getSequence()
      });
    }

    // Load transcription into context with a system-like message
    const contextMessage = `Here is a meeting transcript context:\n\n${transcription}`;
    
    // Count tokens for context loading
    const contextTokens = await this.countTokens(contextMessage);
    console.log(`📝 Loading transcription into context (${contextTokens} tokens)`);
    
    const acknowledgment = await this.session.prompt(contextMessage);
    
    // Count response tokens
    const responseTokens = await this.countTokens(acknowledgment);
    this.logTokenUsage("Load Transcription Context", contextTokens, responseTokens);
    
    this.currentTranscription = transcription;
    this.hasTranscriptionLoaded = true;
    this.tokenCounts.contextTokens = contextTokens;
    
    console.log("Transcription loaded into LLM context");
    return { success: true, message: "Transcription loaded successfully", acknowledgment };
  }

  async loadTranscriptionIntoAPIContext(transcription) {
    // For API models, we'll store the transcription in memory
    // and include it in prompts as needed
    this.currentTranscription = transcription;
    this.hasTranscriptionLoaded = true;
    
    // Count tokens for context loading
    const contextTokens = await this.countTokens(transcription);
    this.tokenCounts.contextTokens = contextTokens;
    
    console.log(`📝 Transcription stored for API context (${contextTokens} tokens)`);
    return { 
      success: true, 
      message: "Transcription loaded successfully", 
      acknowledgment: "Transcription context loaded and ready for queries." 
    };
  }

  async clearContext() {
    if (!this.isInitialized) {
      throw new Error("LLM not initialized.");
    }

    try {
      if (this.apiConfig.useLocalModel) {
        // Simply clear chat history instead of disposing sessions
        if (this.session) {
          this.session.setChatHistory([]);
        }
      }

      this.hasTranscriptionLoaded = false;
      this.currentTranscription = null;
      
      // Reset token counts when clearing context
      this.tokenCounts = {
        contextTokens: 0,
        promptTokens: 0,
        responseTokens: 0,
        totalTokens: 0
      };
      
      console.log("LLM context cleared and token counts reset");
      return { success: true, message: "Context cleared successfully" };
    } catch (error) {
      console.error('Error clearing context:', error);
      throw new Error(`Failed to clear context: ${error.message}`);
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasTranscriptionLoaded: this.hasTranscriptionLoaded,
      modelReady: this.isInitialized && (this.session !== null || this.apiClient !== null),
      contextReady: this.hasTranscriptionLoaded,
      tokenCounts: this.tokenCounts,
      config: this.apiConfig
    };
  }

  getTokenStats() {
    return {
      ...this.tokenCounts,
      averageTokensPerPrompt: this.tokenCounts.promptTokens > 0 ? 
        (this.tokenCounts.totalTokens / this.tokenCounts.promptTokens).toFixed(2) : 0,
      contextUtilization: this.tokenCounts.contextTokens > 0 ? 
        `${this.tokenCounts.contextTokens} tokens loaded` : "No context loaded"
    };
  }

  // Generic prompt method that works with both local and API models
  async prompt(promptText, options = {}) {
    if (!this.isInitialized) {
      throw new Error("LLM not initialized");
    }

    if (this.apiConfig.useLocalModel) {
      return await this.localPrompt(promptText, options);
    } else {
      return await this.apiPrompt(promptText, options);
    }
  }

  async localPrompt(promptText, options = {}) {
    const promptTokens = await this.countTokens(promptText);
    console.log(`🤖 Local prompt (${promptTokens} tokens): "${promptText.substring(0, 100)}..."`);
    
    let response;
    if (options.onTextChunk) {
      // For streaming, we'll need to implement chunking for local model
      response = await this.session.prompt(promptText);
      // For now, just call the chunk callback once with the full response
      options.onTextChunk(response);
    } else {
      response = await this.session.prompt(promptText);
    }
    
    const responseTokens = await this.countTokens(response);
    this.logTokenUsage("Local Prompt", promptTokens, responseTokens);
    
    return response.trim();
  }

  async apiPrompt(promptText, options = {}) {
    const promptTokens = await this.countTokens(promptText);
    console.log(`🌐 API prompt (${promptTokens} tokens): "${promptText.substring(0, 100)}..."`);
    
    try {
      // For API models, if we have transcription context, include it in the system message
      let messages = [];
      
      if (this.hasTranscriptionLoaded && this.currentTranscription) {
        // Add system message with transcription context
        messages.push({
          role: 'system',
          content: `You have access to the following meeting transcript context:\n\n${this.currentTranscription}\n\nPlease use this context to answer questions and provide analysis.`
        });
      }
      
      // Add user message
      messages.push({ role: 'user', content: promptText });
      
      if (options.onTextChunk) {
        // Streaming response
        const stream = await this.apiClient.chat.completions.create({
          model: this.apiConfig.selectedModel,
          messages: messages,
          stream: true,
          temperature: 0.3,
          max_tokens: 2000
        });

        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            options.onTextChunk(content);
          }
        }
        
        const responseTokens = await this.countTokens(fullResponse);
        this.logTokenUsage("API Prompt (Streaming)", promptTokens, responseTokens);
        
        return fullResponse.trim();
      } else {
        // Non-streaming response
        const completion = await this.apiClient.chat.completions.create({
          model: this.apiConfig.selectedModel,
          messages: messages,
          temperature: 0.3,
          max_tokens: 2000
        });

        const response = completion.choices[0].message.content;
        const responseTokens = await this.countTokens(response);
        this.logTokenUsage("API Prompt", promptTokens, responseTokens);
        
        return response.trim();
      }
    } catch (error) {
      console.error('API prompt error:', error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  // Original methods kept for backward compatibility but now work with both local and API
  async generateSummary(transcription = null) {
    await this.initialize();
    
    // Summary requires transcription to be loaded into context first
    if (!this.hasTranscriptionLoaded) {
      throw new Error("No transcription loaded in context. Please load a transcription into context first using 'Load Transcription into Context' button.");
    }
    
    try {
      // Only use loaded context - never send full transcription to save context space
      const prompt = "Please provide a comprehensive summary of the loaded meeting transcript.";
      
      return await this.prompt(prompt);
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async askQuestion(question, transcription = null) {
    await this.initialize();
    
    // Allow general questions even without transcription loaded
    // Only require transcription if user is trying to ask about a specific transcript
    
    try {
      let prompt;
      if (this.hasTranscriptionLoaded) {
        prompt = `Based on the loaded meeting transcript, answer this question: "${question}"`;
      } else {
        // Ask any general question with no context (transcript)
        prompt = question;
      }
      
      return await this.prompt(prompt);
    } catch (error) {
      console.error('Error answering question:', error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }

  async generateInsights(transcription = null) {
    await this.initialize();
    
    // Insights require transcription to be loaded into context first
    if (!this.hasTranscriptionLoaded) {
      throw new Error("No transcription loaded in context. Please load a transcription into context first using 'Load Transcription into Context' button.");
    }
    
    try {
      // Only use loaded context - never send full transcription to save context space
      const prompt = "Analyze the loaded meeting transcript and provide insights about key themes, sentiment, action items, and notable patterns.";
      
      return await this.prompt(prompt);
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error(`Failed to generate insights: ${error.message}`);
    }
  }

  // Streaming versions of the methods
  async generateSummaryStream(onChunk, transcription = null) {
    await this.initialize();
    
    // Summary requires transcription to be loaded into context first
    if (!this.hasTranscriptionLoaded) {
      throw new Error("No transcription loaded in context. Please load a transcription into context first using 'Load Transcription into Context' button.");
    }
    
    try {
      // Only use loaded context - never send full transcription to save context space
      const prompt = "Please provide a comprehensive summary of the loaded meeting transcript.";
      
      return await this.prompt(prompt, { onTextChunk: onChunk });
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async askQuestionStream(question, onChunk, transcription = null) {
    await this.initialize();
    
    // Allow general questions even without transcription loaded
    // Only require transcription if user is trying to ask about a specific transcript
    
    try {
      let prompt;
      if (this.hasTranscriptionLoaded) {
        prompt = `Based on the loaded meeting transcript, answer this question: "${question}"`;
      } else {
        // Ask any general question with no context (transcript)
        prompt = question;
      }
      
      return await this.prompt(prompt, { onTextChunk: onChunk });
    } catch (error) {
      console.error('Error answering question:', error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }

  async generateInsightsStream(onChunk, transcription = null) {
    await this.initialize();
    
    // Insights require transcription to be loaded into context first
    if (!this.hasTranscriptionLoaded) {
      throw new Error("No transcription loaded in context. Please load a transcription into context first using 'Load Transcription into Context' button.");
    }
    
    try {
      // Only use loaded context - never send full transcription to save context space
      const prompt = "Analyze the loaded meeting transcript and provide insights about key themes, sentiment, action items, and notable patterns.";
      
      return await this.prompt(prompt, { onTextChunk: onChunk });
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error(`Failed to generate insights: ${error.message}`);
    }
  }
}

const llmService = new LLMService();

// Updated wrapper functions
async function initializeLLM() {
  return await llmService.initialize();
}

async function loadTranscriptionIntoContext(transcription) {
  return await llmService.loadTranscriptionIntoContext(transcription);
}

async function clearLLMContext() {
  return await llmService.clearContext();
}

async function getLLMStatus() {
  return llmService.getStatus();
}

async function getLLMTokenStats() {
  return llmService.getTokenStats();
}

async function getAvailableModels() {
  return await llmService.getAvailableModels();
}

async function getExternalAPIModels(apiEndpoint, apiKey) {
  return await llmService.getExternalAPIModels(apiEndpoint, apiKey);
}

async function testConnection() {
  return await llmService.testConnection();
}

async function updateLLMConfiguration(config) {
  try {
    return llmService.updateConfiguration(config);
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function generateSummary(transcription, apiKey) {
  // apiKey parameter is kept for compatibility but not used with local model
  return await llmService.generateSummary(transcription);
}

async function askQuestion(transcription, question, apiKey) {
  // apiKey parameter is kept for compatibility but not used with local model
  return await llmService.askQuestion(question, transcription);
}

async function generateInsights(transcription, apiKey) {
  // apiKey parameter is kept for compatibility but not used with local model
  return await llmService.generateInsights(transcription);
}

// Streaming versions
async function generateSummaryStream(transcription, onChunk, apiKey) {
  return await llmService.generateSummaryStream(onChunk, transcription);
}

async function askQuestionStream(transcription, question, onChunk, apiKey) {
  return await llmService.askQuestionStream(question, onChunk, transcription);
}

async function generateInsightsStream(transcription, onChunk, apiKey) {
  return await llmService.generateInsightsStream(onChunk, transcription);
}

module.exports = {
  initializeLLM,
  loadTranscriptionIntoContext,
  clearLLMContext,
  getLLMStatus,
  getLLMTokenStats,
  getAvailableModels,
  getExternalAPIModels,
  testConnection,
  updateLLMConfiguration,
  generateSummary,
  askQuestion,
  generateInsights,
  generateSummaryStream,
  askQuestionStream,
  generateInsightsStream,
  LLMService
}; 