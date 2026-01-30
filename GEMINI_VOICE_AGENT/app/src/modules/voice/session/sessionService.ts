import { v4 as uuidv4 } from 'uuid';
import type { Session } from '../../../common/types.js';
import { SESSION_TIMEOUT_MS, MEMORY_MAX_LENGTH } from '../../../common/constants.js';

/**
 * In-memory session store. Swap for Redis by replacing this Map with Redis client calls.
 */
const sessions = new Map<string, Session>();

const timeouts = new Map<string, NodeJS.Timeout>();

function scheduleCleanup(sessionId: string): void {
  const existing = timeouts.get(sessionId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    sessions.delete(sessionId);
    timeouts.delete(sessionId);
  }, SESSION_TIMEOUT_MS);
  timeouts.set(sessionId, t);
}

export function createSession(
  userId?: string,
  ragContext?: Session['ragContext']
): Session {
  const session: Session = {
    id: uuidv4(),
    userId,
    createdAt: new Date(),
    geminiSession: null,
    memory: [],
    ragContext,
  };
  sessions.set(session.id, session);
  scheduleCleanup(session.id);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function updateSession(
  sessionId: string,
  updates: Partial<Session>
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  sessions.set(sessionId, { ...session, ...updates });
  return true;
}

export function addToMemory(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.memory.push({ role, content });
  if (session.memory.length > MEMORY_MAX_LENGTH) {
    session.memory = session.memory.slice(-MEMORY_MAX_LENGTH);
  }
}

export function deleteSession(sessionId: string): boolean {
  const t = timeouts.get(sessionId);
  if (t) {
    clearTimeout(t);
    timeouts.delete(sessionId);
  }
  return sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    const age = now - session.createdAt.getTime();
    if (age > SESSION_TIMEOUT_MS) {
      deleteSession(id);
    }
  }
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}
