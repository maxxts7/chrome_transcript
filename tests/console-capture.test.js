// Console Capture Tests
// These tests demonstrate console log capture and debugging capabilities

describe('Console Capture Utilities', () => {
  beforeEach(() => {
    // Console capture is already started in jest.setup.js
    global.consoleCaptureUtils.clearLogs();
  });

  test('should capture console.log messages', () => {
    const testMessage = 'This is a test log message';
    const testData = { key: 'value', number: 42 };
    
    console.log(testMessage, testData);
    
    const logs = global.consoleCaptureUtils.getLogsByMethod('log');
    expect(logs).toHaveLength(1);
    expect(logs[0].args[0]).toBe(testMessage);
    expect(logs[0].args[1]).toEqual(testData);
    expect(logs[0].timestamp).toBeDefined();
    
    // Test custom matcher
    expect().toHaveLoggedMessage(testMessage);
  });

  test('should capture console.warn messages', () => {
    const warningMessage = 'This is a warning';
    console.warn(warningMessage);
    
    const warnings = global.consoleCaptureUtils.getLogsByMethod('warn');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].args[0]).toBe(warningMessage);
    
    // Test custom matcher
    expect().toHaveLoggedWarning(warningMessage);
  });

  test('should capture console.error messages', () => {
    const errorMessage = 'This is an error';
    const errorObject = new Error('Test error');
    
    console.error(errorMessage, errorObject);
    
    const errors = global.consoleCaptureUtils.getLogsByMethod('error');
    expect(errors).toHaveLength(1);
    expect(errors[0].args[0]).toBe(errorMessage);
    expect(errors[0].args[1]).toBe(errorObject);
    
    // Test custom matcher
    expect().toHaveLoggedError(errorMessage);
  });

  test('should find logs containing specific text', () => {
    console.log('User clicked button');
    console.log('API call completed');
    console.warn('Rate limit exceeded');
    console.error('Connection failed');
    
    const apiLogs = global.consoleCaptureUtils.findLogsContaining('API');
    expect(apiLogs).toHaveLength(1);
    expect(apiLogs[0].args[0]).toBe('API call completed');
    
    const connectionLogs = global.consoleCaptureUtils.findLogsContaining('connection');
    expect(connectionLogs).toHaveLength(1);
    expect(connectionLogs[0].method).toBe('error');
  });

  test('should provide comprehensive log summary', () => {
    console.log('Log message 1');
    console.log('Log message 2');
    console.warn('Warning message');
    console.error('Error message');
    
    const summary = global.consoleCaptureUtils.getLogSummary();
    expect(summary.totalLogs).toBe(2);
    expect(summary.totalWarns).toBe(1);
    expect(summary.totalErrors).toBe(1);
    expect(summary.total).toBe(4);
    expect(summary.lastLog.args[0]).toBe('Log message 2');
    expect(summary.lastWarn.args[0]).toBe('Warning message');
    expect(summary.lastError.args[0]).toBe('Error message');
    
    // Test custom matcher
    expect().toHaveLogCount(4);
  });

  test('should handle multiple arguments in logs', () => {
    const prefix = '[TEST]';
    const message = 'Multiple arguments';
    const data = { id: 123, active: true };
    const timestamp = new Date().toISOString();
    
    console.log(prefix, message, data, timestamp);
    
    const logs = global.consoleCaptureUtils.getLogsByMethod('log');
    expect(logs).toHaveLength(1);
    expect(logs[0].args).toHaveLength(4);
    expect(logs[0].args[0]).toBe(prefix);
    expect(logs[0].args[1]).toBe(message);
    expect(logs[0].args[2]).toEqual(data);
    expect(logs[0].args[3]).toBe(timestamp);
  });

  test('should clear logs properly', () => {
    console.log('Before clear');
    console.warn('Warning before clear');
    console.error('Error before clear');
    
    expect(global.consoleCaptureUtils.getLogSummary().total).toBe(3);
    
    global.consoleCaptureUtils.clearLogs();
    
    expect(global.consoleCaptureUtils.getLogSummary().total).toBe(0);
    
    console.log('After clear');
    expect(global.consoleCaptureUtils.getLogSummary().total).toBe(1);
  });
});

describe('Debug Logger Integration', () => {
  let DebugLogger;
  
  beforeAll(() => {
    // Load the DebugLogger from debug-utils.js
    const fs = require('fs');
    const path = require('path');
    const debugUtilsPath = path.join(__dirname, '../debug-utils.js');
    const debugUtilsContent = fs.readFileSync(debugUtilsPath, 'utf8');
    
    // Create a safe evaluation context
    const mockContext = { 
      console, 
      Date, 
      navigator: { userAgent: 'Jest Test Runner' },
      window: { location: { href: 'test://localhost' } },
      module: { exports: {} }
    };
    
    // Execute the debug utils in our context
    const vm = require('vm');
    const script = new vm.Script(`
      ${debugUtilsContent};
      DebugLogger;
    `);
    
    DebugLogger = script.runInNewContext(mockContext);
  });

  test('should integrate with DebugLogger and capture its output', () => {
    const logger = new DebugLogger('TestComponent');
    
    // The logger should have logged initialization messages
    const initLogs = global.consoleCaptureUtils.findLogsContaining('TestComponent');
    expect(initLogs.length).toBeGreaterThan(0);
    
    // Test different log levels
    logger.debug('Debug message', { detail: 'test' });
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message', new Error('Test error'));
    
    // Verify all messages were captured
    expect().toHaveLoggedMessage('Debug message');
    expect().toHaveLoggedMessage('Info message');
    expect().toHaveLoggedWarning('Warning message');
    expect().toHaveLoggedError('Error message');
    
    const summary = global.consoleCaptureUtils.getLogSummary();
    expect(summary.total).toBeGreaterThan(4); // At least the 4 we added plus init logs
  });

  test('should capture DebugLogger test execution', async () => {
    const logger = new DebugLogger('TestExecution');
    
    // Test the executeTest method
    const testResult = await logger.executeTest('Sample Test', async () => {
      console.log('Inside test function');
      return { success: true, data: 'test data' };
    });
    
    expect(testResult.success).toBe(true);
    expect(testResult.result.success).toBe(true);
    expect(testResult.testName).toBe('Sample Test');
    
    // Verify test execution logs were captured
    expect().toHaveLoggedMessage('Starting test: Sample Test');
    expect().toHaveLoggedMessage('Test passed: Sample Test');
    expect().toHaveLoggedMessage('Inside test function');
  });

  test('should capture failed test execution', async () => {
    const logger = new DebugLogger('TestFailure');
    
    const testResult = await logger.executeTest('Failing Test', async () => {
      throw new Error('This test is supposed to fail');
    });
    
    expect(testResult.success).toBe(false);
    expect(testResult.error).toBe('This test is supposed to fail');
    expect(testResult.testName).toBe('Failing Test');
    
    // Verify failure logs were captured
    expect().toHaveLoggedMessage('Starting test: Failing Test');
    expect().toHaveLoggedError('Test failed: Failing Test');
  });
});