# Test Frontend

This directory contains a simple test frontend for testing the backend WebSocket server.

## Files

- `index.html` - Main test UI
- `app.js` - WebSocket client and audio handling logic

## Usage

1. Start the backend server: `npm run dev`
2. Open `http://localhost:3001` in your browser
3. Click "Connect" and allow microphone access
4. Start speaking!

## Features

- Real-time audio streaming
- Connection status indicator
- Transcription display (user and assistant)
- Volume meters (input and output)
- Error handling and display
- Configurable backend URLs

## Browser Compatibility

Requires:
- Modern browser with WebSocket support
- Web Audio API support
- getUserMedia API (for microphone access)

Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

