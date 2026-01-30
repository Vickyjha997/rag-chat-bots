import type { Request, Response } from "express"
import { ZodError } from "zod"
import { cohortKeySchema, createSessionSchema } from "../../common/schemas"
import { createSession } from "./sessionHandler"
import {
  isAppError,
  fromZodError,
  toAppError,
} from "../../logger/errors"
import { logError } from "../../logger/errorlog"

const parseCohortKey = (raw: unknown) => cohortKeySchema.parse(raw)

export async function createSessionController(req: Request, res: Response) {
  const route = "POST /api/createSession/:cohortKey"
  let cohortKey: string

  try {
    cohortKey = parseCohortKey(req.params.cohortKey)
  } catch (e) {
    if (e instanceof ZodError) {
      const err = fromZodError(e)
      logError(route, { cohortKey: req.params.cohortKey }, err)
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }
    throw e
  }

  try {
    const parsed = createSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      const err = fromZodError(parsed.error)
      logError(route, { cohortKey }, err)
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }

    const result = await createSession(cohortKey, parsed.data)
    res.json({ sessionId: result.sessionId, expiresAt: result.expiresAt })
  } catch (e) {
    const err = isAppError(e) ? e : toAppError(e)
    logError(route, { cohortKey }, err)
    res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    })
  }
}
