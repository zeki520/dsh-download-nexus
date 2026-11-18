import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConductorError } from '../lib/errors.mjs'
import {
  createStagingDir,
  measureTree,
  moveTreeNoOverwrite,
  removeTreeNoFollow,
  scanTree,
} from '../lib/staging.mjs'
import { runProc } from './proc.mjs'
import { createStagingBudget } from '../lib/staging-budget.mjs'

const REPO_TYPES = new Set(['model', 'dataset', 'space'])
const REPO_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/
const REVISION = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
const INCLUDE = /^[A-Za-z0-9*?_.\-/[\]\s]+$/

function assertRepo(repo) {
  if (!REPO_ID.test(String(repo || ''))) {
    throw new ConductorError('E_TARGET', `Hugging Face 仓库 ID 不合法：${repo}（应为 owner/name）`)
  }
}

function assertRevision(revision) {
  const value = String(revision || 'main')
  if (value.length > 200 || value.includes('..') || value.includes('//') || !REVISION.test(value)) {
    throw new ConductorError('E_TARGET', `revision 不合法：${revision}`)
  }
  return value
}

function assertInclude(include) {
  const rows = Array.isArray(include) ? include : include ? [include] : []
  const out = []
  for (const raw of rows) {
    const value = String(raw).trim()
    if (!value) continue
    if (value.length > 200 || value.includes('..') || value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value) || !INCLUDE.test(value)) {
      throw new ConductorError('E_UNSUPPORTED', `include 模式不合法：${raw}`)
    }
    out.push(value)
  }
  return out
}

