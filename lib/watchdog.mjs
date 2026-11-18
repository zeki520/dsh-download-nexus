import { ConductorError } from './errors.mjs'
import { WATCHDOG_DEFAULTS } from './limits.mjs'

const TERMINAL = new Set(['completed', 'error', 'cancelled', 'stopped', 'paused', 'failed'])

/**
 * Background size watchdog for Motrix tasks. It deliberately uses a
 * self-scheduling timeout (not setInterval): a slow RPC must never overlap the
 * next poll. All timers are unref'ed; dispose() clears every timer and lease.
 */
export function createWatchdog({
  pollMs = WATCHDOG_DEFAULTS.pollMs,
  maxLifetimeMs = WATCHDOG_DEFAULTS.maxLifetimeMs,
  maxFailures = WATCHDOG_DEFAULTS.maxFailures,
  status,
  control,
  update = () => {},
  onLimit = () => {},
  onError = () => {},
  now = () => Date.now(),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const entries = new Map()
  let closed = false

  function schedule(entry, delay = pollMs) {
    if (closed || entry.cancelled || entry.timer) return
    entry.timer = setTimeoutImpl(() => {
      entry.timer = null
      void tick(entry)
    }, Math.max(1, delay))
    entry.timer?.unref?.()
  }

  function finalize(entry, reason, task = null, error = null) {
    if (entry.finalized) return
    entry.finalized = true
    entry.cancelled = true
    if (entry.timer) {
      clearTimeoutImpl(entry.timer)
      entry.timer = null
    }
    entries.delete(entry.ref)
    if (task) update(entry.ref, task)
    if (reason === 'limit') onLimit(entry, task, error)
    else if (reason === 'rpc' || reason === 'lifetime') onError(entry, error, reason)
    try {
      entry.lease?.release?.()
    } catch {
      // A lease release must never turn a watchdog failure into a crash.
    }
  }

  async function tick(entry) {
    if (closed || entry.cancelled || entry.running || entry.finalized) return
    entry.running = true
    try {
      let task
      try {
        task = await status(entry.nativeId)
      } catch (error) {
        if (closed || entry.cancelled) return
        entry.failures += 1
        if (entry.failures >= maxFailures) {
          finalize(
            entry,
            'rpc',
            null,
            new ConductorError('E_ENGINE_UNAVAILABLE', `Motrix watchdog 连续 ${entry.failures} 次查询失败`, {
              info: { failures: entry.failures, last_error: error?.message || String(error) },
              cause: error,
            }),
          )
          return
        }
        schedule(entry, Math.min(pollMs * 2 ** entry.failures, 8_000))
        return
      }

      if (closed || entry.cancelled) return
      entry.failures = 0
      if (!task) {
        finalize(entry, 'gone')
        return
      }
      update(entry.ref, task)

      const statusName = String(task.status || '').toLowerCase()
      if (TERMINAL.has(statusName)) {
        finalize(entry, 'terminal', task)
        return
      }

      if (Number.isFinite(entry.maxBytes) && entry.maxBytes > 0 && Number(task.bytesDone) > entry.maxBytes) {
        let cleanup = 'ok'
        try {
          await control(entry.nativeId, 'purge', { deleteFiles: true })
        } catch {
          cleanup = 'failed'
        }
        const error = new ConductorError(
          'E_IO',
          `Motrix 任务 ${task.bytesDone} 字节超过上限 ${entry.maxBytes} 字节`,
          { info: { kind: 'limit', bytes: task.bytesDone, max_bytes: entry.maxBytes, cleanup } },
        )
        if (closed || entry.cancelled) return
        finalize(entry, 'limit', task, error)
        return
      }

      if (now() - entry.startedAt > maxLifetimeMs) {
        try {
          await control(entry.nativeId, 'pause', { deleteFiles: false })
        } catch {
          // Best effort; the record still records the lifecycle expiry.
        }
        const error = new ConductorError('E_IO', `Motrix 任务超过看门狗生命周期上限 ${maxLifetimeMs}ms，已尝试暂停`, {
          info: { kind: 'lifetime', max_lifetime_ms: maxLifetimeMs },
        })
        if (closed || entry.cancelled) return
        finalize(entry, 'lifetime', task, error)
        return
      }

      schedule(entry)
    } finally {
      entry.running = false
    }
  }

  function track({ ref, nativeId, maxBytes, lease }) {
    if (closed) {
      lease?.release?.()
      return false
    }
    if (entries.has(ref)) {
      // A later status/download call owns the same task; keep the existing
      // timer rather than creating a second monitor for one native id.
      lease?.release?.()
      return false
    }
    const entry = {
      ref,
      nativeId,
      maxBytes,
      lease,
      timer: null,
      running: false,
      cancelled: false,
      finalized: false,
      failures: 0,
      startedAt: now(),
    }
    entries.set(ref, entry)
    schedule(entry)
    return true
  }

  function stop(ref, reason = 'stop') {
    const entry = entries.get(ref)
    if (!entry) return false
    finalize(entry, reason)
    return true
  }

  function has(ref) {
    return entries.has(ref)
  }

  function size() {
    return entries.size
  }

  function closeAll() {
    closed = true
    for (const entry of [...entries.values()]) {
      entry.cancelled = true
      entry.finalized = true
      if (entry.timer) {
        clearTimeoutImpl(entry.timer)
        entry.timer = null
      }
      try {
        entry.lease?.release?.()
      } catch {
        // ignore
      }
    }
    entries.clear()
  }

  /** Test seam: run one poll immediately without waiting for the timer. */
  async function tickNow(ref) {
    const entry = entries.get(ref)
    if (!entry) return false
    if (entry.timer) {
      clearTimeoutImpl(entry.timer)
      entry.timer = null
    }
    await tick(entry)
    return true
  }

  return { track, stop, has, size, closeAll, tickNow }
}
