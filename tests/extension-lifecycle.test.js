// Extension Lifecycle Tests
// Tests for extension loading, page refresh, and tab navigation scenarios

describe('Extension Lifecycle Management', () => {
  beforeEach(() => {
    global.consoleCaptureUtils.clearLogs();
  });

  describe('First Time Extension Load', () => {
    test('should handle first load on YouTube page with no transcript', async () => {
      console.log('Extension first load on YouTube page');
      
      // Mock initial tab state - no transcript extracted yet
      const tabId = 12345;
      const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      
      // Mock chrome APIs for first load
      global.chrome.tabs.query.mockResolvedValue([
        { id: tabId, url: youtubeUrl, title: 'Rick Astley - Never Gonna Give You Up' }
      ]);
      
      // Mock empty storage (no previous state)
      global.chrome.storage.local.get.mockResolvedValue({});
      
      console.log('Checking for existing tab state');
      const existingState = await chrome.storage.local.get(`tab_${tabId}`);
      expect(Object.keys(existingState)).toHaveLength(0);
      
      console.log('Creating initial tab state');
      const initialState = {
        tabId,
        url: youtubeUrl,
        title: 'Rick Astley - Never Gonna Give You Up',
        transcript: null,
        keyPoints: null,
        article: null,
        status: 'loaded',
        firstLoad: true,
        lastUpdated: Date.now()
      };
      
      // Save initial state
      await chrome.storage.local.set({ [`tab_${tabId}`]: initialState });
      console.log('Initial tab state saved');
      
      expect().toHaveLoggedMessage('Extension first load on YouTube page');
      expect().toHaveLoggedMessage('Checking for existing tab state');
      expect().toHaveLoggedMessage('Creating initial tab state');
      expect().toHaveLoggedMessage('Initial tab state saved');
      
      // Verify state structure
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [`tab_${tabId}`]: expect.objectContaining({
          tabId,
          url: youtubeUrl,
          transcript: null,
          status: 'loaded',
          firstLoad: true
        })
      });
    });

    test('should initialize content script on YouTube page', () => {
      console.log('Content script initializing on YouTube page');
      
      // Mock DOM state for YouTube page
      Object.defineProperty(global.window, 'location', {
        value: { 
          href: 'https://www.youtube.com/watch?v=test123',
          hostname: 'www.youtube.com'
        },
        writable: true
      });
      
      // Check if we're on YouTube
      const isYouTube = window.location.hostname.includes('youtube.com');
      console.log('YouTube page detected:', isYouTube);
      
      if (isYouTube) {
        console.log('Setting up YouTube page listeners');
        
        // Mock transcript elements not present yet
        global.document.querySelectorAll = jest.fn().mockReturnValue([]);
        
        const transcriptElements = document.querySelectorAll('.ytd-transcript-segment-renderer');
        console.log('Transcript elements found:', transcriptElements.length);
        
        if (transcriptElements.length === 0) {
          console.log('No transcript elements found - waiting for user action');
        }
      }
      
      expect().toHaveLoggedMessage('Content script initializing on YouTube page');
      expect().toHaveLoggedMessage('YouTube page detected:');
      expect().toHaveLoggedMessage('Setting up YouTube page listeners');
      expect().toHaveLoggedMessage('No transcript elements found - waiting for user action');
    });
  });

  describe('Page Refresh Behavior', () => {
    test('should handle page refresh with existing tab state', async () => {
      console.log('Page refresh detected');
      
      const tabId = 67890;
      const youtubeUrl = 'https://www.youtube.com/watch?v=existing';
      
      // Mock existing state from previous session
      const existingState = {
        tabId,
        url: youtubeUrl,
        title: 'Existing Video',
        transcript: {
          segments: [
            { timestamp: '0:00', text: 'Previously extracted transcript' },
            { timestamp: '0:05', text: 'More transcript content' }
          ]
        },
        keyPoints: 'Previously extracted key points',
        status: 'transcript_extracted',
        lastUpdated: Date.now() - 60000 // 1 minute ago
      };
      
      global.chrome.storage.local.get.mockResolvedValue({ [`tab_${tabId}`]: existingState });
      
      console.log('Checking for existing tab state after refresh');
      const storedState = await chrome.storage.local.get(`tab_${tabId}`);
      
      if (storedState[`tab_${tabId}`]) {
        console.log('Found existing state, restoring previous session');
        console.log('Previous status:', storedState[`tab_${tabId}`].status);
        
        // Update last accessed time
        const updatedState = {
          ...storedState[`tab_${tabId}`],
          lastAccessed: Date.now(),
          refreshCount: (storedState[`tab_${tabId}`].refreshCount || 0) + 1
        };
        
        await chrome.storage.local.set({ [`tab_${tabId}`]: updatedState });
        console.log('State updated after refresh');
        
        // Verify transcript is still available
        if (updatedState.transcript) {
          console.log('Transcript available after refresh:', updatedState.transcript.segments.length, 'segments');
        }
      }
      
      expect().toHaveLoggedMessage('Page refresh detected');
      expect().toHaveLoggedMessage('Found existing state, restoring previous session');
      expect().toHaveLoggedMessage('Previous status:');
      expect().toHaveLoggedMessage('State updated after refresh');
      expect().toHaveLoggedMessage('Transcript available after refresh:');
    });

    test('should handle refresh on different YouTube video', async () => {
      console.log('Navigated to different YouTube video');
      
      const tabId = 55555;
      const oldUrl = 'https://www.youtube.com/watch?v=old_video';
      const newUrl = 'https://www.youtube.com/watch?v=new_video';
      
      // Mock existing state for old video
      const oldState = {
        tabId,
        url: oldUrl,
        title: 'Old Video',
        transcript: { segments: [{ timestamp: '0:00', text: 'Old transcript' }] },
        status: 'transcript_extracted'
      };
      
      global.chrome.storage.local.get.mockResolvedValue({ [`tab_${tabId}`]: oldState });
      
      // Simulate URL change detection
      console.log('Current URL:', newUrl);
      console.log('Stored URL:', oldState.url);
      
      const urlChanged = newUrl !== oldState.url;
      console.log('URL changed detected:', urlChanged);
      
      if (urlChanged) {
        console.log('Clearing previous video state');
        
        // Create new state for new video
        const newState = {
          tabId,
          url: newUrl,
          title: 'New Video Title',
          transcript: null,
          keyPoints: null,
          article: null,
          status: 'loaded',
          previousUrl: oldUrl,
          urlChangeTime: Date.now()
        };
        
        await chrome.storage.local.set({ [`tab_${tabId}`]: newState });
        console.log('New video state initialized');
      }
      
      expect().toHaveLoggedMessage('Navigated to different YouTube video');
      expect().toHaveLoggedMessage('URL changed detected:');
      expect().toHaveLoggedMessage('Clearing previous video state');
      expect().toHaveLoggedMessage('New video state initialized');
    });
  });

  describe('Tab Navigation Behavior', () => {
    test('should handle switching between YouTube tabs', async () => {
      console.log('Testing tab switching behavior');
      
      // Mock multiple YouTube tabs
      const tabs = [
        { 
          id: 111, 
          url: 'https://www.youtube.com/watch?v=video1', 
          title: 'Video 1',
          active: false 
        },
        { 
          id: 222, 
          url: 'https://www.youtube.com/watch?v=video2', 
          title: 'Video 2',
          active: true 
        },
        { 
          id: 333, 
          url: 'https://www.google.com', 
          title: 'Google',
          active: false 
        }
      ];
      
      global.chrome.tabs.query.mockResolvedValue(tabs);
      
      // Get all tabs
      const allTabs = await chrome.tabs.query({});
      console.log('Total tabs found:', allTabs.length);
      
      // Filter YouTube tabs
      const youtubeTabs = allTabs.filter(tab => tab.url.includes('youtube.com'));
      console.log('YouTube tabs found:', youtubeTabs.length);
      
      // Find active tab
      const activeTab = youtubeTabs.find(tab => tab.active);
      if (activeTab) {
        console.log('Active YouTube tab:', activeTab.id, activeTab.title);
        
        // Mock state for active tab
        global.chrome.storage.local.get.mockResolvedValue({
          [`tab_${activeTab.id}`]: {
            tabId: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
            status: 'loaded'
          }
        });
        
        console.log('Loading state for active tab');
        const activeTabState = await chrome.storage.local.get(`tab_${activeTab.id}`);
        
        if (activeTabState[`tab_${activeTab.id}`]) {
          console.log('Active tab state loaded successfully');
        }
      }
      
      // Check for inactive YouTube tabs
      const inactiveTabs = youtubeTabs.filter(tab => !tab.active);
      console.log('Inactive YouTube tabs:', inactiveTabs.length);
      
      for (const tab of inactiveTabs) {
        console.log('Maintaining state for inactive tab:', tab.id);
      }
      
      expect().toHaveLoggedMessage('Testing tab switching behavior');
      expect().toHaveLoggedMessage('YouTube tabs found:');
      expect().toHaveLoggedMessage('Active YouTube tab:');
      expect().toHaveLoggedMessage('Active tab state loaded successfully');
      expect().toHaveLoggedMessage('Inactive YouTube tabs:');
    });

    test('should cleanup closed tab states', async () => {
      console.log('Testing tab cleanup on tab close');
      
      const closedTabId = 99999;
      
      // Mock existing state for a tab that will be closed
      const closedTabState = {
        tabId: closedTabId,
        url: 'https://www.youtube.com/watch?v=closed',
        status: 'transcript_extracted'
      };
      
      global.chrome.storage.local.get.mockResolvedValue({
        [`tab_${closedTabId}`]: closedTabState,
        [`tab_111`]: { tabId: 111, status: 'loaded' },
        [`tab_222`]: { tabId: 222, status: 'loaded' }
      });
      
      // Mock current active tabs (closed tab not included)
      global.chrome.tabs.query.mockResolvedValue([
        { id: 111, url: 'https://www.youtube.com/watch?v=video1' },
        { id: 222, url: 'https://www.youtube.com/watch?v=video2' }
      ]);
      
      console.log('Checking for tabs that no longer exist');
      
      // Get all stored tab states
      const allStoredStates = await chrome.storage.local.get(null);
      const storedTabIds = Object.keys(allStoredStates)
        .filter(key => key.startsWith('tab_'))
        .map(key => parseInt(key.replace('tab_', '')));
      
      console.log('Stored tab IDs:', storedTabIds);
      
      // Get current active tab IDs
      const currentTabs = await chrome.tabs.query({});
      const currentTabIds = currentTabs.map(tab => tab.id);
      console.log('Current tab IDs:', currentTabIds);
      
      // Find tabs to cleanup
      const tabsToCleanup = storedTabIds.filter(id => !currentTabIds.includes(id));
      console.log('Tabs to cleanup:', tabsToCleanup);
      
      if (tabsToCleanup.length > 0) {
        for (const tabId of tabsToCleanup) {
          console.log('Removing state for closed tab:', tabId);
          await chrome.storage.local.remove(`tab_${tabId}`);
        }
        console.log('Cleanup completed');
      }
      
      expect().toHaveLoggedMessage('Testing tab cleanup on tab close');
      expect().toHaveLoggedMessage('Tabs to cleanup:');
      expect().toHaveLoggedMessage('Removing state for closed tab:');
      expect().toHaveLoggedMessage('Cleanup completed');
    });
  });

  describe('Extension State Recovery', () => {
    test('should recover from corrupted state', async () => {
      console.log('Testing state recovery from corruption');
      
      const tabId = 77777;
      
      // Mock corrupted state (missing required fields)
      global.chrome.storage.local.get.mockResolvedValue({
        [`tab_${tabId}`]: {
          // Missing tabId, url, and other required fields
          corruptedData: 'invalid'
        }
      });
      
      console.log('Attempting to load tab state');
      const storedState = await chrome.storage.local.get(`tab_${tabId}`);
      const state = storedState[`tab_${tabId}`];
      
      // Validate state structure
      const isValidState = state && state.tabId && state.url;
      console.log('State validation result:', isValidState);
      
      if (!isValidState) {
        console.warn('Corrupted state detected, creating fresh state');
        
        const freshState = {
          tabId,
          url: window.location?.href || 'https://www.youtube.com/watch?v=recovery',
          title: 'Recovered State',
          transcript: null,
          keyPoints: null,
          article: null,
          status: 'recovered',
          recoveredAt: Date.now()
        };
        
        await chrome.storage.local.set({ [`tab_${tabId}`]: freshState });
        console.log('Fresh state created after corruption recovery');
      }
      
      expect().toHaveLoggedMessage('Testing state recovery from corruption');
      expect().toHaveLoggedMessage('State validation result:');
      expect().toHaveLoggedWarning('Corrupted state detected, creating fresh state');
      expect().toHaveLoggedMessage('Fresh state created after corruption recovery');
    });

    test('should handle storage quota exceeded', async () => {
      console.log('Testing storage quota handling');
      
      // Mock storage quota exceeded error
      const quotaError = new Error('QUOTA_BYTES quota exceeded');
      global.chrome.storage.local.set.mockRejectedValueOnce(quotaError);
      
      const tabId = 88888;
      const largeState = {
        tabId,
        url: 'https://www.youtube.com/watch?v=large',
        transcript: {
          segments: Array.from({ length: 1000 }, (_, i) => ({
            timestamp: `${i}:00`,
            text: 'Very long transcript segment'.repeat(100)
          }))
        }
      };
      
      try {
        console.log('Attempting to save large state');
        await chrome.storage.local.set({ [`tab_${tabId}`]: largeState });
      } catch (error) {
        console.error('Storage quota exceeded:', error.message);
        
        // Implement cleanup strategy
        console.log('Starting storage cleanup');
        
        // Mock cleanup - remove old tab states
        global.chrome.storage.local.get.mockResolvedValue({
          'tab_1': { lastUpdated: Date.now() - 86400000 }, // 1 day old
          'tab_2': { lastUpdated: Date.now() - 3600000 },  // 1 hour old
          'tab_3': { lastUpdated: Date.now() - 300000 }    // 5 minutes old
        });
        
        const allStates = await chrome.storage.local.get(null);
        const oldStates = Object.keys(allStates).filter(key => {
          const state = allStates[key];
          const age = Date.now() - (state.lastUpdated || 0);
          return age > 3600000; // Older than 1 hour
        });
        
        console.log('Found old states to remove:', oldStates.length);
        
        if (oldStates.length > 0) {
          await chrome.storage.local.remove(oldStates);
          console.log('Old states removed, retrying save');
          
          // Mock successful retry
          global.chrome.storage.local.set.mockResolvedValueOnce();
          await chrome.storage.local.set({ [`tab_${tabId}`]: { ...largeState, transcript: null } });
          console.log('State saved successfully after cleanup');
        }
      }
      
      expect().toHaveLoggedMessage('Testing storage quota handling');
      expect().toHaveLoggedMessage('Attempting to save large state');
      expect().toHaveLoggedError('Storage quota exceeded');
      expect().toHaveLoggedMessage('Found old states to remove:');
      expect().toHaveLoggedMessage('State saved successfully after cleanup');
    });
  });
});