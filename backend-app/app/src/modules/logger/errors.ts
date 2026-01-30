/** HTTP-aware error (plain object). Controller maps to status + JSON body. */
export type AppError = {
  readonly __brand: "AppError"
  message: string
  status: number
  code?: string
  cause?: unknown
}

const mk = (
  message: string,
  status: number,
  code?: string,
  cause?: unknown
): AppError =>
  Object.freeze({
    __brand: "AppError" as const,
    message,
    status,
    ...(code && { code }),
    ...(cause !== undefined && { cause }),
  })

export const validationError = (message: string): AppError =>
  mk(message, 400, "VALIDATION_ERROR")

export const notFoundError = (message: string): AppError =>
  mk(message, 404, "NOT_FOUND")

export const xiteApiError = (message: string, status = 502): AppError =>
  mk(message, status, "XITE_API_ERROR")

export const internalError = (message: string, cause?: unknown): AppError =>
  mk(message, 500, "INTERNAL_ERROR", cause)

export const isAppError = (e: unknown): e is AppError =>
  typeof e === "object" &&
  e !== null &&
  "__brand" in e &&
  (e as AppError).__brand === "AppError"

export const toAppError = (e: unknown): AppError =>
  isAppError(e) ? e : internalError(
    e instanceof Error ? e.message : "Internal server error",
    e
  )

export const fromZodError = (zodError: {
  issues: Array<{ message?: string }>
}): AppError =>
  validationError(zodError.issues[0]?.message ?? "Validation failed")
