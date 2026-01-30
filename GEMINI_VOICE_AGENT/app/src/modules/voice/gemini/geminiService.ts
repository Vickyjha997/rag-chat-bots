import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import type { Session } from '../../../common/types.js';
import { getSession, updateSession } from '../session/sessionService.js';
import { getGeminiToolsFormat, execute as executeTool } from '../tools/toolRegistry.js';
import { logError, logWarn } from '../../../common/errorLog.js';
import { GEMINI_MODEL_NAME, TOOL_DEDUPE_TTL_MS } from '../../../common/constants.js';

let ai: GoogleGenAI | null = null;

const latencyMarks = new Map<string, Record<string, number>>();
const inFlightToolCalls = new Map<string, Promise<any>>();
const toolResultCache = new Map<string, { result: any; storedAt: number }>();

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

function logLatency(sessionId: string, key: string, extra?: Record<string, unknown>): void {
  if (!latencyEnabled()) return;
  const now = Date.now();
  const marks = latencyMarks.get(sessionId) || {};
  if (marks.start == null) marks.start = now;
  latencyMarks.set(sessionId, marks);
  const start = marks.start || now;
  console.log('[LATENCY]', JSON.stringify({ sessionId, key, t: now, sinceStartMs: now - start, ...(extra || {}) }));
}

function dedupeKeyForToolCall(sessionId: string, toolName: string, args: Record<string, any>): string {
  const q = String(args?.question ?? '').trim().toLowerCase();
  const cohortKey = String(args?.cohortKey ?? '');
  const ragSessionId = String(args?.sessionId ?? '');
  const baseUrl = String(args?.baseUrl ?? '');
  return `${sessionId}::${toolName}::${cohortKey}::${ragSessionId}::${baseUrl}::${q}`;
}

function getSystemInstruction(ragCtx: Session['ragContext']): string {
  if (ragCtx) {
    return `You are a voice assistant for an academic programme chatbot.

CRITICAL RULES (MUST FOLLOW):
- You MUST answer using ONLY the cohort_chat tool.
- For EVERY user question, call cohort_chat exactly once.
- The tool will return JSON like: {"response":"..."}.
- You MUST speak EXACTLY the value of "response". Do NOT add any extra words, greetings, prefixes, suffixes, or explanations.
- If the tool returns an empty response, say: "I don't have any information. Please start chat after sometime and exit."

TOOL CALL ARGUMENTS:
- Call cohort_chat with:
  - question: the user's question (verbatim)
  - cohortKey: ${ragCtx.cohortKey}
  - sessionId: ${ragCtx.ragSessionId}

LANGUAGE:
- Provide Answer in English`;
  }
  return `You are a helpful AI voice assistant with access to various tools and APIs. 

IMPORTANT: You have access to function calling tools. When a user asks about:
- Weather information → Use the get_weather function
- Analytics or data queries → Use get_analytics or execute_sql_query functions  
- Searching for information → Use search_knowledge_base function
- External API calls → Use call_external_api function

You MUST use function calls when users request data, information retrieval, or external service interactions. Do not just respond without calling functions when they are needed.

Always explain what you're doing when calling functions.
Mostly try to respond in English unless the user speaks in another language.`;
}

