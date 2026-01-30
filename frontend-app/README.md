## frontend-app

This folder contains the **React frontend** used to develop/test the chat widget UI.

### Key design points

- **Single shared sessionId**: text + voice use the same `sessionId` created by `POST /api/cohorts/:cohortKey/session`, so message ordering stays consistent.
- **Shared backend routes**: voice tool-calling uses the existing backend route `POST /api/cohorts/:cohortKey/chat`.
- **Env-only configuration**: URLs/ports/keys must come from `.env` (no hard-coded values in code, except safe defaults).
- **Backend runs in `app/`**: chat + voice REST run on port 3000; voice WS runs on port 3001.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env` file** (copy from `.env.example`):
   ```env
   # Frontend Configuration
   VITE_API_BASE_URL=http://localhost:3000
   VITE_VOICE_HTTP_BASE_URL=http://localhost:3000
   VITE_VOICE_WS_BASE_URL=ws://localhost:3001
   VITE_LOG_LEVEL=info
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

4. Voice backend is started by the main backend (`app/`) automatically.

## Prerequisites

- The main backend server must be running (see `../app/`):
  - Chat + Voice REST: `http://localhost:3000`
  - Voice WS: `ws://localhost:3001`

## Available Scripts

- `npm run dev` - Start Vite development server (port 5173)
- `npm run build` - Build React app to `dist/` folder
- `npm run preview` - Preview production build (serves from `dist/`)

## Building for Production

The React frontend builds to its own `dist/` folder and runs separately from the backend:

```bash
cd frontend-app
npm run build
```

This will:
1. Compile TypeScript
2. Build React app with Vite (outputs to `dist/`)
3. All static files are included in the build

**Note**: Frontend and backend run separately:
- **Frontend**: Runs on port 5173 (dev) or serves from `dist/` (production)
- **Backend**: Runs on port 3000 (HTTP) and 3001 (WebSocket)

## Project Structure

```
frontend-app/
├── src/
│   ├── App.tsx              # Main React app
│   ├── main.tsx             # React entry point
│   ├── iframe/              # Chat widget iframe
│   │   ├── main.tsx
│   │   └── widget/
│   │       ├── WidgetApp.tsx
│   │       ├── config.ts
│   │       └── types.ts
│   └── lib/                 # Utilities
├── public/                  # Static assets
├── index.html              # Main HTML entry
└── vite.config.ts          # Vite configuration
```

## Environment Variables

### Frontend Variables (must be prefixed with `VITE_`)

- `VITE_API_BASE_URL` - Main backend API URL (default: http://localhost:3000)
- `VITE_VOICE_HTTP_BASE_URL` - Voice backend HTTP URL (default: http://localhost:3000)
- `VITE_VOICE_WS_BASE_URL` - Voice backend WebSocket URL (default: ws://localhost:3001)
- `VITE_LOG_LEVEL` - Logging level (default: info)

**Note**: Voice backend env vars live in `app/.env` now.

## Troubleshooting

### Frontend not connecting to backend

1. Ensure the main backend is running on port 3000
2. Check that `.env` file exists and has correct URLs
3. Check browser console for CORS or network errors
4. Verify Vite proxy configuration in `vite.config.ts`

### Port 5173 already in use

Change the port in `vite.config.ts`:
```typescript
server: {
  port: 5174, // or any available port
}
```

### Environment variables not working

- Variables must start with `VITE_` prefix
- Restart the dev server after changing `.env` files
- Check that `.env` file is in the `frontend-app/` directory
