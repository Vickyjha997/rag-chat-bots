import {
  getCachedSession,
  setCachedSession,
  getCachedMessages,
  setCachedMessages,
  getCachedCollectionExists,
  setCachedCollectionExists,
  type CachedSessionData,
  type CachedMessageData,
} from "../../../common/services/cacheService"
import { checkCollectionExists } from "../../../common/services/qdrantServices"
import { getChatSessionModel } from "../../session/mongoSchema/mongoChatSessionSchema"
import { getChatMessageModel } from "../../session/mongoSchema/mongoChatMessageSchema"
import type { ChatSessionDoc } from "../../session/mongoSchema/mongoChatSessionSchema"
import type { ChatMessageDoc } from "../../session/mongoSchema/mongoChatMessageSchema"

/** TTL for session and messages cache (30 minutes). */
export const CHAT_CACHE_TTL_SECONDS = 30 * 60

/** TTL for collection-exists cache (30 minutes). */
const COLLECTION_EXISTS_TTL_SECONDS = 30 * 60

// ---------------------------------------------------------------------------
// Mongo doc → cache shape (JSON-serializable; dates → ISO strings)
// ---------------------------------------------------------------------------

function toCachedSession(doc: ChatSessionDoc): CachedSessionData {
  return JSON.parse(JSON.stringify(doc)) as CachedSessionData
}

function toCachedMessages(docs: ChatMessageDoc[]): CachedMessageData[] {
  return JSON.parse(JSON.stringify(docs)) as CachedMessageData[]
}

// ---------------------------------------------------------------------------
// Session: Redis first, fallback to Mongo (cache-aside). Cache failure = Mongo.
// ---------------------------------------------------------------------------

/**
 * Get session for chat: Redis first, Mongo on miss. Caches on miss.
 * If Redis fails (timeout, down), falls back to Mongo so the app keeps working.
 * Returns null if not found.
 */
export async function getSessionForChat(
  sessionId: string
): Promise<CachedSessionData | null> {
  let cached: CachedSessionData | null = null
  try {
    cached = await getCachedSession(sessionId)
  } catch {
    // Redis unavailable; fall back to Mongo
  }
  if (cached != null) return cached

  const SessionModel = await getChatSessionModel()
  const doc = await SessionModel.findById(sessionId).lean()
  if (doc == null) return null

  const data = toCachedSession(doc as ChatSessionDoc)
  try {
    await setCachedSession(sessionId, data, CHAT_CACHE_TTL_SECONDS)
  } catch {
    // Best-effort cache fill; ignore
  }
  return data
}

// ---------------------------------------------------------------------------
// Messages: Redis first, fallback to Mongo (cache-aside). Cache failure = Mongo.
// ---------------------------------------------------------------------------

/**
 * Get messages for chat: Redis first, Mongo on miss. Caches on miss.
 * Always sorted by message_order (cache stores array in order; Mongo uses .sort({ message_order: 1 })).
 * If Redis fails, falls back to Mongo so the app keeps working.
 */
export async function getMessagesForChat(
  sessionId: string
): Promise<CachedMessageData[]> {
  let cached: CachedMessageData[] | null = null
  try {
    cached = await getCachedMessages(sessionId)
  } catch {
    // Redis unavailable; fall back to Mongo
  }
  if (cached != null) return cached

  const MessageModel = await getChatMessageModel()
  const docs = await MessageModel.find({ session_id: sessionId })
    .sort({ message_order: 1 })
    .lean()

  const data = toCachedMessages(docs as ChatMessageDoc[])
  try {
    await setCachedMessages(sessionId, data, CHAT_CACHE_TTL_SECONDS)
  } catch {
    // Best-effort cache fill; ignore
  }
  return data
}

/**
 * Update messages cache after saving a new message. Best-effort only; never throws.
 * Call after MessageModel.create (fire-and-forget) so response isn't blocked by Redis.
 */
export async function setMessagesCacheAfterSave(
  sessionId: string,
  messages: CachedMessageData[],
  ttlSeconds: number = CHAT_CACHE_TTL_SECONDS
): Promise<void> {
  try {
    await setCachedMessages(sessionId, messages, ttlSeconds)
  } catch {
    // Best-effort; ignore
  }
}

// ---------------------------------------------------------------------------
// Collection existence: Redis first, Qdrant on miss. Cache failure = Qdrant.
// ---------------------------------------------------------------------------

/**
 * Check if vector collection exists: cache first, Qdrant on miss. Caches result.
 * If Redis fails, calls Qdrant directly so the app keeps working.
 */
export async function getCollectionExistsWithCache(
  collectionName: string
): Promise<boolean> {
  let cached: boolean | null = null
  try {
    cached = await getCachedCollectionExists(collectionName)
  } catch {
    // Redis unavailable; fall back to Qdrant
  }
  if (cached !== null) return cached

  const exists = await checkCollectionExists(collectionName)
  try {
    await setCachedCollectionExists(
      collectionName,
      exists,
      COLLECTION_EXISTS_TTL_SECONDS
    )
  } catch {
    // Best-effort cache fill; ignore
  }
  return exists
}
