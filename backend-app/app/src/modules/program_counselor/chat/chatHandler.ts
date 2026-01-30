import { traceable } from "langsmith/traceable"
import { getLangchainCallbacks } from "langsmith/langchain"
import { similaritySearchWithScore } from "../../common/services/qdrantServices"
import { getChatMessageModel } from "../session/mongoSchema/mongoChatMessageSchema"
import { ragRunConfig } from "../../common/langsmith"
import type { Document } from "@langchain/core/documents"
import {
  askWithContext,
  type HistoryEntry,
  type RankedChunk,
  takeLatestHistory,
} from "./services/rag"
import { notFoundError, internalError } from "../../logger/errors"
import {
  getSessionForChat,
  getMessagesForChat,
  getCollectionExistsWithCache,
  setMessagesCacheAfterSave,
  CHAT_CACHE_TTL_SECONDS,
} from "./services/chatDataService"
import type { CachedMessageData } from "../../common/services/cacheService"
import { searchSemantic, setEntry as setLangCacheEntry } from "../../common/services/langCacheService"
import { validateWorthCaching } from "./services/semanticCacheValidation"

const RAG_K = 8

function toRankedChunks(pairs: [Document, number][]): RankedChunk[] {
  return pairs.map(([doc, score], index) => {
    const meta = doc.metadata as Record<string, unknown> | undefined
    return {
      rank: index + 1,
      score,
      text: doc.pageContent ?? "",
      chunkIndex: meta?.chunkIndex as number | undefined,
    }
  })
}

export type SendMessageResult = { answer: string }

async function runSendMessage(
  cohortKey: string,
  sessionId: string,
  question: string
): Promise<SendMessageResult> {
  const session = await getSessionForChat(sessionId)
  if (!session) {
    throw notFoundError("Chat session not found")
  }

  if (session.cohort_key !== cohortKey) {
    throw notFoundError("Session does not belong to this cohort")
  }

  const collectionName = `cohort_${cohortKey}`
  const programName = cohortKey

  // Semantic cache: search only; no update. On hit return cached answer (do not store again).
  const semanticHit = await searchSemantic(question, cohortKey).catch(() => null)
  if (semanticHit != null && semanticHit.score > 0.9) {
    const messages = await getMessagesForChat(sessionId)
    const MessageModel = await getChatMessageModel()
    const lastMessage = messages[messages.length - 1]
    const nextOrder = (lastMessage?.message_order ?? 0) + 1
    try {
      const created = await MessageModel.create({
        session_id: sessionId,
        question,
        answer: semanticHit.response,
        message_order: nextOrder,
      })
      const newCached: CachedMessageData = JSON.parse(
        JSON.stringify(created)
      ) as CachedMessageData
      setMessagesCacheAfterSave(
        sessionId,
        [...messages, newCached],
        CHAT_CACHE_TTL_SECONDS
      ).catch(() => {})
    } catch (e) {
      throw internalError("Failed to save chat messages", e)
    }
    return { answer: semanticHit.response }
  }

  // Run collection check, vector search, and messages fetch in parallel (no improvement if run sequentially)
  let collectionExists: boolean
  let pairs: [Document, number][]
  let messages: CachedMessageData[]
  try {
    ;[collectionExists, pairs, messages] = await Promise.all([
      getCollectionExistsWithCache(collectionName),
      similaritySearchWithScore(collectionName, question, RAG_K),
      getMessagesForChat(sessionId),
    ])
  } catch (e) {
    throw internalError("Similarity search failed", e)
  }

  if (!collectionExists) {
    throw notFoundError(`Collection '${collectionName}' does not exist`)
  }

  const rankedChunks = toRankedChunks(pairs)

  const fullHistory: HistoryEntry[] = messages.flatMap((m: CachedMessageData) => [
    { role: "user", content: m.question },
    { role: "assistant", content: m.answer },
  ]) as HistoryEntry[]
  const history = takeLatestHistory(fullHistory)

  const runConfig = ragRunConfig(sessionId, cohortKey)
  const callbacks = await getLangchainCallbacks()

  let answer: string
  try {
    answer = await askWithContext(
      question,
      rankedChunks,
      history,
      programName,
      {
        ...runConfig,
        ...(callbacks && { callbacks: callbacks as any }),
      }
    )
  } catch (e) {
    throw internalError("RAG / LLM failed", e)
  }

  const MessageModel = await getChatMessageModel()
  // message_order: Mongo is source of truth; nextOrder from current list (cache or Mongo), then persist
  const lastMessage = messages[messages.length - 1]
  const nextOrder = (lastMessage?.message_order ?? 0) + 1

  try {
    const created = await MessageModel.create({
      session_id: sessionId,
      question,
      answer,
      message_order: nextOrder,
    })
    const newCached: CachedMessageData = JSON.parse(
      JSON.stringify(created)
    ) as CachedMessageData
    const updatedMessages = [...messages, newCached]
    // Fire-and-forget cache update: don't block response on Redis; Mongo is source of truth
    setMessagesCacheAfterSave(
      sessionId,
      updatedMessages,
      CHAT_CACHE_TTL_SECONDS
    ).catch(() => {})

    // On miss only: insert into LangCache if Q&A validator approves (question clear, answer good). No updates.
    validateWorthCaching(question, answer)
      .then((worth) => {
        if (worth) return setLangCacheEntry(question, answer, cohortKey)
      })
      .catch(() => {})
  } catch (e) {
    throw internalError("Failed to save chat messages", e)
  }

  return { answer }
}

const sendMessageTraced = traceable(runSendMessage, {
  name: "sendMessage",
  tags: ["rag", "program_counselor"],
})

/**
 * RAG chat flow: retrieve top-8 ranked chunks from cohort collection →
 * latest-4-turn history → askWithContext (sales-agent prompt) → persist messages → return answer.
 * programName skipped for now (use cohortKey); can store separately later.
 */
export async function sendMessage(
  cohortKey: string,
  sessionId: string,
  question: string
): Promise<SendMessageResult> {
  return sendMessageTraced(cohortKey, sessionId, question)
}
