import type { WidgetConfig } from './types'

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, '')
}

/**
 * Load widget config from .env and URL params.
 * Env: VITE_API_BASE (RAG backend), VITE_VOICE_HTTP, VITE_VOICE_WS (Gemini Voice Agent).
 * Local: .env.local; Docker: .env.docker (or build args). URL params override for embedding.
 */
export async function loadWidgetConfig(): Promise<WidgetConfig> {
  const urlParams = new URLSearchParams(window.location.search)

  const env = (import.meta as any).env
  const envApiBase = (env?.VITE_API_BASE as string) ?? ''
  const envVoiceHttp = (env?.VITE_VOICE_HTTP as string) ?? ''
  const envVoiceWs = (env?.VITE_VOICE_WS as string) ?? ''

  const cohortKey = urlParams.get('cohortKey') || ''
  if (!cohortKey) {
    throw new Error('cohortKey is required')
  }

  const apiBase = normalizeUrl(
    urlParams.get('apiBase') || envApiBase || window.location.origin
  )
  const voiceHttpBase = normalizeUrl(
    urlParams.get('voiceHttpBase') || envVoiceHttp || ''
  )
  const voiceWsBase = urlParams.get('voiceWsBase') || envVoiceWs || ''

  return {
    apiBase,
    cohortKey,
    source: urlParams.get('source') || 'chatbot',
    agentName: urlParams.get('agentName') || 'Steve',
    profileImage:
      urlParams.get('profileImage') ||
      'https://api.dicebear.com/7.x/bottts/svg?seed=Steve&backgroundColor=b6e3f4',
    parentOrigin: urlParams.get('parentOrigin') || '*',
    voiceHttpBase,
    voiceWsBase,
  }
}