async function handleFunctionCalls(
  message: LiveServerMessage,
  sessionId: string,
  onMessage: (message: LiveServerMessage) => void
): Promise<void> {
  const msgAny: any = message;
  const toolCall =
    msgAny.toolCall ??
    msgAny.tool_call ??
    msgAny.serverContent?.toolCall ??
    msgAny.serverContent?.tool_call ??
    msgAny.server_content?.toolCall ??
    msgAny.server_content?.tool_call;
  const functionCalls = toolCall?.functionCalls ?? toolCall?.function_calls ?? [];
  if (!Array.isArray(functionCalls) || functionCalls.length === 0) return;

  logLatency(sessionId, 'tool_call_received', { count: functionCalls.length });
  const session = getSession(sessionId);
  if (!session?.geminiSession) return;

  const functionResponses: any[] = [];
  for (const fc of functionCalls) {
    const toolName = fc.name || '';
    const args = fc.args || {};
    const callId = fc.id || toolName + '_' + Date.now();
    if (!toolName) continue;

    if (process.env.LOG_TOOLS !== '0') console.log('[Voice] Tool:', toolName);
    let effectiveArgs: Record<string, any> = args;
    if (toolName === 'cohort_chat') {
      const ragCtx = session.ragContext;
      if (!ragCtx) {
        effectiveArgs = { ...args, baseUrl: args.baseUrl ?? process.env.RAG_BASE_URL };
      } else {
        // Prefer RAG_BASE_URL (env) over ragCtx.baseUrl (browser URL) so Docker uses internal network.
        effectiveArgs = {
          baseUrl: args.baseUrl ?? process.env.RAG_BASE_URL ?? ragCtx.baseUrl,
          cohortKey: args.cohortKey ?? ragCtx.cohortKey,
          sessionId: args.sessionId ?? ragCtx.ragSessionId,
          question: args.question ?? args.query ?? args.text ?? '',
        };
      }
    }

    const dedupeKey = dedupeKeyForToolCall(sessionId, toolName, effectiveArgs);
    const cached = toolResultCache.get(dedupeKey);
    if (cached && Date.now() - cached.storedAt < TOOL_DEDUPE_TTL_MS) {
      logLatency(sessionId, 'tool_dedupe_cache_hit', { toolName });
      functionResponses.push({
        id: callId,
        name: toolName,
        response: cached.result?.error ? { error: cached.result.error } : cached.result?.result ?? cached.result,
      });
      continue;
    }

    const existing = inFlightToolCalls.get(dedupeKey);
    if (existing) {
      logLatency(sessionId, 'tool_dedupe_inflight_hit', { toolName });
      const awaited = await existing;
      functionResponses.push({
        id: callId,
        name: toolName,
        response: awaited?.error ? { error: awaited.error } : awaited?.result ?? awaited,
      });
      continue;
    }

    const promise = executeTool(toolName, effectiveArgs)
      .then((r) => {
        toolResultCache.set(dedupeKey, { result: r, storedAt: Date.now() });
        return r;
      })
      .finally(() => { inFlightToolCalls.delete(dedupeKey); });
    inFlightToolCalls.set(dedupeKey, promise);
    const result = await promise;
    functionResponses.push({
      id: callId,
      name: toolName,
      response: result.error ? { error: result.error } : result.result,
    });
  }

  try {
    if (typeof session.geminiSession.sendToolResponse === 'function') {
      logLatency(sessionId, 'tool_response_send_start', { responses: functionResponses.length });
      await session.geminiSession.sendToolResponse({ functionResponses });
      logLatency(sessionId, 'tool_response_send_done', { responses: functionResponses.length });
    } else {
      logWarn({ route: 'gemini_tool_response', sessionId }, 'sendToolResponse method not available on session');
    }
  } catch (error: any) {
    logError({ route: 'gemini_tool_response', sessionId }, error);
  }
}

export function initGeminiService(apiKey: string): void {
  ai = new GoogleGenAI({ apiKey });
}

export async function connectSession(
  sessionId: string,
  onMessage: (message: LiveServerMessage) => void,
  onError: (error: Error) => void
): Promise<any> {
  if (!ai) throw new Error('Gemini service not initialized');
  const session = getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const ragCtx = session.ragContext;
  const tools = ragCtx
    ? getGeminiToolsFormat().filter((t) => t.name === 'cohort_chat')
    : getGeminiToolsFormat();
  const toolsToUse =
    tools.length > 0
      ? [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }]
      : undefined;

  markOnce(sessionId, 'gemini_connect_start');
  let geminiSession: any;
  try {
    geminiSession = await ai.live.connect({
      model: GEMINI_MODEL_NAME,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: getSystemInstruction(ragCtx),
        tools: toolsToUse as any,
      },
      callbacks: {
        onopen: () => console.log('[Gemini] Connected', sessionId),
        onmessage: async (message: LiveServerMessage) => {
          await handleFunctionCalls(message, sessionId, onMessage);
          onMessage(message);
        },
        onclose: (event: any) => {
          const closeReason = event?.reason ?? event?.[Symbol.for('kReason')] ?? 'Unknown';
          const closeCode = event?.code ?? event?.[Symbol.for('kCode')] ?? 'Unknown';
          console.log('[Gemini] Closed', sessionId, closeCode, closeReason);
          if (
            typeof closeReason === 'string' &&
            (closeReason.includes('leaked') || closeReason.includes('API key') || closeReason.includes('invalid'))
          ) {
            const apiKeyError = new Error(`API Key Error: ${closeReason}`);
            (apiKeyError as any).code = closeCode;
            (apiKeyError as any).reason = closeReason;
            onError(apiKeyError);
          }
        },
        onerror: (err: Error) => {
          logError({ route: 'gemini_live', sessionId }, err);
          onError(err);
        },
      },
    });
    markOnce(sessionId, 'gemini_connect_done');
  } catch (error: any) {
    throw error;
  }

  updateSession(sessionId, { geminiSession });
  return geminiSession;
}

export async function sendAudio(sessionId: string, audioBlob: any): Promise<void> {
  const session = getSession(sessionId);
  if (!session?.geminiSession) throw new Error('Session not found or not connected');
  await session.geminiSession.sendRealtimeInput({ media: audioBlob });
}

export async function disconnectSession(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session?.geminiSession) return;
  if (typeof session.geminiSession.close === 'function') {
    await session.geminiSession.close();
  }
  updateSession(sessionId, { geminiSession: null });
  latencyMarks.delete(sessionId);
}
