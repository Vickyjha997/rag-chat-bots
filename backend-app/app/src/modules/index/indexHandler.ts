import axios from "axios"
import { getJson } from "./util/getJson"
import { cohortJsonToText, type CohortJson } from "./util/jsonToText"
import { splitIntoChunks } from "./services/chunkingService"
import {
  checkCollectionExists,
  deleteCollection,
  upsertChunks,
} from "../common/services/qdrantServices"
import {
  delCachedCollectionExists,
  setCachedCollectionExists,
} from "../common/services/cacheService"
import { internalError, notFoundError, xiteApiError } from "../logger/errors"

export type UpdateVectorDBResult = { chunks: string[]; collection: string }
export type DeleteVectorDBResult = { collection: string }

export async function updateVectorDB(cohortKey: string): Promise<UpdateVectorDBResult> {
  const collectionName = `cohort_${cohortKey}`

  const exists = await checkCollectionExists(collectionName)
  if (exists) {
    await deleteCollection(collectionName)
    try {
      await delCachedCollectionExists(collectionName)
    } catch {
      // Cache invalidation best-effort; app works without Redis
    }
  }

  let json: CohortJson
  try {
    json = await getJson<CohortJson>(cohortKey)
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status ?? 502
      const msg =
        (e.response?.data as { message?: string })?.message ??
        e.message ??
        "XITE API request failed"
      throw xiteApiError(msg, status)
    }
    throw internalError("Failed to fetch cohort JSON", e)
  }

  const text = cohortJsonToText(json)
  const chunks = await splitIntoChunks(text)
  await upsertChunks(collectionName, chunks, { cohortKey })

  // Cache that collection exists so sendMessage can skip Qdrant getCollections (30 min TTL)
  try {
    await setCachedCollectionExists(collectionName, true, 30 * 60)
  } catch {
    // Best-effort; app works without Redis
  }

  return { chunks: chunks, collection: collectionName }
}

export async function deleteVectorDB(cohortKey: string): Promise<DeleteVectorDBResult> {
  const collectionName = `cohort_${cohortKey}`

  const exists = await checkCollectionExists(collectionName)
  if (!exists) throw notFoundError(`Collection '${collectionName}' does not exist`)

  await deleteCollection(collectionName)
  try {
    await delCachedCollectionExists(collectionName)
  } catch {
    // Cache invalidation best-effort; app works without Redis
  }
  return { collection: collectionName }
}
