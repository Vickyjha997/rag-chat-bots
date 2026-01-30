import { z } from "zod"

/** Validates :cohortKey route param (e.g. oxford-selp-cohort-4). */
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
