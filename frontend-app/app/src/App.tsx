import { useEffect, useState } from 'react'

export default function App() {
  const [config, setConfig] = useState<{ apiBase: string; voiceHttpBase: string; voiceWsBase: string } | null>(null)
  const [cohortKey, setCohortKey] = useState('oxford-selp-cohort-4')
  const [iframeUrl, setIframeUrl] = useState('')

  useEffect(() => {
    // Env: VITE_API_BASE (RAG), VITE_VOICE_HTTP, VITE_VOICE_WS (voice agent). .env.local / .env.docker.
    const apiBase = ((import.meta as any).env?.VITE_API_BASE as string) || ''
    const voiceHttp = ((import.meta as any).env?.VITE_VOICE_HTTP as string) || ''
    const voiceWs = ((import.meta as any).env?.VITE_VOICE_WS as string) || ''
    const origin = window.location.origin.replace(':5173', ':3000')
    setConfig({
      apiBase: apiBase.replace(/\/+$/, '') || origin,
      voiceHttpBase: voiceHttp.replace(/\/+$/, '') || apiBase || origin,
      voiceWsBase: voiceWs || '',
    })
  }, [])

  useEffect(() => {
    if (!config) return

    const params = new URLSearchParams({
      cohortKey: cohortKey,
      apiBase: config.apiBase,
      source: 'website',
      agentName: 'Steve',
      voiceHttpBase: config.voiceHttpBase,
      voiceWsBase: config.voiceWsBase,
    })

    // In dev mode, Vite serves the iframe HTML from /iframe.html
    setIframeUrl(`/iframe.html?${params.toString()}`)
  }, [config, cohortKey])

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      <h1>React Frontend App - Widget Test</h1>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Cohort Key:
          <input
            type="text"
            value={cohortKey}
            onChange={(e) => setCohortKey(e.target.value)}
            style={{ marginLeft: 8, padding: 8, width: 300 }}
          />
        </label>
        {config && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#666' }}>
            <div>API Base: {config.apiBase}</div>
            <div>Voice HTTP: {config.voiceHttpBase}</div>
            <div>Voice WS: {config.voiceWsBase}</div>
          </div>
        )}
      </div>

      {iframeUrl && (
        <div style={{ border: '2px solid #ccc', borderRadius: 8, overflow: 'hidden', width: '100%', height: '600px' }}>
          <iframe
            src={iframeUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Chat Widget"
            allow="microphone; autoplay; clipboard-read; clipboard-write"
          />
        </div>
      )}

      {!config && <p>Loading configuration...</p>}
    </main>
  )
}

