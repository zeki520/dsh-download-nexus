import fs from 'node:fs/promises'
import path from 'node:path'
import { ConductorError } from '../lib/errors.mjs'
import { assertSafeFilename } from '../lib/paths.mjs'

const PROBE_TIMEOUT_MS = 1500
const RPC_TIMEOUT_MS = 15_000
const ENDPOINT_ENV = 'DSH_MOTRIX_ENDPOINT'

function endpointPath(env = process.env) {
  if (env[ENDPOINT_ENV]) return env[ENDPOINT_ENV]
  const appData = env.APPDATA
  if (!appData) return null
  return path.join(appData, 'Motrix', 'bridge', 'endpoint.json')
}

async function readEndpoint(env = process.env) {
  const file = endpointPath(env)
  if (!file) return null
  let raw
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    return null
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const port = Number(parsed?.port)
  const token = typeof parsed?.localToken === 'string' ? parsed.localToken : ''
  if (!Number.isInteger(port) || port <= 0 || port >= 65536 || !token) return null
  return { port, token, file }
}

function signalFor(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(Math.max(1, timeoutMs))
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function toHeaderList(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return undefined
  const list = []
  for (const [name, value] of Object.entries(headers)) {
    if (!name || value === undefined || value === null || value === '') continue
    const headerName = String(name)
    const headerValue = typeof value === 'string' ? value : String(value)
    if (/[\r\n]/.test(headerName) || /[\r\n]/.test(headerValue)) {
      throw new ConductorError('E_TARGET', '请求头包含换行，已拒绝')
    }
    list.push({ name: headerName, value: headerValue })
  }
  return list.length ? list : undefined
}

function probeReason(error) {
  const message = String(error?.message || '')
  if (/endpoint\.json|找不到 bridge|桥未运行/i.test(message)) return 'bridge-missing'
  if (/ECONNREFUSED|actively refused|拒绝/i.test(message)) return 'connect-refused'
  if (/超时|timeout/i.test(message)) return 'timeout'
  if (/非 JSON|HTTP|不支持该方法/i.test(message)) return 'protocol'
  return 'unknown'
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function projectTask(raw) {
  const task = raw && typeof raw === 'object' ? raw : {}
  const total = numberOrNull(task.bytesTotal)
  const done = numberOrNull(task.bytesDone) ?? 0
  return {
    taskId: String(task.id || task.taskId || ''),
    type: String(task.type || ''),
    name: String(task.name || ''),
    status: String(task.status || 'queued'),
    progress: total && total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 1000) / 10)) : Number(task.progress) || 0,
    bytesDone: done,
    bytesTotal: total,
    speedBps: numberOrNull(task.speedBps) ?? 0,
    etaSec: numberOrNull(task.etaSec),
    saveDir: String(task.saveDir || ''),
    finalPath: typeof task.finalPath === 'string' ? task.finalPath : '',
    error: typeof task.error === 'string' && task.error ? task.error : '',
    errorCode: task.errorCode ? String(task.errorCode) : '',
    createdAt: numberOrNull(task.createdAt) ?? 0,
    finishedAt: numberOrNull(task.finishedAt),
    infoHash: typeof task.infoHash === 'string' ? task.infoHash : '',
  }
}

