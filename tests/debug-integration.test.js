// Debug Integration Tests
// Advanced console capture scenarios and debugging utilities

describe('Advanced Console Debugging Integration', () => {
  beforeEach(() => {
    global.consoleCaptureUtils.clearLogs();
  });

  describe('Complex Logging Scenarios', () => {
    test('should handle structured logging patterns', () => {
      const userId = 'user_123';
      const sessionId = 'session_456';
      const action = 'video_extraction';
      
      // Simulate structured logging
      console.log('[INFO]', { 
        timestamp: new Date().toISOString(),
        userId,
        sessionId,
        action,
        message: 'Starting video extraction process' 
      });
      
      console.log('[DEBUG]', {
        userId,
        sessionId,
        action,
        details: { url: 'https://youtube.com/watch?v=test', method: 'transcript' }
      });
      
      console.log('[SUCCESS]', {
        userId,
        sessionId,
        action,
        result: { extractedSegments: 42, duration: 1200 }
      });
      
      const logs = global.consoleCaptureUtils.getLogsByMethod('log');
      expect(logs).toHaveLength(3);
      
      // Test structured log searching
      const extractionLogs = global.consoleCaptureUtils.findLogsContaining('video_extraction');
      expect(extractionLogs.length).toBeGreaterThan(0);
      
      const debugLogs = global.consoleCaptureUtils.findLogsContaining('[DEBUG]');
      expect(debugLogs).toHaveLength(1);
      expect(debugLogs[0].args[1].details.url).toBe('https://youtube.com/watch?v=test');
    });

    test('should handle error chains and stack traces', () => {
      const originalError = new Error('Original error');
      const wrappedError = new Error('Wrapped error');
      wrappedError.cause = originalError;
      
      console.log('Processing started');
      console.error('First level error', originalError);
      console.error('Wrapped error with cause', wrappedError);
      
      const errors = global.consoleCaptureUtils.getLogsByMethod('error');
      expect(errors).toHaveLength(2);
      expect(errors[0].args[1]).toBe(originalError);
      expect(errors[1].args[1]).toBe(wrappedError);
      expect(errors[1].args[1].cause).toBe(originalError);
    });

    test('should capture console.table and console.group usage', () => {
      const tableData = [
        { id: 1, name: 'Test 1', status: 'passed' },
        { id: 2, name: 'Test 2', status: 'failed' },
        { id: 3, name: 'Test 3', status: 'skipped' }
      ];
      
      console.log('Test Results Summary:');
      
      // Mock console.table since it might not capture in the same way
      const originalTable = console.table;
      console.table = (...args) => {
        console.log('[TABLE]', ...args);
        if (originalTable) originalTable(...args);
      };
      
      console.table(tableData);
      
      // Mock console.group
      const originalGroup = console.group;
      console.group = (...args) => {
        console.log('[GROUP]', ...args);
        if (originalGroup) originalGroup(...args);
      };
      
      console.group('Detailed Results');
      console.log('Passed: 1');
      console.log('Failed: 1');
      console.log('Skipped: 1');
      console.groupEnd();
      
      const logs = global.consoleCaptureUtils.getLogsByMethod('log');
      const tableLogs = logs.filter(log => log.args[0] === '[TABLE]');
      const groupLogs = logs.filter(log => log.args[0] === '[GROUP]');
      
      expect(tableLogs).toHaveLength(1);
      expect(groupLogs).toHaveLength(1);
      expect(tableLogs[0].args[1]).toEqual(tableData);
      
      // Restore original methods
      console.table = originalTable;
      console.group = originalGroup;
    });
  });

  describe('Real-world Extension Debugging', () => {
    test('should simulate background script message handling', async () => {
      // Simulate background script receiving messages
      const messageHandler = (message, sender, sendResponse) => {
        console.log('Background received message', { type: message.type, sender: sender?.tab?.id });
        
        switch (message.type) {
          case 'EXTRACT_TRANSCRIPT':
            console.log('Starting transcript extraction for tab', sender.tab.id);
            setTimeout(() => {
              console.log('Transcript extraction completed');
              sendResponse({ success: true, transcript: 'mock transcript' });
            }, 100);
            return true; // Async response
            
          case 'GET_TAB_STATE':
            console.log('Retrieving tab state for tab', message.tabId);
            sendResponse({ state: 'mock state' });
            break;
            
          default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ error: 'Unknown message type' });
        }
      };
      
      // Test message handling
      const mockSender = { tab: { id: 123, url: 'https://youtube.com/watch?v=test' } };
      const mockSendResponse = jest.fn();
      
      // Test transcript extraction
      messageHandler({ type: 'EXTRACT_TRANSCRIPT' }, mockSender, mockSendResponse);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockSendResponse).toHaveBeenCalledWith({ 
        success: true, 
        transcript: 'mock transcript' 
      });
      
      // Test unknown message type
      messageHandler({ type: 'UNKNOWN_TYPE' }, mockSender, mockSendResponse);
      
      expect().toHaveLoggedMessage('Background received message');
      expect().toHaveLoggedMessage('Starting transcript extraction');
      expect().toHaveLoggedMessage('Transcript extraction completed');
      expect().toHaveLoggedWarning('Unknown message type');
      
      const logs = global.consoleCaptureUtils.getLogsByMethod('log');
      expect(logs.length).toBeGreaterThan(3);
    });

    test('should simulate content script DOM interaction', () => {
      // Mock DOM elements
      const mockTranscriptElement = {
        textContent: 'This is a transcript segment',
        getAttribute: jest.fn(() => '0:30'),
        querySelector: jest.fn()
      };
      
      // Mock the DOM functions properly
      global.document.querySelectorAll = jest.fn().mockReturnValue([mockTranscriptElement]);
      global.document.querySelector = jest.fn().mockReturnValue(mockTranscriptElement);
      
      // Simulate content script execution
      console.log('Content script starting transcript extraction');
      
      const transcriptElements = document.querySelectorAll('.transcript-segment');
      console.log(`Found ${transcriptElements.length} transcript elements`);
      
      if (transcriptElements.length > 0) {
        console.log('Processing transcript segments...');
        
        const segments = Array.from(transcriptElements).map((element, index) => {
          console.debug(`Processing segment ${index + 1}`);
          return {
            timestamp: element.getAttribute('data-timestamp'),
            text: element.textContent
          };
        });
        
        console.log('Transcript extraction completed', { 
          segmentCount: segments.length,
          totalLength: segments.reduce((sum, s) => sum + s.text.length, 0)
        });
      } else {
        console.warn('No transcript elements found on page');
      }
      
      expect().toHaveLoggedMessage('Content script starting transcript extraction');
      expect().toHaveLoggedMessage('Found 1 transcript elements');
      expect().toHaveLoggedMessage('Processing transcript segments...');
      expect().toHaveLoggedMessage('Transcript extraction completed');
      
      const debugLogs = global.consoleCaptureUtils.getLogsByMethod('debug');
      expect(debugLogs).toHaveLength(1);
    });

    test('should simulate API error handling with retry logic', async () => {
      let attemptCount = 0;
      const maxRetries = 3;
      const delay = 50;
      
      const mockApiCall = async (data) => {
        attemptCount++;
        console.log(`API attempt ${attemptCount}/${maxRetries + 1}`, { data });
        
        if (attemptCount <= 2) {
          const error = new Error(`Rate limit exceeded (attempt ${attemptCount})`);
          console.error('API call failed', error);
          throw error;
        }
        
        console.log('API call succeeded');
        return { success: true, result: 'processed data' };
      };
      
      const apiCallWithRetry = async (data) => {
        for (let retry = 0; retry <= maxRetries; retry++) {
          try {
            return await mockApiCall(data);
          } catch (error) {
            if (retry === maxRetries) {
              console.error('All retries exhausted', error);
              throw error;
            }
            
            console.warn(`Retry ${retry + 1}/${maxRetries} after ${delay}ms`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };
      
      const result = await apiCallWithRetry({ text: 'test data' });
      
      expect(result).toEqual({ success: true, result: 'processed data' });
      expect(attemptCount).toBe(3);
      
      const errorLogs = global.consoleCaptureUtils.getLogsByMethod('error');
      expect(errorLogs).toHaveLength(2); // Two failed attempts
      
      const warnLogs = global.consoleCaptureUtils.getLogsByMethod('warn');
      expect(warnLogs).toHaveLength(2); // Two retry warnings
      
      expect().toHaveLoggedMessage('API call succeeded');
    });
  });

  describe('Performance and Memory Debugging', () => {
    test('should track memory usage patterns', () => {
      console.log('Starting memory usage test');
      
      const memoryBefore = performance?.memory?.usedJSHeapSize || 0;
      console.log('Memory before test:', memoryBefore);
      
      // Simulate memory-intensive operation
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
        timestamp: Date.now(),
        metadata: { created: true, processed: false }
      }));
      
      console.log('Created large array with', largeArray.length, 'items');
      
      // Process the array
      const processed = largeArray.map(item => {
        return {
          ...item,
          metadata: { ...item.metadata, processed: true }
        };
      });
      
      const memoryAfter = performance?.memory?.usedJSHeapSize || 0;
      console.log('Memory after test:', memoryAfter);
      console.log('Memory difference:', memoryAfter - memoryBefore);
      
      // Cleanup
      processed.length = 0;
      largeArray.length = 0;
      
      expect(processed).toHaveLength(0);
      expect().toHaveLoggedMessage('Starting memory usage test');
      expect().toHaveLoggedMessage('Created large array with');
      
      const memoryLogs = global.consoleCaptureUtils.findLogsContaining('Memory');
      expect(memoryLogs.length).toBeGreaterThan(0);
    });

    test('should measure operation timing', async () => {
      const operationName = 'complex-calculation';
      
      console.log(`Starting ${operationName}`);
      const startTime = performance.now();
      
      // Simulate complex operation
      await new Promise(resolve => {
        let result = 0;
        for (let i = 0; i < 100000; i++) {
          result += Math.random();
        }
        console.log('Calculation intermediate result:', result);
        setTimeout(resolve, 50);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Completed ${operationName} in ${duration.toFixed(2)}ms`);
      
      if (duration > 100) {
        console.warn(`${operationName} took longer than expected: ${duration.toFixed(2)}ms`);
      }
      
      expect(duration).toBeGreaterThan(45); // Should take at least 50ms
      expect().toHaveLoggedMessage('Starting complex-calculation');
      expect().toHaveLoggedMessage('Completed complex-calculation');
      
      const timingLogs = global.consoleCaptureUtils.findLogsContaining('ms');
      expect(timingLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Console Capture Edge Cases', () => {
    test('should handle circular references in logged objects', () => {
      const obj1 = { name: 'obj1' };
      const obj2 = { name: 'obj2' };
      obj1.ref = obj2;
      obj2.ref = obj1; // Circular reference
      
      // This should not crash the console capture
      console.log('Testing circular reference handling');
      
      try {
        console.log('Object with circular reference', obj1);
      } catch (error) {
        console.error('Circular reference error', error.message);
      }
      
      const logs = global.consoleCaptureUtils.getLogsByMethod('log');
      expect(logs.length).toBeGreaterThan(0);
      expect().toHaveLoggedMessage('Testing circular reference handling');
    });

    test('should handle very large log messages', () => {
      const largeString = 'x'.repeat(10000);
      const largeObject = {
        data: largeString,
        metadata: {
          size: largeString.length,
          type: 'test',
          nested: {
            deepData: Array.from({ length: 100 }, (_, i) => i)
          }
        }
      };
      
      console.log('Testing large message handling');
      console.log('Large string:', largeString.substring(0, 100) + '...');
      console.log('Large object with', Object.keys(largeObject).length, 'keys');
      
      const logs = global.consoleCaptureUtils.getLogsByMethod('log');
      expect(logs).toHaveLength(3);
      expect().toHaveLoggedMessage('Testing large message handling');
      
      const summary = global.consoleCaptureUtils.getLogSummary();
      expect(summary.totalLogs).toBe(3);
    });
  });
});