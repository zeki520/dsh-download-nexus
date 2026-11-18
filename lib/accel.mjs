import net from 'node:net'
import { proxyFromEnv } from './net-policy.mjs'

const CACHE_MS = 30_000
let cache = { at: 0, value: null }

function canConnect(port, timeoutMs = 900) {
  return new Promise((resolve) => {
    let settled = false
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/**
 * Read-only acceleration probe: environment proxy first, then the two local
 * mixed ports. It never starts FlClash or dev-sidecar and never writes config.
 */
export async function detectAccel({ cfg, env = process.env, force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value

  const envProxy = proxyFromEnv(env)
  if (envProxy) {
    cache = {
      at: Date.now(),
      value: { proxy: envProxy.url, source: 'env', detail: `环境代理 ${envProxy.url}` },
    }
    return cache.value
  }

  for (const port of cfg.proxyCandidates || []) {
    if (!Number.isInteger(port) || port <= 0 || port >= 65536) continue
    if (await canConnect(port)) {
      cache = {
        at: Date.now(),
        value: { proxy: `http://127.0.0.1:${port}`, source: 'port', detail: `本机代理 127.0.0.1:${port}` },
      }
      return cache.value
    }
  }

  cache = { at: Date.now(), value: { proxy: null, source: 'none', detail: '未发现可用本地代理' } }
  return cache.value
}

export function clearAccelCache() {
  cache = { at: 0, value: null }
}
