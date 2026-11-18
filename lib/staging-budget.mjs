import { ConductorError } from './errors.mjs'
import { STAGING_BUDGET_DEFAULTS } from './limits.mjs'
import { measureTree } from './staging.mjs'

/**
 * Runtime byte budget for engines that download through a staging directory.
 * This is a polling guard, not an OS quota: the engine may overshoot by up to
 * one poll interval before it is killed. The final measureTree() remains the
 * authoritative post-check.
 */
export function createStagingBudget({
  staging,
  maxBytes,
  pollMs = STAGING_BUDGET_DEFAULTS.pollMs,
  measure = measureTree,
  onExceed,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
} = {}) {
  let timer = null
  let stopped = false
  let exceeded = false
  let lastBytes = 0

  function tick() {
    if (stopped || exceeded) return
    let measured
    try {
      measured = measure(staging)
    } catch (error) {
      exceeded = true
      stop()
      onExceed?.(
        new ConductorError('E_IO', `无法测量暂存目录，已中止下载：${error?.message || error}`, {
          info: { kind: 'measure-failed', staging },
          cause: error,
        }),
      )
      return
    }
    lastBytes = Number(measured?.bytes) || 0
    if (Number.isFinite(maxBytes) && maxBytes > 0 && lastBytes > maxBytes) {
      exceeded = true
      stop()
      onExceed?.(
        new ConductorError('E_IO', `暂存目录 ${lastBytes} 字节超过上限 ${maxBytes} 字节`, {
          info: { kind: 'limit', bytes: lastBytes, max_bytes: maxBytes, staging },
        }),
      )
    }
  }

  function start() {
    if (timer || stopped) return
    timer = setIntervalImpl(tick, Math.max(100, pollMs))
    timer?.unref?.()
  }

  function stop() {
    stopped = true
    if (timer) {
      clearIntervalImpl(timer)
      timer = null
    }
  }

  return {
    start,
    stop,
    tickNow: tick,
    get exceeded() {
      return exceeded
    },
    get bytes() {
      return lastBytes
    },
  }
}
