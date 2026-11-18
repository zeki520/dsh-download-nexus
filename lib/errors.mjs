/**
 * Stable error codes. The model is allowed to branch on `code`, so these
 * strings are part of the tool contract and must not change casually.
 */
export class ConductorError extends Error {
  constructor(code, message, { hint = '', cause, info } = {}) {
    super(message)
    this.name = 'ConductorError'
    this.code = code
    this.hint = hint
    this.cause = cause
    this.info = info
  }
}

export function asConductorError(error) {
  if (error instanceof ConductorError) return error
  const message = error instanceof Error ? error.message : String(error)
  const code = typeof error?.code === 'string' && /^E_[A-Z0-9_]+$/.test(error.code) ? error.code : 'E_IO'
  const hint = typeof error?.hint === 'string' ? error.hint : ''
  return new ConductorError(code, message, { cause: error, hint })
}

export function errorPayload(error) {
  const e = asConductorError(error)
  const payload = {
    ok: false,
    code: e.code,
    message: e.message,
  }
  if (e.hint) payload.hint = e.hint
  if (e.info && typeof e.info === 'object') payload.info = e.info
  return payload
}
