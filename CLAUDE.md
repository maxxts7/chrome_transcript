# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YouTube AI Article Generator Chrome extension that extracts video transcripts and uses Anthropic Claude AI to generate key points and articles. The extension has evolved from a simple transcript extractor into a comprehensive AI-powered content generation tool with multi-tab state management.

## Key Architecture Components

### Chrome Extension Structure
- **Manifest V3** architecture with service worker background script
- **Content Scripts** injected into YouTube pages for transcript extraction  
- **Popup Interface** with tabbed UI for transcript, key points, and article views
- **Multi-tab State Management** preserving data across browser sessions

### Core Components
- `background.js` - Service worker handling tab management, content script injection, and message passing
- `content.js` - YouTube page integration for transcript extraction with multiple fallback methods
- `popup.js` - Main UI logic with comprehensive tab state management
- `anthropic-api.js` - Claude API integration for AI content generation
- `tab-manager.js` - Centralized multi-tab state persistence system
- `debug-utils.js` - Logging framework with storage persistence

### Data Flow
1. Content script extracts transcript from YouTube's DOM
2. Tab manager persists transcript data with tab-specific state
3. Anthropic API processes transcript to generate key points and articles
4. All data persists across browser sessions and tab switches

## Development Commands

### Testing
```bash
npm test           # Run Jest test suite
npm run test:watch    # Watch mode for development
npm run test:coverage # Coverage report
npm run test:debug    # Verbose test output
```

### Debug and Logs
```bash
npm run test:logs  # View latest test logs
```

### Browser Testing
The extension includes comprehensive browser testing through console commands:
```javascript
// In browser console on any page:
runQuickTests()    // Run full test suite
```

## Chrome Extension Development

### Loading the Extension
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select project directory
4. Extension appears with transcript icon

### Testing Content Scripts
Navigate to any YouTube video and check browser console for debug messages starting with 🔍. The content script automatically attempts transcript extraction on YouTube watch pages.

### Background Script Debugging
Background script logs appear in the extension's service worker console accessible through `chrome://extensions/` > extension details > "Inspect views: service worker".

## Key Implementation Details

### Transcript Extraction Strategy
Multiple fallback methods implemented for robust transcript extraction:
1. YouTube's native transcript panel (attempts to auto-open)
2. Live caption segments from video player
3. General page content scanning for transcript-like elements

### State Management
- Tab states persist in `chrome.storage.local` with 8MB limit management
- Automatic cleanup of old tab data (24-hour retention)
- Data preserved across YouTube SPA navigation and browser sessions
- Processing states tracked to prevent duplicate API calls

### Error Handling
- Comprehensive error logging through DebugLogger system
- Automatic content script re-injection on failures
- API retry logic with exponential backoff
- User-friendly error messages with actionable guidance

### Testing Framework
Includes Jest-based testing with jsdom environment plus browser-based integration testing. Test utilities provide mock data and component validation.

## API Integration

### Anthropic Claude API
- Requires API key starting with `sk-ant-`
- Uses Claude Sonnet 4 model for content generation  
- Implements rate limiting and retry logic
- Supports key points extraction and article generation workflows

### Storage Management
- 8MB storage limit with automatic cleanup
- Logs preserved with 1000-entry limit
- API keys encrypted in Chrome storage
- Tab data cleanup after 24 hours

## Common Development Workflows

### Adding New AI Features
1. Extend `anthropic-api.js` with new prompt templates
2. Add UI components to `popup.html` and corresponding logic in `popup.js`
3. Update tab state schema in `tab-manager.js` if needed
4. Add tests in `/tests` directory

### Debugging Extension Issues
1. Check service worker logs in Chrome extensions page
2. Use browser console commands like `runQuickTests()`
3. Inspect Chrome storage via DevTools > Application > Storage
4. Review extension logs through popup logs panel

### Content Script Issues
1. Verify YouTube page compatibility with different layouts
2. Check transcript extraction selectors against current YouTube DOM
3. Test auto-injection logic for non-responsive content scripts

The extension uses comprehensive logging throughout all components, making debugging straightforward through both browser console and built-in logs panel.