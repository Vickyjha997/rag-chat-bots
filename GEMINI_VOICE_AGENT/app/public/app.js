/* Gemini Live Backend Test - v no-ingest (no 7245 / ingest calls) */
/**
 * Functional UI: state object, pure helpers, functions(state, dom).
 */

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
const DEFAULT_HTTP = 'https://localhost:40001';
const DEFAULT_WS = 'ws://localhost:3002';

// ---------------------------------------------------------------------------
// Pure helpers (no side effects)
// ---------------------------------------------------------------------------

function createPcmBlob(data, sampleRate = INPUT_SAMPLE_RATE) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    int16[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return { data: base64, mimeType: `audio/pcm;rate=${sampleRate}` };
}

async function fetchConfigFromApi() {
  const response = await fetch('/api/config');
  if (!response.ok) return null;
  return response.json();
}

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

async function resolveConfig() {
  try {
    const config = await fetchConfigFromApi();
    if (config && (config.httpBase || config.wsBase)) {
      return { httpBase: config.httpBase || DEFAULT_HTTP, wsBase: config.wsBase || DEFAULT_WS, source: 'auto' };
    }
  } catch (e) {
    console.log('[Config] Could not load from /api/config:', e.message);
  }
  try {
    const inferred = inferConfigFromWindow();
    return { ...inferred, source: 'auto' };
  } catch (e) {
    console.log('[Config] Could not detect from window.location:', e.message);
  }
  return { httpBase: DEFAULT_HTTP, wsBase: DEFAULT_WS, source: 'default' };
}

// ---------------------------------------------------------------------------
// State and DOM
// ---------------------------------------------------------------------------

function createInitialState() {
  return {
    backendUrl: null,
    wsUrl: null,
    configSource: 'auto',
    sessionId: null,
    ws: null,
    isConnected: false,
    audioContext: null,
    outputAudioContext: null,
    processor: null,
    inputSource: null,
    outputNode: null,
    inputAnalyser: null,
    outputAnalyser: null,
    nextStartTime: 0,
    audioSources: new Set(),
    mediaStream: null,
  };
}

function getDomRefs() {
  return {
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    errorBox: document.getElementById('errorBox'),
    infoBox: document.getElementById('infoBox'),
    transcriptionBox: document.getElementById('transcriptionBox'),
    inputVolume: document.getElementById('inputVolume'),
    outputVolume: document.getElementById('outputVolume'),
    backendUrlInput: document.getElementById('backendUrl'),
    wsUrlInput: document.getElementById('wsUrl'),
    configStatus: document.getElementById('configStatus'),
  };
}

// ---------------------------------------------------------------------------
// UI updates (state + dom)
// ---------------------------------------------------------------------------

function updateConfigDisplay(state, dom) {
  if (dom.backendUrlInput) dom.backendUrlInput.value = state.backendUrl || '';
  if (dom.wsUrlInput) dom.wsUrlInput.value = state.wsUrl || '';
  if (dom.configStatus) {
    const labels = { auto: '🟢 Auto-detected', manual: '🔵 Manual', default: '🟡 Default' };
    dom.configStatus.textContent = labels[state.configSource] || 'Unknown';
    dom.configStatus.className = `config-source ${state.configSource}`;
  }
}

function updateInfo(dom, message) {
  if (dom.infoBox) dom.infoBox.textContent = message;
}

function updateStatus(dom, status, text) {
  if (dom.statusText) dom.statusText.textContent = text;
  if (dom.statusIndicator) {
    dom.statusIndicator.className = 'status-indicator';
    if (status === 'CONNECTED') dom.statusIndicator.classList.add('connected');
    else if (status === 'CONNECTING') dom.statusIndicator.classList.add('connecting');
  }
}

function showError(dom, message) {
  if (!dom.errorBox) return;
  dom.errorBox.textContent = message;
  dom.errorBox.classList.add('show');
  setTimeout(() => dom.errorBox.classList.remove('show'), 5000);
}

function hideError(dom) {
  if (dom.errorBox) dom.errorBox.classList.remove('show');
}

function addTranscription(dom, type, text, isFinal = false) {
  if (!text && !isFinal) return;
  if (!dom.transcriptionBox) return;
  const item = document.createElement('div');
  item.className = `transcription-item ${type}`;
  const label = document.createElement('div');
  label.className = 'transcription-label';
  label.textContent = type === 'user' ? 'You' : type === 'assistant' ? 'Assistant' : 'System';
  const content = document.createElement('div');
  content.textContent = text || (isFinal ? '[Turn complete]' : '');
  item.appendChild(label);
  item.appendChild(content);
  dom.transcriptionBox.appendChild(item);
  dom.transcriptionBox.scrollTop = dom.transcriptionBox.scrollHeight;
  if (isFinal && type !== 'system') {
    const sep = document.createElement('div');
    sep.style.height = '8px';
    dom.transcriptionBox.appendChild(sep);
  }
}

