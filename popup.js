document.addEventListener('DOMContentLoaded', async () => {
  // Initialize components
  const anthropicAPI = new window.AnthropicAPI();
  
  // Update version number
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = `v${manifest.version}`;
  }

  // DOM elements
  const extractBtn = document.getElementById('extract-btn');
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

  // State variables
  let currentTranscript = null;
  let currentKeyPoints = null;
  let currentArticle = null;

  // Initialize on load
  await initializeExtension();

  // Event Listeners
  extractBtn.addEventListener('click', handleExtractTranscript);
  settingsBtn.addEventListener('click', toggleSettingsPanel);
  extractPointsBtn.addEventListener('click', handleExtractKeyPoints);
  generateArticleBtn.addEventListener('click', handleGenerateArticle);
  
  // Settings panel events
  saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  testApiKeyBtn.addEventListener('click', handleTestApiKey);
  clearApiKeyBtn.addEventListener('click', handleClearApiKey);
  apiKeyInput.addEventListener('input', handleApiKeyInput);
  
  // Tab navigation events
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Copy/Export button events
  copyTranscriptBtn.addEventListener('click', () => copyToClipboard(formatTranscriptAsText(currentTranscript)));
  exportTranscriptBtn.addEventListener('click', () => exportAsFile(formatTranscriptAsText(currentTranscript), `${sanitizeFileName(currentTranscript?.title || 'transcript')}.txt`));
  copyKeypointsBtn.addEventListener('click', () => copyToClipboard(currentKeyPoints));
  exportKeypointsBtn.addEventListener('click', () => exportAsFile(currentKeyPoints, `${sanitizeFileName(currentTranscript?.title || 'keypoints')}_keypoints.txt`));
  copyArticleBtn.addEventListener('click', () => copyToClipboard(currentArticle));
  exportArticleBtn.addEventListener('click', () => exportAsFile(currentArticle, `${sanitizeFileName(currentTranscript?.title || 'article')}_article.txt`));

  // Core Functions
  async function initializeExtension() {
    // Load API key and check status
    await updateApiKeyStatus();
    
    // Load any stored transcript
    await loadStoredTranscript();
    
    console.log('AI Article Generator popup initialized');
  }

  async function handleExtractTranscript() {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    status.textContent = 'Extracting transcript from page...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('youtube.com')) {
        status.textContent = '❌ Please navigate to a YouTube video';
        resetExtractButton();
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TRANSCRIPT' });
      
      if (response?.transcript && response.transcript.length > 0) {
        currentTranscript = {
          url: response.url,
          timestamp: new Date().toISOString(),
          segments: response.transcript,
          title: await getVideoTitle(tab)
        };
        
        displayTranscript(currentTranscript);
        status.textContent = `✅ Extracted ${response.transcript.length} segments`;
        
        // Enable AI buttons if API key is available
        updateButtonStates();
        
      } else {
        status.textContent = '❌ No transcript found - try enabling captions first';
        showTranscriptEmptyState();
      }
    } catch (error) {
      console.error('Error extracting transcript:', error);
      status.textContent = '❌ Error extracting transcript - reload the page and try again';
      showTranscriptEmptyState();
    }

    resetExtractButton();
  }

  async function handleExtractKeyPoints() {
    if (!currentTranscript) {
      status.textContent = '❌ No transcript available';
      return;
    }

    if (!anthropicAPI.apiKey) {
      status.textContent = '❌ Please configure your Anthropic API key first';
      switchTab('transcript');
      toggleSettingsPanel();
      return;
    }

    extractPointsBtn.disabled = true;
    extractPointsBtn.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Extracting Points...</div>';
    status.textContent = '🧠 AI is analyzing the transcript...';

    try {
      // Monitor for retry attempts
      const originalMakeRequest = anthropicAPI.makeRequest.bind(anthropicAPI);
      anthropicAPI.makeRequest = async function(apiKey, messages, maxTokens, retryCount = 0) {
        if (retryCount > 0) {
          status.textContent = `🔄 API busy, retrying... (attempt ${retryCount + 1}/4)`;
        }
        return originalMakeRequest(apiKey, messages, maxTokens, retryCount);
      };

      currentKeyPoints = await anthropicAPI.extractKeyPoints(currentTranscript);
      displayKeyPoints(currentKeyPoints);
      status.textContent = '✅ Key points extracted successfully';
      
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
      showKeypointsEmptyState();
    }

    extractPointsBtn.disabled = false;
    extractPointsBtn.textContent = '🧠 Extract Key Points';
  }

  async function handleGenerateArticle() {
    if (!currentKeyPoints || !currentTranscript) {
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

    try {
      // Monitor for retry attempts
      const originalMakeRequest = anthropicAPI.makeRequest.bind(anthropicAPI);
      anthropicAPI.makeRequest = async function(apiKey, messages, maxTokens, retryCount = 0) {
        if (retryCount > 0) {
          status.textContent = `🔄 API busy, retrying... (attempt ${retryCount + 1}/4)`;
        }
        return originalMakeRequest(apiKey, messages, maxTokens, retryCount);
      };

      currentArticle = await anthropicAPI.generateArticle(currentKeyPoints, currentTranscript);
      displayArticle(currentArticle);
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
    const hasTranscript = !!currentTranscript;
    const hasApiKey = !!anthropicAPI.apiKey;
    const hasKeyPoints = !!currentKeyPoints;

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
    copyArticleBtn.disabled = !currentArticle;
    exportArticleBtn.disabled = !currentArticle;
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
  async function loadStoredTranscript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STORED_TRANSCRIPT' });
        if (response?.transcript) {
          currentTranscript = response.transcript;
          currentTranscript.title = await getVideoTitle(tab);
          displayTranscript(currentTranscript);
          status.textContent = `📋 Loaded ${currentTranscript.segments.length} segments`;
          updateButtonStates();
        }
      }
    } catch (error) {
      console.log('No stored transcript available');
    }
  }

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
});