// Anthropic Claude API Integration for Chrome Extension
class AnthropicAPI {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-5-sonnet-20241022';
    this.maxTokens = 4000;
    
    // Load API key from storage
    this.loadApiKey();
  }

  // Load API key from Chrome storage
  async loadApiKey() {
    try {
      const result = await chrome.storage.local.get(['anthropic_api_key']);
      this.apiKey = result.anthropic_api_key || null;
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  // Save API key to Chrome storage
  async saveApiKey(apiKey) {
    try {
      await chrome.storage.local.set({ anthropic_api_key: apiKey });
      this.apiKey = apiKey;
      return true;
    } catch (error) {
      console.error('Error saving API key:', error);
      return false;
    }
  }

  // Clear API key from storage
  async clearApiKey() {
    try {
      await chrome.storage.local.remove(['anthropic_api_key']);
      this.apiKey = null;
      return true;
    } catch (error) {
      console.error('Error clearing API key:', error);
      return false;
    }
  }

  // Validate API key format
  isValidApiKey(apiKey) {
    return apiKey && apiKey.startsWith('sk-ant-') && apiKey.length > 20;
  }

  // Test API key by making a simple request
  async testApiKey(apiKey = null) {
    const testKey = apiKey || this.apiKey;
    if (!this.isValidApiKey(testKey)) {
      throw new Error('Invalid API key format');
    }

    try {
      const response = await this.makeRequest(testKey, [
        {
          role: 'user',
          content: 'Hello! Please respond with just "API key is working" to confirm the connection.'
        }
      ], 50);

      if (response && response.content && response.content[0]?.text) {
        return true;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      if (error.message.includes('401')) {
        throw new Error('Invalid API key - authentication failed');
      } else if (error.message.includes('403')) {
        throw new Error('API key does not have required permissions');
      } else if (error.message.includes('429')) {
        throw new Error('Rate limit exceeded - please try again later');
      } else {
        throw error;
      }
    }
  }

  // Make API request to Claude with retry logic
  async makeRequest(apiKey, messages, maxTokens = null, retryCount = 0) {
    if (!this.isValidApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    const requestBody = {
      model: this.model,
      max_tokens: maxTokens || this.maxTokens,
      messages: messages
    };

    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error cases
        if (response.status === 529 && retryCount < maxRetries) {
          // API overloaded - retry with exponential backoff
          const delay = baseDelay * Math.pow(2, retryCount);
          console.log(`API overloaded, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(apiKey, messages, maxTokens, retryCount + 1);
        }
        
        if (response.status === 429 && retryCount < maxRetries) {
          // Rate limited - retry with longer delay
          const delay = baseDelay * Math.pow(2, retryCount + 1);
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(apiKey, messages, maxTokens, retryCount + 1);
        }

        // Create user-friendly error messages
        let userMessage = `API request failed: ${response.status} ${response.statusText}`;
        
        if (response.status === 529) {
          userMessage = 'Anthropic API is currently overloaded. Please try again in a few minutes.';
        } else if (response.status === 429) {
          userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (response.status === 401) {
          userMessage = 'Invalid API key. Please check your Anthropic API key in settings.';
        } else if (response.status === 403) {
          userMessage = 'API access denied. Please check your API key permissions.';
        } else if (response.status >= 500) {
          userMessage = 'Anthropic API server error. Please try again later.';
        } else if (errorData.error?.message) {
          userMessage = errorData.error.message;
        }

        const error = new Error(userMessage);
        error.status = response.status;
        error.details = errorData;
        error.retryCount = retryCount;
        throw error;
      }

      return await response.json();
      
    } catch (error) {
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      }
      
      // Re-throw API errors as-is
      throw error;
    }
  }

  // Extract key points from transcript
  async extractKeyPoints(transcript) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      throw new Error('No transcript data provided');
    }

    // Combine transcript segments into full text
    const fullText = transcript.segments.map(segment => segment.text).join(' ');
    
    // Check if prompts are loaded
    if (!window.KEY_POINTS_PROMPT) {
      throw new Error('KEY_POINTS_PROMPT is not loaded. Please ensure prompts.js is included and loaded.');
    }

    // Use prompt template with variable replacement
    const prompt = this.replaceTemplateVariables(window.KEY_POINTS_PROMPT, {
      VIDEO_TITLE: transcript.title || 'YouTube Video',
      TRANSCRIPT: fullText
    });

    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.makeRequest(this.apiKey, messages);
      return response.content[0]?.text || 'No key points extracted';
    } catch (error) {
      console.error('Error extracting key points:', error);
      throw error;
    }
  }

  // Generate article from key points
  async generateArticle(keyPoints, transcript) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    if (!keyPoints || !transcript) {
      throw new Error('Key points and transcript data required');
    }

    // Check if prompts are loaded
    if (!window.ARTICLE_GENERATION_PROMPT) {
      throw new Error('ARTICLE_GENERATION_PROMPT is not loaded. Please ensure prompts.js is included and loaded.');
    }

    // Use prompt template with variable replacement
    const prompt = this.replaceTemplateVariables(window.ARTICLE_GENERATION_PROMPT, {
      VIDEO_TITLE: transcript.title || 'YouTube Video',
      KEY_POINTS: keyPoints,
      TRANSCRIPT: transcript.segments.map(segment => segment.text).join(' ')
    });

    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.makeRequest(this.apiKey, messages, 4000);
      return response.content[0]?.text || 'No article generated';
    } catch (error) {
      console.error('Error generating article:', error);
      throw error;
    }
  }

  // Combined method to extract key points and generate article
  async processTranscript(transcript) {
    try {
      // Step 1: Extract key points
      const keyPoints = await this.extractKeyPoints(transcript);
      
      // Step 2: Generate article from key points
      const article = await this.generateArticle(keyPoints, transcript);
      
      return {
        keyPoints,
        article,
        transcript
      };
    } catch (error) {
      console.error('Error processing transcript:', error);
      throw error;
    }
  }

  // Template variable replacement helper
  replaceTemplateVariables(template, variables) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template is undefined or not a string. Make sure prompts.js is loaded.');
    }
    
    let result = template;
    
    // Replace each variable in the template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    return result;
  }

  // Get current model info
  getModelInfo() {
    return {
      model: this.model,
      maxTokens: this.maxTokens,
      hasApiKey: !!this.apiKey,
      apiKeyValid: this.isValidApiKey(this.apiKey)
    };
  }

  // Update model settings
  updateSettings(model = null, maxTokens = null) {
    if (model) this.model = model;
    if (maxTokens) this.maxTokens = maxTokens;
  }
}

// Export for use in other files
window.AnthropicAPI = AnthropicAPI;