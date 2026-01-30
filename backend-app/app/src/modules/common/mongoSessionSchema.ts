/**
 * Zod schemas for chat session validation.
 * Maps to ChatSession MongoDB doc (snake_case) via toSessionDoc.
 */
import { z } from "zod"

export const createSessionSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  currentDesignation: z.string().min(1, "Current designation is required"),
  phoneNumber: z.preprocess(
    (val) =>
      val === null || val === undefined ? "" : String(val).trim(),
    z.string().min(1, "Phone number is required")
  ),
  countryCode: z.preprocess(
    (val) =>
      val === null || val === undefined || val === "" ? undefined : String(val),
    z.string().optional()
  ),
  source: z.string().optional().default("chatbot"),
})

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format"),
  question: z
    .string()
    .min(1, "Question is required and must be a non-empty string"),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>

/** Map validated CreateSessionInput → ChatSession doc (snake_case). */
export const toSessionDoc = (
  input: CreateSessionInput,
  opts: { _id: string; cohort_key: string; expires_at: Date }
) => ({
  _id: opts._id,
  cohort_key: opts.cohort_key,
  full_name: input.fullName,
  email: input.email,
  current_designation: input.currentDesignation,
  phone_number: input.phoneNumber,
  country_code: input.countryCode ?? undefined,
  expires_at: opts.expires_at,
})
