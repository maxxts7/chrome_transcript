// Background service worker for YouTube AI Article Generator

// Initialize debug logger and tab manager
let logger = null;
let tabManager = null;

// Initialize logger in service worker context
function initializeLogger() {
  if (!logger && typeof DebugLogger !== 'undefined') {
    logger = new DebugLogger('Background');
    logger.info('Background service worker logger initialized');
  } else if (!logger) {
    // Fallback logging if DebugLogger not available
    logger = {
      info: (msg, data) => console.log(`[Background] ${msg}`, data),
      debug: (msg, data) => console.log(`[Background DEBUG] ${msg}`, data),
      warn: (msg, data) => console.warn(`[Background WARN] ${msg}`, data),
      error: (msg, error) => console.error(`[Background ERROR] ${msg}`, error)
    };
  }
}

// Import TabManager when needed
async function getTabManager() {
  if (!tabManager) {
    // Import tab manager (Note: In service worker, we'll need to implement this differently)
    tabManager = {
      // Simplified tab manager methods for service worker context
      
      // Extract YouTube video ID from URL  
      extractVideoId(url) {
        if (!url) return null;
        
        const patterns = [
          /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
          /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
          /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
          /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }
        return null;
      },

      // Normalize YouTube URL
      normalizeYouTubeUrl(url) {
        const videoId = this.extractVideoId(url);
        return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
      },

      // Check if two URLs are the same video
      isSameYouTubeVideo(url1, url2) {
        if (!url1 || !url2) return false;
        const videoId1 = this.extractVideoId(url1);
        const videoId2 = this.extractVideoId(url2);
        return videoId1 && videoId2 && videoId1 === videoId2;
      },

      async updateTabInfo(tabId, url, title) {
        if (!logger) initializeLogger();
        
        try {
          const result = await chrome.storage.local.get(['youtubeTabs']);
          const allTabs = result.youtubeTabs || {};
          const normalizedUrl = this.normalizeYouTubeUrl(url);
          
          if (!allTabs[tabId]) {
            // Create new tab state
            logger.debug('Creating new tab state in background', { tabId, url: normalizedUrl });
            allTabs[tabId] = {
              tabId: tabId,
              url: normalizedUrl,
              title: title || 'YouTube Video',
              transcript: null,
              keyPoints: null,
              article: null,
              isProcessing: false,
              processingStep: null,
              error: null,
              lastUpdated: Date.now(),
              createdAt: Date.now()
            };
          } else {
            // Check if same video - preserve data if so
            const isSameVideo = this.isSameYouTubeVideo(allTabs[tabId].url, url);
            
            if (isSameVideo) {
              logger.debug('Same video, preserving existing data', { 
                tabId, 
                hasTranscript: !!allTabs[tabId].transcript 
              });
              // Just update URL to normalized version and title
              allTabs[tabId].url = normalizedUrl;
              if (title) allTabs[tabId].title = title;
              allTabs[tabId].lastUpdated = Date.now();
            } else {
              logger.warn('Different video detected, preserving existing data anyway', { 
                tabId, 
                oldUrl: allTabs[tabId].url, 
                newUrl: normalizedUrl 
              });
              // Update URL and title but preserve transcript data
              // This handles cases where URL parameters change but it's the same video
              allTabs[tabId].url = normalizedUrl;
              if (title) allTabs[tabId].title = title;
              allTabs[tabId].lastUpdated = Date.now();
            }
          }
          
          await chrome.storage.local.set({ youtubeTabs: allTabs });
          return true;
        } catch (error) {
          if (logger) {
            logger.error('Error updating tab info', error);
          } else {
            console.error('Error updating tab info:', error);
          }
          return false;
        }
      },

      async removeTab(tabId) {
        if (!logger) initializeLogger();
        
        try {
          const result = await chrome.storage.local.get(['youtubeTabs']);
          const allTabs = result.youtubeTabs || {};
          
          if (allTabs[tabId]) {
            logger.debug('Removing tab from storage', { 
              tabId, 
              hadData: !!(allTabs[tabId].transcript || allTabs[tabId].keyPoints) 
            });
            delete allTabs[tabId];
            await chrome.storage.local.set({ youtubeTabs: allTabs });
          }
          
          return true;
        } catch (error) {
          if (logger) {
            logger.error('Error removing tab', error);
          } else {
            console.error('Error removing tab:', error);
          }
          return false;
        }
      },

      isYouTubeUrl(url) {
        return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'));
      }
    };
  }
  return tabManager;
}

