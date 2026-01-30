import type { Callbacks } from "@langchain/core/callbacks/manager"
import { getLLM } from "../../../common/services/llm"
import { ragPrompt } from "./ragPrompt"

export type HistoryEntry = { role: "user" | "assistant"; content: string }

export type RankedChunk = {
  rank: number
  score: number
  text: string
  chunkIndex?: number
}

export type AskWithContextRunConfig = {
  runName?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  callbacks?: Callbacks
}

const HISTORY_TURNS = 4
const HISTORY_MAX_MESSAGES = HISTORY_TURNS * 2

/** Keep only the latest 4 conversation turns (4 user + 4 assistant = 8 messages). */
export function takeLatestHistory(history: HistoryEntry[]): HistoryEntry[] {
  if (history.length <= HISTORY_MAX_MESSAGES) return history
  return history.slice(-HISTORY_MAX_MESSAGES)
}

/** Format history entries into a single string for the prompt. */
export function formatHistory(history: HistoryEntry[]): string {
  if (history.length === 0) return "(none)"
  return history
    .map((h) => (h.role === "user" ? `User: ${h.content}` : `Assistant: ${h.content}`))
    .join("\n")
}

/** Build context string from ranked chunks (rank, score, text). */
export function rankedChunksToContext(rankedChunks: RankedChunk[]): string {
  if (rankedChunks.length === 0) return "(no relevant context)"
  return rankedChunks
    .map(
      (c) =>
        `[Rank ${c.rank}, score: ${c.score.toFixed(4)}] ${c.chunkIndex != null ? `(chunk ${c.chunkIndex}) ` : ""}${c.text}`
    )
    .join("\n\n")
}

/**
 * Run RAG: prompt (programName, context from ranked chunks, latest-4-turn history, question) → LLM → answer.
 */
export async function askWithContext(
  question: string,
  rankedChunks: RankedChunk[],
  history: HistoryEntry[],
  programName: string,
  runConfig?: AskWithContextRunConfig
): Promise<string> {
  const context = rankedChunksToContext(rankedChunks)
  const chatHistory = formatHistory(history)
  const llm = getLLM()
  const chain = ragPrompt.pipe(llm)
  const config = runConfig
    ? {
        ...(runConfig.runName && { runName: runConfig.runName }),
        ...(runConfig.tags?.length && { tags: runConfig.tags }),
        ...(runConfig.metadata && Object.keys(runConfig.metadata).length > 0 && {
          metadata: runConfig.metadata,
        }),
        ...(runConfig.callbacks && { callbacks: runConfig.callbacks }),
      }
    : undefined
  const result = await chain.invoke(
    { programName, context, chat_history: chatHistory, question },
    config
  )
  const content = result?.content
  if (typeof content !== "string") {
    throw new Error("LLM returned non-string content")
  }
  return content
}
