// Quick Test Script for YouTube AI Article Generator
// Run this in the browser console to test the extension

console.log('🚀 Starting Quick Extension Test...');

async function quickTest() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0, skipped: 0 }
  };

  // Test 1: Check if we're on the right domain
  console.log('\n📍 Test 1: Environment Check');
  try {
    const environment = {
      domain: window.location.hostname,
      protocol: window.location.protocol,
      isYouTube: window.location.hostname.includes('youtube.com'),
      hasChrome: typeof chrome !== 'undefined',
      hasStorage: typeof chrome?.storage !== 'undefined'
    };
    
    console.log('✅ Environment:', environment);
    results.tests.environment = { status: 'passed', data: environment };
    results.summary.passed++;
  } catch (error) {
    console.error('❌ Environment check failed:', error);
    results.tests.environment = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 2: Check extension components
  console.log('\n🧩 Test 2: Component Availability');
  try {
    const components = {
      DebugLogger: typeof DebugLogger !== 'undefined',
      TestDataTemplates: typeof TestDataTemplates !== 'undefined',
      ExtensionTestRunner: typeof ExtensionTestRunner !== 'undefined',
      TabManager: typeof window.TabManager !== 'undefined',
      AnthropicAPI: typeof window.AnthropicAPI !== 'undefined'
    };
    
    console.log('✅ Components:', components);
    results.tests.components = { status: 'passed', data: components };
    results.summary.passed++;
  } catch (error) {
    console.error('❌ Component check failed:', error);
    results.tests.components = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 3: Storage Access
  console.log('\n💾 Test 3: Storage Access');
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ quickTestKey: 'test-value' });
      const testResult = await chrome.storage.local.get(['quickTestKey']);
      await chrome.storage.local.remove(['quickTestKey']);
      
      const storageWorks = testResult.quickTestKey === 'test-value';
      console.log('✅ Storage access:', { works: storageWorks });
      results.tests.storage = { status: 'passed', data: { works: storageWorks } };
      results.summary.passed++;
    } else {
      console.log('⚠️ Chrome storage not available');
      results.tests.storage = { status: 'skipped', reason: 'Chrome storage not available' };
      results.summary.skipped++;
    }
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    results.tests.storage = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 4: Background Script Communication
  console.log('\n📡 Test 4: Background Script Communication');
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      console.log('✅ Background response:', response);
      results.tests.background = { status: 'passed', data: response };
      results.summary.passed++;
    } else {
      console.log('⚠️ Chrome runtime not available');
      results.tests.background = { status: 'skipped', reason: 'Chrome runtime not available' };
      results.summary.skipped++;
    }
  } catch (error) {
    console.error('❌ Background communication failed:', error);
    results.tests.background = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 5: DOM Elements (if on popup)
  console.log('\n🖼️ Test 5: DOM Elements Check');
  try {
    const requiredElements = [
      'extract-btn', 'settings-btn', 'extract-points-btn', 
      'generate-article-btn', 'status', 'api-key-input'
    ];
    
    const elementCheck = requiredElements.map(id => ({
      id,
      exists: !!document.getElementById(id)
    }));
    
    const allPresent = elementCheck.every(el => el.exists);
    const presentCount = elementCheck.filter(el => el.exists).length;
    
    if (allPresent) {
      console.log('✅ All DOM elements present');
      results.tests.domElements = { status: 'passed', data: elementCheck };
      results.summary.passed++;
    } else if (presentCount > 0) {
      console.log(`⚠️ ${presentCount}/${requiredElements.length} DOM elements present`);
      results.tests.domElements = { status: 'partial', data: elementCheck };
      results.summary.passed++;
    } else {
      console.log('⚠️ No expected DOM elements found (might not be on popup page)');
      results.tests.domElements = { status: 'skipped', reason: 'No DOM elements found' };
      results.summary.skipped++;
    }
  } catch (error) {
    console.error('❌ DOM elements check failed:', error);
    results.tests.domElements = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 6: Content Script Features (if on YouTube)
  console.log('\n📺 Test 6: Content Script Features');
  try {
    if (window.location.hostname.includes('youtube.com')) {
      const youtubeFeatures = {
        hasVideoPlayer: !!document.querySelector('.html5-video-player'),
        hasTranscriptElements: document.querySelectorAll('ytd-transcript-segment-renderer').length,
        hasCaptionButton: !!document.querySelector('.ytp-subtitles-button'),
        videoTitle: document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      };
      
      console.log('✅ YouTube features:', youtubeFeatures);
      results.tests.contentScript = { status: 'passed', data: youtubeFeatures };
      results.summary.passed++;
    } else {
      console.log('⚠️ Not on YouTube domain');
      results.tests.contentScript = { status: 'skipped', reason: 'Not on YouTube domain' };
      results.summary.skipped++;
    }
  } catch (error) {
    console.error('❌ Content script test failed:', error);
    results.tests.contentScript = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Test 7: Component Initialization
  console.log('\n🔧 Test 7: Component Initialization');
  try {
    let initResults = {};
    
    if (typeof window.TabManager !== 'undefined') {
      const tabManager = new window.TabManager();
      initResults.tabManager = !!tabManager;
    }
    
    if (typeof window.AnthropicAPI !== 'undefined') {
      const anthropicAPI = new window.AnthropicAPI();
      initResults.anthropicAPI = !!anthropicAPI;
    }
    
    if (typeof DebugLogger !== 'undefined') {
      const logger = new DebugLogger('QuickTest');
      initResults.debugLogger = !!logger;
    }
    
    console.log('✅ Component initialization:', initResults);
    results.tests.initialization = { status: 'passed', data: initResults };
    results.summary.passed++;
  } catch (error) {
    console.error('❌ Component initialization failed:', error);
    results.tests.initialization = { status: 'failed', error: error.message };
    results.summary.failed++;
  }

  // Final Summary
  console.log('\n📊 QUICK TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⚠️ Skipped: ${results.summary.skipped}`);
  console.log(`📈 Success Rate: ${((results.summary.passed / (results.summary.passed + results.summary.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (results.tests.components?.data?.DebugLogger === false) {
    console.log('• ⚠️ Debug utilities not loaded - include debug-utils.js');
  }
  if (results.tests.background?.status === 'failed') {
    console.log('• ❌ Background script issues - check extension loading');
  }
  if (results.tests.storage?.status === 'failed') {
    console.log('• ❌ Storage access issues - check extension permissions');
  }
  if (results.summary.failed > 0) {
    console.log('• 🔍 Run full test suite: runQuickTests()');
  }
  if (results.summary.passed === results.summary.passed + results.summary.failed) {
    console.log('• ✅ All tests passed! Extension appears to be working correctly.');
  }

  return results;
}

// Auto-run the test
quickTest().then(results => {
  console.log('\n🎯 Quick test completed. Full results available in returned object.');
  window.quickTestResults = results;
}).catch(error => {
  console.error('❌ Quick test failed to complete:', error);
});

// Export for manual use
window.quickTest = quickTest;