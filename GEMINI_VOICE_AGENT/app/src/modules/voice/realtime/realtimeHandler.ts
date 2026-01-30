import { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, TranscriptionData } from '../../../common/types.js';
import { ConnectionState } from '../../../common/types.js';
import { getSession } from '../session/sessionService.js';
import * as gemini from '../gemini/geminiService.js';
import { validateAudioData } from '../../../utils/audioUtils.js';
import { logError, logWarn } from '../../../common/errorLog.js';

const clients = new Map<string, WebSocket>();
const latencyMarks = new Map<string, Record<string, number>>();

function latencyEnabled(): boolean {
  return process.env.LATENCY_LOG === '1';
}

function markOnce(sessionId: string, key: string): void {
  const now = Date.now();
  const marks = latencyMarks.get(sessionId) || {};
  const isFirst = marks[key] == null;
  if (isFirst) marks[key] = now;
  if (marks.start == null) marks.start = marks[key] || now;
  latencyMarks.set(sessionId, marks);
  if (latencyEnabled() && isFirst) {
    const start = marks.start || now;
    console.log('[LATENCY]', JSON.stringify({ sessionId, key, t: now, sinceStartMs: now - start }));
  }
}

export function sendToClient(sessionId: string, message: ServerMessage): void {
  const client = clients.get(sessionId);
  if (client?.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

export function broadcast(message: ServerMessage): void {
  for (const [sid, client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ ...message, sessionId: sid }));
    }
  }
}

function handleGeminiMessage(sessionId: string, message: any): void {
  const functionCalls = message.serverContent?.modelTurn?.parts?.filter((part: any) => part.functionCall) ?? [];
  if (functionCalls.length > 0) {
    functionCalls.forEach((part: any) => {
      const fc = part.functionCall;
      sendToClient(sessionId, {
        type: 'function_call',
        data: { name: fc.name, args: fc.args || {}, callId: fc.name + '_' + Date.now() },
        sessionId,
      });
    });
  }
  const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    markOnce(sessionId, 'first_audio_out');
    sendToClient(sessionId, {
      type: 'audio',
      data: { audio: base64Audio, mimeType: 'audio/pcm;rate=24000' },
      sessionId,
    });
  }
  const inputTranscript = message.serverContent?.inputTranscription;
  if (inputTranscript) {
    markOnce(sessionId, 'first_user_transcript');
    const t: TranscriptionData = { text: inputTranscript.text, isUser: true, isFinal: false };
    sendToClient(sessionId, { type: 'transcription', data: t, sessionId });
  }
  const outputTranscript = message.serverContent?.outputTranscription;
  if (outputTranscript) {
    markOnce(sessionId, 'first_assistant_transcript');
    const t: TranscriptionData = { text: outputTranscript.text, isUser: false, isFinal: false };
    sendToClient(sessionId, { type: 'transcription', data: t, sessionId });
  }
  if (message.serverContent?.turnComplete) {
    sendToClient(sessionId, { type: 'transcription', data: { text: '', isUser: true, isFinal: true }, sessionId });
    sendToClient(sessionId, { type: 'transcription', data: { text: '', isUser: false, isFinal: true }, sessionId });
  }
  if (message.serverContent?.interrupted) {
    sendToClient(sessionId, { type: 'audio', data: { interrupt: true }, sessionId });
  }
}

async function handleConnect(sessionId: string): Promise<void> {
  markOnce(sessionId, 'connect_session_start');
  const session = getSession(sessionId);
  if (!session) {
    sendToClient(sessionId, { type: 'error', data: { message: 'Session not found' }, sessionId });
    return;
  }
  try {
    if (latencyEnabled()) {
      console.log('[LATENCY]', JSON.stringify({
        sessionId,
        key: 'voice_rag_context',
        t: Date.now(),
        hasRagContext: !!session.ragContext,
        cohortKey: session.ragContext?.cohortKey,
        hasBaseUrl: !!session.ragContext?.baseUrl,
        hasRagSessionId: !!session.ragContext?.ragSessionId,
      }));
    }
    await gemini.connectSession(
      sessionId,
      (msg) => handleGeminiMessage(sessionId, msg),
      (error: Error) => {
        const errAny = error as any;
        logError({ route: 'gemini_session', sessionId }, error);
        const errorData: any = { message: error?.message || String(error) };
        if (errAny?.code) errorData.code = errAny.code;
        if (errAny?.reason) errorData.reason = errAny.reason;
        sendToClient(sessionId, { type: 'error', data: errorData, sessionId });
        sendToClient(sessionId, { type: 'status', data: { status: ConnectionState.ERROR }, sessionId });
      }
    );
    markOnce(sessionId, 'connect_session_done');
    sendToClient(sessionId, { type: 'status', data: { status: ConnectionState.CONNECTED }, sessionId });
    markOnce(sessionId, 'client_status_connected_sent');
  } catch (error: any) {
    logError({ route: 'ws_connect_gemini', sessionId }, error);
    sendToClient(sessionId, { type: 'status', data: { status: ConnectionState.ERROR }, sessionId });
    sendToClient(sessionId, { type: 'error', data: { message: error?.message || String(error) }, sessionId });
  }
}

async function handleAudio(sessionId: string, audioData: any): Promise<void> {
  if (!validateAudioData(audioData)) {
    sendToClient(sessionId, { type: 'error', data: { message: 'Invalid audio data format' }, sessionId });
    return;
  }
  try {
    await gemini.sendAudio(sessionId, audioData);
  } catch (error: any) {
    logError({ route: 'ws_audio_send', sessionId }, error);
    sendToClient(sessionId, { type: 'error', data: { message: error.message }, sessionId });
  }
}

async function handleDisconnect(sessionId: string): Promise<void> {
  try {
    await gemini.disconnectSession(sessionId);
    sendToClient(sessionId, { type: 'status', data: { status: ConnectionState.DISCONNECTED }, sessionId });
  } catch (error) {
    logError({ route: 'ws_disconnect', sessionId }, error);
  }
}

async function handleMessage(sessionId: string, message: ClientMessage): Promise<void> {
  switch (message.type) {
    case 'connect':
      markOnce(sessionId, 'client_connect_msg');
      await handleConnect(sessionId);
      break;
    case 'audio':
      markOnce(sessionId, 'first_mic_chunk_in');
      await handleAudio(sessionId, message.data);
      break;
    case 'disconnect':
      await handleDisconnect(sessionId);
      break;
    case 'ping':
      sendToClient(sessionId, { type: 'pong', sessionId });
      break;
    default:
      logWarn({ route: 'ws_message', sessionId }, `Unknown message type: ${(message as any).type}`);
  }
}

export function handleConnection(ws: WebSocket, sessionId: string): void {
  clients.set(sessionId, ws);
  markOnce(sessionId, 'ws_connected');

  ws.on('message', async (data: Buffer) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      await handleMessage(sessionId, message);
    } catch (error) {
      logError({ route: 'ws_message', sessionId }, error);
      sendToClient(sessionId, {
        type: 'error',
        data: { message: 'Invalid message format' },
        sessionId,
      });
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client', sessionId, 'disconnected');
    handleDisconnect(sessionId);
    clients.delete(sessionId);
    latencyMarks.delete(sessionId);
  });

  ws.on('error', (error: Error) => {
    logError({ route: 'ws_connection', sessionId }, error);
    handleDisconnect(sessionId);
    clients.delete(sessionId);
    latencyMarks.delete(sessionId);
  });

  sendToClient(sessionId, {
    type: 'status',
    data: { status: ConnectionState.CONNECTING },
    sessionId,
  });
}
