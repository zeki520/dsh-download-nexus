/**
 * Resource limits approved for 0.2.7. These are intentionally constants, not
 * UI fields: the configuration page has no controls for them yet, and silently
 * exposing them through the form would create a second source of truth.
 */
export const ENGINE_LIMITS = Object.freeze({
  direct: Object.freeze({ concurrency: 4, queue: 8, waitMs: 60_000 }),
  motrix: Object.freeze({ concurrency: 3, queue: 8, waitMs: 60_000 }),
  ytdlp: Object.freeze({ concurrency: 2, queue: 8, waitMs: 60_000 }),
  hf: Object.freeze({ concurrency: 2, queue: 8, waitMs: 60_000 }),
})

export const WATCHDOG_DEFAULTS = Object.freeze({
  pollMs: 500,
  maxLifetimeMs: 7 * 24 * 60 * 60 * 1000,
  maxFailures: 5,
})

export const STAGING_BUDGET_DEFAULTS = Object.freeze({
  pollMs: 1_000,
})
