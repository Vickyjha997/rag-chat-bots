import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PhoneInput, { isPossiblePhoneNumber, isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { loadWidgetConfig } from './config'
import type { ChatMessage, WidgetConfig } from './types'
import { logError, logInfo } from '../../lib/logger'
import { getSessionUrl, getChatUrl, getChatResponseField, getApiHeaders } from './api'
import { useVoiceAgent } from './useVoiceAgent'

type Mode = 'text' | 'voice'

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

/**
 * Format markdown-like text to HTML
 * Converts * for lists and ** for bold text
 */
function formatMarkdown(text: string): string {
  if (!text) return ''
  
  // First, handle bold text (**text**)
  let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  // Split by lines to handle lists
  const lines = formatted.split('\n')
  const formattedLines: string[] = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Check if line starts with * (list item) - must be at start or after whitespace
    // Match patterns like "*   **Trudi Lang:**" or "*   Session 1:"
    if (/^\s*\*\s+/.test(line)) {
      if (!inList) {
        formattedLines.push('<ul>')
        inList = true
      }
      // Remove the * and format the rest (preserve bold tags)
      const listContent = line.replace(/^\s*\*\s+/, '').trim()
      formattedLines.push(`<li>${listContent}</li>`)
    } else {
      if (inList) {
        formattedLines.push('</ul>')
        inList = false
      }
      if (trimmed) {
        // Format as paragraph (bold tags already processed)
        formattedLines.push(`<p>${line}</p>`)
      } else {
        formattedLines.push('<br/>')
      }
    }
  }
  
  if (inList) {
    formattedLines.push('</ul>')
  }
  
  return formattedLines.join('')
}

function postToParent(origin: string, payload: any) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, origin)
  }
}

