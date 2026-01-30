import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts"
import { getLLM } from "../../../common/services/llm"

const SYSTEM_TEMPLATE = `You are a validator for a semantic cache. Given a user QUESTION and an assistant ANSWER from a program-counselor chat, decide:

1) Is the QUESTION clear and not vague? (e.g. "what is the fee" is clear; "tell me more" or "???" is vague)
2) Is the ANSWER a good, direct fit for the QUESTION?
3) Would this Q&A pair be useful to cache for future similar questions?

Reply with exactly one word: YES or NO.`

const HUMAN_TEMPLATE = `QUESTION:
{question}

ANSWER:
{answer}

Reply YES or NO:`

const validationChain = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
  HumanMessagePromptTemplate.fromTemplate(HUMAN_TEMPLATE),
]).pipe(getLLM())

/**
 * LLM decides if this question+answer pair is worth storing in the semantic cache.
 * Returns true only if the LLM responds YES (question not vague, answer good for question, worth caching).
 */
export async function validateWorthCaching(
  question: string,
  answer: string
): Promise<boolean> {
  try {
    const result = await validationChain.invoke({ question, answer })
    const content = typeof result?.content === "string" ? result.content : ""
    const normalized = content.trim().toUpperCase()
    return normalized.startsWith("YES") && !normalized.startsWith("NO")
  } catch {
    return false
  }
}
