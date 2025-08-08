// Debug Utilities for YouTube AI Article Generator
// Comprehensive logging and testing framework

// Global log storage for extension
window.ExtensionLogs = window.ExtensionLogs || {
  logs: [],
  maxLogs: 1000, // Keep only last 1000 logs
  
  add(level, component, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component,
      message,
      data: data ? JSON.stringify(data) : null
    };
    
    this.logs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Also store in chrome.storage for persistence
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ extensionLogs: this.logs }).catch(() => {
        // Ignore storage errors
      });
    }
  },
  
  get() {
    return this.logs;
  },
  
  clear() {
    this.logs = [];
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove('extensionLogs').catch(() => {
        // Ignore storage errors
      });
    }
  },
  
  async load() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get('extensionLogs');
        if (result.extensionLogs && Array.isArray(result.extensionLogs)) {
          this.logs = result.extensionLogs;
        }
      } catch (error) {
        // Ignore storage errors
      }
    }
  }
};

class DebugLogger {
  constructor(componentName = 'Extension') {
    this.componentName = componentName;
    this.enabled = true;
    this.logLevel = 'debug'; // debug, info, warn, error
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    // Log levels in order of severity
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.init();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  init() {
    console.log(`🚀 [${this.componentName}] Debug Logger initialized - Session: ${this.sessionId}`);
    this.logSystemInfo();
  }

  logSystemInfo() {
    const info = {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location?.href || 'background',
      sessionId: this.sessionId,
      component: this.componentName
    };
    console.log(`📊 [${this.componentName}] System Info:`, info);
  }

  shouldLog(level) {
    return this.enabled && this.levels[level] >= this.levels[this.logLevel];
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString().slice(11, 23);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const prefix = this.getLevelIcon(level);
    
    return {
      prefix: `${prefix} [${timestamp}|${elapsed}s] [${this.componentName}]`,
      message,
      data,
      metadata: {
        level,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        component: this.componentName,
        elapsed: parseFloat(elapsed)
      }
    };
  }

  getLevelIcon(level) {
    const icons = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    };
    return icons[level] || '📝';
  }

  debug(message, data = null) {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('debug', message, data);
    
    // Store in extension logs
    window.ExtensionLogs.add('debug', this.componentName, message, data);
    
    if (data) {
      console.log(formatted.prefix, formatted.message, data);
    } else {
      console.log(formatted.prefix, formatted.message);
    }
  }

  info(message, data = null) {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('info', message, data);
    
    // Store in extension logs
    window.ExtensionLogs.add('info', this.componentName, message, data);
    
    if (data) {
      console.info(formatted.prefix, formatted.message, data);
    } else {
      console.info(formatted.prefix, formatted.message);
    }
  }

  warn(message, data = null) {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('warn', message, data);
    
    // Store in extension logs
    window.ExtensionLogs.add('warn', this.componentName, message, data);
    
    if (data) {
      console.warn(formatted.prefix, formatted.message, data);
    } else {
      console.warn(formatted.prefix, formatted.message);
    }
  }

  error(message, error = null) {
    if (!this.shouldLog('error')) return;
    const formatted = this.formatMessage('error', message, error);
    
    // Store in extension logs
    window.ExtensionLogs.add('error', this.componentName, message, error);
    
    if (error) {
      console.error(formatted.prefix, formatted.message, error);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } else {
      console.error(formatted.prefix, formatted.message);
    }
  }

  // Performance timing utilities
  time(label) {
    console.time(`⏱️ [${this.componentName}] ${label}`);
  }

  timeEnd(label) {
    console.timeEnd(`⏱️ [${this.componentName}] ${label}`);
  }

  // Test execution wrapper
  async executeTest(testName, testFn) {
    this.info(`🧪 Starting test: ${testName}`);
    const startTime = Date.now();
    
    try {
      this.time(testName);
      const result = await testFn();
      this.timeEnd(testName);
      
      const duration = Date.now() - startTime;
      this.info(`✅ Test passed: ${testName} (${duration}ms)`, result);
      
      return { success: true, result, duration, testName };
    } catch (error) {
      this.timeEnd(testName);
      const duration = Date.now() - startTime;
      this.error(`❌ Test failed: ${testName} (${duration}ms)`, error);
      
      return { success: false, error: error.message, duration, testName };
    }
  }

  // Storage debugging utilities
  async logStorageStatus() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const local = await chrome.storage.local.get(null);
        const size = JSON.stringify(local).length;
        
