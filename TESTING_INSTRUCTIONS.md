# YouTube AI Article Generator - Testing Instructions

## Quick Start Testing

### 1. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select the extension directory
4. Note the extension ID for debugging

### 2. Initial Setup Testing
```javascript
// Open browser console (F12) and run:
runQuickTests()
```

### 3. Manual Testing Steps

#### A. Content Script Testing (On YouTube)
1. Navigate to a YouTube video with captions: https://www.youtube.com/watch?v=dQw4w9WgXcQ
2. Open console (F12) and look for debug messages starting with 🔍
3. Run: `extractTranscript()` to test transcript extraction
4. Check sessionStorage: `JSON.parse(sessionStorage.getItem('extractedTranscript'))`

#### B. Background Script Testing
1. Open extension popup
2. Check console for background script messages
3. Test message passing:
```javascript
chrome.runtime.sendMessage({type: 'GET_STATUS'}, console.log)
```

#### C. Popup Interface Testing
1. Click extension icon to open popup
2. Check console for initialization messages
3. Test each button and tab:
   - Extract Transcript
   - Settings panel
   - Tab navigation (Transcript/Key Points/Article)

#### D. API Integration Testing (Requires API Key)
1. Open settings in popup
2. Enter valid Anthropic API key
3. Test key validation and save
4. Extract transcript from a video
5. Test key points extraction
6. Test article generation

## Test Data

### Test YouTube URLs
- **With Transcripts**: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- **Educational**: https://www.youtube.com/watch?v=aircAruvnKk
- **Live/No Transcript**: https://www.youtube.com/watch?v=5qap5aO4i9A

### Mock Data Testing
```javascript
// Test with mock data
const mockTranscript = TestDataTemplates.getMockTranscriptData().short;
console.log('Mock transcript:', mockTranscript);
```

## Debugging Commands

### Console Commands
```javascript
// Run all tests
runQuickTests()

// Test specific components
const runner = new ExtensionTestRunner();
await runner.testTabManager()
await runner.testAnthropicAPI()

// Check storage
chrome.storage.local.get(null, console.log)

// Clear storage
chrome.storage.local.clear()

// Test transcript extraction
const response = await chrome.tabs.sendMessage(
  (await chrome.tabs.query({active: true}))[0].id, 
  {type: 'EXTRACT_TRANSCRIPT'}
)
```

### Debug Logging
All components now include detailed debug logging:
- 🔍 Debug messages
- ℹ️ Info messages  
- ⚠️ Warning messages
- ❌ Error messages
- ⏱️ Performance timing

## Common Issues & Solutions

### 1. Extension Not Loading
- Check manifest.json syntax
- Ensure all required files exist
- Check browser console for errors

### 2. Content Script Not Working
- Verify you're on a YouTube page
- Check content script injection in DevTools > Sources
- Look for CORS or permission errors

### 3. API Errors
- Verify API key format (starts with sk-ant-)
- Check rate limits and quotas
- Test with shorter transcripts first

### 4. Storage Issues
- Check storage quota usage
- Clear extension storage if corrupted
- Verify permissions in manifest.json

## Test Results Interpretation

### Success Indicators
- ✅ All major tests passing (>90% success rate)
- 📊 Clean debug logs without errors
- 🎯 Transcript extraction working on test videos
- 🤖 API calls completing successfully (if key provided)

### Failure Indicators
- ❌ Component initialization failures
- 🚫 Permission or CORS errors
- 💥 Unhandled JavaScript exceptions
- 📦 Storage quota exceeded

## Performance Benchmarks

### Expected Performance
- Transcript extraction: < 5 seconds
- Key points generation: < 30 seconds
- Article generation: < 45 seconds
- Storage operations: < 1 second

### Memory Usage
- Extension should use < 50MB RAM
- Storage should stay under 8MB
- No memory leaks in long sessions

## Automated Testing Schedule

### Daily Testing
```bash
# Run quick tests
node -e "console.log('Run runQuickTests() in browser console')"
```

### Before Deployment
1. Run full test suite: `runQuickTests()`
2. Test on multiple YouTube videos
3. Test with different API key states
4. Test storage cleanup and limits
5. Performance testing with large transcripts

## Bug Report Template

When reporting issues, include:
1. Extension version and browser version
2. Console logs with timestamps
3. Steps to reproduce
4. Expected vs actual behavior
5. Storage state: `chrome.storage.local.get(null, console.log)`
6. Test results from `runQuickTests()`

## Test Coverage

### Components Tested
- ✅ Background Service Worker
- ✅ Content Script (YouTube integration)
- ✅ Popup Interface
- ✅ Tab Manager (storage/state)
- ✅ Anthropic API Integration
- ✅ Error Handling
- ✅ End-to-End Workflows

### Edge Cases Covered
- Invalid API keys
- Network failures
- Storage quota limits
- Multiple tab scenarios
- Videos without transcripts
- Rate limiting
- Large transcript handling