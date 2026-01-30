// /*
//  * Gemini Voice Client - Functional, auto-configuring client library
//  *
//  * Usage:
//  *   const client = createGeminiVoiceClient({
//  *     ragContext: { baseUrl, cohortKey, sessionId, agentName },
//  *     onStatus: (status) => console.log('Status:', status),
//  *     onTranscription: (text, isUser, isFinal) => console.log(text),
//  *     onAudio: (audioData) => { /* handle audio */ }
//  *   });
//  *   await client.connect();
//  *   client.disconnect();
//  */

const DEFAULT_HTTP_BASE = 'http://localhost:3001';
const DEFAULT_WS_BASE = 'ws://localhost:3002';
const DEFAULT_INPUT_SAMPLE_RATE = 16000;
const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const DEFAULT_BUFFER_SIZE = 4096;

function defaultNoop() {}
function defaultOnError(err) {
  console.error('[GeminiVoice]', err);
}

/**
 * Normalize options into a single object with defaults.
 */
function normalizeOptions(options = {}) {
  return {
    httpBase: options.httpBase || null,
    wsBase: options.wsBase || null,
    ragContext: options.ragContext || null,
    onStatus: options.onStatus || defaultNoop,
    onTranscription: options.onTranscription || defaultNoop,
    onAudio: options.onAudio || defaultNoop,
    onError: options.onError || defaultOnError,
    inputSampleRate: options.inputSampleRate ?? DEFAULT_INPUT_SAMPLE_RATE,
    outputSampleRate: options.outputSampleRate ?? DEFAULT_OUTPUT_SAMPLE_RATE,
    bufferSize: options.bufferSize ?? DEFAULT_BUFFER_SIZE,
  };
}

/**
 * Create PCM blob from Float32Array (pure).
 */
function createPcmBlob(float32Data, inputSampleRate) {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    int16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return { data: base64, mimeType: `audio/pcm;rate=${inputSampleRate}` };
}

/**
 * Auto-detect backend configuration (pure fetch, no state).
 */
async function fetchConfigFromApi() {
  const response = await fetch('/api/config');
  if (!response.ok) return null;
  const config = await response.json();
  return {
    httpBase: config.httpBase || config.httpBase,
    wsBase: config.wsBase || config.wsBase,
  };
}

/**
 * Infer config from window.location (pure).
 */
function inferConfigFromWindow() {
  const origin = window.location.origin;
  const protocol = window.location.protocol;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const httpPort = window.location.port || (protocol === 'https:' ? '443' : '80');
  const wsPort = parseInt(httpPort, 10) + 1;
  return {
    httpBase: origin,
    wsBase: `${wsProtocol}//${host.split(':')[0]}:${wsPort}`,
  };
}

/**
 * Resolve config: explicit > /api/config > window > defaults.
 */
async function resolveConfig(opts) {
  if (opts.httpBase && opts.wsBase) {
    return { httpBase: opts.httpBase, wsBase: opts.wsBase };
  }
  try {
    const fromApi = await fetchConfigFromApi();
    if (fromApi) return fromApi;
  } catch (e) {
    console.log('[GeminiVoice] Could not load from /api/config, trying alternatives...');
  }
  try {
    return inferConfigFromWindow();
  } catch (e) {
    console.log('[GeminiVoice] Could not detect from window.location');
  }
  return { httpBase: DEFAULT_HTTP_BASE, wsBase: DEFAULT_WS_BASE };
}

/**
 * Create a Gemini Voice client. Returns an object with connect, disconnect, isConnected.
 * State is held in closure; no class.
 */
