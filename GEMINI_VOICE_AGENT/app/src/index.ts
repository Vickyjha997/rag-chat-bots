import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logError } from './common/errorLog.js';
import { createVoiceApiRouter } from './modules/voice/indexRoutes.js';
import { initGeminiService } from './modules/voice/gemini/geminiService.js';
import { handleConnection } from './modules/voice/realtime/realtimeHandler.js';
import { createSession, getSession } from './modules/voice/session/sessionService.js';
import { cleanupExpiredSessions } from './modules/voice/session/sessionService.js';
import { SESSION_CLEANUP_INTERVAL_MS } from './common/constants.js';

import './modules/voice/tools/cohortChatTool.js';
import './modules/voice/tools/exampleTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const WS_PORT = Number(process.env.WS_PORT) || 3002;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ||
  ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.use('/api', createVoiceApiRouter(PORT, WS_PORT));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logError({ route: 'http' }, err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

initGeminiService(process.env.GEMINI_API_KEY || '');

setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`[HTTP] Server running on http://localhost:${PORT}`);
  console.log(`[HTTP] Health check: http://localhost:${PORT}/health`);
});

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  let sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    const session = createSession();
    sessionId = session.id;
  } else {
    const session = getSession(sessionId);
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }
  }
  console.log('[WS] New connection:', sessionId);
  handleConnection(ws, sessionId);
});

wss.on('listening', () => {
  console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log(`[WS] Connect with: ws://localhost:${WS_PORT}?sessionId=<your-session-id>`);
});

function shutdown(): void {
  console.log('[Server] Shutting down gracefully...');
  wss.close(() => {
    console.log('[WS] WebSocket server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
