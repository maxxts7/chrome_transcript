# Jest Console Capture & Debugging Guide

## Overview

This project now includes a comprehensive Jest testing setup with advanced console capture capabilities for debugging Chrome extension code. The setup provides:

- **Full console.log/warn/error capture** during tests
- **Chrome Extension API mocking** for testing background scripts, content scripts, and popup interactions
- **Custom Jest matchers** for testing console output
- **Advanced debugging utilities** integration with existing `DebugLogger`

## Key Features

### 1. Console Capture Utilities

The `consoleCaptureUtils` global object provides:

```javascript
// Capture all console output during tests
global.consoleCaptureUtils.captureLogs();

// Get logs by method type
const logs = global.consoleCaptureUtils.getLogsByMethod('log');
const warnings = global.consoleCaptureUtils.getLogsByMethod('warn');
const errors = global.consoleCaptureUtils.getLogsByMethod('error');

// Search logs containing specific text
const apiLogs = global.consoleCaptureUtils.findLogsContaining('API');

// Get comprehensive summary
const summary = global.consoleCaptureUtils.getLogSummary();
// Returns: { totalLogs: 5, totalWarns: 2, totalErrors: 1, total: 8 }
```

### 2. Custom Jest Matchers

Use these custom matchers to test console output:

```javascript
// Test if a specific message was logged
expect().toHaveLoggedMessage('API call completed');

// Test if an error was logged
expect().toHaveLoggedError('Connection failed');

// Test if a warning was logged
expect().toHaveLoggedWarning('Rate limit exceeded');

// Test total log count
expect().toHaveLogCount(5);
```

### 3. Chrome Extension API Mocking

All Chrome extension APIs are mocked and ready for testing:

```javascript
// Storage operations
chrome.storage.local.set({ key: 'value' });
chrome.storage.local.get('key');

// Runtime messaging
chrome.runtime.sendMessage({ type: 'TEST_MESSAGE' });

// Tab operations
chrome.tabs.query({ url: '*://youtube.com/*' });
chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TRANSCRIPT' });

// All APIs return promises and can be mocked with jest.fn()
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with verbose output
npm run test:debug
```

## Example Test Patterns

### Basic Console Capture

```javascript
describe('My Component', () => {
  beforeEach(() => {
    global.consoleCaptureUtils.clearLogs();
  });

  test('should log initialization message', () => {
    console.log('Component initialized');
    
    expect().toHaveLoggedMessage('Component initialized');
    
    const logs = global.consoleCaptureUtils.getLogsByMethod('log');
    expect(logs).toHaveLength(1);
  });
});
```

### Chrome Extension Testing

```javascript
test('should handle background script messages', async () => {
  // Mock the chrome API response
  chrome.runtime.sendMessage.mockResolvedValue({ success: true });
  
  console.log('Sending message to background');
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
  
  expect(response.success).toBe(true);
  expect().toHaveLoggedMessage('Sending message to background');
});
```

### Error Handling Testing

```javascript
test('should handle API errors with proper logging', async () => {
  const mockError = new Error('API rate limit exceeded');
  
  try {
    throw mockError;
  } catch (error) {
    console.error('API call failed', error);
  }
  
  expect().toHaveLoggedError('API call failed');
  
  const errors = global.consoleCaptureUtils.getLogsByMethod('error');
  expect(errors[0].args[1]).toBe(mockError);
});
```

### Performance Testing with Timing

```javascript
test('should measure operation performance', async () => {
  console.log('Starting operation');
  const startTime = Date.now();
  
  await someAsyncOperation();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`Operation completed in ${duration}ms`);
  
  expect().toHaveLoggedMessage('Starting operation');
  expect().toHaveLoggedMessage(`Operation completed in ${duration}ms`);
});
```

## Advanced Debugging

### Structured Logging

```javascript
test('should handle structured logs', () => {
  const logData = {
    userId: 'user123',
    action: 'extract_transcript',
    timestamp: new Date().toISOString(),
    details: { videoId: 'abc123', duration: 300 }
  };
  
  console.log('[INFO]', logData);
  
  const logs = global.consoleCaptureUtils.findLogsContaining('extract_transcript');
  expect(logs).toHaveLength(1);
  expect(logs[0].args[1].userId).toBe('user123');
});
```

### Integration with DebugLogger

The setup integrates with your existing `DebugLogger` class:

```javascript
test('should capture DebugLogger output', () => {
  const logger = new DebugLogger('TestComponent');
  
  logger.info('Test message', { key: 'value' });
  logger.warn('Warning message');
  logger.error('Error message', new Error('Test error'));
  
  expect().toHaveLoggedMessage('Test message');
  expect().toHaveLoggedWarning('Warning message');
  expect().toHaveLoggedError('Error message');
});
```

### Testing Error Recovery Patterns

```javascript
test('should test retry logic with proper logging', async () => {
  let attempts = 0;
  const maxRetries = 3;
  
  const flakyOperation = async () => {
    attempts++;
    console.log(`Attempt ${attempts}`);
    
    if (attempts < 3) {
      throw new Error(`Attempt ${attempts} failed`);
    }
    return { success: true };
  };
  
  // Test retry logic
  let result;
  for (let i = 0; i < maxRetries; i++) {
    try {
      result = await flakyOperation();
      break;
    } catch (error) {
      console.warn(`Retry ${i + 1}`, error.message);
    }
  }
  
  expect(result.success).toBe(true);
  expect(attempts).toBe(3);
  
  const attemptLogs = global.consoleCaptureUtils.findLogsContaining('Attempt');
  expect(attemptLogs).toHaveLength(3);
});
```

## Configuration Files

### jest.setup.js
- Sets up console capture utilities
- Mocks Chrome extension APIs
- Defines custom Jest matchers
- Configures test environment

### package.json
- Jest configuration with jsdom environment
- Test scripts for different scenarios
- Dependencies for testing utilities

## Best Practices

1. **Clear logs between tests**: Always use `global.consoleCaptureUtils.clearLogs()` in `beforeEach()`

2. **Test actual behavior**: Use console capture to verify that your code is logging what you expect

3. **Mock Chrome APIs**: Use the provided mocks for consistent testing

4. **Structure your logs**: Use structured logging patterns for better debugging

5. **Test error paths**: Ensure error scenarios are properly logged and handled

6. **Performance monitoring**: Use console capture to verify timing and performance logs

## Troubleshooting

- **Tests not finding logs**: Make sure console capture is started in `beforeEach()`
- **Chrome API errors**: Verify mocks are set up correctly in `jest.setup.js`
- **Module import issues**: The setup uses CommonJS, avoid ES6 imports in test files

## Examples in Action

Run the test suite to see all these patterns in action:

```bash
npm test
```

The test files demonstrate:
- `__tests__/console-capture.test.js` - Basic console capture functionality
- `__tests__/extension-components.test.js` - Chrome extension component testing
- `__tests__/debug-integration.test.js` - Advanced debugging scenarios

This setup gives you powerful debugging capabilities for Chrome extension development with full visibility into console output and proper mocking of browser APIs.