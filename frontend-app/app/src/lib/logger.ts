type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function getLevel(): LogLevel {
  const raw = String((import.meta as any).env?.VITE_LOG_LEVEL || 'info').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw
  return 'info'
}

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function shouldLog(level: LogLevel) {
  return order[level] >= order[getLevel()]
}

function fmt(message: string, data?: Record<string, unknown>) {
  return data ? [message, data] : [message]
}

export function logInfo(message: string, data?: Record<string, unknown>) {
  if (!shouldLog('info')) return
  console.info(...fmt(message, data))
}

export function logError(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
  if (!shouldLog('error')) return
  const errData =
    error instanceof Error
      ? { error: error.message, stack: error.stack, ...(data || {}) }
      : error != null
        ? { error, ...(data || {}) }
        : data
  console.error(...fmt(message, errData))
}

export function logWarn(message: string, data?: Record<string, unknown>) {
  if (!shouldLog('warn')) return
  console.warn(...fmt(message, data))
}

export function logDebug(message: string, data?: Record<string, unknown>) {
  if (!shouldLog('debug')) return
  console.debug(...fmt(message, data))
}

// Back-compat default export used by some older imports.
const logger = { info: logInfo, error: logError, warn: logWarn, debug: logDebug }
export default logger

