document.addEventListener('DOMContentLoaded', async () => {
  // Update version number
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = `v${manifest.version}`;
  }

  // DOM elements
  const extractBtn = document.getElementById('extract-btn');
  const copyBtn = document.getElementById('copy-btn');
  const exportBtn = document.getElementById('export-btn');
  const status = document.getElementById('status');
  const transcriptEmpty = document.getElementById('transcript-empty');
  const transcriptData = document.getElementById('transcript-data');

  let currentTranscript = null;

  // Load any stored transcript on popup open
  await loadStoredTranscript();

  // Extract transcript button handler
  extractBtn.addEventListener('click', async () => {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    status.textContent = 'Extracting transcript from page...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on YouTube
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
        
        // Enable copy and export buttons
        copyBtn.disabled = false;
        exportBtn.disabled = false;
        
      } else {
        status.textContent = '❌ No transcript found - try enabling captions first';
        showEmptyState();
      }
    } catch (error) {
      console.error('Error extracting transcript:', error);
      status.textContent = '❌ Error extracting transcript - reload the page and try again';
      showEmptyState();
    }

    resetExtractButton();
  });

  // Copy button handler
  copyBtn.addEventListener('click', async () => {
    if (!currentTranscript) return;
    
    const textContent = formatTranscriptAsText(currentTranscript);
    
    try {
      await navigator.clipboard.writeText(textContent);
      copyBtn.textContent = 'Copied!';
      copyBtn.style.background = '#00ff88';
      
      setTimeout(() => {
        copyBtn.textContent = 'Copy Text';
        copyBtn.style.background = '#4CAF50';
      }, 2000);
      
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Text';
      }, 2000);
    }
  });

  // Export button handler
  exportBtn.addEventListener('click', () => {
    if (!currentTranscript) return;
    
    const textContent = formatTranscriptAsText(currentTranscript);
    const videoTitle = currentTranscript.title || 'transcript';
    const fileName = sanitizeFileName(videoTitle) + '.txt';
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    exportBtn.textContent = 'Exported!';
    exportBtn.style.background = '#00ff88';
    
    setTimeout(() => {
      exportBtn.textContent = 'Export TXT';
      exportBtn.style.background = '#2196F3';
    }, 2000);
  });

  // Helper functions
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
          copyBtn.disabled = false;
          exportBtn.disabled = false;
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

  function displayTranscript(data) {
    if (!data || !data.segments || data.segments.length === 0) {
      showEmptyState();
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

  function showEmptyState() {
    transcriptEmpty.style.display = 'block';
    transcriptData.style.display = 'none';
    copyBtn.disabled = true;
    exportBtn.disabled = true;
  }

  function resetExtractButton() {
    extractBtn.disabled = false;
    extractBtn.textContent = 'Extract Transcript';
  }

  function formatTranscriptAsText(data) {
    let output = '';
    output += `${data.title || 'YouTube Video Transcript'}\n`;
    output += `${data.url}\n`;
    output += `Extracted: ${formatDate(data.timestamp)}\n`;
    output += `Segments: ${data.segments.length}\n\n`;
    output += '=' .repeat(50) + '\n\n';

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

  console.log('Transcript Extractor popup initialized');
});