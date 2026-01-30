import { register } from './toolRegistry.js';
import { logError } from '../../../common/errorLog.js';

/**
 * cohort_chat
 * Calls the RAG backend: POST /api/chat/cohort/:cohortKey
 * baseUrl from RAG_BASE_URL (env); cohortKey/sessionId from voice session ragContext.
 */
register({
  name: 'cohort_chat',
  description:
    'Ask the cohort RAG chatbot a question. Always use this for programme/cohort questions. Returns { response: string }.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'User question to ask the cohort RAG chatbot' },
      baseUrl: { type: 'string', description: 'RAG API base URL (or set RAG_BASE_URL in env)' },
      cohortKey: { type: 'string', description: 'Cohort key' },
      sessionId: { type: 'string', description: 'RAG session UUID from POST /api/createSession/:cohortKey' },
    },
    required: ['question'],
  },
  handler: async (args) => {
    const latencyEnabled = process.env.LATENCY_LOG === '1';
    const t0 = Date.now();

    const baseUrl = String(args.baseUrl || process.env.RAG_BASE_URL || '').replace(/\/+$/, '');
    const cohortKey = String(args.cohortKey || '');
    const sessionId = String(args.sessionId || '');
    const question = String(args.question || '');

    if (!baseUrl) throw new Error('Missing baseUrl. Set RAG_BASE_URL in .env or provide baseUrl in request');
    if (!cohortKey) throw new Error('Missing cohortKey');
    if (!sessionId) throw new Error('Missing sessionId');
    if (!question) throw new Error('Missing question');

    if (latencyEnabled) {
      // eslint-disable-next-line no-console
      console.log('[LATENCY]', JSON.stringify({ sessionId: String(args?.sessionId || ''), key: 'rag_tool_http_start', t: Date.now(), questionLen: question.length }));
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.RAG_API_KEY;
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const url = `${baseUrl}/api/chat/cohort/${encodeURIComponent(cohortKey)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, sessionId, mode: 'voice' }),
      });
    } catch (err: any) {
      const cause = err?.cause?.message ?? err?.message ?? String(err);
      const msg = `RAG backend unreachable: ${cause}. URL: ${url}. In Docker use RAG_BASE_URL=http://program-counsellor-backend:8080 (root compose) or http://host.docker.internal:8080 (standalone, backend on host).`;
      logError({ route: 'cohort_chat', cohortKey, sessionId, baseUrl }, err);
      throw new Error(msg);
    }

    const text = await res.text();
    if (latencyEnabled) {
      // eslint-disable-next-line no-console
      console.log('[LATENCY]', JSON.stringify({ sessionId: String(args?.sessionId || ''), key: 'rag_tool_http_done', t: Date.now(), ms: Date.now() - t0, status: res.status, bytes: text.length }));
    }
    if (!res.ok) {
      const err = new Error(`RAG chat failed (${res.status}): ${text}`);
      logError({ route: 'cohort_chat', cohortKey, sessionId, status: res.status }, err);
      throw err;
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      const err = new Error(`RAG chat returned non-JSON: ${text}`);
      logError({ route: 'cohort_chat', cohortKey, sessionId }, err);
      throw err;
    }

    const answer = json?.answer ?? json?.response ?? '';
    return { response: answer };
  },
});
