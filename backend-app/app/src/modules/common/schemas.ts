import { z } from "zod"

/** Validates :cohortKey route param. */
export const cohortKeySchema = z
  .string()
  .trim()
  .min(1, "cohortKey is required")
  .max(256, "cohortKey too long")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "cohortKey must be alphanumeric with dots, hyphens or underscores"
  )

export type CohortKey = z.infer<typeof cohortKeySchema>

export { createSessionSchema } from "./mongoSessionSchema"
export type { CreateSessionInput } from "./mongoSessionSchema"
