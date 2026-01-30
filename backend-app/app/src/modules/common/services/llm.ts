import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

const DEFAULT_MODEL = "gemini-2.5-flash"

/**
 * Returns a LangChain ChatGoogleGenerativeAI instance (Gemini).
 * Reads GEMINI_API_KEY from env. Use for RAG chain, etc.
 */
export const getLLM = (): ChatGoogleGenerativeAI =>
  new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_CHAT_MODEL ?? DEFAULT_MODEL,
  })