function createGeminiVoiceClient(options = {}) {
  const opts = normalizeOptions(options);
  const state = {
    sessionId: null,
    ws: null,
    connected: false,
    isRunning: false,
    inputAudioContext: null,
    outputAudioContext: null,
    processor: null,
    inputSource: null,
    outputNode: null,
    mediaStream: null,
    audioSources: new Set(),
    nextStartTime: 0,
  };

  function stopAllAudio() {
    state.audioSources.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    state.audioSources.clear();
  }

  function playAudio(base64Audio) {
    if (!state.outputAudioContext || !state.outputNode) return;
    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = state.outputAudioContext.createBuffer(
        1,
        frameCount,
        opts.outputSampleRate
      );
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }
      state.nextStartTime = Math.max(
        state.nextStartTime,
        state.outputAudioContext.currentTime
      );
      const source = state.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(state.outputNode);
      source.start(state.nextStartTime);
      state.nextStartTime += buffer.duration;
      state.audioSources.add(source);
      source.onended = () => state.audioSources.delete(source);
    } catch (error) {
      console.error('[GeminiVoice] Error playing audio:', error);
      opts.onError(error);
    }
  }

  function handleMessage(message) {
    switch (message.type) {
      case 'status': {
        const status = message.data?.status;
        state.connected = status === 'CONNECTED';
        opts.onStatus(status, message.data);
        break;
      }
      case 'audio':
        if (message.data?.interrupt) {
          stopAllAudio();
          state.nextStartTime = state.outputAudioContext?.currentTime ?? 0;
        } else if (message.data?.audio) {
          playAudio(message.data.audio);
          opts.onAudio(message.data.audio);
        }
        break;
      case 'transcription': {
        const t = message.data;
        if (t) opts.onTranscription(t.text, t.isUser, t.isFinal);
        break;
      }
      case 'error':
        opts.onError(new Error(message.data?.message || 'Unknown error'));
        break;
      default:
        break;
    }
  }

  async function connect() {
    if (state.isRunning) {
      console.warn('[GeminiVoice] Already connected');
      return;
    }
    try {
      state.isRunning = true;
      opts.onStatus('CONNECTING');

      const config = await resolveConfig(opts);
      opts.httpBase = config.httpBase;
      opts.wsBase = config.wsBase;
      console.log('[GeminiVoice] Using backend:', config);

      const sessionBody = opts.ragContext ? { ragContext: opts.ragContext } : {};
      const sessionRes = await fetch(`${config.httpBase}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionBody),
      });
      if (!sessionRes.ok) {
        const errorText = await sessionRes.text();
        throw new Error(`Failed to create session: ${sessionRes.status} ${errorText}`);
      }
      const sessionData = await sessionRes.json();
      state.sessionId = sessionData.sessionId;
      if (!state.sessionId) {
        throw new Error('Session created but no sessionId returned');
      }
      console.log('[GeminiVoice] Session created:', state.sessionId);

      state.inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: opts.inputSampleRate,
      });
      state.outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: opts.outputSampleRate,
      });
      state.outputNode = state.outputAudioContext.createGain();
      state.outputNode.connect(state.outputAudioContext.destination);

      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.inputSource = state.inputAudioContext.createMediaStreamSource(state.mediaStream);
      state.processor = state.inputAudioContext.createScriptProcessor(
        opts.bufferSize,
        1,
        1
      );
      state.inputSource.connect(state.processor);
      state.processor.connect(state.inputAudioContext.destination);

      const wsUrl = `${config.wsBase}?sessionId=${encodeURIComponent(state.sessionId)}`;
      console.log('[GeminiVoice] Connecting WebSocket:', wsUrl);
      state.ws = new WebSocket(wsUrl);

      state.ws.onopen = () => {
        console.log('[GeminiVoice] WebSocket opened');
        state.ws.send(JSON.stringify({ type: 'connect', sessionId: state.sessionId }));
        opts.onStatus('CONNECTING');
      };

      state.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('[GeminiVoice] Message parse error:', error);
          opts.onError(error);
        }
      };

      state.ws.onerror = (error) => {
        console.error('[GeminiVoice] WebSocket error:', error);
        opts.onError(error);
        opts.onStatus('ERROR');
      };

      state.ws.onclose = (event) => {
        console.log('[GeminiVoice] WebSocket closed:', event.code, event.reason);
        state.connected = false;
        opts.onStatus('DISCONNECTED');
      };

      state.processor.onaudioprocess = (e) => {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        if (!state.connected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData, opts.inputSampleRate);
        state.ws.send(JSON.stringify({
          type: 'audio',
          data: pcmBlob,
          sessionId: state.sessionId,
        }));
      };
    } catch (error) {
      console.error('[GeminiVoice] Connection error:', error);
      opts.onError(error);
      disconnect();
      throw error;
    }
  }

  function disconnect() {
    if (!state.isRunning) return;
    state.isRunning = false;
    state.connected = false;

    try {
      if (state.ws && state.sessionId && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ type: 'disconnect', sessionId: state.sessionId }));
      }
    } catch (e) {}

    try {
      state.ws?.close();
    } catch (e) {}
    state.ws = null;
    state.sessionId = null;

    if (state.processor) {
      try {
        state.processor.disconnect();
        state.processor.onaudioprocess = null;
      } catch (e) {}
      state.processor = null;
    }
    if (state.inputSource) {
      try { state.inputSource.disconnect(); } catch (e) {}
      state.inputSource = null;
    }
    if (state.inputAudioContext) {
      try { state.inputAudioContext.close(); } catch (e) {}
      state.inputAudioContext = null;
    }
    if (state.outputAudioContext) {
      try { state.outputAudioContext.close(); } catch (e) {}
      state.outputAudioContext = null;
    }
    stopAllAudio();
    state.nextStartTime = 0;
    if (state.mediaStream) {
      try {
        state.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      state.mediaStream = null;
    }
    opts.onStatus('DISCONNECTED');
    console.log('[GeminiVoice] Disconnected');
  }

  function isConnected() {
    return state.connected && state.isRunning;
  }

  return {
    connect,
    disconnect,
    isConnected,
  };
}

// Export for modules and global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGeminiVoiceClient };
}
if (typeof window !== 'undefined') {
  window.createGeminiVoiceClient = createGeminiVoiceClient;
}
