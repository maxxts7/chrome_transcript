// Background service worker for Click and Error Logger extension

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Click and Error Logger extension installed/updated');
  
  if (details.reason === 'install') {
    console.log('Extension installed for the first time');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Extension startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log('Click and Error Logger extension started');
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        status: 'active',
        version: chrome.runtime.getManifest().version,
        tabId: sender.tab?.id || 'unknown'
      });
      break;
      
    case 'LOG_EVENT':
      console.log('Event logged from tab:', sender.tab?.id, message.data);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
});

// Tab update handler - inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
  }
});

console.log('Background script loaded');