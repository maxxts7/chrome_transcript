// Jest Setup for Console Capture and Chrome Extension Testing
require('@testing-library/jest-dom');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'test-logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Global console capture utilities
global.consoleCaptureUtils = {
  logs: [],
  warns: [],
  errors: [],
  logFilePath: null,
  
  // Initialize log file for current test run
  initLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `test-logs-${timestamp}.log`);
    fs.writeFileSync(this.logFilePath, `# Jest Test Log - ${new Date().toISOString()}\n\n`);
  },

  // Stream log entry to file
  streamToFile(method, args, timestamp) {
    if (!this.logFilePath) return;
    
    const logTime = new Date(timestamp).toISOString();
    const logLevel = method.toUpperCase().padEnd(5);
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(' ');
    
    const logEntry = `[${logTime}] ${logLevel} ${message}\n`;
    fs.appendFileSync(this.logFilePath, logEntry);
  },

  // Capture console methods
  captureLogs() {
    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;
    this.originalInfo = console.info;
    this.originalDebug = console.debug;
    
    console.log = (...args) => {
      const timestamp = Date.now();
      this.logs.push({ method: 'log', args, timestamp });
      this.streamToFile('log', args, timestamp);
      this.originalLog(...args);
    };
    
    console.warn = (...args) => {
      const timestamp = Date.now();
      this.warns.push({ method: 'warn', args, timestamp });
      this.streamToFile('warn', args, timestamp);
      this.originalWarn(...args);
    };
    
    console.error = (...args) => {
      const timestamp = Date.now();
      this.errors.push({ method: 'error', args, timestamp });
      this.streamToFile('error', args, timestamp);
      this.originalError(...args);
    };
    
    console.info = (...args) => {
      const timestamp = Date.now();
      this.logs.push({ method: 'info', args, timestamp });
      this.streamToFile('info', args, timestamp);
      this.originalInfo(...args);
    };
    
    console.debug = (...args) => {
      const timestamp = Date.now();
      this.logs.push({ method: 'debug', args, timestamp });
      this.streamToFile('debug', args, timestamp);
      this.originalDebug(...args);
    };
  },
  
  // Restore original console methods
  restoreConsole() {
    if (this.originalLog) console.log = this.originalLog;
    if (this.originalWarn) console.warn = this.originalWarn;
    if (this.originalError) console.error = this.originalError;
    if (this.originalInfo) console.info = this.originalInfo;
    if (this.originalDebug) console.debug = this.originalDebug;
  },
  
  // Clear captured logs
  clearLogs() {
    this.logs = [];
    this.warns = [];
    this.errors = [];
  },
  
  // Get logs by method
  getLogsByMethod(method) {
    switch (method) {
      case 'log':
      case 'info':
      case 'debug':
        return this.logs.filter(log => log.method === method);
      case 'warn':
        return this.warns;
      case 'error':
        return this.errors;
      default:
        return [...this.logs, ...this.warns, ...this.errors];
    }
  },
  
  // Search logs by content
  findLogsContaining(searchText) {
    const allLogs = [...this.logs, ...this.warns, ...this.errors];
    return allLogs.filter(log => 
      log.args.some(arg => 
        String(arg).toLowerCase().includes(searchText.toLowerCase())
      )
    );
  },
  
  // Get formatted log summary
  getLogSummary() {
    return {
      totalLogs: this.logs.length,
      totalWarns: this.warns.length,
      totalErrors: this.errors.length,
      total: this.logs.length + this.warns.length + this.errors.length,
      lastLog: this.logs[this.logs.length - 1] || null,
      lastWarn: this.warns[this.warns.length - 1] || null,
      lastError: this.errors[this.errors.length - 1] || null
    };
  }
};

// Mock Chrome Extension APIs for testing
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getURL: jest.fn(path => `chrome-extension://test-extension/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  scripting: {
    executeScript: jest.fn()
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Mock DOM methods commonly used in extensions
global.document = {
  ...document,
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  getElementById: jest.fn(),
  createElement: jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    }
  }))
};

// Mock window methods
global.window = {
  ...window,
  location: {
    href: 'https://www.youtube.com/watch?v=test',
    hostname: 'www.youtube.com'
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Jest custom matchers for console testing
expect.extend({
  toHaveLoggedMessage(received, expectedMessage) {
    const logs = global.consoleCaptureUtils.getLogsByMethod('log');
    const found = logs.some(log => 
      log.args.some(arg => String(arg).includes(expectedMessage))
    );
    
    return {
      message: () => 
        found 
          ? `Expected not to find log message "${expectedMessage}"`
          : `Expected to find log message "${expectedMessage}" in logs: ${JSON.stringify(logs.map(l => l.args))}`,
      pass: found
    };
  },
  
  toHaveLoggedError(received, expectedError) {
    const errors = global.consoleCaptureUtils.errors;
    const found = errors.some(error => 
      error.args.some(arg => String(arg).includes(expectedError))
    );
    
    return {
      message: () => 
        found 
          ? `Expected not to find error "${expectedError}"`
          : `Expected to find error "${expectedError}" in errors: ${JSON.stringify(errors.map(e => e.args))}`,
      pass: found
    };
  },
  
  toHaveLoggedWarning(received, expectedWarning) {
    const warnings = global.consoleCaptureUtils.warns;
    const found = warnings.some(warn => 
      warn.args.some(arg => String(arg).includes(expectedWarning))
    );
    
    return {
      message: () => 
        found 
          ? `Expected not to find warning "${expectedWarning}"`
          : `Expected to find warning "${expectedWarning}" in warnings: ${JSON.stringify(warnings.map(w => w.args))}`,
      pass: found
    };
  },
  
  toHaveLogCount(received, expectedCount) {
    const summary = global.consoleCaptureUtils.getLogSummary();
    const actualCount = summary.total;
    
    return {
      message: () => 
        `Expected ${expectedCount} logs but got ${actualCount}`,
      pass: actualCount === expectedCount
    };
  }
});

// Initialize log file once at the start
global.consoleCaptureUtils.initLogFile();

// Setup before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Start console capture
  global.consoleCaptureUtils.clearLogs();
  global.consoleCaptureUtils.captureLogs();
  
  // Reset Chrome API mocks with default implementations
  global.chrome.storage.local.get.mockResolvedValue({});
  global.chrome.storage.local.set.mockResolvedValue();
  global.chrome.storage.local.remove.mockResolvedValue();
  global.chrome.runtime.sendMessage.mockResolvedValue({ success: true });
  global.chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://www.youtube.com/watch?v=test' }]);
});

// Cleanup after each test
afterEach(() => {
  // Restore console
  global.consoleCaptureUtils.restoreConsole();
  
  // Log test summary if test failed
  if (expect.getState().currentTestName) {
    const summary = global.consoleCaptureUtils.getLogSummary();
    if (summary.totalErrors > 0) {
      console.log(`Test "${expect.getState().currentTestName}" had ${summary.totalErrors} console errors`);
    }
  }
});

console.log('🧪 Jest setup complete with console capture utilities');