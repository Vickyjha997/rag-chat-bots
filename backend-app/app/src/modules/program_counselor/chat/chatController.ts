import type { Request, Response } from "express"
import { ZodError } from "zod"
import { cohortKeySchema } from "../../common/schemas"
import { sendMessageSchema } from "../../common/mongoSessionSchema"
import { sendMessage } from "./chatHandler"
import {
  isAppError,
  fromZodError,
  toAppError,
} from "../../logger/errors"
import { logError } from "../../logger/errorlog"

const route = "POST /api/chat/cohort/:cohortKey"

export async function sendMessageController(req: Request, res: Response) {
  let cohortKey: string
  try {
    cohortKey = cohortKeySchema.parse(req.params.cohortKey)
  } catch (e) {
    if (e instanceof ZodError) {
      const err = fromZodError(e)
      logError(route, { cohortKey: req.params.cohortKey }, err)
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }
    throw e
  }

  const parsed = sendMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    const err = fromZodError(parsed.error)
    logError(route, { cohortKey }, err)
    res.status(err.status).json({ error: err.message, code: err.code })
    return
  }

  const { sessionId, question } = parsed.data

  try {
    const result = await sendMessage(cohortKey, sessionId, question)
    res.json(result)
  } catch (e) {
    const err = isAppError(e) ? e : toAppError(e)
    logError(route, { cohortKey, sessionId }, err)
    res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    })
  }
}
