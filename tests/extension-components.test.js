// Extension Components Tests with Console Capture
// Tests for individual extension components with proper debugging

describe('Extension Component Testing with Console Capture', () => {
  beforeEach(() => {
    global.consoleCaptureUtils.clearLogs();
  });

  describe('Chrome Extension API Mocking', () => {
    test('should mock chrome.storage.local operations', async () => {
      const testData = { key: 'test', value: 123 };
      
      // Mock the get operation to return our test data
      global.chrome.storage.local.get.mockResolvedValue(testData);
      
      console.log('Testing storage.local.get');
      const result = await chrome.storage.local.get('key');
      
      expect(result).toEqual(testData);
      expect(chrome.storage.local.get).toHaveBeenCalledWith('key');
      expect().toHaveLoggedMessage('Testing storage.local.get');
    });

    test('should mock chrome.runtime.sendMessage', async () => {
      const mockResponse = { success: true, data: 'response data' };
      global.chrome.runtime.sendMessage.mockResolvedValue(mockResponse);
      
      console.log('Sending message to background script');
      const response = await chrome.runtime.sendMessage({ type: 'TEST_MESSAGE' });
      
      expect(response).toEqual(mockResponse);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TEST_MESSAGE' });
      expect().toHaveLoggedMessage('Sending message to background script');
    });

    test('should mock chrome.tabs.query', async () => {
      const mockTabs = [
        { id: 1, url: 'https://youtube.com/watch?v=123', title: 'Test Video' },
        { id: 2, url: 'https://youtube.com/watch?v=456', title: 'Another Video' }
      ];
      global.chrome.tabs.query.mockResolvedValue(mockTabs);
      
      console.log('Querying for YouTube tabs');
      const tabs = await chrome.tabs.query({ url: '*://youtube.com/*' });
      
      expect(tabs).toEqual(mockTabs);
      expect(tabs).toHaveLength(2);
      expect().toHaveLoggedMessage('Querying for YouTube tabs');
    });
  });

  describe('Tab Manager Simulation', () => {
    test('should simulate tab state management with logging', async () => {
      const tabId = 12345;
      const tabData = {
        id: tabId,
        url: 'https://youtube.com/watch?v=test',
        title: 'Test Video',
        transcript: null,
        keyPoints: null,
        article: null
      };

      console.log('Creating new tab state', { tabId, url: tabData.url });
      
      // Mock storage operations
      global.chrome.storage.local.set.mockResolvedValue();
      global.chrome.storage.local.get.mockResolvedValue({ [`tab_${tabId}`]: tabData });
      
      // Simulate saving tab state
      await chrome.storage.local.set({ [`tab_${tabId}`]: tabData });
      console.log('Tab state saved successfully');
      
      // Simulate retrieving tab state
      const storedData = await chrome.storage.local.get(`tab_${tabId}`);
      console.log('Retrieved tab state', storedData);
      
      expect(storedData[`tab_${tabId}`]).toEqual(tabData);
      expect().toHaveLoggedMessage('Creating new tab state');
      expect().toHaveLoggedMessage('Tab state saved successfully');
      expect().toHaveLoggedMessage('Retrieved tab state');
    });

    test('should handle tab cleanup with error logging', async () => {
      const tabId = 99999;
      
      console.log('Starting tab cleanup process', { tabId });
      
      // Simulate an error during cleanup
      global.chrome.storage.local.remove.mockRejectedValue(new Error('Storage error'));
      
      try {
        await chrome.storage.local.remove(`tab_${tabId}`);
      } catch (error) {
        console.error('Failed to cleanup tab', error);
      }
      
      expect().toHaveLoggedMessage('Starting tab cleanup process');
      expect().toHaveLoggedError('Failed to cleanup tab');
      
      const summary = global.consoleCaptureUtils.getLogSummary();
      expect(summary.totalErrors).toBe(1);
    });
  });

  describe('API Integration Simulation', () => {
    test('should simulate API key validation with debug logs', async () => {
      const validApiKey = 'sk-ant-api03-valid-key-here';
      const invalidApiKey = 'invalid-key';
      
      console.log('Testing API key validation');
      
      // Simulate validation logic
      const isValidFormat = (key) => {
        const valid = key && key.startsWith('sk-ant-api03-');
        console.debug('API key format check', { key: key?.substring(0, 20) + '...', valid });
        return valid;
      };
      
      expect(isValidFormat(validApiKey)).toBe(true);
      expect(isValidFormat(invalidApiKey)).toBe(false);
      
      const debugLogs = global.consoleCaptureUtils.getLogsByMethod('debug');
      expect(debugLogs).toHaveLength(2);
      expect().toHaveLoggedMessage('Testing API key validation');
    });

    test('should simulate rate limiting with warning logs', async () => {
      console.log('Simulating API rate limiting');
      
      // Simulate multiple API calls
      for (let i = 1; i <= 5; i++) {
        console.log(`API call #${i}`);
        
        if (i > 3) {
          console.warn(`Rate limit warning: Call #${i} might be throttled`);
        }
      }
      
      const warnings = global.consoleCaptureUtils.getLogsByMethod('warn');
      expect(warnings).toHaveLength(2);
      expect().toHaveLoggedWarning('Rate limit warning');
      
      const apiCallLogs = global.consoleCaptureUtils.findLogsContaining('API call #');
      expect(apiCallLogs).toHaveLength(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should test error recovery patterns', async () => {
      console.log('Testing error recovery patterns');
      
      let retryCount = 0;
      const maxRetries = 3;
      
      const flakyOperation = async () => {
        retryCount++;
        console.log(`Attempting operation (attempt ${retryCount})`);
        
        if (retryCount < 3) {
          const error = new Error(`Attempt ${retryCount} failed`);
          console.error('Operation failed', error);
          throw error;
        }
        
        console.log('Operation succeeded');
        return { success: true };
      };
      
      // Simulate retry logic
      let result = null;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await flakyOperation();
          break;
        } catch (error) {
          console.warn(`Retry ${i + 1}/${maxRetries} failed`, error.message);
        }
      }
      
      expect(result).toEqual({ success: true });
      expect(retryCount).toBe(3);
      
      const attemptLogs = global.consoleCaptureUtils.findLogsContaining('Attempting operation');
      expect(attemptLogs).toHaveLength(3);
      
      const errorLogs = global.consoleCaptureUtils.getLogsByMethod('error');
      expect(errorLogs).toHaveLength(2);
      
      expect().toHaveLoggedMessage('Operation succeeded');
    });
  });

  describe('Performance Monitoring', () => {
    test('should monitor performance with timing logs', async () => {
      console.log('Starting performance test');
      const startTime = Date.now();
      
      // Simulate async operation
      const simulateAsyncWork = () => {
        return new Promise(resolve => {
          console.log('Async work started');
          setTimeout(() => {
            console.log('Async work completed');
            resolve();
          }, 100);
        });
      };
      
      await simulateAsyncWork();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Performance test completed in ${duration}ms`);
      
      expect(duration).toBeGreaterThan(90); // Should take at least 100ms
      expect().toHaveLoggedMessage('Starting performance test');
      expect().toHaveLoggedMessage('Async work started');
      expect().toHaveLoggedMessage('Async work completed');
      expect().toHaveLoggedMessage(`Performance test completed in ${duration}ms`);
    });
  });
});