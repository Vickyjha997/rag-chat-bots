import { randomUUID } from "crypto"
import { toSessionDoc } from "../../common/mongoSessionSchema"
import type { CreateSessionInput } from "../../common/mongoSessionSchema"
import { getLeadModel } from "./mongoSchema/mongoLeadSchema"
import { getChatSessionModel } from "./mongoSchema/mongoChatSessionSchema"
import { internalError } from "../../logger/errors"

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

export type CreateSessionResult = { sessionId: string; expiresAt: Date }

export async function createSession(
  cohortKey: string,
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  const sessionId = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  try {
    const LeadModel = await getLeadModel()
    const ChatSessionModel = await getChatSessionModel()

    const leadData = {
      cohort_key: cohortKey,
      full_name: input.fullName,
      email: input.email,
      current_designation: input.currentDesignation,
      phone_number: input.phoneNumber,
      country_code: input.countryCode ?? undefined,
      source: input.source ?? "chatbot",
    }
    await LeadModel.create(leadData)

    const sessionData = toSessionDoc(input, {
      _id: sessionId,
      cohort_key: cohortKey,
      expires_at: expiresAt,
    })
    await ChatSessionModel.create(sessionData)

    return { sessionId, expiresAt }
  } catch (e) {
    throw internalError("Failed to create session and lead", e)
  }
}
