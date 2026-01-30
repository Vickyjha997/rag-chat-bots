/**
 * LangCache semantic cache: search by prompt (similarity), store prompt+response with attributes.
 * All cohorts use the same LANGCACHE_CACHE_ID; scope by attribute cohortKey.
 * @see https://redis.io/docs/latest/develop/ai/langcache/api-examples/
 */

const LANGCACHE_SERVER_URL = process.env.LANGCACHE_SERVER_URL ?? ""
const LANGCACHE_CACHE_ID = process.env.LANGCACHE_CACHE_ID ?? ""
const LANGCACHE_API_KEY = process.env.LANGCACHE_API_KEY ?? ""

const SEMANTIC_SCORE_THRESHOLD = 0.9

/** TTL for each Q&A pair in LangCache: 30 hours (in milliseconds). */
export const LANGCACHE_ENTRY_TTL_MILLIS = 30 * 60 * 60 * 1000

export function isLangCacheConfigured(): boolean {
  return Boolean(
    LANGCACHE_SERVER_URL &&
      LANGCACHE_CACHE_ID &&
      LANGCACHE_API_KEY
  )
}

export type SemanticSearchHit = {
  response: string
  score: number
}

/**
 * Search LangCache for a semantically similar Q&A. Scopes by cohortKey attribute.
 * Returns hit only if score > SEMANTIC_SCORE_THRESHOLD (0.9).
 * Returns null on miss, config missing, or API error.
 */
export async function searchSemantic(
  question: string,
  cohortKey: string
): Promise<SemanticSearchHit | null> {
  if (!isLangCacheConfigured()) return null

  const baseUrl = LANGCACHE_SERVER_URL.replace(/\/$/, "")
  const url = `${baseUrl}/v1/caches/${encodeURIComponent(LANGCACHE_CACHE_ID)}/entries/search`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${LANGCACHE_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: question,
        attributes: { cohortKey },
        similarityThreshold: SEMANTIC_SCORE_THRESHOLD,
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as unknown
    // LangCache API returns { data: { "0": { response, score } } } (array-like) or { data: { entries: [...] } }
    const raw = data && typeof data === "object" && (data as { data?: unknown }).data != null
      ? (data as { data: Record<string, unknown> }).data
      : (data as Record<string, unknown>)
    const firstFromKey =
      raw && typeof raw === "object" && ("0" in (raw as object))
        ? (raw as { "0": { response?: string; score?: number } })["0"]
        : null
    const entries = raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown[] }).entries)
      ? (raw as { entries: { response?: string; score?: number }[] }).entries
      : null
    const first = firstFromKey ?? entries?.[0]
    const score =
      typeof first?.score === "number"
        ? first.score
        : typeof raw?.score === "number"
          ? (raw as { score: number }).score
          : 1
    const response =
      typeof first?.response === "string"
        ? first.response
        : typeof (raw as { response?: string })?.response === "string"
          ? (raw as { response: string }).response
          : Array.isArray((data as { entries?: unknown[] }).entries) &&
              (data as { entries: { response?: string; score?: number }[] }).entries[0]
            ? (data as { entries: { response: string; score?: number }[] }).entries[0].response
            : null

    if (response == null || typeof response !== "string") return null
    if (score < SEMANTIC_SCORE_THRESHOLD) return null

    return { response, score }
  } catch {
    return null
  }
}

/**
 * Store a prompt+response in LangCache with attribute cohortKey (same cache ID for all cohorts).
 * Each entry has a 30-hour TTL.
 */
export async function setEntry(
  prompt: string,
  response: string,
  cohortKey: string
): Promise<void> {
  if (!isLangCacheConfigured()) return

  const baseUrl = LANGCACHE_SERVER_URL.replace(/\/$/, "")
  const url = `${baseUrl}/v1/caches/${encodeURIComponent(LANGCACHE_CACHE_ID)}/entries`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${LANGCACHE_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        response,
        attributes: { cohortKey },
        ttlMillis: LANGCACHE_ENTRY_TTL_MILLIS,
      }),
    })
    if (!res.ok) {
      console.warn("[LangCache] set entry failed:", res.status, await res.text())
    }
  } catch (e) {
    console.warn("[LangCache] set entry error:", (e as Error).message)
  }
}