// Extension installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  initializeLogger();
  logger.info('YouTube AI Article Generator extension installed/updated', { reason: details.reason });
  
  if (details.reason === 'install') {
    logger.info('Extension installed for the first time');
    // Initialize storage
    await chrome.storage.local.set({ 
      youtubeTabs: {},
      settings: {}
    });
    logger.debug('Initial storage setup completed');
  } else if (details.reason === 'update') {
    const version = chrome.runtime.getManifest().version;
    logger.info('Extension updated to version:', version);
    // Clean up old data if needed
    const manager = await getTabManager();
    logger.debug('Tab manager initialized for update cleanup');
    // await manager.cleanupOldTabs(); // Will implement when needed
  }
  
  // Just initialize tab tracking for existing YouTube tabs
  try {
    const tabs = await chrome.tabs.query({});
    const manager = await getTabManager();
    
    for (const tab of tabs) {
      if (manager.isYouTubeUrl(tab.url)) {
        logger.debug('Initializing existing YouTube tab', { 
          tabId: tab.id, 
          url: tab.url 
        });
        
        // Just update tab info in storage, don't inject scripts
        await manager.updateTabInfo(tab.id, tab.url, tab.title);
      }
    }
  } catch (error) {
    logger.error('Error during tab initialization', error);
  }
});

// Extension startup handler
chrome.runtime.onStartup.addListener(async () => {
  initializeLogger();
  logger.info('YouTube AI Article Generator extension started');
  
  // Clean up old tab data on startup
  try {
    const manager = await getTabManager();
    logger.debug('Tab manager ready for startup cleanup');
    // Perform cleanup of closed tabs
  } catch (error) {
    logger.error('Error during startup cleanup', error);
  }
});

// Tab update handler - track YouTube tab changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!logger) initializeLogger();
  
  try {
    const manager = await getTabManager();
    
    // Only track YouTube tabs that have finished loading
    if (changeInfo.status === 'complete' && tab.url && manager.isYouTubeUrl(tab.url)) {
      logger.debug('YouTube tab updated', { tabId, url: tab.url, title: tab.title });
      await manager.updateTabInfo(tabId, tab.url, tab.title);
      
      // Notify popup if it's open
      try {
        chrome.runtime.sendMessage({
          type: 'TAB_UPDATED',
          tabId: tabId,
          url: tab.url,
          title: tab.title
        });
        logger.debug('Sent TAB_UPDATED message to popup');
      } catch (error) {
        // Popup might not be open, that's fine
        logger.debug('Could not send message to popup (popup not open)');
      }
    }
  } catch (error) {
    logger.error('Error handling tab update', error);
  }
});