export function createMotrixEngine({ cfg, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  let endpoint = null
  let nextId = 1

  async function ensureEndpoint({ refresh = false } = {}) {
    if (!endpoint || refresh) endpoint = await readEndpoint(env)
    return endpoint
  }

  async function rpc(method, params = {}, { timeoutMs = RPC_TIMEOUT_MS, signal, retryAuth = true } = {}) {
    const current = await ensureEndpoint()
    if (!current) {
      throw new ConductorError('E_ENGINE_UNAVAILABLE', 'Motrix 桥未运行（找不到 bridge/endpoint.json）', {
        hint: '请先打开 Motrix 2.x，并确认“设置 → 浏览器桥接”已开启。',
      })
    }
    const body = JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params })
    let response
    try {
      response = await fetchImpl(`http://127.0.0.1:${current.port}/mdxp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${current.token}`,
        },
        body,
        signal: signalFor(signal, timeoutMs),
      })
    } catch (error) {
      throw new ConductorError('E_ENGINE_UNAVAILABLE', `连不上 Motrix 桥：${error.message}`, { cause: error })
    }

    if (response.status === 401 && retryAuth) {
      endpoint = null
      return rpc(method, params, { timeoutMs, signal, retryAuth: false })
    }

    let payload
    try {
      payload = await response.json()
    } catch (error) {
      throw new ConductorError('E_ENGINE_UNAVAILABLE', `Motrix 桥返回了非 JSON 响应（HTTP ${response.status}）`, { cause: error })
    }
    if (payload?.error) {
      const message = String(payload.error.message || 'Motrix 桥返回错误')
      if (payload.error.code === -32005) {
        throw new ConductorError('E_ENGINE_UNAVAILABLE', `Motrix 桥不支持该方法：${method}`, { info: payload.error })
      }
      throw new ConductorError('E_ENGINE_REJECTED', message, { info: payload.error })
    }
    if (!response.ok) {
      throw new ConductorError('E_ENGINE_UNAVAILABLE', `Motrix 桥 HTTP ${response.status}`, {
        info: { status: response.status },
      })
    }
    return payload.result
  }

  return {
    id: 'motrix',
    label: 'Motrix / aria2',
    capabilities: { pause: true, resume: true, purge: true, list: true, multipleFiles: true, resumeFromBreak: true },
    accepts(target) {
      return target.kind === 'url' || target.kind === 'magnet' || target.kind === 'torrent'
    },
    async probe() {
      try {
        const stats = await rpc('stats/get', {}, { timeoutMs: PROBE_TIMEOUT_MS })
        return { available: true, detail: `aria2 在线（活跃 ${Number(stats?.activeTasks) || 0}）` }
      } catch (error) {
        return { available: false, detail: error.message, reason: probeReason(error) }
      }
    },
    async info() {
      const current = await ensureEndpoint()
      if (!current) return { endpointFile: endpointPath(env), connected: false }
      return { endpointFile: current.file, port: current.port, connected: true }
    },
    async submit({ target, saveDir, filename, headers, proxy, connections, torrentBase64, idempotencyKey }) {
      const params = { saveDir }
      if (target.kind === 'url') {
        params.kind = 'url'
        params.uris = [target.url]
        if (filename) params.filename = filename
        const list = toHeaderList(headers)
        if (list) params.headers = list
      } else if (target.kind === 'magnet') {
        params.kind = 'magnet'
        params.uri = target.url
      } else if (target.kind === 'torrent') {
        params.kind = 'torrent'
        params.base64 = torrentBase64
        if (filename) params.displayName = assertSafeFilename(filename, { allowExecutable: true })
      } else {
        throw new ConductorError('E_ENGINE_REJECTED', `Motrix 不接受 ${target.kind}`)
      }
      if (proxy) params.proxy = proxy
      if (Number.isInteger(connections) && connections > 0 && connections <= 16) params.connections = connections
      if (idempotencyKey) params.idempotencyKey = idempotencyKey
      const raw = await rpc('download/add', params)
      const task = projectTask(raw)
      if (!task.taskId) throw new ConductorError('E_ENGINE_REJECTED', 'Motrix 没有返回任务 ID')
      return { nativeId: task.taskId, task }
    },
    async status(nativeId) {
      const result = await rpc('task/get', { taskId: nativeId })
      return result?.task ? projectTask(result.task) : null
    },
    async list({ limit = 10, status } = {}) {
      const params = { limit }
      if (status) params.status = status
      const result = await rpc('task/list', params)
      const tasks = Array.isArray(result?.tasks) ? result.tasks.map(projectTask) : []
      return { tasks, total: Number(result?.total) || tasks.length }
    },
    async stats() {
      const stats = await rpc('stats/get', {}, { timeoutMs: PROBE_TIMEOUT_MS })
      return {
        downloadSpeed: Number(stats?.totalDownloadSpeed) || 0,
        uploadSpeed: Number(stats?.totalUploadSpeed) || 0,
        activeTasks: Number(stats?.activeTasks) || 0,
        waitingTasks: Number(stats?.waitingTasks) || 0,
        stoppedTasks: Number(stats?.stoppedTasks) || 0,
      }
    },
    async control(nativeId, action, { deleteFiles = false } = {}) {
      if (action === 'pause') return rpc('task/pause', { taskId: nativeId })
      if (action === 'resume') return rpc('task/resume', { taskId: nativeId })
      if (action === 'cancel' || action === 'purge') {
        return rpc('task/remove', { taskId: nativeId, deleteFiles: action === 'purge' || deleteFiles === true })
      }
      throw new ConductorError('E_UNSUPPORTED', `Motrix 不支持控制动作 ${action}`)
    },
    async waitForPaused(nativeId, { timeoutMs = 5_000, pollMs = 250, signal } = {}) {
      const deadline = Date.now() + Math.max(0, timeoutMs)
      for (;;) {
        const task = await this.status(nativeId)
        if (!task) throw new ConductorError('E_ENGINE_REJECTED', '暂停确认失败：任务不存在', { info: { taskId: nativeId } })
        if (['paused', 'stopped', 'cancelled', 'completed', 'error', 'failed'].includes(task.status)) return task
        if (Date.now() >= deadline) {
          throw new ConductorError('E_ENGINE_REJECTED', '暂停确认超时：任务仍在运行', {
            info: { taskId: nativeId, status: task.status },
          })
        }
        await sleep(pollMs, signal)
      }
    },
    async waitFor(nativeId, { waitSeconds = 0, pollMs = 500, signal, maxBytes } = {}) {
      const deadline = Date.now() + Math.max(0, waitSeconds) * 1000
      for (;;) {
        const task = await this.status(nativeId)
        if (!task) return { task: null, timedOut: false }
        if (Number.isFinite(maxBytes) && maxBytes > 0 && Number(task.bytesDone) > maxBytes) {
          let cleanup = 'ok'
          try {
            await this.control(nativeId, 'purge', { deleteFiles: true })
          } catch {
            cleanup = 'failed'
          }
          throw new ConductorError('E_IO', `Motrix 任务 ${task.bytesDone} 字节超过上限 ${maxBytes} 字节`, {
            info: { kind: 'limit', bytes: task.bytesDone, max_bytes: maxBytes, cleanup },
          })
        }
        if (['completed', 'error', 'paused', 'cancelled', 'stopped'].includes(task.status)) {
          return { task, timedOut: false }
        }
        const remaining = deadline - Date.now()
        if (remaining <= 0) return { task, timedOut: waitSeconds > 0 }
        await sleep(Math.min(pollMs, remaining), signal)
      }
    },
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ConductorError('E_CANCELLED', '等待已取消'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new ConductorError('E_CANCELLED', '等待已取消'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
