## frontend-app

This folder contains the **React frontend** used to develop/test the chat widget UI.

### Key design points

- **Single shared sessionId**: text + voice use the same RAG `sessionId`; voice agent gets it via `ragContext` and calls RAG as a tool.
- **Voice → RAG**: WebSocket to Gemini Voice Agent (VITE_VOICE_WS); agent calls RAG backend (VITE_API_BASE) via tool; no direct frontend→backend tool calls.
- **Env-only configuration**: VITE_API_BASE, VITE_VOICE_HTTP, VITE_VOICE_WS from `.env.local` (local) or `.env.docker` (Docker); no hardcoded URLs.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env.local`** for local development (or copy from `app/.env.local`):
   ```env
   VITE_API_BASE=http://localhost:8080
   VITE_VOICE_HTTP=http://localhost:3001
   VITE_VOICE_WS=ws://localhost:3002
   VITE_LOG_LEVEL=info
   ```
   For Docker builds use `app/.env.docker`; URLs use host ports (e.g. 40080, 40001, 40002).

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

## Prerequisites

- **Local**: RAG backend (e.g. port 8080), Gemini Voice Agent (HTTP 3001, WS 3002). Set VITE_API_BASE, VITE_VOICE_HTTP, VITE_VOICE_WS in `app/.env.local`.
- **Docker**: Use root `docker compose up`; frontend uses host ports (40080, 40001, 40002) via `app/.env.docker` or build args.

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

**Note**: Frontend, RAG backend, and Voice Agent run separately. Frontend uses env vars to reach them (local or host ports in Docker).

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

### Frontend (prefix `VITE_`). No hardcoded URLs; use `.env.local` (local) or `.env.docker` (Docker).

- `VITE_API_BASE` - RAG backend HTTP base (e.g. http://localhost:8080)
- `VITE_VOICE_HTTP` - Gemini Voice Agent HTTP base (e.g. http://localhost:3001)
- `VITE_VOICE_WS` - Gemini Voice Agent WebSocket URL (e.g. ws://localhost:3002)
- `VITE_LOG_LEVEL` - Logging level (default: info)

**Local**: browser uses localhost + above ports. **Docker**: use host-mapped ports (e.g. 40080, 40001, 40002) in `app/.env.docker` or build args.

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
