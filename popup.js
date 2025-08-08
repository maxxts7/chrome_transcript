document.addEventListener('DOMContentLoaded', async () => {
  // Initialize debug logger for popup
  const logger = new DebugLogger('Popup');
  logger.info('Popup DOM loaded, initializing components');
  
  // Initialize components
  const anthropicAPI = new window.AnthropicAPI();
  const tabManager = new window.TabManager();
  
  logger.debug('Components initialized', {
    hasAnthropicAPI: !!anthropicAPI,
    hasTabManager: !!tabManager
  });
  
  // Update version number
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = `v${manifest.version}`;
    logger.debug('Version updated', { version: manifest.version });
  }

  // DOM elements
  const extractBtn = document.getElementById('extract-btn');
  const logsBtn = document.getElementById('logs-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const extractPointsBtn = document.getElementById('extract-points-btn');
  const generateArticleBtn = document.getElementById('generate-article-btn');
  const status = document.getElementById('status');
  
  // Settings panel elements
  const settingsPanel = document.getElementById('settings-panel');
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKeyStatus = document.getElementById('api-key-status');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const testApiKeyBtn = document.getElementById('test-api-key-btn');
  const clearApiKeyBtn = document.getElementById('clear-api-key-btn');
  
  // Logs panel elements
  const logsPanel = document.getElementById('logs-panel');
  const logsContent = document.getElementById('logs-content');
  const copyLogsBtn = document.getElementById('copy-logs-btn');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');
  
  // Tab elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  
  // Transcript tab elements
  const transcriptEmpty = document.getElementById('transcript-empty');
  const transcriptData = document.getElementById('transcript-data');
  const copyTranscriptBtn = document.getElementById('copy-transcript-btn');
  const exportTranscriptBtn = document.getElementById('export-transcript-btn');
  
  // Key points tab elements
  const keypointsEmpty = document.getElementById('keypoints-empty');
  const keypointsData = document.getElementById('keypoints-data');
  const copyKeypointsBtn = document.getElementById('copy-keypoints-btn');
  const exportKeypointsBtn = document.getElementById('export-keypoints-btn');
  
  // Article tab elements
  const articleEmpty = document.getElementById('article-empty');
  const articleData = document.getElementById('article-data');
  const copyArticleBtn = document.getElementById('copy-article-btn');
  const exportArticleBtn = document.getElementById('export-article-btn');

  // Current tab state variables
  let currentTabId = null;
  let currentTabState = null;

  // Initialize on load
  logger.time('Extension Initialization');
  
  // Load existing logs from storage
  await window.ExtensionLogs.load();
  logger.debug('Extension logs loaded on startup');
  
  await initializeExtension();
  logger.timeEnd('Extension Initialization');

  // Listen for tab updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug('Received message from background', message);
    if (message.type === 'TAB_UPDATED' || message.type === 'TAB_REMOVED') {
      // Refresh current tab context if it affects our current tab
      if (message.tabId === currentTabId) {
        logger.debug('Refreshing current tab context due to tab update');
        initializeCurrentTab();
      }
    }
  });

  // Refresh current tab context when popup becomes visible
  // This handles cases where user switches tabs while popup is open
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      initializeCurrentTab();
    }
  });

  // Event Listeners
  extractBtn.addEventListener('click', handleExtractTranscript);
  logsBtn.addEventListener('click', toggleLogsPanel);
  settingsBtn.addEventListener('click', toggleSettingsPanel);
  extractPointsBtn.addEventListener('click', handleExtractKeyPoints);
  generateArticleBtn.addEventListener('click', handleGenerateArticle);
  
  // Settings panel events
  saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  testApiKeyBtn.addEventListener('click', handleTestApiKey);
  clearApiKeyBtn.addEventListener('click', handleClearApiKey);
  
  // Logs panel events
  copyLogsBtn.addEventListener('click', handleCopyLogs);
  clearLogsBtn.addEventListener('click', handleClearLogs);
  refreshLogsBtn.addEventListener('click', handleRefreshLogs);
  apiKeyInput.addEventListener('input', handleApiKeyInput);
  
  // Tab navigation events
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Copy/Export button events
  copyTranscriptBtn.addEventListener('click', () => copyToClipboard(formatTranscriptAsText(currentTabState?.transcript)));
  exportTranscriptBtn.addEventListener('click', () => exportAsFile(formatTranscriptAsText(currentTabState?.transcript), `${sanitizeFileName(currentTabState?.transcript?.title || 'transcript')}.txt`));
  copyKeypointsBtn.addEventListener('click', () => copyToClipboard(currentTabState?.keyPoints));
  exportKeypointsBtn.addEventListener('click', () => exportAsFile(currentTabState?.keyPoints, `${sanitizeFileName(currentTabState?.transcript?.title || 'keypoints')}_keypoints.txt`));
  copyArticleBtn.addEventListener('click', () => copyToClipboard(currentTabState?.article));
  exportArticleBtn.addEventListener('click', () => exportAsFile(currentTabState?.article, `${sanitizeFileName(currentTabState?.transcript?.title || 'article')}_article.txt`));

  // Core Functions
  async function initializeExtension() {
    logger.debug('Starting extension initialization');
    
    // Load API key and check status
    logger.time('API Key Status Check');
    await updateApiKeyStatus();
    logger.timeEnd('API Key Status Check');
    
    // Set up current tab context
    logger.time('Tab Context Initialization');
    await initializeCurrentTab();
    logger.timeEnd('Tab Context Initialization');
    
    logger.info('AI Article Generator popup initialized successfully');
  }

  // Check if content script is loaded and responsive
  async function checkContentScriptHealth(tabId) {
    try {
      logger.debug('Checking content script health for tab:', tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type: 'HEALTH_CHECK' });
      logger.debug('Content script health response:', response);
      return response?.status === 'ready';
    } catch (error) {
      logger.debug('Content script health check failed:', error);
      return false;
    }
  }

  // Get current active YouTube tab
  async function getCurrentActiveTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && tabManager.isYouTubeUrl(activeTab.url)) {
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


  // Initialize current tab state
  async function initializeCurrentTab() {
    logger.debug('Initializing current tab');
    
    // Try to get current active YouTube tab
    const activeTab = await getCurrentActiveTab();
    
    if (activeTab) {
      // If we're switching to a different tab, update context
      if (currentTabId !== activeTab.tabId) {
        logger.info('Switching to different tab', { 
          oldTabId: currentTabId, 
          newTabId: activeTab.tabId, 
          url: activeTab.url 
        });
        
        const previousTabId = currentTabId;
        currentTabId = activeTab.tabId;
        
        // Initialize tab in storage (this will preserve existing data if same video)
        const tabState = await tabManager.initializeTab(activeTab.tabId, activeTab.url, activeTab.title);
        
        // Load the complete state from storage
        await loadCurrentTabState();
        
        logger.info('Successfully switched to YouTube tab', { 
          currentTabId, 
          previousTabId,
          url: activeTab.url,
          hasTranscript: !!(currentTabState?.transcript),
          hasKeyPoints: !!(currentTabState?.keyPoints),  
          hasArticle: !!(currentTabState?.article)
        });
      } else {
        // Same tab - just refresh the state in case something changed
        logger.debug('Same tab, refreshing state', { currentTabId });
        await loadCurrentTabState();
      }
    } else {
      // No active YouTube tab - show appropriate message
      if (currentTabId !== null) {
        logger.info('No YouTube tab active, resetting to empty state', { 
          previousTabId: currentTabId 
        });
        
        currentTabId = null;
        currentTabState = null;
        
        // Reset UI to empty state
        showTranscriptEmptyState();
        showKeypointsEmptyState(); 
        showArticleEmptyState();
        updateButtonStates();
        status.textContent = '📺 Open a YouTube video to get started';
      }
    }
  }

  // Load state for the current tab with retry logic
  async function loadCurrentTabState(retryCount = 0) {
    if (!currentTabId) {
      logger.debug('No current tab ID, skipping state load');
      return;
    }
    
    const maxRetries = 3;
    logger.debug('Loading tab state', { currentTabId, retryCount });
    
    try {
      // Get the tab state from storage
      currentTabState = await tabManager.getTabState(currentTabId);
      
      // Validate the loaded state
      if (!currentTabState || typeof currentTabState !== 'object') {
        throw new Error('Invalid tab state format received');
      }
      
      // Ensure all required properties exist
      const requiredProps = ['tabId', 'url', 'title', 'transcript', 'keyPoints', 'article'];
      const missingProps = requiredProps.filter(prop => !(prop in currentTabState));
      
      if (missingProps.length > 0) {
        logger.warn('Tab state missing properties, will fix', { 
          missingProps, 
          currentState: currentTabState 
        });
        
        // Fill in missing properties with defaults
        const defaults = tabManager.createEmptyTabState(currentTabId);
        currentTabState = { ...defaults, ...currentTabState };
        
        // Save the corrected state
        await tabManager.saveTabState(currentTabId, currentTabState);
      }
      
      // Update UI with current tab state
      await updateUIForCurrentTab();
      
      logger.info('Successfully loaded tab state', { 
        currentTabId,
        hasTranscript: !!currentTabState.transcript,
        hasKeyPoints: !!currentTabState.keyPoints,
        hasArticle: !!currentTabState.article,
        url: currentTabState.url
      });
      
    } catch (error) {
      logger.error('Error loading tab state', { error, currentTabId, retryCount });
      
      if (retryCount < maxRetries) {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
        logger.info(`Retrying state load in ${delay}ms`, { retryCount: retryCount + 1 });
        
        setTimeout(() => {
          loadCurrentTabState(retryCount + 1);
        }, delay);
        return;
      }
      
      // Final fallback - create empty state
      logger.warn('All retries failed, creating empty state', { currentTabId });
      currentTabState = tabManager.createEmptyTabState(currentTabId);
      
      try {
        // Try to save the empty state
        await tabManager.saveTabState(currentTabId, currentTabState);
        await updateUIForCurrentTab();
      } catch (saveError) {
        logger.error('Failed to save empty state fallback', saveError);
        // Still update UI to show empty state
        await updateUIForCurrentTab();
      }
    }
  }

  // Update UI to reflect current tab state with comprehensive logging
  async function updateUIForCurrentTab() {
    if (!currentTabState) {
      logger.warn('updateUIForCurrentTab called with no currentTabState');
      return;
    }

    logger.debug('Updating UI for current tab state', {
      tabId: currentTabState.tabId,
      hasTranscript: !!currentTabState.transcript,
      hasKeyPoints: !!currentTabState.keyPoints,
      hasArticle: !!currentTabState.article,
      isProcessing: currentTabState.isProcessing,
      processingStep: currentTabState.processingStep,
      hasError: !!currentTabState.error
    });

    // Update transcript UI
    if (currentTabState.transcript) {
      logger.debug('Displaying transcript UI', { 
        segments: currentTabState.transcript.segments?.length || 0 
      });
      displayTranscript(currentTabState.transcript);
      if (!currentTabState.isProcessing) {
        status.textContent = `📋 ${currentTabState.transcript.segments.length} segments loaded`;
      }
    } else {
      logger.debug('Showing transcript empty state');
      showTranscriptEmptyState();
      if (!currentTabState.isProcessing) {
        // Check content script health before showing ready state
        const isContentScriptReady = await checkContentScriptHealth(currentTabId);
        if (isContentScriptReady) {
          status.textContent = 'Ready to extract transcript';
        } else {
          // Check if we can reach the content script at all
          try {
            const response = await chrome.tabs.sendMessage(currentTabId, { type: 'HEALTH_CHECK' });
            if (response) {
              // Content script is loaded but YouTube DOM isn't ready
              status.textContent = 'Waiting for YouTube player to load...';
              logger.debug('Content script loaded but YouTube DOM not ready');
              
              // Start periodic check for YouTube DOM readiness
              const checkReadiness = setInterval(async () => {
                const isReady = await checkContentScriptHealth(currentTabId);
                if (isReady) {
                  status.textContent = 'Ready to extract transcript';
                  clearInterval(checkReadiness);
                  logger.debug('YouTube DOM became ready, updated status');
                }
              }, 2000);
              
              // Clear interval after 30 seconds to avoid infinite checking
              setTimeout(() => clearInterval(checkReadiness), 30000);
            } else {
              status.textContent = 'Loading YouTube integration...';
              logger.debug('Content script not responding');
            }
          } catch (error) {
            status.textContent = 'Loading YouTube integration...';
            logger.debug('Content script not ready, triggering background injection');
          }
        }
      }
    }

    // Update key points UI
    if (currentTabState.keyPoints) {
      logger.debug('Displaying key points UI', { 
        keyPointsLength: currentTabState.keyPoints.length 
      });
      displayKeyPoints(currentTabState.keyPoints);
    } else {
      logger.debug('Showing key points empty state');
      showKeypointsEmptyState();
    }

    // Update article UI
    if (currentTabState.article) {
      logger.debug('Displaying article UI', { 
        articleLength: currentTabState.article.length 
      });
      displayArticle(currentTabState.article);
    } else {
      logger.debug('Showing article empty state');
      showArticleEmptyState();
    }

    // Update button states
    logger.debug('Updating button states');
    updateButtonStates();

    // Show processing status if in progress
    if (currentTabState.isProcessing) {
      const stepText = currentTabState.processingStep || 'processing';
      status.textContent = `🔄 ${stepText}...`;
      logger.debug('Showing processing status', { stepText });
    }

    // Show error status if there's an error
    if (currentTabState.error && !currentTabState.isProcessing) {
      status.textContent = `❌ ${currentTabState.error}`;
      logger.warn('Showing error status', { error: currentTabState.error });
    }

    logger.debug('UI update completed successfully');
  }


  async function handleExtractTranscript() {
    logger.info('Starting transcript extraction', { currentTabId });
    
    if (!currentTabId) {
      const errorMsg = '❌ Open a YouTube video first';
      status.textContent = errorMsg;
      logger.warn('Transcript extraction failed: no active YouTube tab');
      return;
    }

    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    status.textContent = 'Extracting transcript from page...';
    
    logger.time('Transcript Extraction');

    // Mark tab as processing
    await tabManager.setProcessingStatus(currentTabId, true, 'extracting transcript');

    try {
      // First try to send message to content script
      let response;
      try {
        response = await chrome.tabs.sendMessage(currentTabId, { type: 'EXTRACT_TRANSCRIPT' });
      } catch (messageError) {
        // Content script might not be loaded, try to initialize it
        logger.warn('Content script not responding, attempting initialization', messageError);
        status.textContent = 'Initializing extension for this tab...';
        
        try {
          logger.info('Attempting automatic content script injection');
          status.textContent = 'Auto-fixing: Injecting content script...';
          
          // First test if background script is responsive
          try {
            const statusCheck = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
            logger.debug('Background script status check', statusCheck);
            
            if (!statusCheck || statusCheck.status !== 'active') {
              throw new Error(`Background script unhealthy: ${JSON.stringify(statusCheck)}`);
            }
          } catch (statusError) {
            logger.error('Background script not responding', {
              error: statusError.message,
              name: statusError.name,
              stack: statusError.stack
            });
            throw new Error(`Extension background script not responding: ${statusError.message}`);
          }
          
          logger.info('Background script confirmed active, proceeding with content script injection');
          
          const initResult = await chrome.runtime.sendMessage({ 
            type: 'INITIALIZE_CONTENT_SCRIPT', 
            tabId: currentTabId 
          });
          
          logger.debug('Content script injection result', { 
            success: initResult?.success, 
            error: initResult?.error,
            message: initResult?.message,
            details: initResult?.details,
            fullResult: initResult
          });
          
          if (initResult?.success) {
            logger.info('Content script initialized successfully, retrying extraction');
            status.textContent = 'Auto-fix successful! Extracting transcript...';
            
            // Clear any previous errors
            await tabManager.clearError(currentTabId);
            
            // Wait a moment for content script to fully initialize
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Verify content script is actually loaded
            try {
              const verifyResult = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_STORED_TRANSCRIPT' });
              logger.debug('Content script verification successful', verifyResult);
            } catch (verifyError) {
              logger.warn('Content script verification failed', verifyError);
              throw new Error('Content script injection appeared successful but script is not responding');
            }
            
            // Try the extraction again after initialization
            response = await chrome.tabs.sendMessage(currentTabId, { type: 'EXTRACT_TRANSCRIPT' });
            logger.info('Transcript extraction retry successful after auto-fix');
            
          } else {
            const errorDetails = {
              success: initResult?.success,
              error: initResult?.error,
              message: initResult?.message,
              details: initResult?.details,
              stack: initResult?.stack
            };
            
            logger.error('Content script initialization failed', errorDetails);
            
            if (initResult?.error?.includes('Not a YouTube page')) {
              throw new Error('Current tab is not a YouTube page');
            } else if (initResult?.error?.includes('Injection failed')) {
              throw new Error(`Script injection failed: ${initResult.error}`);
            } else {
              throw new Error(`Auto-fix failed: ${initResult?.error || 'Unknown initialization error'}. Please refresh the page.`);
            }
          }
        } catch (initError) {
          logger.error('Content script initialization error', { 
            error: initError.message,
            stack: initError.stack,
            type: typeof initError,
            name: initError.name,
            currentTabId,
            initError 
          });
          
          // Provide more specific error messages based on common failure scenarios
          let userMessage;
          if (initError.message.includes('Extension context invalidated')) {
            userMessage = 'Extension was reloaded. Please refresh the page and try again.';
          } else if (initError.message.includes('not responding')) {
            userMessage = 'Extension background script is not responding. Try restarting Chrome.';
          } else if (initError.message.includes('YouTube page')) {
            userMessage = 'Please navigate to a YouTube video page first.';
          } else {
            userMessage = `Auto-fix failed: ${initError.message}. Please refresh the page and try again.`;
          }
          
          throw new Error(userMessage);
        }
      }
      
      if (response?.transcript && response.transcript.length > 0) {
        const transcript = {
          url: response.url,
          timestamp: new Date().toISOString(),
          segments: response.transcript,
          title: await getVideoTitle({ id: currentTabId }) || 'YouTube Video'
        };
        
        // Save transcript to current tab state
        await tabManager.updateTabState(currentTabId, {
          transcript: transcript,
          isProcessing: false,
          processingStep: null
        });

        // Update UI
        currentTabState.transcript = transcript;
        displayTranscript(transcript);
        status.textContent = `✅ Extracted ${response.transcript.length} segments`;
        logger.info('Transcript extraction completed', { 
          segments: response.transcript.length,
          title: transcript.title
        });
        
        // Enable AI buttons if API key is available
        updateButtonStates();
        
      } else {
        status.textContent = '❌ No transcript found - try enabling captions first';
        await tabManager.setProcessingStatus(currentTabId, false);
        showTranscriptEmptyState();
      }
    } catch (error) {
      console.error('Error extracting transcript:', error);
      status.textContent = '❌ Error extracting transcript - reload the page and try again';
      await tabManager.setError(currentTabId, error.message);
      showTranscriptEmptyState();
    }

    resetExtractButton();
  }

  async function handleExtractKeyPoints() {
    logger.info('Starting key points extraction', { 
      hasCurrentTab: !!currentTabId,
      hasTranscript: !!(currentTabState?.transcript),
      hasApiKey: !!anthropicAPI.apiKey
    });
    
    if (!currentTabId || !currentTabState?.transcript) {
      const errorMsg = '❌ No transcript available';
      status.textContent = errorMsg;
      logger.warn('Key points extraction failed: no transcript available');
      return;
    }

    if (!anthropicAPI.apiKey) {
      const errorMsg = '❌ Please configure your Anthropic API key first';
      status.textContent = errorMsg;
      logger.warn('Key points extraction failed: no API key configured');
      switchTab('transcript');
      toggleSettingsPanel();
      return;
    }

    extractPointsBtn.disabled = true;
    extractPointsBtn.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Extracting Points...</div>';
    status.textContent = '🧠 AI is analyzing the transcript...';

    // Mark tab as processing
    await tabManager.setProcessingStatus(currentTabId, true, 'extracting key points');
    logger.time('Key Points Extraction API Call');

    try {
      // Monitor for retry attempts
      const originalMakeRequest = anthropicAPI.makeRequest.bind(anthropicAPI);
      anthropicAPI.makeRequest = async function(apiKey, messages, maxTokens, retryCount = 0) {
        if (retryCount > 0) {
          status.textContent = `🔄 API busy, retrying... (attempt ${retryCount + 1}/4)`;
        }
        return originalMakeRequest(apiKey, messages, maxTokens, retryCount);
      };

      const keyPoints = await anthropicAPI.extractKeyPoints(currentTabState.transcript);
      
      // Save key points to current tab state
      await tabManager.updateTabState(currentTabId, {
        keyPoints: keyPoints,
        isProcessing: false,
        processingStep: null
      });

      // Update UI
      currentTabState.keyPoints = keyPoints;
      displayKeyPoints(keyPoints);
      status.textContent = '✅ Key points extracted successfully';
      logger.timeEnd('Key Points Extraction API Call');
      logger.info('Key points extraction completed successfully');
      
      // Switch to key points tab and enable generate article button
      switchTab('keypoints');
      updateButtonStates();
      
    } catch (error) {
      console.error('Error extracting key points:', error);
      
      // Provide specific guidance based on error type
      let statusMessage = `❌ ${error.message}`;
      if (error.message.includes('overloaded')) {
        statusMessage += ' - Try again in 2-3 minutes.';
      } else if (error.message.includes('Rate limit')) {
        statusMessage += ' - Wait a moment before trying again.';
      }
      
      status.textContent = statusMessage;
      await tabManager.setError(currentTabId, error.message);
      showKeypointsEmptyState();
    }

    extractPointsBtn.disabled = false;
    extractPointsBtn.textContent = '🧠 Extract Key Points';
  }

  async function handleGenerateArticle() {
    if (!currentTabId || !currentTabState?.keyPoints || !currentTabState?.transcript) {
      status.textContent = '❌ Please extract key points first';
      return;
    }

    if (!anthropicAPI.apiKey) {
      status.textContent = '❌ Please configure your Anthropic API key first';
      return;
    }

    generateArticleBtn.disabled = true;
    generateArticleBtn.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Generating Article...</div>';
    status.textContent = '📝 AI is writing your article...';

    // Mark tab as processing
    await tabManager.setProcessingStatus(currentTabId, true, 'generating article');

    try {
      // Monitor for retry attempts
      const originalMakeRequest = anthropicAPI.makeRequest.bind(anthropicAPI);
      anthropicAPI.makeRequest = async function(apiKey, messages, maxTokens, retryCount = 0) {
        if (retryCount > 0) {
          status.textContent = `🔄 API busy, retrying... (attempt ${retryCount + 1}/4)`;
        }
        return originalMakeRequest(apiKey, messages, maxTokens, retryCount);
      };

      const article = await anthropicAPI.generateArticle(currentTabState.keyPoints, currentTabState.transcript);
      
      // Save article to current tab state
      await tabManager.updateTabState(currentTabId, {
        article: article,
        isProcessing: false,
        processingStep: null
      });

      // Update UI
      currentTabState.article = article;
      displayArticle(article);
      status.textContent = '✅ Article generated successfully';
      
      // Switch to article tab
      switchTab('article');
      
    } catch (error) {
      console.error('Error generating article:', error);
      
      // Provide specific guidance based on error type
      let statusMessage = `❌ ${error.message}`;
      if (error.message.includes('overloaded')) {
        statusMessage += ' - Try again in 2-3 minutes.';
      } else if (error.message.includes('Rate limit')) {
        statusMessage += ' - Wait a moment before trying again.';
      }
      
      status.textContent = statusMessage;
      await tabManager.setError(currentTabId, error.message);
      showArticleEmptyState();
    }

    generateArticleBtn.disabled = false;
    generateArticleBtn.textContent = '📝 Generate Article';
  }

  function toggleSettingsPanel() {
    const isVisible = settingsPanel.style.display !== 'none';
    settingsPanel.style.display = isVisible ? 'none' : 'block';
    settingsBtn.textContent = isVisible ? '⚙️ Settings' : '✕ Close';
  }

  async function handleSaveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      updateApiKeyStatus('Please enter an API key', false);
      return;
    }

    if (!anthropicAPI.isValidApiKey(apiKey)) {
      updateApiKeyStatus('Invalid API key format', false);
      return;
    }

    saveApiKeyBtn.disabled = true;
    saveApiKeyBtn.textContent = 'Saving...';

    try {
      await anthropicAPI.saveApiKey(apiKey);
      updateApiKeyStatus('API key saved successfully', true);
      updateButtonStates();
    } catch (error) {
      updateApiKeyStatus('Error saving API key', false);
    }

    saveApiKeyBtn.disabled = false;
    saveApiKeyBtn.textContent = 'Save Key';
  }

  async function handleTestApiKey() {
    const apiKey = apiKeyInput.value.trim() || anthropicAPI.apiKey;
    if (!apiKey) {
      updateApiKeyStatus('No API key to test', false);
      return;
    }

    testApiKeyBtn.disabled = true;
    testApiKeyBtn.textContent = 'Testing...';

    try {
      await anthropicAPI.testApiKey(apiKey);
      updateApiKeyStatus('API key is working!', true);
    } catch (error) {
      updateApiKeyStatus(error.message, false);
    }

    testApiKeyBtn.disabled = false;
    testApiKeyBtn.textContent = 'Test Key';
  }

  async function handleClearApiKey() {
    if (confirm('Are you sure you want to clear the API key?')) {
      await anthropicAPI.clearApiKey();
      apiKeyInput.value = '';
      updateApiKeyStatus('API key cleared', false);
      updateButtonStates();
    }
  }

  function handleApiKeyInput() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      const isValid = anthropicAPI.isValidApiKey(apiKey);
      updateApiKeyStatus(isValid ? 'Valid format' : 'Invalid format', isValid);
    } else {
      updateApiKeyStatus('', false);
    }
  }

  function switchTab(tabName) {
    // Update tab buttons
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab contents
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  async function updateApiKeyStatus() {
    await anthropicAPI.loadApiKey();
    const hasKey = !!anthropicAPI.apiKey;
    
    if (hasKey) {
      // Mask the API key in the input
      apiKeyInput.value = '••••••••••••••••••••';
      updateApiKeyStatus('API key configured', true);
    } else {
      apiKeyInput.value = '';
      updateApiKeyStatus('No API key configured', false);
    }
    
    updateButtonStates();
  }

  function updateApiKeyStatus(message, isValid) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = `api-key-status ${isValid ? 'valid' : 'invalid'}`;
  }

  function updateButtonStates() {
    const hasTranscript = !!(currentTabState?.transcript);
    const hasApiKey = !!anthropicAPI.apiKey;
    const hasKeyPoints = !!(currentTabState?.keyPoints);
    const hasArticle = !!(currentTabState?.article);

    // Transcript buttons
    copyTranscriptBtn.disabled = !hasTranscript;
    exportTranscriptBtn.disabled = !hasTranscript;

    // AI buttons
    extractPointsBtn.disabled = !hasTranscript || !hasApiKey;
    generateArticleBtn.disabled = !hasKeyPoints || !hasApiKey;

    // Key points buttons
    copyKeypointsBtn.disabled = !hasKeyPoints;
    exportKeypointsBtn.disabled = !hasKeyPoints;

    // Article buttons
    copyArticleBtn.disabled = !hasArticle;
    exportArticleBtn.disabled = !hasArticle;
  }

  // Display Functions
  function displayTranscript(data) {
    if (!data || !data.segments || data.segments.length === 0) {
      showTranscriptEmptyState();
      return;
    }

    transcriptEmpty.style.display = 'none';
    transcriptData.style.display = 'block';

    // Create video info
    const videoInfo = document.createElement('div');
    videoInfo.className = 'video-info';
    videoInfo.innerHTML = `
      <div class="video-title">${escapeHtml(data.title || 'YouTube Video')}</div>
      <div class="video-url">${new URL(data.url).hostname}/watch?v=...</div>
    `;

    // Create stats
    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.textContent = `${data.segments.length} segments • Extracted ${formatDate(data.timestamp)}`;

    // Create transcript segments
    const segments = data.segments.map(segment => {
      const segmentDiv = document.createElement('div');
      segmentDiv.className = 'transcript-segment';
      segmentDiv.innerHTML = `
        <div class="timestamp">${escapeHtml(segment.timestamp)}</div>
        <div class="transcript-text">${escapeHtml(segment.text)}</div>
      `;
      return segmentDiv;
    });

    // Clear and populate transcript data
    transcriptData.innerHTML = '';
    transcriptData.appendChild(videoInfo);
    transcriptData.appendChild(stats);
    segments.forEach(segment => transcriptData.appendChild(segment));
  }

  function displayKeyPoints(keyPoints) {
    if (!keyPoints) {
      showKeypointsEmptyState();
      return;
    }

    keypointsEmpty.style.display = 'none';
    keypointsData.style.display = 'block';
    keypointsData.textContent = keyPoints;
  }

  function displayArticle(article) {
    if (!article) {
      showArticleEmptyState();
      return;
    }

    articleEmpty.style.display = 'none';
    articleData.style.display = 'block';
    articleData.textContent = article;
  }

  function showTranscriptEmptyState() {
    transcriptEmpty.style.display = 'block';
    transcriptData.style.display = 'none';
  }

  function showKeypointsEmptyState() {
    keypointsEmpty.style.display = 'block';
    keypointsData.style.display = 'none';
  }

  function showArticleEmptyState() {
    articleEmpty.style.display = 'block';
    articleData.style.display = 'none';
  }

  // Utility Functions
  // Note: loadStoredTranscript is now handled by the tab manager system

  async function getVideoTitle(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title, .watch-title');
          return titleElement ? titleElement.textContent.trim() : 'YouTube Video';
        }
      });
      return results[0]?.result || 'YouTube Video';
    } catch (error) {
      return 'YouTube Video';
    }
  }

  async function copyToClipboard(text) {
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = '✅ Copied to clipboard';
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      status.textContent = '✅ Copied to clipboard (fallback)';
    }
  }

  function exportAsFile(content, fileName) {
    if (!content) return;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    status.textContent = `✅ Exported as ${fileName}`;
  }

  function resetExtractButton() {
    extractBtn.disabled = false;
    extractBtn.textContent = 'Extract Transcript';
  }

  function formatTranscriptAsText(data) {
    if (!data) return '';
    
    let output = '';
    output += `${data.title || 'YouTube Video Transcript'}\n`;
    output += `${data.url}\n`;
    output += `Extracted: ${formatDate(data.timestamp)}\n`;
    output += `Segments: ${data.segments.length}\n\n`;
    output += '='.repeat(50) + '\n\n';

    data.segments.forEach(segment => {
      output += `[${segment.timestamp}] ${segment.text}\n\n`;
    });

    return output;
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  function sanitizeFileName(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Logs Panel Functions
  function toggleLogsPanel() {
    logger.info('Toggling logs panel');
    const isVisible = logsPanel.style.display !== 'none';
    
    if (isVisible) {
      logsPanel.style.display = 'none';
    } else {
      logsPanel.style.display = 'block';
      loadLogs(); // Load logs when showing panel
    }
    
    // Hide settings panel if it's open
    if (!isVisible && settingsPanel.style.display !== 'none') {
      settingsPanel.style.display = 'none';
    }
  }

  async function loadLogs() {
    logger.debug('Loading extension logs');
    
    try {
      // Load logs from storage first
      await window.ExtensionLogs.load();
      
      const logs = window.ExtensionLogs.get();
      logger.debug('Retrieved logs', { count: logs.length });
      
      if (logs.length === 0) {
        logsContent.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No logs available</div>';
        return;
      }
      
      // Format logs for display
      let logHtml = '';
      const recentLogs = logs.slice(-50); // Show only last 50 logs
      
      recentLogs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelColor = getLevelColor(log.level);
        const dataStr = log.data ? `\n${log.data}` : '';
        
        logHtml += `
          <div style="margin-bottom: 8px; padding: 4px; border-left: 3px solid ${levelColor}; background: rgba(255,255,255,0.05);">
            <div style="color: #888; font-size: 10px;">${timestamp} [${log.component}]</div>
            <div style="color: ${levelColor}; font-weight: bold; display: inline;">${log.level}</div>
            <div style="color: #fff; margin-left: 8px; display: inline;">${escapeHtml(log.message)}</div>
            ${dataStr ? `<div style="color: #ccc; font-size: 10px; margin-top: 2px; white-space: pre-wrap;">${escapeHtml(dataStr)}</div>` : ''}
          </div>
        `;
      });
      
      logsContent.innerHTML = logHtml;
      
      // Scroll to bottom
      logsContent.scrollTop = logsContent.scrollHeight;
      
    } catch (error) {
      logger.error('Failed to load logs', error);
      logsContent.innerHTML = '<div style="color: #ff4444; text-align: center; padding: 20px;">Error loading logs</div>';
    }
  }

  function getLevelColor(level) {
    const colors = {
      'DEBUG': '#888',
      'INFO': '#00ff88',
      'WARN': '#ffa500',
      'ERROR': '#ff4444'
    };
    return colors[level] || '#fff';
  }

  async function handleCopyLogs() {
    logger.info('Copying logs to clipboard');
    
    try {
      const logs = window.ExtensionLogs.get();
      
      if (logs.length === 0) {
        status.textContent = '⚠️ No logs to copy';
        return;
      }
      
      // Show copying feedback
      copyLogsBtn.textContent = '📋 Copying...';
      copyLogsBtn.disabled = true;
      
      // Format logs as text
      let logText = `YouTube AI Extension Logs - ${new Date().toISOString()}\n`;
      logText += '='.repeat(60) + '\n';
      logText += `Total Log Entries: ${logs.length}\n`;
      logText += `Session: ${window.location.href}\n`;
      logText += '='.repeat(60) + '\n\n';
      
      logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const dataStr = log.data ? `\n    Data: ${log.data}` : '';
        logText += `[${timestamp}] ${log.level.padEnd(5)} [${log.component}] ${log.message}${dataStr}\n`;
      });
      
      logText += '\n' + '='.repeat(60) + '\n';
      logText += 'End of logs\n';
      
      await copyToClipboard(logText);
      logger.info('Logs copied successfully', { logCount: logs.length });
      
      // Success feedback
      copyLogsBtn.textContent = '✅ Copied!';
      status.textContent = `📋 Copied ${logs.length} log entries to clipboard`;
      
      // Reset button after 2 seconds
      setTimeout(() => {
        copyLogsBtn.textContent = '📋 Copy All Logs';
        copyLogsBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      logger.error('Failed to copy logs', error);
      status.textContent = '❌ Failed to copy logs';
      
      // Reset button on error
      copyLogsBtn.textContent = '📋 Copy All Logs';
      copyLogsBtn.disabled = false;
    }
  }

  async function handleClearLogs() {
    logger.info('Clearing extension logs');
    
    if (confirm('Are you sure you want to clear all logs?')) {
      window.ExtensionLogs.clear();
      logsContent.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Logs cleared</div>';
      status.textContent = '🗑️ Logs cleared';
      logger.info('Extension logs cleared by user');
    }
  }

  async function handleRefreshLogs() {
    logger.info('Refreshing logs display');
    await loadLogs();
    status.textContent = '🔄 Logs refreshed';
  }
});