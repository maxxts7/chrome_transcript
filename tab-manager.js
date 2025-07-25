// Tab Manager - Multi-tab state management for YouTube AI Article Generator
class TabManager {
  constructor() {
    this.storageKey = 'youtubeTabs';
    this.settingsKey = 'settings';
    this.maxStorageSize = 8 * 1024 * 1024; // 8MB limit (leaving 2MB buffer)
    this.tabCleanupHours = 24; // Remove closed tab data after 24 hours
    
    // Initialize logger
    if (typeof DebugLogger !== 'undefined') {
      this.logger = new DebugLogger('TabManager');
      this.logger.info('TabManager initialized', {
        maxStorageSize: this.maxStorageSize,
        cleanupHours: this.tabCleanupHours
      });
    } else {
      this.logger = {
        info: (msg, data) => console.log(`[TabManager] ${msg}`, data),
        debug: (msg, data) => console.log(`[TabManager DEBUG] ${msg}`, data),
        warn: (msg, data) => console.warn(`[TabManager WARN] ${msg}`, data),
        error: (msg, error) => console.error(`[TabManager ERROR] ${msg}`, error)
      };
    }
  }

  // Get all stored tab data
  async getAllTabs() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const tabs = result[this.storageKey] || {};
      this.logger.debug('Retrieved all tabs', { count: Object.keys(tabs).length });
      return tabs;
    } catch (error) {
      this.logger.error('Error loading tab data', error);
      return {};
    }
  }

  // Get specific tab state
  async getTabState(tabId) {
    const allTabs = await this.getAllTabs();
    return allTabs[tabId] || this.createEmptyTabState(tabId);
  }

  // Save tab state
  async saveTabState(tabId, tabState) {
    this.logger.debug('Saving tab state', { tabId, hasTranscript: !!tabState.transcript });
    
    try {
      const allTabs = await this.getAllTabs();
      
      // Update the specific tab
      allTabs[tabId] = {
        ...tabState,
        tabId: tabId,
        lastUpdated: Date.now()
      };

      // Check storage size and cleanup if needed
      await this.ensureStorageCapacity(allTabs);

      // Save to Chrome storage
      await chrome.storage.local.set({
        [this.storageKey]: allTabs
      });

      this.logger.debug('Tab state saved successfully', { tabId });
      return true;
    } catch (error) {
      this.logger.error('Error saving tab state', error);
      return false;
    }
  }

  // Update specific fields in tab state
  async updateTabState(tabId, updates) {
    const currentState = await this.getTabState(tabId);
    const newState = {
      ...currentState,
      ...updates,
      lastUpdated: Date.now()
    };
    return await this.saveTabState(tabId, newState);
  }

  // Remove tab data
  async removeTab(tabId) {
    try {
      const allTabs = await this.getAllTabs();
      delete allTabs[tabId];
      
      await chrome.storage.local.set({
        [this.storageKey]: allTabs
      });
      
      return true;
    } catch (error) {
      console.error('Error removing tab:', error);
      return false;
    }
  }

  // Get all YouTube tabs with their processing status
  async getYouTubeTabs() {
    const allTabs = await this.getAllTabs();
    const youtubeTabs = [];

    for (const [tabId, tabState] of Object.entries(allTabs)) {
      if (this.isYouTubeUrl(tabState.url)) {
        youtubeTabs.push({
          tabId: parseInt(tabId),
          title: tabState.title || 'YouTube Video',
          url: tabState.url,
          status: this.getProcessingStatus(tabState),
          lastUpdated: tabState.lastUpdated || 0,
          hasTranscript: !!tabState.transcript,
          hasKeyPoints: !!tabState.keyPoints,
          hasArticle: !!tabState.article
        });
      }
    }

    // Sort by last updated (most recent first)
    return youtubeTabs.sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  // Get processing status for a tab
  getProcessingStatus(tabState) {
    if (tabState.isProcessing) {
      return tabState.processingStep || 'processing';
    }
    
    if (tabState.article) return 'completed';
    if (tabState.keyPoints) return 'keypoints';
    if (tabState.transcript) return 'transcript';
    return 'empty';
  }

  // Create empty tab state
  createEmptyTabState(tabId) {
    return {
      tabId: parseInt(tabId),
      url: '',
      title: '',
      transcript: null,
      keyPoints: null,
      article: null,
      isProcessing: false,
      processingStep: null,
      error: null,
      lastUpdated: Date.now(),
      createdAt: Date.now()
    };
  }

  // Check if URL is YouTube
  isYouTubeUrl(url) {
    return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'));
  }

  // Extract YouTube video ID from URL
  extractVideoId(url) {
    if (!url) return null;
    
    // Handle different YouTube URL formats
    const patterns = [
      // youtube.com/watch?v=VIDEO_ID
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      // youtu.be/VIDEO_ID
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/embed/VIDEO_ID
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/v/VIDEO_ID
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        this.logger?.debug('Extracted video ID', { url, videoId: match[1] });
        return match[1];
      }
    }
    
    this.logger?.warn('Could not extract video ID from URL', { url });
    return null;
  }

  // Normalize YouTube URL to use video ID for consistent comparison
  normalizeYouTubeUrl(url) {
    const videoId = this.extractVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  }

  // Check if two YouTube URLs refer to the same video
  isSameYouTubeVideo(url1, url2) {
    if (!url1 || !url2) return false;
    
    const videoId1 = this.extractVideoId(url1);
    const videoId2 = this.extractVideoId(url2);
    
    if (videoId1 && videoId2) {
      const isSame = videoId1 === videoId2;
      this.logger?.debug('Comparing video IDs', { 
        url1, url2, videoId1, videoId2, isSame 
      });
      return isSame;
    }
    
    // Fallback to URL comparison if no video ID found
    return url1 === url2;
  }

  // Initialize tab state with basic info
  async initializeTab(tabId, url, title) {
    this.logger.debug('Initializing tab', { tabId, url, title });
    
    const existingState = await this.getTabState(tabId);
    
    // Check if this is the same YouTube video using video ID comparison
    const isSameVideo = this.isSameYouTubeVideo(existingState.url, url);
    
    if (!existingState.url || existingState.url === '') {
      // First time seeing this tab - create new state
      this.logger.info('Creating new tab state (first time)', { tabId, url });
      const newState = this.createEmptyTabState(tabId);
      newState.url = this.normalizeYouTubeUrl(url);
      newState.title = title || 'YouTube Video';
      
      await this.saveTabState(tabId, newState);
      return newState;
    } else if (isSameVideo) {
      // Same video - just update title and URL if needed, preserve all data
      this.logger.debug('Same video detected, preserving existing data', { 
        tabId, 
        existingUrl: existingState.url, 
        newUrl: url,
        hasTranscript: !!existingState.transcript,
        hasKeyPoints: !!existingState.keyPoints,
        hasArticle: !!existingState.article
      });
      
      // Update URL to normalized version and title if changed
      const normalizedUrl = this.normalizeYouTubeUrl(url);
      const updatedTitle = title || existingState.title || 'YouTube Video';
      
      if (existingState.url !== normalizedUrl || existingState.title !== updatedTitle) {
        await this.updateTabState(tabId, {
          url: normalizedUrl,
          title: updatedTitle
        });
        existingState.url = normalizedUrl;
        existingState.title = updatedTitle;
      }
      
      return existingState;
    } else {
      // Different video in same tab - create new state but warn about data loss
      this.logger.warn('Different video detected in same tab, creating new state', { 
        tabId, 
        oldUrl: existingState.url, 
        newUrl: url,
        dataWillBeLost: !!(existingState.transcript || existingState.keyPoints || existingState.article)
      });
      
      const newState = this.createEmptyTabState(tabId);
      newState.url = this.normalizeYouTubeUrl(url);
      newState.title = title || 'YouTube Video';
      
      await this.saveTabState(tabId, newState);
      return newState;
    }
  }

  // Mark tab as processing
  async setProcessingStatus(tabId, isProcessing, step = null) {
    return await this.updateTabState(tabId, {
      isProcessing: isProcessing,
      processingStep: step,
      error: null
    });
  }

  // Set error state
  async setError(tabId, error) {
    return await this.updateTabState(tabId, {
      isProcessing: false,
      processingStep: null,
      error: error
    });
  }

  // Clean up old tab data
  async cleanupOldTabs() {
    try {
      const allTabs = await this.getAllTabs();
      const cutoffTime = Date.now() - (this.tabCleanupHours * 60 * 60 * 1000);
      let hasChanges = false;

      // Get current active tab IDs
      const activeTabs = await chrome.tabs.query({});
      const activeTabIds = new Set(activeTabs.map(tab => tab.id.toString()));

      for (const [tabId, tabState] of Object.entries(allTabs)) {
        const isOld = (tabState.lastUpdated || 0) < cutoffTime;
        const isClosedTab = !activeTabIds.has(tabId);
        
        // Remove if tab is closed and old, or if data is very old
        if ((isClosedTab && isOld) || (tabState.lastUpdated || 0) < cutoffTime - (7 * 24 * 60 * 60 * 1000)) {
          delete allTabs[tabId];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await chrome.storage.local.set({
          [this.storageKey]: allTabs
        });
      }

      return hasChanges;
    } catch (error) {
      console.error('Error during cleanup:', error);
      return false;
    }
  }

  // Ensure we don't exceed storage limits
  async ensureStorageCapacity(allTabs) {
    const dataSize = JSON.stringify(allTabs).length;
    
    if (dataSize > this.maxStorageSize) {
      // Remove oldest tabs until we're under the limit
      const tabArray = Object.entries(allTabs)
        .map(([id, state]) => ({ id, ...state }))
        .sort((a, b) => (a.lastUpdated || 0) - (b.lastUpdated || 0));

      while (JSON.stringify(allTabs).length > this.maxStorageSize && tabArray.length > 0) {
        const oldestTab = tabArray.shift();
        delete allTabs[oldestTab.id];
      }
    }
  }

  // Get current active YouTube tab
  async getCurrentYouTubeTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && this.isYouTubeUrl(activeTab.url)) {
        return {
          tabId: activeTab.id,
          url: activeTab.url,
          title: activeTab.title || 'YouTube Video'
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current tab:', error);
      return null;
    }
  }

  // Export all tab data
  async exportAllTabs() {
    const allTabs = await this.getAllTabs();
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      tabs: allTabs
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Import tab data
  async importTabs(jsonData) {
    try {
      const importData = JSON.parse(jsonData);
      if (importData.tabs) {
        await chrome.storage.local.set({
          [this.storageKey]: importData.tabs
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing tabs:', error);
      return false;
    }
  }

  // Get storage usage statistics
  async getStorageStats() {
    const allTabs = await this.getAllTabs();
    const dataSize = JSON.stringify(allTabs).length;
    const tabCount = Object.keys(allTabs).length;
    
    const stats = {
      totalTabs: tabCount,
      storageUsed: dataSize,
      storageLimit: this.maxStorageSize,
      usagePercentage: Math.round((dataSize / this.maxStorageSize) * 100)
    };
    
    this.logger.debug('Storage stats calculated', stats);
    return stats;
  }
}

// Export for use in other files
window.TabManager = TabManager;