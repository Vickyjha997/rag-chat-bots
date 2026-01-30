# Quick Guide: Embed Widget on Any Website

## What You Need

1. **`widget.js`** - The embeddable loader script (stays in `public/iframe/`)
2. **Built React app** - After `npm run build`, everything is in `dist/`

## Current `public/` Structure

**Keep these (needed for embedding):**
- ✅ `public/iframe/widget.js` - Embeddable script
- ✅ `public/iframe/chat-widget.html` - Iframe entry point

**Removed (now in React):**
- ❌ `chat-widget.css` - Now in `src/iframe/widget/chat-widget.css`
- ❌ `gemini-voice-client.js` - Now in `src/iframe/widget/geminiVoiceClient.ts`

## How to Use on Different Websites

### 1. Build
```bash
cd frontend-app
npm run build
```

### 2. Deploy `dist/` Folder
Upload `dist/` to any static hosting:
- Vercel, Netlify, AWS S3, GitHub Pages, etc.

**Result:** Your widget is now at `https://your-cdn.com/`

### 3. Embed on Any Website
Add this to any website's HTML:

```html
<script
  src="https://your-cdn.com/iframe/widget.js"
  data-cohort-key="oxford-selp-cohort-4"
  data-api-base="https://your-backend.com"
  data-voice-http-base="https://your-backend.com"
  data-voice-ws-base="wss://your-backend.com:3001"
></script>
```

That's it! The widget will appear on their website.

## File Flow

```
Website embeds widget.js
  ↓
widget.js creates iframe → loads chat-widget.html
  ↓
chat-widget.html loads React app (from assets/)
  ↓
React app calls your backend API
```

## Important Notes

- **`widget.js` MUST stay in `public/`** - It's copied to `dist/` during build
- **Backend must allow CORS** from the CDN and embedding websites
- **Backend runs separately** - Only serves API, not frontend files
