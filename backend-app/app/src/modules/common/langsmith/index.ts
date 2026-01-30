/**
 * LangSmith config and helpers for debugging & monitoring.
 * See https://docs.langchain.com/langsmith/trace-with-langchain
 *
 * Env vars (all optional when tracing disabled):
 * - LANGSMITH_TRACING: "true" to enable
 * - LANGSMITH_API_KEY: your API key (required for tracing)
 * - LANGSMITH_PROJECT: project name (default: rag-program-counselor)
 * - LANGSMITH_ENDPOINT: e.g. https://eu.api.smith.langchain.com for EU
 * - LANGCHAIN_CALLBACKS_BACKGROUND: "false" in serverless so traces flush before exit
 */

export const LANGSMITH_PROJECT_DEFAULT = "rag-program-counselor"

export function isTracingEnabled(): boolean {
  const v = process.env.LANGSMITH_TRACING
  const key = process.env.LANGSMITH_API_KEY
  if (!key?.trim()) return false
  return v === "true" || v === "1"
}

export function getLangSmithProject(): string {
  return process.env.LANGSMITH_PROJECT?.trim() || LANGSMITH_PROJECT_DEFAULT
}

export type RagRunConfig = {
  runName: string
  tags: string[]
  metadata: Record<string, unknown>
}

/** Build RunnableConfig fields for RAG chain invoke (tags, metadata, runName). */
export function ragRunConfig(sessionId: string, cohortKey: string): RagRunConfig {
  return {
    runName: "RAG",
    tags: ["rag", "program_counselor"],
    metadata: {
      session_id: sessionId,
      cohort_key: cohortKey,
    },
  }
}