export function WidgetApp() {
  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<Mode>('text')

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Voice: RAG answers from agent tool calls are appended here so UI stays in sync with voice.
  const onVoiceAssistantMessage = useCallback((text: string) => {
    if (!text.trim()) return
    setMessages((prev) => [...prev, { id: uid(), role: 'assistant', text }])
  }, [])

  const voiceAgent = useVoiceAgent({
    voiceHttpBase: config?.voiceHttpBase ?? '',
    voiceWsBase: config?.voiceWsBase ?? '',
    apiBase: config?.apiBase ?? '',
    cohortKey: config?.cohortKey ?? '',
    ragSessionId: sessionId,
    onAssistantMessage: onVoiceAssistantMessage,
  })

  // Lead form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState<string | undefined>(undefined) // E.164
  const [phoneCountry, setPhoneCountry] = useState<string | undefined>(undefined) // ISO2

  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    loadWidgetConfig()
      .then((c) => {
        setConfig(c)
        logInfo('widget_config_loaded', { apiBase: c.apiBase, voiceHttpBase: c.voiceHttpBase, voiceWsBase: c.voiceWsBase })
      })
      .catch((e: any) => {
        logError('widget_config_load_failed', e)
        setConfigError(e?.message || String(e))
      })
  }, [])

  useEffect(() => {
    if (!config) return
    postToParent(config.parentOrigin, {
      type: 'chatWidgetResize',
      expanded,
      width: expanded ? 400 : 100,
      height: expanded ? 600 : 100,
    })
  }, [expanded, config])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, expanded, mode])

  // When leaving voice mode, disconnect WebSocket and release mic.
  useEffect(() => {
    if (mode !== 'voice') voiceAgent.disconnect()
  }, [mode, voiceAgent.disconnect])

  const canUseVoice = !!sessionId

  const emailIsValid = useMemo(() => {
    if (!email.trim()) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }, [email])

  const phoneIsValid = useMemo(() => {
    if (!phone) return false
    // both checks: possible + valid
    return isPossiblePhoneNumber(phone) && isValidPhoneNumber(phone)
  }, [phone])

  async function createSession() {
    if (!config) return
    setError(null)

    if (!fullName.trim() || !email.trim() || !designation.trim() || !phoneIsValid) {
      setError('Please fill all required fields with a valid phone number.')
      return
    }
    if (!emailIsValid) {
      setError('Please enter a valid email address.')
      return
    }

    setBusy(true)
    try {
      const sessionUrl = getSessionUrl(config.cohortKey)
      const res = await fetch(sessionUrl, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          currentDesignation: designation.trim(),
          phoneNumber: phone,
          countryCode: phoneCountry || null,
          source: config.source,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to start session (${res.status})`)

      setSessionId(String(data.sessionId))
      logInfo('rag_session_created', { sessionId: String(data.sessionId), cohortKey: config.cohortKey })
      setMessages([
        {
          id: uid(),
          role: 'assistant',
          text:
            'Welcome to XED, and congratulations on taking the first step towards a more empowered you. Let me know if I can answer any question for you.',
        },
      ])
      setMode('text')
    } catch (e: any) {
      logError('rag_session_create_failed', e, { cohortKey: config.cohortKey })
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!config || !sessionId) return
    const q = messageInput.trim()
    if (!q || busy) return

    setError(null)
    setBusy(true)
    setMessageInput('')
    setMessages((prev) => [...prev, { id: uid(), role: 'user', text: q }])

    try {
      const chatUrl = getChatUrl(config.cohortKey)
      const responseField = getChatResponseField()
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ sessionId, question: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed to send message (${res.status})`)

      const answer = responseField in data ? String((data as any)[responseField] ?? '') : ''
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', text: answer }])
    } catch (e: any) {
      logError('rag_chat_failed', e, { cohortKey: config.cohortKey, sessionId })
      setError(e?.message || String(e))
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  if (configError) {
    return (
      <div style={{ padding: 20, fontFamily: 'system-ui', color: '#dc2626' }}>
        Error: {configError}
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="chat-widget-container">
      <div
        className="widget-minimized"
        id="minimizedWidget"
        role="button"
        aria-label="Open chat widget"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div className="profile-circle">
          <img src={config.profileImage} alt="Chat Assistant" className="profile-image" />
          <div className="status-dot" aria-hidden="true"></div>
        </div>
      </div>

      <div className={`widget-expanded ${expanded ? 'active' : ''}`} id="expandedWidget" role="dialog" aria-modal="true">
        <div className="chat-header">
          <div className="header-left">
            <div className="header-avatar">
              <img src={config.profileImage} alt="Chat Assistant" />
            </div>
            <div className="header-info">
              <h3 id="agentName">{config.agentName}</h3>
              <div className="header-status">
                <div className="status-indicator" aria-hidden="true"></div>
                <span className="beta-badge">Beta Version</span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="mode-tabs" role="tablist" aria-label="Chat modes">
              <button
                className={`mode-tab-btn ${mode === 'text' ? 'active' : ''}`}
                id="modeTextBtn"
                type="button"
                role="tab"
                aria-selected={mode === 'text'}
                onClick={() => setMode('text')}
              >
                Text
              </button>
              <button
                className={`mode-tab-btn ${mode === 'voice' ? 'active' : ''}`}
                id="modeVoiceBtn"
                type="button"
                role="tab"
                aria-selected={mode === 'voice'}
                disabled={!canUseVoice}
                onClick={() => setMode('voice')}
              >
                Voice
              </button>
            </div>
            <button className="close-btn" id="closeBtn" aria-label="Close chat widget" type="button" onClick={() => setExpanded(false)}>
              ×
            </button>
          </div>
        </div>

        {!sessionId && (
          <div className="lead-form-container" id="leadFormContainer">
            <h2 className="form-title">Please provide your details to continue</h2>

            <form
              id="leadForm"
              onSubmit={(e) => {
                e.preventDefault()
                void createSession()
              }}
              noValidate
            >
              <div className="form-group">
                <label htmlFor="fullName">
                  Full Name <span className="required" aria-label="required">*</span>
                </label>
                <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  Email <span className="required" aria-label="required">*</span>
                </label>
                <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" />
              </div>

              <div className="form-group">
                <label htmlFor="designation">
                  Current Designation <span className="required" aria-label="required">*</span>
                </label>
                <input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Enter your current designation"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">
                  Phone Number <span className="required" aria-label="required">*</span>
                </label>
                <div className="phone-input-container">
                  <PhoneInput
                    id="phone"
                    international
                    defaultCountry="US"
                    value={phone}
                    onChange={(value) => setPhone(value)}
                    onCountryChange={(c) => setPhoneCountry(c)}
                    placeholder="Enter your phone number"
                  />
                </div>
                {!phoneIsValid && phone && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>Please enter a valid phone number.</div>
                )}
              </div>

              <button type="submit" className="submit-btn" id="submitBtn" disabled={busy}>
                <span id="submitBtnText">{busy ? 'Starting…' : 'Start Chat'}</span>
              </button>

              {error && (
                <div id="errorMessage" className={`error-message ${error ? 'show' : ''}`} role="alert" aria-live="polite">
                  {error}
                </div>
              )}
            </form>
          </div>
        )}

        {sessionId && mode === 'text' && (
          <div className="chat-interface-container active" id="chatInterfaceContainer">
            <div className="chat-messages" id="chatMessages" role="log" aria-live="polite" aria-label="Chat messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.role === 'user' ? 'user' : 'bot'}`} role="listitem">
                  <div className="message-header">{m.role === 'user' ? 'You' : config.agentName}</div>
                  <div className="message-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }} />
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-container">
              <label htmlFor="messageInput" className="sr-only">
                Type your message
              </label>
              <input
                id="messageInput"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message here..."
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage()
                  }
                }}
              />
              <button className="send-btn" id="sendBtn" type="button" aria-label="Send message" disabled={busy} onClick={() => void sendMessage()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
            </div>

            <div id="chatLoading" className={`loading ${busy ? 'show' : ''}`} role="status" aria-live="polite">
              Processing...
            </div>
          </div>
        )}

        {sessionId && mode === 'voice' && config && (
          <div className="chat-interface-container active" id="voiceInterfaceContainer">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#f9fafb' }}>
              {/* Voice connection: WebSocket to Gemini Voice Agent (VITE_VOICE_WS). Tool calls run on agent; we show transcript + RAG answers. */}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
                <img
                  alt="Voice assistant"
                  src={config.profileImage}
                  style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid #1e3a8a', background: '#fff' }}
                />
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {voiceAgent.status === 'idle' && 'Click Connect to start voice (microphone required).'}
                  {voiceAgent.status === 'connecting' && 'Connecting…'}
                  {voiceAgent.status === 'connected' && 'Listening — speak to get RAG answers.'}
                  {voiceAgent.status === 'disconnected' && 'Disconnected.'}
                  {voiceAgent.status === 'error' && (voiceAgent.error || 'Connection error.')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(voiceAgent.status === 'idle' || voiceAgent.status === 'disconnected' || voiceAgent.status === 'error') && (
                    <button type="button" className="submit-btn" style={{ minWidth: 100 }} onClick={() => voiceAgent.connect()}>
                      Connect
                    </button>
                  )}
                  {(voiceAgent.status === 'connecting' || voiceAgent.status === 'connected') && (
                    <button type="button" className="submit-btn" style={{ minWidth: 100, background: '#dc2626' }} onClick={() => voiceAgent.disconnect()}>
                      Disconnect
                    </button>
                  )}
                  <button type="button" className="submit-btn" style={{ maxWidth: 140 }} onClick={() => setMode('text')}>
                    Back to Text
                  </button>
                </div>
                {voiceAgent.error && (
                  <div role="alert" style={{ fontSize: 12, color: '#dc2626', textAlign: 'center', maxWidth: 320 }}>
                    {voiceAgent.error}
                  </div>
                )}
              </div>
              {/* Live transcript + RAG answers (from agent tool calls) in sync with voice */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {voiceAgent.transcriptions.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Live transcript</div>
                    {voiceAgent.transcriptions.map((t, i) => (
                      <div key={i} style={{ color: t.isUser ? '#1e40af' : '#111827', marginBottom: 4 }}>
                        {t.isUser ? 'You' : config.agentName}: {t.text}
                        {t.isFinal && ' ✓'}
                      </div>
                    ))}
                  </div>
                )}
                {messages.filter((m) => m.role === 'assistant').length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>RAG answers</div>
                    {messages.filter((m) => m.role === 'assistant').map((m) => (
                      <div key={m.id} className="message-content" style={{ marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: formatMarkdown(m.text) }} />
                    ))}
                  </div>
                )}
                {voiceAgent.transcriptions.length === 0 && messages.filter((m) => m.role === 'assistant').length === 0 && (
                  <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 16 }}>
                    Connect and speak; answers from the RAG backend will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
