const path = require("path");
const fs = require('fs');

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
  }

  // Helper method to count tokens in text
  async countTokens(text) {
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
      // Dynamic import for ES module
      const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
      
      // Store the imported classes for use in other methods
      this.LlamaChatSession = LlamaChatSession;
      
      // Model path - using the same path as in testing file
      // const modelPath =
      //  path.join(__dirname, "..", "models", "qwen3-0.6b", "qwen3-0.6b.q8_0.gguf");
      const modelPath = path.join(__dirname, "..", "models", "qwen3-1.7b", "qwen3-1.7b.q4_0.gguf");
      // const modelPath = path.join(__dirname, "..", "models", "qwen3-1.7b", "qwen3-1.7b.q8_0.gguf");
      
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
        // contextSize: 32768,
        threads: 8, // Optimized for M2 Pro (8 performance + 2 efficiency cores)
        useMlock: false,
        useMmap: true,
        gpuLayers: 30,
        useMetal: true,
        // gpuLayers: 0,
        // useMetal: false,
        // batchSize: 1024,
        batchSize: 2048,
      };

      // Test different GPU configurations
      console.log("Testing GPU configuration...");
      const startTime = Date.now();
      
      // Option 1: Conservative GPU usage (try this first)
      // modelConfig.gpuLayers = 20;
      // modelConfig.useMetal = true;
      
      // Option 2: If Option 1 is slow, try CPU only
      // modelConfig.gpuLayers = 0;
      // modelConfig.useMetal = false;
      
      // Option 3: If Option 1 is fast, try more aggressive GPU usage
      // modelConfig.gpuLayers = 35;
      // modelConfig.useMetal = true;
      
      console.log("Model config:", modelConfig);
      
      this.model = await this.llama.loadModel(modelConfig);
      
      const loadTime = Date.now() - startTime;
      console.log(`Model loaded in ${loadTime}ms`);

      this.context = await this.model.createContext();
      this.session = new this.LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      this.isInitialized = true;
      console.log("LLM loaded successfully!");
      return { success: true, message: `LLM initialized successfully in ${loadTime}ms` };
    } catch (error) {
      console.error("Error initializing LLM:", error);
      this.isInitialized = false;
      return { success: false, message: `Failed to initialize LLM: ${error.message}` };
    }
  }

  async loadTranscriptionIntoContext(transcription) {
    if (!this.isInitialized) {
      throw new Error("LLM not initialized. Please initialize the model first.");
    }

    try {
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
    } catch (error) {
      console.error('Error loading transcription into context:', error);
      this.hasTranscriptionLoaded = false;
      throw new Error(`Failed to load transcription: ${error.message}`);
    }
  }

  async clearContext() {
    if (!this.isInitialized) {
      throw new Error("LLM not initialized.");
    }

    try {
      // Simply clear chat history instead of disposing sessions
      // This is more reliable and avoids "No sequences left" errors
      if (this.session) {
        this.session.setChatHistory([]);
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
      modelReady: this.isInitialized && this.session !== null,
      contextReady: this.hasTranscriptionLoaded,
      tokenCounts: this.tokenCounts
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

  // Original methods kept for backward compatibility but now work with loaded context
  async generateSummary(transcription = null) {
    await this.initialize();
    
    // Summary requires transcription to be loaded into context first
    if (!this.hasTranscriptionLoaded) {
      throw new Error("No transcription loaded in context. Please load a transcription into context first using 'Load Transcription into Context' button.");
    }
    
    try {
      // Only use loaded context - never send full transcription to save context space
      const prompt = "Please provide a comprehensive summary of the loaded meeting transcript.";
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`📋 Generating summary (${promptTokens} prompt tokens)`);
      
      const response = await this.session.prompt(prompt);
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Generate Summary", promptTokens, responseTokens);
      
      return response.trim();
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
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`❓ Asking question (${promptTokens} prompt tokens): "${question}"`);
      
      const response = await this.session.prompt(prompt);
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Ask Question", promptTokens, responseTokens);
      
      return response.trim();
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
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`🔍 Generating insights (${promptTokens} prompt tokens)`);
      
      const response = await this.session.prompt(prompt);
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Generate Insights", promptTokens, responseTokens);
      
      return response.trim();
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
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`📋 Generating summary (streaming) (${promptTokens} prompt tokens)`);
      
      let fullResponse = "";
      const response = await this.session.prompt(prompt, {
        onTextChunk: (chunk) => {
          fullResponse += chunk;
          onChunk(chunk);
        }
      });
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Generate Summary (Streaming)", promptTokens, responseTokens);
      
      return response.trim();
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
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`❓ Asking question (streaming) (${promptTokens} prompt tokens): "${question}"`);
      
      let fullResponse = "";
      const response = await this.session.prompt(prompt, {
        onTextChunk: (chunk) => {
          fullResponse += chunk;
          onChunk(chunk);
        }
      });
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Ask Question (Streaming)", promptTokens, responseTokens);
      
      return response.trim();
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
      
      // Count prompt tokens
      const promptTokens = await this.countTokens(prompt);
      console.log(`🔍 Generating insights (streaming) (${promptTokens} prompt tokens)`);
      
      let fullResponse = "";
      const response = await this.session.prompt(prompt, {
        onTextChunk: (chunk) => {
          fullResponse += chunk;
          onChunk(chunk);
        }
      });
      
      // Count response tokens
      const responseTokens = await this.countTokens(response);
      this.logTokenUsage("Generate Insights (Streaming)", promptTokens, responseTokens);
      
      return response.trim();
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
  generateSummary,
  askQuestion,
  generateInsights,
  generateSummaryStream,
  askQuestionStream,
  generateInsightsStream,
  LLMService
}; 