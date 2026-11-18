import { randomUUID } from 'node:crypto'
import { ConductorError } from '../lib/errors.mjs'
import { downloadDirect } from '../lib/http.mjs'

function now() {
  return Date.now()
}

function makeTask({ nativeId, url, saveDir, filename, bytes = 0, status, path = '', error = '' }) {
  return {
    taskId: nativeId,
    type: 'direct',
    name: filename || url,
    status,
    progress: status === 'completed' ? 100 : 0,
    bytesDone: bytes,
    bytesTotal: status === 'completed' ? bytes : null,
    speedBps: 0,
    etaSec: null,
    saveDir,
    finalPath: path,
    error,
    errorCode: error ? 'E_IO' : '',
    createdAt: now(),
    finishedAt: status === 'completed' || status === 'error' ? now() : null,
    infoHash: '',
  }
}

/**
 * Direct HTTP(S) engine. The transfer is synchronous inside submit(); the
 * registry keeps the resulting task so status/list still work. It is the
 * fallback when Motrix is unavailable or the user explicitly chooses it.
 */
export function createDirectEngine({ cfg, netPolicy }) {
  const tasks = new Map()

  return {
    id: 'direct',
    label: '直连 HTTP(S)',
    capabilities: { pause: false, resume: false, purge: false, list: true, multipleFiles: false, resumeFromBreak: false },
    accepts(target) {
      return target.kind === 'url'
    },
    async probe() {
      return { available: true, detail: '内置直连下载器' }
    },
    async submit({ target, saveDir, filename, headers, proxy, signal, onProgress }) {
      if (target.kind !== 'url') {
        throw new ConductorError('E_ENGINE_REJECTED', `直连不接受 ${target.kind}`)
      }
      const nativeId = randomUUID()
      try {
        const result = await downloadDirect({
          url: target.url,
          saveDir,
          filename,
          headers,
          proxy,
          maxBytes: cfg.maxBytes,
          netPolicy,
          timeoutMs: cfg.requestTimeoutMs,
          signal,
          onProgress,
          allowExecutable: cfg.allowExecutable,
        })
        const task = makeTask({
          nativeId,
          url: target.url,
          saveDir,
          filename: result.filename,
          bytes: result.bytes,
          status: 'completed',
          path: result.path,
        })
        tasks.set(nativeId, task)
        return { nativeId, task }
      } catch (error) {
        const task = makeTask({
          nativeId,
          url: target.url,
          saveDir,
          filename: filename || '',
          status: 'error',
          error: error.message,
        })
        tasks.set(nativeId, task)
        throw error
      }
    },
    async status(nativeId) {
      return tasks.get(nativeId) || null
    },
    async list({ limit = 10 } = {}) {
      const rows = [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
      return { tasks: rows, total: tasks.size }
    },
    async stats() {
      return { downloadSpeed: 0, uploadSpeed: 0, activeTasks: 0, waitingTasks: 0, stoppedTasks: tasks.size }
    },
    async control() {
      throw new ConductorError('E_UNSUPPORTED', '直连任务不支持暂停/恢复/删除；文件已落盘，请直接管理文件')
    },
    async waitFor(nativeId) {
      const task = tasks.get(nativeId) || null
      return { task, timedOut: false }
    },
  }
}
