import type { EmbeddingsInterface } from "@langchain/core/embeddings"
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Default embedding dimension (gemini-embedding-001). Use 768, 1536, or 3072. */
export const EMBEDDING_DIMENSION = 3072

/**
 * Returns a LangChain Embeddings instance (Google Gemini). Use for
 * vector stores, retrievers, etc. Reads GEMINI_API_KEY from env.
 * Uses gemini-embedding-001 with 3072-dimensional output.
 */
export const getEmbeddings = (): EmbeddingsInterface =>
  new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-001",
  })

// ---------------------------------------------------------------------------
// Direct embedding (functional API)
// ---------------------------------------------------------------------------

/**
 * Embed a single query string. Returns the embedding vector.
 */
export const embedQuery = async (text: string): Promise<number[]> => {
  const embeddings = getEmbeddings()
  return embeddings.embedQuery(text)
}

/**
 * Embed multiple documents. Returns an array of embedding vectors.
 */
export const embedDocuments = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return []
  const embeddings = getEmbeddings()
  return embeddings.embedDocuments(texts)
}
