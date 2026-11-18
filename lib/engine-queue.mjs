import { ConductorError } from './errors.mjs'
import { ENGINE_LIMITS } from './limits.mjs'

function busyError(engineId, state, message) {
  return new ConductorError('E_ENGINE_BUSY', message || `${engineId} 并发已满`, {
    hint: '稍后重试，或等待当前任务完成；不要通过换 save_dir/URL 绕过并发限制。',
    info: {
      engine: engineId,
      active: state.active,
      limit: state.limit,
      queued: state.waiters.length,
      queue_limit: state.queue,
    },
  })
}

/**
 * Per-engine FIFO concurrency gate. A released slot is handed directly to the
 * oldest waiter, so `active` never briefly drops below the limit; that keeps
 * the invariant easy to test.
 */
export function createEngineQueue({ limits = ENGINE_LIMITS } = {}) {
  const states = new Map()
  let closed = false

  function stateFor(engineId) {
    const cfg = limits[engineId]
    if (!cfg) throw new ConductorError('E_ENGINE_UNAVAILABLE', `没有并发配置：${engineId}`)
    let state = states.get(engineId)
    if (!state) {
      state = {
        active: 0,
        limit: cfg.concurrency,
        queue: cfg.queue,
        waitMs: cfg.waitMs,
        waiters: [],
      }
      states.set(engineId, state)
    }
    return state
  }

  function makeLease(engineId, state) {
    let released = false
    return {
      engineId,
      get released() {
        return released
      },
      release() {
        if (released) return
        released = true
        releaseSlot(state)
      },
    }
  }

  function releaseSlot(state) {
    if (closed) return
    const waiter = state.waiters.shift()
    if (waiter) {
      if (waiter.timer) clearTimeout(waiter.timer)
      waiter.cleanup?.()
      // Hand the slot directly to the waiter: active stays at the limit.
      waiter.resolve(makeLease(waiter.engineId, state))
      return
    }
    state.active = Math.max(0, state.active - 1)
  }

  function removeWaiter(state, waiter) {
    const index = state.waiters.indexOf(waiter)
    if (index >= 0) state.waiters.splice(index, 1)
  }

  async function acquire(engineId, { signal, timeoutMs } = {}) {
    if (closed) throw new ConductorError('E_CANCELLED', '下载队列已关闭')
    const state = stateFor(engineId)
    if (signal?.aborted) throw new ConductorError('E_CANCELLED', '下载已取消')

    if (state.active < state.limit) {
      state.active += 1
      return makeLease(engineId, state)
    }

    const waitMs = timeoutMs === undefined ? state.waitMs : Math.max(0, Number(timeoutMs) || 0)
    if (waitMs === 0) throw busyError(engineId, state)
    if (state.waiters.length >= state.queue) {
      throw busyError(engineId, state, `${engineId} 等待队列已满`)
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        engineId,
        resolve,
        reject,
        timer: null,
        cleanup: null,
      }

      const onAbort = () => {
        removeWaiter(state, waiter)
        if (waiter.timer) clearTimeout(waiter.timer)
        waiter.cleanup?.()
        reject(new ConductorError('E_CANCELLED', '排队等待已取消'))
      }
      waiter.cleanup = () => signal?.removeEventListener?.('abort', onAbort)
      signal?.addEventListener?.('abort', onAbort, { once: true })

      waiter.timer = setTimeout(() => {
        removeWaiter(state, waiter)
        waiter.cleanup?.()
        reject(busyError(engineId, state, `${engineId} 排队等待超时`))
      }, waitMs)
      waiter.timer?.unref?.()

      state.waiters.push(waiter)
    })
  }

  function stats() {
    return Object.fromEntries(
      [...states.entries()].map(([id, state]) => [
        id,
        { active: state.active, limit: state.limit, queued: state.waiters.length, queue: state.queue },
      ]),
    )
  }

  function dispose() {
    closed = true
    for (const state of states.values()) {
      for (const waiter of state.waiters.splice(0)) {
        if (waiter.timer) clearTimeout(waiter.timer)
        waiter.cleanup?.()
        waiter.reject(new ConductorError('E_CANCELLED', '插件已卸载，排队任务已取消'))
      }
      state.active = 0
    }
  }

  return { acquire, stats, dispose }
}
