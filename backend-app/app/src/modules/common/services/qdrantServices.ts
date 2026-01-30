import { Document } from "@langchain/core/documents"
import { QdrantVectorStore } from "@langchain/qdrant"
import { qdrantClient } from "../db/qdrant"
import { getEmbeddings } from "./geminiEmbeddingService"

// ---------------------------------------------------------------------------
// Pure helpers (no I/O)
// ---------------------------------------------------------------------------

const dbConfig = (collectionName: string) => ({
  client: qdrantClient,
  collectionName,
})

export const checkCollectionExists = async (collectionName: string) => {
  const collections = await qdrantClient.getCollections()
  return collections.collections.some(collection => collection.name === collectionName)
}

/**
 * Convert text chunks to LangChain Document[] (pure).
 */
export const chunksToDocuments = (
  chunks: string[],
  metadata?: Record<string, unknown> | Record<string, unknown>[]
): Document[] =>
  chunks.map((pageContent, i) => {
    const meta = Array.isArray(metadata) ? metadata[i] ?? {} : metadata ?? {}
    return new Document({ pageContent, metadata: meta })
  })

// ---------------------------------------------------------------------------
// Vector store operations (functional API)
// ---------------------------------------------------------------------------

/**
 * Embed chunks and upsert into a Qdrant collection. Creates the collection
 * if it does not exist.
 */
export const upsertChunks = async (
  collectionName: string,
  chunks: string[],
  metadata?: Record<string, unknown> | Record<string, unknown>[]
): Promise<void> => {
  if (chunks.length === 0) return
  const embeddings = getEmbeddings()
  const config = dbConfig(collectionName)
  const store = new QdrantVectorStore(embeddings, config)
  await store.ensureCollection()
  const docs = chunksToDocuments(chunks, metadata)
  await store.addDocuments(docs)
}

/**
 * Similarity search over a Qdrant collection. Returns matching documents.
 */
export const similaritySearch = async (
  collectionName: string,
  query: string,
  k = 4
): Promise<Document[]> => {
  const embeddings = getEmbeddings()
  const config = dbConfig(collectionName)
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, config)
  return store.similaritySearch(query, k)
}

/**
 * Similarity search with scores. Returns [doc, score][].
 */
export const similaritySearchWithScore = async (
  collectionName: string,
  query: string,
  k = 4
): Promise<[Document, number][]> => {
  const embeddings = getEmbeddings()
  const config = dbConfig(collectionName)
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, config)
  const vectors = await embeddings.embedQuery(query)
  return store.similaritySearchVectorWithScore(vectors, k)
}

/**
 * Delete all points in a collection that match a filter.
 */
export const deleteByFilter = async (
  collectionName: string,
  filter: object
): Promise<void> => {
  const embeddings = getEmbeddings()
  const config = dbConfig(collectionName)
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, config)
  await store.delete({ filter })
}

export const deleteCollection = async (collectionName: string): Promise<void> => {
  await qdrantClient.deleteCollection(collectionName)
}
