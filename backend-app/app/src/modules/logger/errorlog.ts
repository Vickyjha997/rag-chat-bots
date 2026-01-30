import pino from "pino"
import { isAppError } from "./errors"

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
})

const toErrorLike = (err: unknown): { message: string; stack?: string } => {
  if (isAppError(err)) return { message: err.message }
  if (err instanceof Error) return { message: err.message, stack: err.stack }
  return { message: String(err) }
}

export const logError = (
  route: string,
  context: Record<string, unknown>,
  err: unknown
) => {
  const errLike = toErrorLike(err)
  log.error({ route, ...context, err: errLike }, errLike.message)
}

export type { AppError } from "./errors"
export {
  validationError,
  notFoundError,
  xiteApiError,
  internalError,
  isAppError,
  toAppError,
  fromZodError,
} from "./errors"
