// Test Tab State Persistence - Specific tests for the tab switching issue

class TabPersistenceTest {
  constructor() {
    this.logger = new DebugLogger('TabPersistenceTest');
    this.tabManager = new TabManager();
  }

  // Test URL normalization and video ID extraction
  async testUrlNormalization() {
    console.log('🧪 Testing URL Normalization...');
    
    const testUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxxx&index=1',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=30',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/v/dQw4w9WgXcQ'
    ];

    const results = [];
    for (const url of testUrls) {
      const videoId = this.tabManager.extractVideoId(url);
      const normalized = this.tabManager.normalizeYouTubeUrl(url);
      
      results.push({
        original: url,
        videoId,
        normalized,
        isYouTube: this.tabManager.isYouTubeUrl(url)
      });
    }

    console.table(results);
    
    // Test same video detection
    const allSame = results.every(r => 
      this.tabManager.isSameYouTubeVideo(results[0].original, r.original)
    );
    
    console.log('✅ All URLs detected as same video:', allSame);
    return { results, allSame };
  }

  // Test tab state initialization and preservation
  async testTabStatePreservation() {
    console.log('🧪 Testing Tab State Preservation...');
    
    const testTabId = 999999;
    const baseUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const urlWithParams = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLxxxxxx';
    
    console.log('Step 1: Initialize tab with base URL');
    let state1 = await this.tabManager.initializeTab(testTabId, baseUrl, 'Test Video');
    console.log('Initial state:', state1);

    console.log('Step 2: Add transcript data');
    await this.tabManager.updateTabState(testTabId, {
      transcript: {
        url: baseUrl,
        title: 'Test Video',
        segments: [
          { timestamp: '0:00', text: 'Test transcript segment 1' },
          { timestamp: '0:05', text: 'Test transcript segment 2' }
        ]
      }
    });

    console.log('Step 3: Add key points');
    await this.tabManager.updateTabState(testTabId, {
      keyPoints: 'Test key points extracted from transcript'
    });

    console.log('Step 4: Check state after adding data');
    let state2 = await this.tabManager.getTabState(testTabId);
    console.log('State with data:', {
      hasTranscript: !!state2.transcript,
      hasKeyPoints: !!state2.keyPoints,
      transcriptSegments: state2.transcript?.segments?.length
    });

    console.log('Step 5: Initialize tab again with URL parameters (simulating tab switch)');
    let state3 = await this.tabManager.initializeTab(testTabId, urlWithParams, 'Test Video');
    console.log('State after re-initialization:', {
      hasTranscript: !!state3.transcript,
      hasKeyPoints: !!state3.keyPoints,
      url: state3.url,
      transcriptSegments: state3.transcript?.segments?.length
    });

    console.log('Step 6: Verify data preservation');
    const dataPreserved = !!(state3.transcript && state3.keyPoints);
    console.log('✅ Data preserved after URL change:', dataPreserved);

    // Cleanup
    await this.tabManager.removeTab(testTabId);

    return {
      initialState: state1,
      stateWithData: state2,
      stateAfterReinit: state3,
      dataPreserved
    };
  }

  // Test multiple tab switching scenario
  async testMultipleTabSwitching() {
    console.log('🧪 Testing Multiple Tab Switching...');
    
    const tabs = [
      { id: 100001, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Rick Roll' },
      { id: 100002, url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', title: 'Gangnam Style' },
      { id: 100003, url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', title: 'DeepMind Go' }
    ];

    const results = [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      console.log(`Initializing tab ${i + 1}: ${tab.title}`);
      
      // Initialize tab
      await this.tabManager.initializeTab(tab.id, tab.url, tab.title);
      
      // Add some test data
      await this.tabManager.updateTabState(tab.id, {
        transcript: {
          url: tab.url,
          title: tab.title,
          segments: [
            { timestamp: '0:00', text: `Test transcript for ${tab.title} - segment 1` },
            { timestamp: '0:05', text: `Test transcript for ${tab.title} - segment 2` }
          ]
        },
        keyPoints: `Test key points for ${tab.title}`
      });

      results.push({
        tabId: tab.id,
        title: tab.title,
        initialized: true
      });
    }

    console.log('All tabs initialized with data');

    // Now test switching between tabs
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      console.log(`Switching to tab ${i + 1}: ${tab.title}`);
      
      // Simulate switching by re-initializing (what happens in popup)
      const urlWithParams = tab.url + '&t=30s';
      await this.tabManager.initializeTab(tab.id, urlWithParams, tab.title);
      
      // Check if data is preserved
      const state = await this.tabManager.getTabState(tab.id);
      const dataPreserved = !!(state.transcript && state.keyPoints);
      
      results[i].dataPreserved = dataPreserved;
      results[i].finalUrl = state.url;
      
      console.log(`Tab ${i + 1} data preserved:`, dataPreserved);
    }

    // Cleanup
    for (const tab of tabs) {
      await this.tabManager.removeTab(tab.id);
    }

    const allPreserved = results.every(r => r.dataPreserved);
    console.log('✅ All tabs preserved data:', allPreserved);

    return { results, allPreserved };
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Tab Persistence Tests...');
    console.log('='.repeat(50));

    const results = {};

    try {
      results.urlNormalization = await this.testUrlNormalization();
      console.log('\n' + '='.repeat(50));
      
      results.statePreservation = await this.testTabStatePreservation();
      console.log('\n' + '='.repeat(50));
      
      results.multipleTabSwitching = await this.testMultipleTabSwitching();
      console.log('\n' + '='.repeat(50));

      // Summary
      console.log('📊 TEST SUMMARY');
      console.log('✅ URL Normalization:', results.urlNormalization.allSame ? 'PASS' : 'FAIL');
      console.log('✅ State Preservation:', results.statePreservation.dataPreserved ? 'PASS' : 'FAIL');
      console.log('✅ Multiple Tab Switching:', results.multipleTabSwitching.allPreserved ? 'PASS' : 'FAIL');

      const allPassed = results.urlNormalization.allSame && 
                       results.statePreservation.dataPreserved && 
                       results.multipleTabSwitching.allPreserved;

      console.log('\n🎯 OVERALL RESULT:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

      if (allPassed) {
        console.log('🎉 Tab state persistence should now work correctly!');
      } else {
        console.log('🔧 Some issues remain - check the detailed results above');
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      results.error = error.message;
    }

    return results;
  }
}

// Quick test runner
async function testTabPersistence() {
  console.log('🧪 Running Tab Persistence Tests...');
  const tester = new TabPersistenceTest();
  return await tester.runAllTests();
}

// Export for use
if (typeof window !== 'undefined') {
  window.TabPersistenceTest = TabPersistenceTest;
  window.testTabPersistence = testTabPersistence;
}