// ---------------------------------------------------------------------------
// Audio (state + dom)
// ---------------------------------------------------------------------------

function stopAllAudio(state) {
  state.audioSources.forEach((source) => {
    try { source.stop(); } catch (e) {}
  });
  state.audioSources.clear();
}

function playAudio(state, dom, base64Audio) {
  if (!state.outputAudioContext || !state.outputNode) return;
  try {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = state.outputAudioContext.createBuffer(1, frameCount, OUTPUT_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    state.nextStartTime = Math.max(state.nextStartTime, state.outputAudioContext.currentTime);
    const source = state.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(state.outputNode);
    source.start(state.nextStartTime);
    state.nextStartTime += buffer.duration;
    state.audioSources.add(source);
    source.onended = () => state.audioSources.delete(source);
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function handleMessage(state, dom, message) {
  switch (message.type) {
    case 'status': {
      const status = message.data?.status;
      if (status === 'CONNECTED') {
        state.isConnected = true;
        updateStatus(dom, 'CONNECTED', 'Connected');
        if (dom.connectBtn) dom.connectBtn.disabled = true;
        if (dom.disconnectBtn) dom.disconnectBtn.disabled = false;
        if (dom.infoBox) dom.infoBox.textContent = 'Connected! Start speaking...';
      } else if (status === 'ERROR') {
        updateStatus(dom, 'ERROR', 'Error');
        showError(dom, 'Connection error');
      } else if (status === 'DISCONNECTED') {
        state.isConnected = false;
        updateStatus(dom, 'DISCONNECTED', 'Disconnected');
      }
      break;
    }
    case 'audio':
      if (message.data?.interrupt) {
        stopAllAudio(state);
        state.nextStartTime = state.outputAudioContext?.currentTime ?? 0;
      } else if (message.data?.audio && state.outputAudioContext && state.outputNode) {
        playAudio(state, dom, message.data.audio);
      }
      break;
    case 'transcription':
      addTranscription(dom, message.data?.isUser ? 'user' : 'assistant', message.data?.text, message.data?.isFinal);
      break;
    case 'error':
      showError(dom, message.data?.message || 'Unknown error');
      break;
    case 'pong':
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Cleanup and disconnect
// ---------------------------------------------------------------------------

function cleanup(state, dom) {
  state.isConnected = false;
  clearVolumeMonitoring(state);
  if (dom.connectBtn) dom.connectBtn.disabled = false;
  if (dom.disconnectBtn) dom.disconnectBtn.disabled = true;

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
  if (state.audioContext) {
    try { state.audioContext.close(); } catch (e) {}
    state.audioContext = null;
  }
  if (state.outputAudioContext) {
    try { state.outputAudioContext.close(); } catch (e) {}
    state.outputAudioContext = null;
  }
  stopAllAudio(state);
  if (state.mediaStream) {
    try { state.mediaStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    state.mediaStream = null;
  }
  state.ws = null;
  state.sessionId = null;
}

async function disconnect(state, dom) {
  if (state.ws && state.sessionId) {
    try {
      state.ws.send(JSON.stringify({ type: 'disconnect', sessionId: state.sessionId }));
      state.ws.close();
    } catch (e) {}
  }
  cleanup(state, dom);
}

// ---------------------------------------------------------------------------
// Connect and setup
// ---------------------------------------------------------------------------

function setupAudioProcessing(state, dom) {
  if (!state.processor) return;
  state.processor.onaudioprocess = (e) => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.sessionId) return;
    if (!state.isConnected) return;
    const inputData = e.inputBuffer.getChannelData(0);
    const pcmBlob = createPcmBlob(inputData, INPUT_SAMPLE_RATE);
    state.ws.send(JSON.stringify({ type: 'audio', data: pcmBlob, sessionId: state.sessionId }));
  };
}

function startVolumeMonitoring(state, dom) {
  const interval = setInterval(() => {
    let inputVol = 0;
    let outputVol = 0;
    if (state.inputAnalyser) {
      const dataArray = new Uint8Array(state.inputAnalyser.frequencyBinCount);
      state.inputAnalyser.getByteFrequencyData(dataArray);
      inputVol = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    }
    if (state.outputAnalyser) {
      const dataArray = new Uint8Array(state.outputAnalyser.frequencyBinCount);
      state.outputAnalyser.getByteFrequencyData(dataArray);
      outputVol = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    }
    if (dom.inputVolume) dom.inputVolume.style.width = inputVol * 100 + '%';
    if (dom.outputVolume) dom.outputVolume.style.width = outputVol * 100 + '%';
  }, 50);
  state._volumeInterval = interval;
}

function clearVolumeMonitoring(state) {
  if (state._volumeInterval) {
    clearInterval(state._volumeInterval);
    state._volumeInterval = null;
  }
}

async function connect(state, dom) {
  if (state.isConnected) return;

  updateStatus(dom, 'CONNECTING', 'Connecting...');
  if (dom.connectBtn) dom.connectBtn.disabled = true;
  hideError(dom);

  try {
    const response = await fetch(`${state.backendUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Failed to create session: ${response.statusText}`);
    const data = await response.json();
    state.sessionId = data.sessionId;
    addTranscription(dom, 'system', `Session created: ${state.sessionId.substring(0, 8)}...`);

    state.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
    state.outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;
    state.inputSource = state.audioContext.createMediaStreamSource(stream);
    state.inputAnalyser = state.audioContext.createAnalyser();
    state.processor = state.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    state.inputSource.connect(state.inputAnalyser);
    state.inputAnalyser.connect(state.processor);
    state.processor.connect(state.audioContext.destination);

    state.outputNode = state.outputAudioContext.createGain();
    state.outputAnalyser = state.outputAudioContext.createAnalyser();
    state.outputNode.connect(state.outputAnalyser);
    state.outputAnalyser.connect(state.outputAudioContext.destination);

    state.ws = new WebSocket(`${state.wsUrl}?sessionId=${state.sessionId}`);
    state.ws.onopen = () => {
      addTranscription(dom, 'system', 'WebSocket connected');
      state.ws.send(JSON.stringify({ type: 'connect', sessionId: state.sessionId }));
      updateStatus(dom, 'CONNECTING', 'Connecting to Gemini...');
    };
    state.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(state, dom, message);
    };
    state.ws.onerror = () => {
      console.error('WebSocket error');
      showError(dom, 'WebSocket error occurred');
      updateStatus(dom, 'ERROR', 'WebSocket error');
    };
    state.ws.onclose = () => {
      addTranscription(dom, 'system', 'WebSocket disconnected');
      updateStatus(dom, 'DISCONNECTED', 'Disconnected');
      cleanup(state, dom);
    };

    setupAudioProcessing(state, dom);
    startVolumeMonitoring(state, dom);
  } catch (error) {
    console.error('Connection error:', error);
    showError(dom, error.message);
    updateStatus(dom, 'ERROR', 'Connection failed');
    cleanup(state, dom);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Config init and event wiring
// ---------------------------------------------------------------------------

async function initConfig(state, dom) {
  const config = await resolveConfig();
  state.backendUrl = config.httpBase;
  state.wsUrl = config.wsBase;
  state.configSource = config.source;
  updateConfigDisplay(state, dom);
  if (config.source === 'auto' && config.httpBase) {
    updateInfo(dom, `✅ Auto-configured: Connected to ${config.httpBase}`);
  } else if (config.source === 'default') {
    updateInfo(dom, '⚠️ Using default configuration. Update URLs if needed.');
  } else {
    updateInfo(dom, `✅ Auto-detected: ${config.httpBase} (WS: ${config.wsBase})`);
  }
}

function setupInputListeners(state, dom) {
  if (dom.backendUrlInput) {
    dom.backendUrlInput.addEventListener('change', (e) => {
      state.backendUrl = e.target.value;
      state.configSource = 'manual';
      updateConfigDisplay(state, dom);
    });
  }
  if (dom.wsUrlInput) {
    dom.wsUrlInput.addEventListener('change', (e) => {
      state.wsUrl = e.target.value;
      state.configSource = 'manual';
      updateConfigDisplay(state, dom);
    });
  }
}

function init() {
  const state = createInitialState();
  const dom = getDomRefs();

  setupInputListeners(state, dom);
  initConfig(state, dom).catch((e) => console.log('[Config]', e.message));

  if (dom.connectBtn) {
    dom.connectBtn.addEventListener('click', async () => {
      try {
        await connect(state, dom);
      } catch (error) {
        showError(dom, 'Connection failed: ' + error.message);
        updateStatus(dom, 'ERROR', 'Connection failed');
      }
    });
  }
  if (dom.disconnectBtn) {
    dom.disconnectBtn.addEventListener('click', () => disconnect(state, dom));
  }

  window.addEventListener('beforeunload', () => {
    clearVolumeMonitoring(state);
    disconnect(state, dom);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