export function createHfEngine({ cfg, env = process.env, runProcImpl = runProc }) {
  const tasks = new Map()

  async function probe() {
    try {
      if (path.isAbsolute(cfg.hfPath)) await fs.access(cfg.hfPath)
      else await runProcImpl({ command: cfg.hfPath, args: ['--help'], timeoutMs: 6000 })
      return { available: true, detail: `hf CLI 可用（mirror ${cfg.useHfMirror ? 'on' : 'off'}）` }
    } catch (error) {
      const detail = error.message
      let reason = 'unknown'
      if (error.code === 'ENOENT' || /not found|is not recognized|找不到|命令不存在/i.test(detail)) reason = 'cli-missing'
      else if (/超时|timeout/i.test(detail)) reason = 'timeout'
      return { available: false, detail, reason }
    }
  }

  return {
    id: 'hf',
    label: 'Hugging Face',
    capabilities: { pause: false, resume: true, purge: false, list: true, multipleFiles: true, resumeFromBreak: true },
    accepts(target) {
      return target.kind === 'hf'
    },
    probe,
    async submit({ target, saveDir, repo, repoType = 'model', revision = 'main', include, signal, onProgress }) {
      const id = repo || target.repo
      assertRepo(id)
      const type = String(repoType || 'model').toLowerCase()
      if (!REPO_TYPES.has(type)) throw new ConductorError('E_UNSUPPORTED', `repo_type 只能是 model/dataset/space`)
      const rev = assertRevision(revision)
      const patterns = assertInclude(include)
      const finalDir = path.join(saveDir, id.replace('/', '--'))
      const staging = createStagingDir(saveDir, 'hf')
      const args = ['download', id, '--type', type, '--revision', rev, '--local-dir', staging, '--max-workers', '4']
      for (const pattern of patterns) args.push('--include', pattern)
      const childEnv = { ...env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
      for (const key of ['NO_PROXY', 'no_proxy']) {
        if (typeof childEnv[key] === 'string') {
          // httpx2 (bundled with hf) mis-parses the bracketed form [::1] in NO_PROXY.
          childEnv[key] = childEnv[key].replace(/\[([^\]]+)\]/g, '$1')
        }
      }
      if (cfg.useHfMirror) {
        childEnv.HF_ENDPOINT = cfg.hfMirror
        // A third-party mirror must never receive the user's HF credentials.
        delete childEnv.HF_TOKEN
        delete childEnv.HF_HUB_TOKEN
        delete childEnv.HUGGINGFACE_HUB_TOKEN
      }
      const nativeId = randomUUID()
      let measured = { bytes: 0 }
      const limitController = new AbortController()
      const onOuterAbort = () => limitController.abort()
      if (signal) {
        if (signal.aborted) limitController.abort()
        else if (typeof signal.addEventListener === 'function') signal.addEventListener('abort', onOuterAbort, { once: true })
      }
      let limitError = null
      const budget = createStagingBudget({
        staging,
        maxBytes: cfg.maxBytes,
        pollMs: 1000,
        onExceed: (error) => {
          limitError = error
          limitController.abort()
        },
      })
      budget.start()
      try {
        await runProcImpl({
          command: cfg.hfPath,
          args,
          env: childEnv,
          signal: limitController.signal,
          timeoutMs: Math.max(60_000, cfg.maxWaitSeconds * 1000),
          onStderrLine(line) {
            if (typeof onProgress === 'function') onProgress({ progress: 0, line })
          },
        })
        if (!cfg.allowExecutable) {
          const { violations } = scanTree(staging)
          if (violations.length > 0) {
            removeTreeNoFollow(staging)
            throw new ConductorError(
              'E_EXEC_EXT',
              `HF 下载包含 ${violations.length} 个 Windows 可执行文件，已删除暂存目录`,
              { info: { violations: violations.slice(0, 10) } },
            )
          }
        }
        const stat = await fs.stat(staging).catch(() => null)
        if (!stat || !stat.isDirectory()) {
          throw new ConductorError('E_ENGINE_REJECTED', 'hf 下载结束但没有找到目标目录')
        }
        measured = measureTree(staging)
        if (Number.isFinite(cfg.maxBytes) && cfg.maxBytes > 0 && measured.bytes > cfg.maxBytes) {
          removeTreeNoFollow(staging)
          throw new ConductorError('E_IO', `HF 产物 ${measured.bytes} 字节超过上限 ${cfg.maxBytes} 字节`, {
            info: { kind: 'limit', bytes: measured.bytes, max_bytes: cfg.maxBytes },
          })
        }
        await fs.mkdir(finalDir, { recursive: true })
        moveTreeNoOverwrite(staging, finalDir)
        removeTreeNoFollow(staging)
        const task = {
          taskId: nativeId,
          type: 'hf',
          name: id,
          status: 'completed',
          progress: 100,
          bytesDone: measured.bytes,
          bytesTotal: measured.bytes,
          speedBps: 0,
          etaSec: null,
          saveDir: finalDir,
          finalPath: finalDir,
          files: [finalDir],
          error: '',
          errorCode: '',
          createdAt: Date.now(),
          finishedAt: Date.now(),
          infoHash: '',
        }
        tasks.set(nativeId, task)
        return { nativeId, task }
      } catch (error) {
        try {
          removeTreeNoFollow(staging)
        } catch {
          // Best effort: a failed cleanup must not mask the download error.
        }
        const effective = limitError || error
        const task = {
          taskId: nativeId,
          type: 'hf',
          name: id,
          status: 'error',
          progress: 0,
          bytesDone: measured.bytes,
          bytesTotal: measured.bytes,
          speedBps: 0,
          etaSec: null,
          saveDir: finalDir,
          finalPath: '',
          files: [],
          error: effective.message,
          errorCode: effective.code || 'E_ENGINE_REJECTED',
          createdAt: Date.now(),
          finishedAt: Date.now(),
          infoHash: '',
        }
        tasks.set(nativeId, task)
        throw effective
      } finally {
        budget.stop()
        if (signal && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onOuterAbort)
        }
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
      throw new ConductorError('E_UNSUPPORTED', 'hf 任务不支持暂停/恢复/删除')
    },
    async waitFor(nativeId) {
      return { task: tasks.get(nativeId) || null, timedOut: false }
    },
  }
}
