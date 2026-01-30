/**
 * API configuration and URLs from .env.
 * Set these in frontend-app/app/.env so you can switch backends without code changes.
 */

const env = typeof import.meta !== 'undefined' && (import.meta as any).env

function getEnv(key: string, fallback: string): string {
  const v = env?.[key]
  return (typeof v === 'string' && v.trim()) ? v.trim() : fallback
}

/** Base URL for the backend (e.g. http://localhost:3000). No trailing slash. */
export function getApiBase(): string {
  return getEnv('VITE_API_BASE_URL', window.location.origin).replace(/\/+$/, '')
}

/**
 * Path segment for session creation (e.g. "createSession").
 * Full URL: ${apiBase}/api/${path}/${cohortKey}
 */
export function getSessionPath(): string {
  return getEnv('VITE_API_PATH_SESSION', 'createSession')
}

/**
 * Path segment for chat (e.g. "chat/cohort").
 * Full URL: ${apiBase}/api/${path}/${cohortKey}
 */
export function getChatPath(): string {
  return getEnv('VITE_API_PATH_CHAT', 'chat/cohort')
}

/** Name of the response field that contains the chat answer (e.g. "answer" or "response"). */
export function getChatResponseField(): string {
  return getEnv('VITE_CHAT_RESPONSE_FIELD', 'answer')
}

/** API key for backend auth. Must match backend RAG_API_KEY. Sent as Authorization: Bearer <key>. */
export function getApiKey(): string {
  return getEnv('VITE_RAG_API_KEY', '')
}

/** Headers for authenticated API requests (session + chat). */
export function getApiHeaders(): Record<string, string> {
  const key = getApiKey()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) {
    headers['Authorization'] = `Bearer ${key}`
  }
  return headers
}

export function getSessionUrl(cohortKey: string): string {
  const base = getApiBase()
  const path = getSessionPath()
  return `${base}/api/${path}/${encodeURIComponent(cohortKey)}`
}

export function getChatUrl(cohortKey: string): string {
  const base = getApiBase()
  const path = getChatPath()
  return `${base}/api/${path}/${encodeURIComponent(cohortKey)}`
}

/** Optional config endpoint; if not set we use .env only. */
export function getConfigUrl(): string {
  const base = getApiBase()
  return `${base}/api/config`
}
