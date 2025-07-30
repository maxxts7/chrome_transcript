(function() {
  'use strict';

  // Initialize debug logger for content script
  let logger = null;
  
  function initializeContentLogger() {
    if (typeof DebugLogger !== 'undefined') {
      logger = new DebugLogger('ContentScript');
      logger.info('Content script logger initialized', { url: window.location.href });
    } else {
      // Fallback to simple logging
      logger = {
        info: (msg, data) => console.log(`🔍 [Content] ${msg}`, data),
        debug: (msg, data) => console.log(`🔍 [Content DEBUG] ${msg}`, data),
        warn: (msg, data) => console.warn(`🔍 [Content WARN] ${msg}`, data),
        error: (msg, error) => console.error(`🔍 [Content ERROR] ${msg}`, error),
        time: (label) => console.time(`⏱️ [Content] ${label}`),
        timeEnd: (label) => console.timeEnd(`⏱️ [Content] ${label}`)
      };
    }
  }

  // Initialize logger
  initializeContentLogger();

  // Legacy debug logging helper for compatibility
  function debugLog(message, data = null) {
    if (logger) {
      logger.debug(message, data);
    } else {
      const timestamp = new Date().toISOString().slice(11, 23);
      if (data) {
        console.log(`🔍 [${timestamp}] ${message}`, data);
      } else {
        console.log(`🔍 [${timestamp}] ${message}`);
      }
    }
  }

  // Function to automatically open transcript panel
  function openTranscriptPanel() {
    debugLog('🔓 Attempting to open transcript panel...');
    
    // Method 1: Look for the "Show transcript" button in video description area
    for (const selector of YouTubeSelectors.transcriptButtons) {
      const button = document.querySelector(selector);
      if (button) {
        debugLog(`  ✅ Found transcript button with selector: ${selector}`);
        button.click();
        debugLog('  🖱️ Clicked transcript button');
        return true;
      } else {
        debugLog(`  → No button found for: ${selector}`);
      }
    }
    
    // Method 2: Look for the three-dots menu and try to open transcript
    const moreActionsButton = document.querySelector(YouTubeSelectors.moreActionsButtons.join(', '));
    if (moreActionsButton) {
      debugLog('  🔍 Found "More actions" button, clicking...');
      moreActionsButton.click();
      
      // Wait a bit for menu to open, then look for transcript option
      setTimeout(() => {
        // Since :contains() doesn't work in querySelectorAll, we'll check text content
        const menuItems = document.querySelectorAll(YouTubeSelectors.menuItems.join(', '));
        for (const item of menuItems) {
          if (item.textContent.toLowerCase().includes('transcript')) {
            debugLog('  ✅ Found transcript menu item, clicking...');
            item.click();
            return true;
          }
        }
        debugLog('  ❌ No transcript option found in menu');
      }, 500);
    }
    
    // Method 3: Look for transcript toggle in video player controls
    const playerTranscriptButton = document.querySelector(`${YouTubeSelectors.playerControls.transcriptButton}, ${YouTubeSelectors.playerControls.ccButton}`);
    if (playerTranscriptButton) {
      debugLog('  ✅ Found player transcript button');
      playerTranscriptButton.click();
      return true;
    }
    
    debugLog('  ❌ Could not find any way to open transcript panel');
    return false;
  }

  // Function to wait for transcript panel to load
  function waitForTranscriptPanel(maxWaitTime = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 200;
      
      const checkForTranscript = () => {
        const transcriptElements = document.querySelectorAll(YouTubeSelectors.transcriptPanel.join(', '));
        
        if (transcriptElements.length > 0) {
          debugLog(`  ✅ Transcript panel loaded with ${transcriptElements.length} segments`);
          resolve(transcriptElements);
        } else if (Date.now() - startTime > maxWaitTime) {
          debugLog(`  ⏰ Timeout waiting for transcript panel (${maxWaitTime}ms)`);
          resolve(null);
        } else {
          setTimeout(checkForTranscript, checkInterval);
        }
      };
      
      checkForTranscript();
    });
  }

  // Helper function to extract transcript from elements synchronously
  function extractTranscriptSync(transcriptItems) {
    const transcript = [];
    debugLog(`  📝 Processing ${transcriptItems.length} transcript items`);
    let validSegments = 0;
    let rejectedEmpty = 0;
    let rejectedShort = 0;
    
    transcriptItems.forEach((item, index) => {
      let timeElement = null;
      let textElement = null;
      
      // Find timestamp element
      for (const sel of YouTubeSelectors.transcriptSegments.timestamp) {
        timeElement = item.querySelector(sel);
        if (timeElement) break;
      }
      
      // Find text element
      for (const sel of YouTubeSelectors.transcriptSegments.text) {
        textElement = item.querySelector(sel);
        if (textElement) break;
      }
      
      const timestamp = timeElement ? timeElement.textContent.trim() : `${index}`;
      const text = textElement ? textElement.textContent.trim() : '';
      
      if (!text) {
        rejectedEmpty++;
        debugLog(`    → Segment ${index}: empty text (rejected)`);
      } else if (text.length < 3) {
        rejectedShort++;
        debugLog(`    → Segment ${index}: "${text}" too short (rejected)`);
      } else {
        validSegments++;
        transcript.push({ timestamp, text });
        debugLog(`    → Segment ${index}: [${timestamp}] "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (accepted)`);
      }
    });
    
    debugLog(`  📊 Results: ${validSegments} valid, ${rejectedEmpty} empty, ${rejectedShort} too short`);
    return transcript;
  }

  // Fallback extraction methods
  function extractTranscriptFallback() {
    const transcript = [];
    
    // Method 2: Try captions/subtitles if available
    debugLog('🎯 Method 2: Caption segments');
    
    let captionElements = [];
    for (const selector of YouTubeSelectors.captions) {
      const elements = document.querySelectorAll(selector);
      debugLog(`  → Trying selector: '${selector}' - found ${elements.length} elements`);
      if (elements.length > 0) {
        captionElements = Array.from(elements);
        debugLog(`  ✅ Using selector: '${selector}'`);
        break;
      }
    }
    
    if (captionElements.length > 0) {
      debugLog(`  📝 Processing ${captionElements.length} caption elements`);
      let validCaptions = 0;
      
      captionElements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text && text.length >= 3) {
          validCaptions++;
          transcript.push({ timestamp: `${index}`, text });
          debugLog(`    → Caption ${index}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (accepted)`);
        } else {
          debugLog(`    → Caption ${index}: "${text}" (rejected - empty/short)`);
        }
      });
      
      debugLog(`  📊 Results: ${validCaptions} valid captions`);
      
      if (transcript.length > 0) {
        return transcript;
      }
    }
    
    // Method 3: Try any text content that looks like transcript
    debugLog('🎯 Method 3: General transcript elements');
    
    let possibleElements = [];
    for (const selector of YouTubeSelectors.generalTranscript) {
      const elements = document.querySelectorAll(selector);
      debugLog(`  → Trying selector: '${selector}' - found ${elements.length} elements`);
      if (elements.length > 0) {
        possibleElements = Array.from(elements);
        break;
      }
    }
    
    if (possibleElements.length > 0) {
      debugLog(`  📝 Processing ${possibleElements.length} general elements`);
      let validElements = 0;
      
      possibleElements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text && text.length > 10) {
          validElements++;
          transcript.push({ timestamp: `${index}`, text });
          debugLog(`    → Element ${index}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (accepted)`);
        } else {
          debugLog(`    → Element ${index}: "${text}" (rejected - too short)`);
        }
      });
      
      debugLog(`  📊 Results: ${validElements} valid elements`);
    }
    
    return transcript;
  }

  // Focused functions for transcript extraction (Single Responsibility Principle)
  
  // Function to validate if we're on a supported platform
  function validatePlatform() {
    if (!window.location.hostname.includes('youtube.com')) {
      debugLog('❌ Not on YouTube domain');
      return false;
    }
    return true;
  }

  // Function to detect existing transcript elements on the page
  function detectTranscriptElements() {
    debugLog('🎯 Detecting transcript elements...');
    
    for (const selector of YouTubeSelectors.transcriptPanel) {
      const elements = document.querySelectorAll(selector);
      debugLog(`  → Trying selector: '${selector}' - found ${elements.length} elements`);
      if (elements.length > 0) {
        debugLog(`  ✅ Using selector: '${selector}'`);
        return elements;
      }
    }
    
    debugLog('  ❌ No transcript elements found');
    return null;
  }

  // Function to attempt opening transcript panel and wait for elements
  async function attemptTranscriptPanelOpening() {
    debugLog('  🚪 Attempting to open transcript panel...');
    
    const opened = openTranscriptPanel();
    if (!opened) {
      debugLog('  ❌ Could not open transcript panel');
      return null;
    }
    
    debugLog('  ⏳ Waiting for transcript panel to load...');
    const loadedElements = await waitForTranscriptPanel();
    
    if (loadedElements && loadedElements.length > 0) {
      debugLog('  ✅ Transcript panel loaded successfully');
      return loadedElements;
    } else {
      debugLog('  ❌ Transcript panel failed to load');
      return null;
    }
  }

  // Function to get video metadata for debugging
  function getVideoMetadata() {
    // Try each title selector until we find one
    let title = 'Unknown';
    for (const selector of YouTubeSelectors.videoInfo.title) {
      const element = document.querySelector(selector);
      if (element) {
        title = element.textContent?.trim() || 'Unknown';
        break;
      }
    }
    
    return {
      title: title,
      hasCC: !!document.querySelector(YouTubeSelectors.playerControls.subtitlesButton),
      playerState: document.querySelector(YouTubeSelectors.playerControls.player)?.className || 'Unknown'
    };
  }

  // Function to log extraction results and provide troubleshooting
  function logExtractionResults(transcript, duration) {
    debugLog(`⏱️ Extraction completed in ${duration}ms`);
    debugLog(`🎬 Video info:`, getVideoMetadata());
    
    if (transcript.length === 0) {
      debugLog('❌ No transcript segments found with any method');
      debugLog('🔧 Troubleshooting suggestions:');
      debugLog('   - Check if captions/subtitles are enabled (CC button)');
      debugLog('   - Try waiting for video to fully load');
      debugLog('   - Check if transcript panel is open (click "Show transcript")');
      debugLog('   - Some videos may not have transcripts available');
    } else {
      debugLog(`✅ Successfully extracted ${transcript.length} transcript segments`);
    }
  }

  // Main transcript extraction functionality (refactored to use focused functions)
  async function extractTranscript() {
    const startTime = performance.now();
    
    debugLog('TRANSCRIPT DEBUG - Starting extraction...');
    debugLog('Page URL:', window.location.href);
    debugLog('Page load state:', document.readyState);
    debugLog('DOM elements count:', document.querySelectorAll(YouTubeSelectors.common.allElements).length);
    
    // Validate platform
    if (!validatePlatform()) {
      return [];
    }
    
    // Try to find existing transcript elements
    let transcriptItems = detectTranscriptElements();
    
    // If no elements found, try to open transcript panel
    if (!transcriptItems) {
      transcriptItems = await attemptTranscriptPanelOpening();
    }
    
    // Extract transcript data
    let transcript = [];
    if (transcriptItems && transcriptItems.length > 0) {
      transcript = extractTranscriptSync(transcriptItems);
    } else {
      // Use fallback methods if main extraction failed
      transcript = extractTranscriptFallback();
    }
    
    // Log results and performance
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    logExtractionResults(transcript, duration);
    
    return transcript;
  }

  // Function to log transcript
  async function logTranscript() {
    debugLog('🚀 logTranscript() called');
    const transcript = await extractTranscript();
    const timestamp = new Date().toISOString();
    
    if (transcript && transcript.length > 0) {
      console.group(`📝 TRANSCRIPT EXTRACTED - ${timestamp}`);
      console.log(`Found ${transcript.length} transcript segments`);
      console.log('Page URL:', window.location.href);
      console.table(transcript);
      console.log('Raw transcript data:', transcript);
      console.groupEnd();
      
      // Store in session for popup access
      try {
        const transcriptData = {
          url: window.location.href,
          timestamp: timestamp,
          segments: transcript
        };
        sessionStorage.setItem('extractedTranscript', JSON.stringify(transcriptData));
        debugLog('✅ Transcript stored in sessionStorage', transcriptData);
      } catch (e) {
        debugLog('❌ Could not store transcript in sessionStorage:', e);
      }
      
      return transcript;
    } else {
      debugLog(`❌ No transcript found on page: ${window.location.href}`);
      return null;
    }
  }

  // Auto-extract transcript on YouTube pages
  function autoExtractTranscript() {
    debugLog('🎬 autoExtractTranscript() called');
    if (window.location.hostname.includes('youtube.com')) {
      debugLog('✅ On YouTube domain, scheduling extraction...');
      // Wait for page to load, then try to extract
      setTimeout(async () => {
        debugLog('⏰ First extraction attempt (2s delay)');
        const transcript = await logTranscript();
        if (!transcript || transcript.length === 0) {
          debugLog('⏰ No transcript found, trying again in 3s...');
          // Try again after more loading time
          setTimeout(async () => {
            debugLog('⏰ Second extraction attempt (5s total delay)');
            await logTranscript();
          }, 3000);
        }
      }, 2000);
    } else {
      debugLog('❌ Not on YouTube domain, skipping auto-extraction');
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // logger.info('Content script message received', {
    //   messageType: message?.type,
    //   messageId: message?.messageId
    // });
    
    if (message.type === 'EXTRACT_TRANSCRIPT') {
      // logger.info('Processing EXTRACT_TRANSCRIPT request', {
      //   messageId: message.messageId,
      //   isYouTube: window.location.hostname.includes('youtube.com')
      // });
      
      // Handle async extraction
      (async () => {
        try {
          const transcript = await logTranscript();
          
          // logger.info('Transcript extraction completed', {
          //   transcriptLength: transcript?.length || 0
          // });

          const response = { 
            transcript, 
            url: window.location.href,
            extractedAt: new Date().toISOString(),
            messageId: message.messageId
          };
          
          // logger.info('Sending transcript response', {
          //   transcriptLength: response.transcript?.length || 0,
          //   url: response.url
          // });
          
          sendResponse(response);
          
        } catch (error) {
          logger.error('Content script extraction error', {
            error: error.message,
            messageId: message.messageId
          });

          const errorResponse = { 
            transcript: null, 
            url: window.location.href, 
            error: error.message,
            messageId: message.messageId,
            errorAt: new Date().toISOString()
          };
          
          sendResponse(errorResponse);
        }
      })();
      
      // Return true to indicate we'll send response asynchronously
      return true;
      
    } else if (message.type === 'GET_STORED_TRANSCRIPT') {
      try {
        const stored = sessionStorage.getItem('extractedTranscript');
        const parsedTranscript = stored ? JSON.parse(stored) : null;
        sendResponse({ transcript: parsedTranscript });
      } catch (e) {
        logger.error('Error retrieving stored transcript', { error: e.message });
        sendResponse({ transcript: null });
      }
    } else if (message.type === 'PING') {
      sendResponse({ 
        pong: true, 
        timestamp: Date.now(),
        url: window.location.href
      });
    } else {
      logger.warn('Unknown message type', { messageType: message.type });
    }
  });


  // Initialize transcript extraction for YouTube
  debugLog('🚀 Initializing YouTube Transcript Extractor...');
  debugLog('🌐 Current URL:', window.location.href);
  debugLog('📄 Document ready state:', document.readyState);
  
  autoExtractTranscript();

  console.log('📝 YouTube Transcript Extractor initialized on:', window.location.href);
})();