        this.info('Storage Status:', {
          itemCount: Object.keys(local).length,
          sizeBytes: size,
          sizeKB: (size / 1024).toFixed(2),
          items: Object.keys(local)
        });
      }
    } catch (error) {
      this.error('Failed to get storage status', error);
    }
  }

  // API call debugging
  logApiCall(method, url, requestData, responseData, duration) {
    this.info(`🌐 API Call: ${method} ${url} (${duration}ms)`, {
      request: requestData,
      response: responseData,
      duration
    });
  }

  // Extension state debugging
  logExtensionState(state) {
    this.info('📊 Extension State:', state);
  }

  // Create debug report
  async generateDebugReport() {
    const report = {
      sessionId: this.sessionId,
      component: this.componentName,
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      userAgent: navigator.userAgent,
      url: window.location?.href || 'background'
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const storage = await chrome.storage.local.get(null);
        report.storage = {
          itemCount: Object.keys(storage).length,
          sizeBytes: JSON.stringify(storage).length,
          items: Object.keys(storage)
        };
      }
    } catch (error) {
      report.storageError = error.message;
    }

    return report;
  }
}

// Test data templates
class TestDataTemplates {
  static getTestYouTubeUrls() {
    return {
      // Public videos with transcripts for testing
      withTranscript: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll (has auto-captions)
        'https://www.youtube.com/watch?v=9bZkp7q19f0', // Gangnam Style
        'https://www.youtube.com/watch?v=kJQP7kiw5Fk'  // DeepMind Go
      ],
      // Educational content (likely to have good transcripts)
      educational: [
        'https://www.youtube.com/watch?v=aircAruvnKk', // 3Blue1Brown
        'https://www.youtube.com/watch?v=WXuK6gekU1Y', // Khan Academy
        'https://www.youtube.com/watch?v=R9OHn5ZF4Uo'  // Veritasium
      ],
      // Live content or videos that might not have transcripts
      problematic: [
        'https://www.youtube.com/watch?v=5qap5aO4i9A', // Live stream
        'https://www.youtube.com/watch?v=jNQXAC9IVRw'  // Music video
      ]
    };
  }

  static getMockTranscriptData() {
    return {
      short: {
        url: 'https://www.youtube.com/watch?v=test123',
        title: 'Short Test Video',
        timestamp: new Date().toISOString(),
        segments: [
          { timestamp: '0:00', text: 'Welcome to this short test video.' },
          { timestamp: '0:05', text: 'This is just a brief example.' },
          { timestamp: '0:10', text: 'Thank you for watching.' }
        ]
      },
      medium: {
        url: 'https://www.youtube.com/watch?v=test456',
        title: 'Medium Length Test Video',
        timestamp: new Date().toISOString(),
        segments: Array.from({ length: 50 }, (_, i) => ({
          timestamp: `${Math.floor(i * 5 / 60)}:${String(i * 5 % 60).padStart(2, '0')}`,
          text: `This is transcript segment number ${i + 1}. It contains some meaningful content about the topic being discussed.`
        }))
      },
      long: {
        url: 'https://www.youtube.com/watch?v=test789',
        title: 'Long Test Video with Extensive Content',
        timestamp: new Date().toISOString(),
        segments: Array.from({ length: 500 }, (_, i) => ({
          timestamp: `${Math.floor(i * 3 / 60)}:${String(i * 3 % 60).padStart(2, '0')}`,
          text: `Detailed transcript segment ${i + 1}. This segment discusses important concepts and provides comprehensive information about the subject matter. The content is rich and informative, suitable for testing longer transcripts.`
        }))
      }
    };
  }

  static getMockKeyPoints() {
    return `• Main concept: Understanding the fundamental principles
• Key insight: The relationship between theory and practice
• Important detail: Specific implementation considerations
• Critical point: Potential challenges and solutions
• Conclusion: Summary of key takeaways`;
  }

  static getMockArticle() {
    return `# Test Article Title

## Introduction
This is a test article generated from mock key points and transcript data.

## Main Content
The article covers the essential points extracted from the video transcript.

## Key Insights
- Important concept 1
- Important concept 2
- Important concept 3

## Conclusion
This concludes the test article with key takeaways.`;
  }
}

// Test suite runner
class TestSuite {
  constructor(componentName) {
    this.logger = new DebugLogger(`TestSuite-${componentName}`);
    this.results = [];
  }

  async runTest(testName, testFn) {
    const result = await this.logger.executeTest(testName, testFn);
    this.results.push(result);
    return result;
  }

  async runAllTests(tests) {
    this.logger.info(`🧪 Running ${tests.length} tests`);
    
    for (const test of tests) {
      await this.runTest(test.name, test.fn);
    }

    return this.generateTestReport();
  }

  generateTestReport() {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    const report = {
      summary: {
        total: this.results.length,
        passed,
        failed,
        successRate: ((passed / this.results.length) * 100).toFixed(1) + '%',
        totalDuration: totalDuration + 'ms',
        averageDuration: (totalDuration / this.results.length).toFixed(1) + 'ms'
      },
      results: this.results
    };

    this.logger.info('📊 Test Report:', report);
    return report;
  }
}

// Export utilities
if (typeof window !== 'undefined') {
  window.DebugLogger = DebugLogger;
  window.TestDataTemplates = TestDataTemplates;
  window.TestSuite = TestSuite;
}

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DebugLogger, TestDataTemplates, TestSuite };
}