import { redis } from "../lib/redis"

// ---------------------------------------------------------------------------
// Key prefixes (single place for consistency)
// ---------------------------------------------------------------------------

const PREFIX_SESSION = "session:"
const PREFIX_MESSAGES = "messages:"
const PREFIX_COLLECTION_EXISTS = "collection_exists:"
const PREFIX_SEMANTIC = "semantic:"

// ---------------------------------------------------------------------------
// Cache payload types (JSON-serializable; dates as ISO strings)
// ---------------------------------------------------------------------------

export interface CachedSessionData {
  _id: string
  cohort_key: string
  full_name: string
  email: string
  current_designation: string
  phone_number: string
  country_code?: string
  expires_at: string
  created_at?: string
  updated_at?: string
}

export interface CachedMessageData {
  _id: string
  session_id: string
  question: string
  answer: string
  message_order: number
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Session cache (cache-aside: check Redis first, then DB)
// ---------------------------------------------------------------------------

/**
 * Get session from Redis. Returns null on miss or parse error.
 * @see https://redis.io/docs/latest/commands/get/
 */
export async function getCachedSession(
  sessionId: string
): Promise<CachedSessionData | null> {
  const key = PREFIX_SESSION + sessionId
  const raw = await redis.get(key)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as CachedSessionData
  } catch {
    return null
  }
}

/**
 * Store session in Redis with TTL (seconds).
 * @see https://redis.io/docs/latest/commands/set/ (EX option)
 * @see https://stackoverflow.com/questions/41237001/how-do-i-set-the-expiration-time-for-a-key-in-ioredis
 */
export async function setCachedSession(
  sessionId: string,
  sessionData: CachedSessionData,
  ttlSeconds: number
): Promise<void> {
  const key = PREFIX_SESSION + sessionId
  const value = JSON.stringify(sessionData)
  await redis.set(key, value, "EX", ttlSeconds)
}

// ---------------------------------------------------------------------------
// Messages cache
// ---------------------------------------------------------------------------

export async function getCachedMessages(
  sessionId: string
): Promise<CachedMessageData[] | null> {
  const key = PREFIX_MESSAGES + sessionId
  const raw = await redis.get(key)
  if (raw == null) return null
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? (arr as CachedMessageData[]) : null
  } catch {
    return null
  }
}

export async function setCachedMessages(
  sessionId: string,
  messages: CachedMessageData[],
  ttlSeconds: number
): Promise<void> {
  const key = PREFIX_MESSAGES + sessionId
  await redis.set(key, JSON.stringify(messages), "EX", ttlSeconds)
}

// ---------------------------------------------------------------------------
// Vector collection existence cache (avoids repeated Qdrant getCollections)
// ---------------------------------------------------------------------------

export async function getCachedCollectionExists(
  collectionName: string
): Promise<boolean | null> {
  const key = PREFIX_COLLECTION_EXISTS + collectionName
  const raw = await redis.get(key)
  if (raw == null) return null
  return raw === "1"
}

export async function setCachedCollectionExists(
  collectionName: string,
  exists: boolean,
  ttlSeconds: number
): Promise<void> {
  const key = PREFIX_COLLECTION_EXISTS + collectionName
  await redis.set(key, exists ? "1" : "0", "EX", ttlSeconds)
}

/**
 * Invalidate collection-exists cache (e.g. after deleting the collection).
 * @see https://redis.io/docs/latest/commands/del/
 */
export async function delCachedCollectionExists(
  collectionName: string
): Promise<void> {
  const key = PREFIX_COLLECTION_EXISTS + collectionName
  await redis.del(key)
}

// ---------------------------------------------------------------------------
// Semantic answer cache (optional; not wired into sendMessage yet)
// ---------------------------------------------------------------------------

export async function getSemanticAnswer(
  cohortKey: string,
  questionHash: string
): Promise<string | null> {
  const key = `${PREFIX_SEMANTIC}${cohortKey}:${questionHash}`
  const raw = await redis.get(key)
  return raw ?? null
}

export async function setSemanticAnswer(
  cohortKey: string,
  questionHash: string,
  answer: string,
  ttlSeconds: number
): Promise<void> {
  const key = `${PREFIX_SEMANTIC}${cohortKey}:${questionHash}`
  await redis.set(key, answer, "EX", ttlSeconds)
}
