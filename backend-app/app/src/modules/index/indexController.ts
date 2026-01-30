import type { Request, Response } from "express"
import { ZodError } from "zod"
import { cohortKeySchema } from "./schemas"
import { updateVectorDB, deleteVectorDB } from "./indexHandler"
import {
  isAppError,
  fromZodError,
  toAppError,
} from "../logger/errors"
import { logError } from "../logger/errorlog"

const parseCohortKey = (raw: unknown) => cohortKeySchema.parse(raw)

export async function updateVectorDBController(req: Request, res: Response) {
  const route = "POST /api/updateVectorDB/:cohortKey"
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
    const result = await updateVectorDB(cohortKey)
    res.json({ ok: true, ...result })
  } catch (e) {
    const err = isAppError(e) ? e : toAppError(e)
    logError(route, { cohortKey }, err)
    res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    })
  }
}

export async function deleteVectorDBController(req: Request, res: Response) {
  const route = "DELETE /api/deleteVectorDB/:cohortKey"
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
    const result = await deleteVectorDB(cohortKey)
    res.json({ ok: true, ...result })
  } catch (e) {
    const err = isAppError(e) ? e : toAppError(e)
    logError(route, { cohortKey }, err)
    res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    })
  }
}
