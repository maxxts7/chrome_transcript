(function() {
  'use strict';


  // Debug logging helper
  function debugLog(message, data = null) {
    const timestamp = new Date().toISOString().slice(11, 23);
    if (data) {
      console.log(`🔍 [${timestamp}] ${message}`, data);
    } else {
      console.log(`🔍 [${timestamp}] ${message}`);
    }
  }

  // Function to automatically open transcript panel
  function openTranscriptPanel() {
    debugLog('🔓 Attempting to open transcript panel...');
    
    // Method 1: Look for the "Show transcript" button in video description area
    const showTranscriptButtons = [
      'button[aria-label*="transcript" i]',
      'button[aria-label*="Show transcript" i]',
      '[role="button"][aria-label*="transcript" i]',
      'yt-button-renderer[aria-label*="transcript" i]'
    ];
    
    for (const selector of showTranscriptButtons) {
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
    const moreActionsButton = document.querySelector('button[aria-label*="More actions" i], button[aria-label*="Show more" i]');
    if (moreActionsButton) {
      debugLog('  🔍 Found "More actions" button, clicking...');
      moreActionsButton.click();
      
      // Wait a bit for menu to open, then look for transcript option
      setTimeout(() => {
        const transcriptMenuItems = [
          'yt-formatted-string:contains("Show transcript")',
          '[role="menuitem"]:contains("transcript")',
          'tp-yt-paper-listbox [role="option"]:contains("transcript")'
        ];
        
        // Since :contains() doesn't work in querySelectorAll, we'll check text content
        const menuItems = document.querySelectorAll('[role="menuitem"], [role="option"], yt-formatted-string');
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
    const playerTranscriptButton = document.querySelector('.ytp-transcript-button, .ytp-cc-button[aria-pressed="true"]');
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
        const transcriptElements = document.querySelectorAll(
          'ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer, [class*="transcript-segment"]'
        );
        
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
      const timeSelectors = ['.segment-timestamp', '[class*="timestamp"]', '.ytd-transcript-segment-renderer .timestamp'];
      const textSelectors = ['.segment-text', '[class*="segment-text"]', '.ytd-transcript-segment-renderer .text'];
      
      let timeElement = null;
      let textElement = null;
      
      // Find timestamp element
      for (const sel of timeSelectors) {
        timeElement = item.querySelector(sel);
        if (timeElement) break;
      }
      
      // Find text element
      for (const sel of textSelectors) {
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
    const captionSelectors = [
      '.ytp-caption-segment',
      '.captions-text',
      '[class*="caption"]',
      '.ytp-caption-window-container [class*="segment"]'
    ];
    
    let captionElements = [];
    for (const selector of captionSelectors) {
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
    const generalSelectors = [
      '[class*="transcript"] p',
      '[id*="transcript"] p',
      '.transcript-text',
      '[data-transcript]',
      '.video-transcript p'
    ];
    
    let possibleElements = [];
    for (const selector of generalSelectors) {
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

  // Main transcript extraction functionality with debug logging
  async function extractTranscript() {
    const transcript = [];
    const startTime = performance.now();
    
    debugLog('TRANSCRIPT DEBUG - Starting extraction...');
    debugLog('Page URL:', window.location.href);
    debugLog('Page load state:', document.readyState);
    debugLog('DOM elements count:', document.querySelectorAll('*').length);
    
    // Check if we're on YouTube
    if (!window.location.hostname.includes('youtube.com')) {
      debugLog('❌ Not on YouTube domain');
      return transcript;
    }
    
    // Method 1: Try YouTube's transcript panel (attempt to open if not found)
    debugLog('🎯 Method 1: YouTube transcript panel');
    const transcriptSelectors = [
      'ytd-transcript-segment-renderer',
      '.ytd-transcript-segment-renderer',
      '[class*="transcript-segment"]',
      'ytd-transcript-body-renderer [class*="segment"]',
      'ytd-transcript-renderer [class*="segment"]'
    ];
    
    let transcriptItems = null;
    for (const selector of transcriptSelectors) {
      const elements = document.querySelectorAll(selector);
      debugLog(`  → Trying selector: '${selector}' - found ${elements.length} elements`);
      if (elements.length > 0) {
        transcriptItems = elements;
        debugLog(`  ✅ Using selector: '${selector}'`);
        break;
      }
    }
    
    // If no transcript panel found, try to open it
    if (!transcriptItems || transcriptItems.length === 0) {
      debugLog('  🚪 No transcript panel found, attempting to open it...');
      const opened = openTranscriptPanel();
      
      if (opened) {
        debugLog('  ⏳ Waiting for transcript panel to load...');
        // Wait for transcript panel to load and try again
        return new Promise(async (resolve) => {
          const loadedElements = await waitForTranscriptPanel();
          if (loadedElements && loadedElements.length > 0) {
            // Recursively call extractTranscript to process the loaded elements
            debugLog('  🔄 Retrying extraction with loaded transcript panel...');
            const result = await extractTranscriptSync(loadedElements);
            resolve(result);
          } else {
            debugLog('  ❌ Transcript panel failed to load, continuing with other methods...');
            resolve(await extractTranscriptFallback());
          }
        });
      }
    }
    
    // Process transcript items if found
    if (transcriptItems && transcriptItems.length > 0) {
      const extractedTranscript = extractTranscriptSync(transcriptItems);
      transcript.push(...extractedTranscript);
    } else {
      // If no transcript panel items, use fallback methods
      const fallbackTranscript = extractTranscriptFallback();
      transcript.push(...fallbackTranscript);
    }
    
    // Additional debugging info
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    debugLog(`⏱️ Extraction completed in ${duration}ms`);
    debugLog(`🎬 Video info:`, {
      title: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title, .watch-title')?.textContent?.trim() || 'Unknown',
      hasCC: !!document.querySelector('.ytp-subtitles-button[aria-pressed="true"]'),
      playerState: document.querySelector('.html5-video-player')?.className || 'Unknown'
    });
    
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
    debugLog('📨 Message received from popup:', message);
    
    if (message.type === 'EXTRACT_TRANSCRIPT') {
      debugLog('🎯 Processing EXTRACT_TRANSCRIPT request');
      
      // Handle async extraction
      (async () => {
        try {
          const transcript = await logTranscript();
          const response = { transcript, url: window.location.href };
          debugLog('📤 Sending response:', response);
          sendResponse(response);
        } catch (error) {
          debugLog('❌ Error during transcript extraction:', error);
          sendResponse({ transcript: null, url: window.location.href, error: error.message });
        }
      })();
      
      // Return true to indicate we'll send response asynchronously
      return true;
      
    } else if (message.type === 'GET_STORED_TRANSCRIPT') {
      debugLog('📋 Processing GET_STORED_TRANSCRIPT request');
      try {
        const stored = sessionStorage.getItem('extractedTranscript');
        const parsedTranscript = stored ? JSON.parse(stored) : null;
        debugLog('📤 Sending stored transcript:', parsedTranscript);
        sendResponse({ transcript: parsedTranscript });
      } catch (e) {
        debugLog('❌ Error retrieving stored transcript:', e);
        sendResponse({ transcript: null });
      }
    } else {
      debugLog('❓ Unknown message type:', message.type);
    }
  });


  // Initialize transcript extraction for YouTube
  debugLog('🚀 Initializing YouTube Transcript Extractor...');
  debugLog('🌐 Current URL:', window.location.href);
  debugLog('📄 Document ready state:', document.readyState);
  
  autoExtractTranscript();

  console.log('📝 YouTube Transcript Extractor initialized on:', window.location.href);
})();