// Tab removal handler - clean up closed tabs
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const manager = await getTabManager();
    console.log('Tab removed:', tabId);
    
    // Don't immediately remove data, just mark as closed
    // Data will be cleaned up later by cleanup process
    
    // Notify popup if it's open
    try {
      chrome.runtime.sendMessage({
        type: 'TAB_REMOVED',
        tabId: tabId
      });
    } catch (error) {
      // Popup might not be open, that's fine
    }
  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (!logger) initializeLogger();
  
  // Always log to console as fallback to ensure we can debug
  console.log('🔧 [Background] Message received:', { 
    type: message.type, 
    from: sender.tab ? 'content' : 'popup',
    tabId: message.tabId || sender.tab?.id || 'unknown'
  });
  
  if (logger) {
    logger.debug('Background received message', { type: message.type, from: sender.tab ? 'content' : 'popup' });
  }
  
  try {
    switch (message.type) {
      case 'GET_STATUS':
        const statusResponse = {
          status: 'active',
          version: chrome.runtime.getManifest().version,
          tabId: sender.tab?.id || 'unknown'
        };
        logger.debug('Sending status response', statusResponse);
        sendResponse(statusResponse);
        break;

      case 'GET_ALL_YOUTUBE_TABS':
        // Get all YouTube tabs with their states
        const manager = await getTabManager();
        const result = await chrome.storage.local.get(['youtubeTabs']);
        const allTabs = result.youtubeTabs || {};
        
        // Get current browser tabs to check which are still open
        const browserTabs = await chrome.tabs.query({});
        const openTabIds = new Set(browserTabs.map(tab => tab.id.toString()));
        
        const youtubeTabs = [];
        for (const [tabId, tabState] of Object.entries(allTabs)) {
          if (manager.isYouTubeUrl(tabState.url)) {
            youtubeTabs.push({
              ...tabState,
              isOpen: openTabIds.has(tabId)
            });
          }
        }
        
        logger.debug('Sending YouTube tabs', { count: youtubeTabs.length });
        sendResponse({ tabs: youtubeTabs });
        break;

      case 'UPDATE_TAB_STATE':
        // Update specific tab state
        const tabUpdateManager = await getTabManager();
        const updateResult = await chrome.storage.local.get(['youtubeTabs']);
        const updateAllTabs = updateResult.youtubeTabs || {};
        
        if (updateAllTabs[message.tabId]) {
          updateAllTabs[message.tabId] = {
            ...updateAllTabs[message.tabId],
            ...message.updates,
            lastUpdated: Date.now()
          };
          
          await chrome.storage.local.set({ youtubeTabs: updateAllTabs });
          logger.debug('Tab state updated successfully', { tabId: message.tabId });
          sendResponse({ success: true });
        } else {
          logger.warn('Tab not found for update', { tabId: message.tabId });
          sendResponse({ success: false, error: 'Tab not found' });
        }
        break;

      case 'CLEANUP_TABS':
        // Manual cleanup trigger
        const cleanupManager = await getTabManager();
        // Implement cleanup logic here
        sendResponse({ success: true });
        break;

      case 'INITIALIZE_CONTENT_SCRIPT':
        // Initialize content script in a specific tab
        console.log('🚀 [Background] INITIALIZE_CONTENT_SCRIPT requested for tab:', message.tabId);
        try {
          const { tabId } = message;
          if (logger) {
            logger.info('Content script initialization requested', { tabId });
          }
          
          // Verify tab exists and is accessible
          let tab;
          try {
            tab = await chrome.tabs.get(tabId);
          } catch (tabError) {
            logger.error('Failed to get tab information', { tabId, error: tabError.message });
            sendResponse({ 
              success: false, 
              error: `Tab not found or inaccessible: ${tabError.message}`
            });
            return;
          }
          
          logger.debug('Target tab info', { 
            tabId, 
            url: tab.url, 
            status: tab.status,
            title: tab.title?.substring(0, 50),
            active: tab.active,
            windowId: tab.windowId
          });
          
          // Check if it's a valid YouTube page
          if (!tab.url || !tab.url.includes('youtube.com')) {
            logger.warn('Not a YouTube tab', { tabId, url: tab.url });
            sendResponse({ 
              success: false, 
              error: 'Not a YouTube page' 
            });
            return;
          }
          
          // Check if tab is in a valid state for script injection
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            logger.warn('Cannot inject into system pages', { tabId, url: tab.url });
            sendResponse({ 
              success: false, 
              error: 'Cannot inject content script into system pages'
            });
            return;
          }
          
          logger.info('Tab validation passed, checking current script status', { tabId });
          
          // First, check if content scripts are already loaded
          let currentStatus;
          try {
            const statusCheck = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              function: () => {
                return {
                  loaded: !!window.youtubeTranscriptExtractorLoaded,
                  hasDebugUtils: typeof DebugLogger !== 'undefined',
                  hasExtensionLogs: !!window.ExtensionLogs,
                  url: window.location.href,
                  timestamp: Date.now(),
                  status: 'checked'
                };
              }
            });
            
            currentStatus = statusCheck[0]?.result;
            logger.debug('Current script status', { tabId, currentStatus });
            
          } catch (statusError) {
            logger.warn('Could not check current status', { tabId, statusError });
            currentStatus = { status: 'unknown' };
          }
          
          // If scripts are already loaded and working, no need to inject
          if (currentStatus?.loaded && currentStatus?.hasDebugUtils) {
            logger.info('Content scripts already loaded and working', { tabId, currentStatus });
            sendResponse({ 
              success: true, 
              message: 'Content scripts already loaded',
              details: currentStatus 
            });
            return;
          }
          
          // Scripts not loaded, try to inject them
          try {
            logger.info('Scripts not loaded, attempting injection', { tabId });
            
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['debug-utils.js', 'content.js']
            });
            
            logger.info('Content script files injected successfully', { tabId });
            
          } catch (injectionError) {
            logger.error('Script injection failed', { 
              tabId, 
              error: injectionError.message, 
              name: injectionError.name,
              stack: injectionError.stack 
            });
            
            // Check for common injection errors
            if (injectionError.message.includes('Cannot access')) {
              throw new Error('Permission denied: Cannot access this tab');
            } else if (injectionError.message.includes('The extensions gallery')) {
              throw new Error('Cannot inject scripts into Chrome Web Store pages');
            } else if (injectionError.message.includes('Duplicate script')) {
              // Scripts might already be loaded but not responding - try to reinitialize
              logger.warn('Duplicate script injection, attempting reinitialize', { tabId });
            } else {
              throw new Error(`Script injection failed: ${injectionError.message}`);
            }
          }
          
          // Wait for scripts to initialize
          logger.debug('Waiting for scripts to initialize', { tabId });
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Test if content script is now available and working
          let testResult;
          try {
            const executeResult = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              function: () => {
                try {
                  return {
                    loaded: !!window.youtubeTranscriptExtractorLoaded,
                    hasDebugUtils: typeof DebugLogger !== 'undefined',
                    hasExtensionLogs: !!window.ExtensionLogs,
                    url: window.location.href,
                    isYouTube: window.location.hostname.includes('youtube.com'),
                    documentReady: document.readyState,
                    timestamp: Date.now(),
                    success: true
                  };
                } catch (error) {
                  return {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                  };
                }
              }
            });
            
            testResult = executeResult[0]?.result;
          } catch (testError) {
            logger.error('Content script test failed', { tabId, testError });
            testResult = { 
              success: false, 
              error: `Test execution failed: ${testError.message}` 
            };
          }
          
          logger.debug('Content script test result', { tabId, testResult });
          
          if (testResult?.success && testResult?.loaded && testResult?.hasDebugUtils) {
            console.log('✅ [Background] Content script initialized successfully for tab:', tabId);
            if (logger) {
              logger.info('Content script initialized and verified successfully', { 
                tabId, 
                details: testResult 
              });
            }
            sendResponse({ 
              success: true, 
              message: 'Content script initialized successfully',
              details: testResult 
            });
          } else {
            console.log('❌ [Background] Content script verification failed for tab:', tabId, testResult);
            if (logger) {
              logger.warn('Content script injection incomplete or failed verification', { 
                tabId, 
                testResult 
              });
            }
            
            const errorMsg = testResult?.error || 
                           `Verification failed: ${JSON.stringify(testResult)}`;
            
            sendResponse({ 
              success: false, 
              error: errorMsg,
              details: testResult
            });
          }
          
        } catch (error) {
          logger.error('Error during content script initialization', { 
            tabId: message.tabId,
            error: error.message,
            name: error.name,
            stack: error.stack
          });
          sendResponse({ 
            success: false, 
            error: `Initialization failed: ${error.message}`,
            stack: error.stack
          });
        }
        break;
        
      default:
        console.log('Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  // Return true to indicate we'll send response asynchronously
  return true;
});

// Periodic cleanup (every hour)
chrome.alarms.create('cleanupTabs', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanupTabs') {
    try {
      console.log('Running periodic tab cleanup');
      const manager = await getTabManager();
      // Implement periodic cleanup
    } catch (error) {
      console.error('Error during periodic cleanup:', error);
    }
  }
});

console.log('Background script loaded - YouTube AI Article Generator');