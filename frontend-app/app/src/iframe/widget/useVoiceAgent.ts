/**
 * Voice agent connection: WebSocket to Gemini Voice Agent, RAG context via session.
 * Flow: create voice session (POST /api/sessions with ragContext) → WS to VITE_VOICE_WS
 * → send { type: 'connect' } → stream mic as { type: 'audio', data: { data: base64, mimeType } }.
 * Tool calls (e.g. cohort_chat) run on the agent; we only display transcriptions and RAG answers.
 * All URLs from config (VITE_API_BASE, VITE_VOICE_HTTP, VITE_VOICE_WS) — no hardcoded hosts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const INPUT_SAMPLE_RATE = 16000
const OUTPUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export type VoiceTranscription = {
  text: string
  isUser: boolean
  isFinal: boolean
}

function createPcmBlob(float32Data: Float32Array, sampleRate: number): { data: string; mimeType: string } {
  const int16 = new Int16Array(float32Data.length)
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]))
    int16[i] = s < 0 ? s * 32768 : s * 32767
  }
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return { data: btoa(binary), mimeType: `audio/pcm;rate=${sampleRate}` }
}

function playBase64Pcm(
  base64: string,
  audioContext: AudioContext,
  outputNode: GainNode,
  nextStartTime: { current: number },
  sampleRate: number
): void {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const int16 = new Int16Array(bytes.buffer)
    const buffer = audioContext.createBuffer(1, int16.length, sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768
    const start = Math.max(nextStartTime.current, audioContext.currentTime)
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(outputNode)
    source.start(start)
    nextStartTime.current = start + buffer.duration
  } catch (e) {
    console.warn('[Voice] play error', e)
  }
}

export type UseVoiceAgentOptions = {
  voiceHttpBase: string
  voiceWsBase: string
  apiBase: string
  cohortKey: string
  ragSessionId: string | null
  onAssistantMessage?: (text: string) => void
}

export function useVoiceAgent(options: UseVoiceAgentOptions) {
  const {
    voiceHttpBase,
    voiceWsBase,
    apiBase,
    cohortKey,
    ragSessionId,
    onAssistantMessage,
  } = options

  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)
  const [transcriptions, setTranscriptions] = useState<VoiceTranscription[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextInRef = useRef<AudioContext | null>(null)
  const audioContextOutRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nextPlayTimeRef = useRef(0)
  const connectedRef = useRef(false)

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch {}
      processorRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioContextInRef.current?.close().catch(() => {})
    audioContextInRef.current = null
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    connectedRef.current = false
    setStatus((s) => (s === 'connected' || s === 'connecting' ? 'disconnected' : s))
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'disconnect' }))
    }
    cleanup()
  }, [cleanup])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const connect = useCallback(async () => {
    if (!voiceHttpBase?.trim() || !voiceWsBase?.trim() || !ragSessionId?.trim()) {
      setError('Voice URLs or RAG session missing. Set VITE_VOICE_HTTP and VITE_VOICE_WS.')
      setStatus('error')
      return
    }

    setError(null)
    setStatus('connecting')

    try {
      const sessionRes = await fetch(`${voiceHttpBase.replace(/\/+$/, '')}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragContext: {
            baseUrl: apiBase.replace(/\/+$/, ''),
            cohortKey,
            sessionId: ragSessionId,
          },
        }),
      })
      if (!sessionRes.ok) {
        const text = await sessionRes.text()
        throw new Error(`Voice session failed: ${sessionRes.status} ${text}`)
      }
      const data = await sessionRes.json()
      const vsid = data?.sessionId
      if (!vsid) throw new Error('No sessionId from voice agent')
      setVoiceSessionId(vsid)

      const wsUrl = `${voiceWsBase.replace(/\/+$/, '').replace(/^http/, 'ws')}?sessionId=${encodeURIComponent(vsid)}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'connect' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'status': {
              const st = msg.data?.status
              if (st === 'CONNECTED') {
                connectedRef.current = true
                setStatus('connected')
              } else if (st === 'DISCONNECTED' || st === 'ERROR') {
                connectedRef.current = false
                setStatus(st === 'ERROR' ? 'error' : 'disconnected')
              }
              break
            }
            case 'audio':
              if (msg.data?.interrupt) {
                nextPlayTimeRef.current = audioContextOutRef.current?.currentTime ?? 0
              } else if (msg.data?.audio && audioContextOutRef.current && outputNodeRef.current) {
                playBase64Pcm(
                  msg.data.audio,
                  audioContextOutRef.current,
                  outputNodeRef.current,
                  nextPlayTimeRef,
                  OUTPUT_SAMPLE_RATE
                )
              }
              break
            case 'transcription': {
              const t = msg.data
              if (t && typeof t.text === 'string') {
                setTranscriptions((prev) => [...prev, { text: t.text, isUser: !!t.isUser, isFinal: !!t.isFinal }])
                if (t.isFinal && !t.isUser && t.text?.trim() && onAssistantMessage) {
                  onAssistantMessage(t.text.trim())
                }
              }
              break
            }
            case 'error':
              setError(msg.data?.message || 'Voice error')
              setStatus('error')
              break
            default:
              break
          }
        } catch (e) {
          console.warn('[Voice] message parse error', e)
        }
      }

      ws.onerror = () => {
        setError('WebSocket error')
        setStatus('error')
      }

      ws.onclose = () => {
        wsRef.current = null
        connectedRef.current = false
        setStatus((s) => (s === 'connecting' || s === 'connected' ? 'disconnected' : s))
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctxIn = new AudioContextClass({ sampleRate: INPUT_SAMPLE_RATE })
      const ctxOut = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE })
      audioContextInRef.current = ctxIn
      audioContextOutRef.current = ctxOut
      const gain = ctxOut.createGain()
      gain.connect(ctxOut.destination)
      outputNodeRef.current = gain
      nextPlayTimeRef.current = 0

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const source = ctxIn.createMediaStreamSource(stream)
      const processor = ctxIn.createScriptProcessor(BUFFER_SIZE, 1, 1)
      source.connect(processor)
      processor.connect(ctxIn.destination)
      processorRef.current = processor

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN || !connectedRef.current) return
        const input = e.inputBuffer.getChannelData(0)
        const blob = createPcmBlob(input, INPUT_SAMPLE_RATE)
        wsRef.current.send(JSON.stringify({ type: 'audio', data: blob }))
      }
    } catch (e: any) {
      setError(e?.message || String(e))
      setStatus('error')
      cleanup()
    }
  }, [
    voiceHttpBase,
    voiceWsBase,
    apiBase,
    cohortKey,
    ragSessionId,
    onAssistantMessage,
    cleanup,
  ])

  const clearTranscriptions = useCallback(() => setTranscriptions([]), [])

  return {
    status,
    error,
    voiceSessionId,
    transcriptions,
    connect,
    disconnect,
    clearTranscriptions,
  }
}
