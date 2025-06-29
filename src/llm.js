const OpenAI = require('openai');

class LLMService {
  constructor() {
    this.client = null;
  }

  initialize(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateSummary(transcription, apiKey) {
    this.initialize(apiKey);
    
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates concise, well-structured summaries of transcriptions. Focus on key points, main topics, and important details. Format your response with clear sections and bullet points where appropriate."
          },
          {
            role: "user",
            content: `Please provide a comprehensive summary of the following transcription:\n\n${transcription}`
          }
        ],
        max_tokens: 1000, // Output/Response Token Length Limit
        temperature: 0.3 // value good for summaries: Balanced consistency with some flexibility
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async askQuestion(transcription, question, apiKey) {
    this.initialize(apiKey);
    
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that answers questions about transcriptions. Base your answers strictly on the content of the transcription provided. If the information is not available in the transcription, clearly state that."
          },
          {
            role: "user",
            content: `Based on the following transcription, please answer this question: "${question}"\n\nTranscription:\n${transcription}`
          }
        ],
        max_tokens: 800,
        temperature: 0.2
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error answering question:', error);
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  }

  async generateInsights(transcription, apiKey) {
    this.initialize(apiKey);
    
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that analyzes transcriptions and provides insights. Identify key themes, sentiment, action items, and notable patterns. Present your analysis in a clear, structured format."
          },
          {
            role: "user",
            content: `Please analyze this transcription and provide insights:\n\n${transcription}`
          }
        ],
        max_tokens: 1200,
        temperature: 0.4
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new Error(`Failed to generate insights: ${error.message}`);
    }
  }
}

const llmService = new LLMService();

async function generateSummary(transcription, apiKey) {
  return await llmService.generateSummary(transcription, apiKey);
}

async function askQuestion(transcription, question, apiKey) {
  return await llmService.askQuestion(transcription, question, apiKey);
}

async function generateInsights(transcription, apiKey) {
  return await llmService.generateInsights(transcription, apiKey);
}

module.exports = {
  generateSummary,
  askQuestion,
  generateInsights,
  LLMService
}; 