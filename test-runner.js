// Comprehensive Test Runner for YouTube AI Article Generator
// This file contains all tests and can be run from the browser console

class ExtensionTestRunner {
  constructor() {
    this.logger = new DebugLogger('TestRunner');
    this.results = {};
    this.components = {
      background: null,
      content: null,
      popup: null,
      tabManager: null,
      anthropicAPI: null
    };
  }

  async initialize() {
    this.logger.info('🚀 Initializing Extension Test Runner');
    
    // Initialize components if available
    try {
      if (window.TabManager) {
        this.components.tabManager = new TabManager();
        this.logger.debug('TabManager initialized');
      }
      
      if (window.AnthropicAPI) {
        this.components.anthropicAPI = new AnthropicAPI();
        this.logger.debug('AnthropicAPI initialized');
      }
    } catch (error) {
      this.logger.error('Error initializing components', error);
    }

    await this.logger.logStorageStatus();
  }

  // Test 1: Background Script Tests
  async testBackgroundScript() {
    const suite = new TestSuite('Background');
    
    const tests = [
      {
        name: 'Message Handling',
        fn: async () => {
          // Test message passing to background
          const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
          if (!response) throw new Error('No response from background script');
          return response;
        }
      },
      {
        name: 'Tab State Storage',
        fn: async () => {
          const testTabId = 12345;
          await chrome.runtime.sendMessage({
            type: 'UPDATE_TAB_STATE',
            tabId: testTabId,
            updates: { test: true, timestamp: Date.now() }
          });
          
          const tabs = await chrome.runtime.sendMessage({ type: 'GET_ALL_YOUTUBE_TABS' });
          return tabs;
        }
      },
      {
        name: 'Storage Cleanup',
        fn: async () => {
          const result = await chrome.runtime.sendMessage({ type: 'CLEANUP_TABS' });
          if (!result.success) throw new Error('Cleanup failed');
          return result;
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Test 2: Content Script Tests
  async testContentScript() {
    const suite = new TestSuite('Content');
    
    const tests = [
      {
        name: 'YouTube Detection',
        fn: async () => {
          const isYouTube = window.location.hostname.includes('youtube.com');
          if (!isYouTube) throw new Error('Not on YouTube domain');
          return { isYouTube, url: window.location.href };
        }
      },
      {
        name: 'Transcript Extraction Message',
        fn: async () => {
          // Test if we can send extraction message to current tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TRANSCRIPT' });
          return response;
        }
      },
      {
        name: 'DOM Element Detection',
        fn: async () => {
          const transcriptElements = document.querySelectorAll([
            'ytd-transcript-segment-renderer',
            '.ytd-transcript-segment-renderer',
            '[class*="transcript-segment"]'
          ].join(', '));
          
          return {
            transcriptElementsFound: transcriptElements.length,
            hasVideoPlayer: !!document.querySelector('.html5-video-player'),
            hasCaptions: !!document.querySelector('.ytp-subtitles-button')
          };
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Test 3: Tab Manager Tests
  async testTabManager() {
    if (!this.components.tabManager) {
      this.logger.warn('TabManager not available for testing');
      return { skipped: true };
    }

    const suite = new TestSuite('TabManager');
    const tabManager = this.components.tabManager;
    const testTabId = 99999;

    const tests = [
      {
        name: 'Create Empty Tab State',
        fn: async () => {
          const emptyState = tabManager.createEmptyTabState(testTabId);
          if (!emptyState.tabId || emptyState.tabId !== testTabId) {
            throw new Error('Invalid empty tab state created');
          }
          return emptyState;
        }
      },
      {
        name: 'Save and Retrieve Tab State',
        fn: async () => {
          const testState = {
            tabId: testTabId,
            url: 'https://youtube.com/watch?v=test',
            title: 'Test Video',
            transcript: TestDataTemplates.getMockTranscriptData().short,
            lastUpdated: Date.now()
          };
          
          await tabManager.saveTabState(testTabId, testState);
          const retrieved = await tabManager.getTabState(testTabId);
          
          if (retrieved.tabId !== testTabId) {
            throw new Error('Retrieved state does not match saved state');
          }
          
          return retrieved;
        }
      },
      {
        name: 'Update Tab State',
        fn: async () => {
          const updates = {
            keyPoints: TestDataTemplates.getMockKeyPoints(),
            article: TestDataTemplates.getMockArticle()
          };
          
          await tabManager.updateTabState(testTabId, updates);
          const updated = await tabManager.getTabState(testTabId);
          
          if (!updated.keyPoints || !updated.article) {
            throw new Error('Tab state not properly updated');
          }
          
          return updated;
        }
      },
      {
        name: 'YouTube URL Detection',
        fn: async () => {
          const testUrls = [
            { url: 'https://youtube.com/watch?v=test', expected: true },
            { url: 'https://youtu.be/test', expected: true },
            { url: 'https://google.com', expected: false },
            { url: 'https://youtube.com/playlist', expected: false }
          ];
          
          const results = testUrls.map(test => ({
            url: test.url,
            expected: test.expected,
            actual: tabManager.isYouTubeUrl(test.url),
            correct: tabManager.isYouTubeUrl(test.url) === test.expected
          }));
          
          const allCorrect = results.every(r => r.correct);
          if (!allCorrect) {
            throw new Error('URL detection failed for some URLs');
          }
          
          return results;
        }
      },
      {
        name: 'Storage Stats',
        fn: async () => {
          const stats = await tabManager.getStorageStats();
          if (typeof stats.totalTabs !== 'number' || typeof stats.storageUsed !== 'number') {
            throw new Error('Invalid storage stats format');
          }
          return stats;
        }
      },
      {
        name: 'Cleanup Test Tab',
        fn: async () => {
          await tabManager.removeTab(testTabId);
          return { cleaned: true };
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Test 4: Anthropic API Tests
  async testAnthropicAPI() {
    if (!this.components.anthropicAPI) {
      this.logger.warn('AnthropicAPI not available for testing');
      return { skipped: true };
    }

    const suite = new TestSuite('AnthropicAPI');
    const api = this.components.anthropicAPI;

    const tests = [
      {
        name: 'API Key Validation',
        fn: async () => {
          const validKey = 'sk-ant-api03-test-key-here';
          const invalidKeys = ['invalid', '', null, 'sk-wrong-format'];
          
          const results = {
            validKey: api.isValidApiKey(validKey),
            invalidKeys: invalidKeys.map(key => ({
              key: key || 'null',
              isValid: api.isValidApiKey(key)
            }))
          };
          
          if (!results.validKey) {
            throw new Error('Valid key not recognized as valid');
          }
          
          if (results.invalidKeys.some(r => r.isValid)) {
            throw new Error('Invalid key recognized as valid');
          }
          
          return results;
        }
      },
      {
        name: 'Model Info',
        fn: async () => {
          const info = api.getModelInfo();
          if (!info.model || typeof info.maxTokens !== 'number') {
            throw new Error('Invalid model info format');
          }
          return info;
        }
      },
      {
        name: 'Template Variable Replacement',
        fn: async () => {
          const template = 'Hello {NAME}, welcome to {PLACE}!';
          const variables = { NAME: 'World', PLACE: 'Testing' };
          const result = api.replaceTemplateVariables(template, variables);
          
          if (result !== 'Hello World, welcome to Testing!') {
            throw new Error('Template replacement failed');
          }
          
          return { template, variables, result };
        }
      },
      {
        name: 'API Key Loading',
        fn: async () => {
          await api.loadApiKey();
          return { hasApiKey: !!api.apiKey, keyFormat: api.apiKey ? 'loaded' : 'none' };
        }
      }
    ];

    // Only run API connection test if we have a valid API key
    if (api.apiKey && api.isValidApiKey(api.apiKey)) {
      tests.push({
        name: 'API Connection Test (with real key)',
        fn: async () => {
          try {
            await api.testApiKey();
            return { connected: true };
          } catch (error) {
            // Don't fail the test if it's just a quota/rate limit issue
            if (error.message.includes('Rate limit') || error.message.includes('overloaded')) {
              return { connected: 'rate_limited', message: error.message };
            }
            throw error;
          }
        }
      });

      tests.push({
        name: 'Key Points Extraction (mock data)',
        fn: async () => {
          const mockTranscript = TestDataTemplates.getMockTranscriptData().short;
          try {
            const keyPoints = await api.extractKeyPoints(mockTranscript);
            if (!keyPoints || keyPoints.length < 10) {
              throw new Error('Key points extraction returned insufficient data');
            }
            return { keyPoints: keyPoints.substring(0, 100) + '...' };
          } catch (error) {
            if (error.message.includes('Rate limit') || error.message.includes('overloaded')) {
              return { skipped: 'rate_limited', message: error.message };
            }
            throw error;
          }
        }
      });
    }

    return await suite.runAllTests(tests);
  }

  // Test 5: Popup Interface Tests
  async testPopupInterface() {
    const suite = new TestSuite('PopupInterface');
    
    const tests = [
      {
        name: 'DOM Elements Present',
        fn: async () => {
          const requiredElements = [
            'extract-btn',
            'settings-btn',
            'extract-points-btn',
            'generate-article-btn',
            'status',
            'api-key-input'
          ];
          
          const results = requiredElements.map(id => ({
            id,
            exists: !!document.getElementById(id)
          }));
          
          const missing = results.filter(r => !r.exists);
          if (missing.length > 0) {
            throw new Error(`Missing DOM elements: ${missing.map(r => r.id).join(', ')}`);
          }
          
          return results;
        }
      },
      {
        name: 'Tab Navigation',
        fn: async () => {
          const tabs = document.querySelectorAll('.tab-btn');
          const contents = document.querySelectorAll('.tab-content');
          
          if (tabs.length !== 3 || contents.length !== 3) {
            throw new Error('Incorrect number of tabs or tab contents');
          }
          
          return {
            tabCount: tabs.length,
            contentCount: contents.length,
            tabIds: Array.from(tabs).map(t => t.dataset.tab)
          };
        }
      },
      {
        name: 'Settings Panel',
        fn: async () => {
          const settingsPanel = document.getElementById('settings-panel');
          const apiKeyInput = document.getElementById('api-key-input');
          
          if (!settingsPanel || !apiKeyInput) {
            throw new Error('Settings panel or API key input not found');
          }
          
          return {
            settingsPanelVisible: settingsPanel.style.display !== 'none',
            apiKeyInputType: apiKeyInput.type
          };
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Test 6: End-to-End Workflow Test
  async testEndToEndWorkflow() {
    const suite = new TestSuite('EndToEnd');
    const testTabId = 88888;

    const tests = [
      {
        name: 'Complete Workflow Simulation',
        fn: async () => {
          // Step 1: Initialize tab
          if (this.components.tabManager) {
            await this.components.tabManager.initializeTab(
              testTabId,
              'https://youtube.com/watch?v=workflow-test',
              'Workflow Test Video'
            );
          }

          // Step 2: Simulate transcript extraction
          const mockTranscript = TestDataTemplates.getMockTranscriptData().medium;
          if (this.components.tabManager) {
            await this.components.tabManager.updateTabState(testTabId, {
              transcript: mockTranscript
            });
          }

          // Step 3: Simulate key points extraction
          const mockKeyPoints = TestDataTemplates.getMockKeyPoints();
          if (this.components.tabManager) {
            await this.components.tabManager.updateTabState(testTabId, {
              keyPoints: mockKeyPoints
            });
          }

          // Step 4: Simulate article generation
          const mockArticle = TestDataTemplates.getMockArticle();
          if (this.components.tabManager) {
            await this.components.tabManager.updateTabState(testTabId, {
              article: mockArticle
            });
          }

          // Step 5: Verify final state
          let finalState = null;
          if (this.components.tabManager) {
            finalState = await this.components.tabManager.getTabState(testTabId);
          }

          // Step 6: Cleanup
          if (this.components.tabManager) {
            await this.components.tabManager.removeTab(testTabId);
          }

          return {
            hasTranscript: !!(finalState?.transcript),
            hasKeyPoints: !!(finalState?.keyPoints),
            hasArticle: !!(finalState?.article),
            transcriptSegments: finalState?.transcript?.segments?.length || 0
          };
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Test 7: Error Scenarios
  async testErrorScenarios() {
    const suite = new TestSuite('ErrorScenarios');

    const tests = [
      {
        name: 'Invalid Tab ID Handling',
        fn: async () => {
          if (!this.components.tabManager) {
            return { skipped: 'TabManager not available' };
          }

          const invalidTabId = -1;
          const state = await this.components.tabManager.getTabState(invalidTabId);
          
          // Should return empty state, not throw error
          if (!state || state.tabId !== invalidTabId) {
            throw new Error('Invalid tab ID not handled properly');
          }
          
          return state;
        }
      },
      {
        name: 'Storage Error Handling',
        fn: async () => {
          // Try to trigger storage errors by attempting very large data
          const largeData = 'x'.repeat(1000000); // 1MB string
          
          try {
            await chrome.storage.local.set({ testLargeData: largeData });
            await chrome.storage.local.remove('testLargeData');
            return { canHandleLargeData: true };
          } catch (error) {
            return { canHandleLargeData: false, error: error.message };
          }
        }
      },
      {
        name: 'API Error Simulation',
        fn: async () => {
          if (!this.components.anthropicAPI) {
            return { skipped: 'AnthropicAPI not available' };
          }

          const api = this.components.anthropicAPI;
          
          // Test invalid API key handling
          const invalidKey = 'invalid-key';
          try {
            await api.testApiKey(invalidKey);
            throw new Error('Should have failed with invalid key');
          } catch (error) {
            if (!error.message.includes('Invalid')) {
              throw new Error('Wrong error message for invalid key');
            }
          }
          
          return { invalidKeyHandled: true };
        }
      }
    ];

    return await suite.runAllTests(tests);
  }

  // Main test runner
  async runAllTests() {
    this.logger.info('🧪 Starting comprehensive test suite');
    const startTime = Date.now();

    await this.initialize();

    const testSuites = [
      { name: 'Background Script', fn: () => this.testBackgroundScript() },
      { name: 'Content Script', fn: () => this.testContentScript() },
      { name: 'Tab Manager', fn: () => this.testTabManager() },
      { name: 'Anthropic API', fn: () => this.testAnthropicAPI() },
      { name: 'Popup Interface', fn: () => this.testPopupInterface() },
      { name: 'End-to-End Workflow', fn: () => this.testEndToEndWorkflow() },
      { name: 'Error Scenarios', fn: () => this.testErrorScenarios() }
    ];

    for (const suite of testSuites) {
      this.logger.info(`📋 Running test suite: ${suite.name}`);
      try {
        this.results[suite.name] = await suite.fn();
      } catch (error) {
        this.logger.error(`Test suite ${suite.name} failed`, error);
        this.results[suite.name] = { error: error.message };
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Generate final report
    const report = await this.generateFinalReport(totalDuration);
    this.logger.info('📊 Final Test Report:', report);

    return report;
  }

  async generateFinalReport(totalDuration) {
    const summary = {
      totalDuration: totalDuration + 'ms',
      timestamp: new Date().toISOString(),
      testSuites: Object.keys(this.results).length,
      results: {}
    };

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const [suiteName, result] of Object.entries(this.results)) {
      if (result.error) {
        summary.results[suiteName] = { status: 'error', error: result.error };
      } else if (result.skipped) {
        summary.results[suiteName] = { status: 'skipped' };
      } else if (result.summary) {
        totalTests += result.summary.total;
        totalPassed += result.summary.passed;
        totalFailed += result.summary.failed;
        
        summary.results[suiteName] = {
          status: 'completed',
          tests: result.summary.total,
          passed: result.summary.passed,
          failed: result.summary.failed,
          successRate: result.summary.successRate
        };
      }
    }

    summary.overallStats = {
      totalTests,
      totalPassed,
      totalFailed,
      overallSuccessRate: totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) + '%' : '0%'
    };

    // Add system information
    summary.systemInfo = await this.logger.generateDebugReport();

    return summary;
  }
}

// Quick test runner for console use
async function runQuickTests() {
  console.log('🚀 Running Quick Extension Tests...');
  const runner = new ExtensionTestRunner();
  return await runner.runAllTests();
}

// Export for use
if (typeof window !== 'undefined') {
  window.ExtensionTestRunner = ExtensionTestRunner;
  window.runQuickTests = runQuickTests;
}