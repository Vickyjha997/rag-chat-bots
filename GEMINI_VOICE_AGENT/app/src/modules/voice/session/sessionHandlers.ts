import type { Request, Response } from 'express';
import * as sessionService from './sessionService.js';

export function createSessionHandler(req: Request, res: Response): void {
  const userId = (req.body.userId ?? req.headers['x-user-id']) as string | undefined;
  const ragContext = req.body?.ragContext
    ? {
        baseUrl: String(req.body.ragContext.baseUrl || process.env.RAG_BASE_URL || ''),
        cohortKey: String(req.body.ragContext.cohortKey || ''),
        ragSessionId: String(req.body.ragContext.sessionId ?? req.body.ragContext.ragSessionId ?? ''),
        agentName: req.body.ragContext.agentName ? String(req.body.ragContext.agentName) : undefined,
      }
    : undefined;
  const session = sessionService.createSession(userId, ragContext);
  res.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    ragContext: session.ragContext ?? null,
  });
}

export function getSessionHandler(req: Request, res: Response): void {
  const sessionId = req.params.sessionId;
  const session = sessionService.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    sessionId: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
    memoryLength: session.memory.length,
  });
}

export function deleteSessionHandler(req: Request, res: Response): void {
  const sessionId = req.params.sessionId;
  const deleted = sessionService.deleteSession(sessionId);
  if (!deleted) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ success: true });
}
