/**
 * Structured error logging for the voice backend.
 * Logs with context (route/sessionId), message, optional code/reason, and stack in development.
 */

const isDev = process.env.NODE_ENV !== 'production';

export interface LogContext {
  route?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ErrorLike {
  message?: string;
  code?: string | number;
  reason?: string;
  stack?: string;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function toErrorLike(err: unknown): ErrorLike {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === 'string' ? e.message : toMessage(err),
      code: e.code as string | number | undefined,
      reason: typeof e.reason === 'string' ? e.reason : undefined,
      stack: typeof e.stack === 'string' ? e.stack : undefined,
    };
  }
  return { message: toMessage(err) };
}

/**
 * Log an error with structured context. Use for API routes, WebSocket handlers, and services.
 */
export function logError(
  context: string | LogContext,
  err: unknown
): void {
  const ctx = typeof context === 'string' ? { route: context } : context;
  const e = toErrorLike(err);
  const payload: Record<string, unknown> = {
    level: 'error',
    ts: new Date().toISOString(),
    ...ctx,
    message: e.message,
  };
  if (e.code != null) payload.code = e.code;
  if (e.reason != null) payload.reason = e.reason;
  if (isDev && e.stack) payload.stack = e.stack;
  // eslint-disable-next-line no-console
  console.error('[ERROR]', JSON.stringify(payload));
  if (isDev && e.stack) {
    // eslint-disable-next-line no-console
    console.error(e.stack);
  }
}

/**
 * Log a warning with optional context.
 */
export function logWarn(
  context: string | LogContext,
  message: string,
  extra?: Record<string, unknown>
): void {
  const ctx = typeof context === 'string' ? { route: context } : context;
  const payload = {
    level: 'warn',
    ts: new Date().toISOString(),
    ...ctx,
    message,
    ...(extra || {}),
  };
  // eslint-disable-next-line no-console
  console.warn('[WARN]', JSON.stringify(payload));
}
