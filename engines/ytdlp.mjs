import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConductorError } from '../lib/errors.mjs'
import { assertInside, assertSafeFilename } from '../lib/paths.mjs'
import {
  createStagingDir,
  measureTree,
  moveFileNoOverwrite,
  removeTreeNoFollow,
} from '../lib/staging.mjs'
import { runProc } from './proc.mjs'
import { createStagingBudget } from '../lib/staging-budget.mjs'

const QUALITY = {
  best: 'bv*+ba/b',
  '1080': 'bv*[height<=1080]+ba/b[height<=1080]',
  '720': 'bv*[height<=720]+ba/b[height<=720]',
  '480': 'bv*[height<=480]+ba/b[height<=480]',
  '360': 'bv*[height<=360]+ba/b[height<=360]',
  audio: 'ba/b',
}

const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'brave', 'chromium', 'opera', 'vivaldi', 'safari'])

function parseSize(value, unit) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const mult = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4 }
  return n * (mult[String(unit || 'B').toUpperCase()] || 1)
}

export function parseYtdlpProgress(line) {
  const text = String(line || '')
  const m = text.match(/(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+)\s*([KMGT]?i?B)(?:\s+at\s+([\d.]+)\s*([KMGT]?i?B)\/s)?/i)
  if (!m) return null
  const total = parseSize(m[2], m[3])
  const pct = Number(m[1])
  return {
    progress: Math.max(0, Math.min(100, pct)),
    bytesTotal: total,
    bytesDone: total ? Math.round((pct / 100) * total) : null,
    speedBps: m[4] ? parseSize(m[4], m[5]) : 0,
  }
}

function buildArgs({ target, saveDir, quality, format, subtitles, playlist, cookiesFromBrowser, proxy, filename, maxBytes }) {
  const args = [
    '--newline',
    '--no-warnings',
    '--progress',
    '--no-overwrites',
    '--windows-filenames',
    '--trim-filenames',
    '180',
    '--print',
    'after_move:filepath',
    '--paths',
    saveDir,
  ]
  if (playlist === true) {
    // keep the playlist
  } else {
    args.push('--no-playlist')
  }
  if (filename) {
    args.push('--output', filename)
  } else {
    args.push('--output', '%(title)s.%(ext)s')
  }
  const selector = format || QUALITY[quality || 'best'] || QUALITY.best
  args.push('--format', selector)
  if (subtitles) args.push('--write-subs', '--sub-langs', 'zh.*,en.*')
  if (cookiesFromBrowser) {
    const browser = String(cookiesFromBrowser).toLowerCase()
    if (!BROWSERS.has(browser)) throw new ConductorError('E_UNSUPPORTED', `不支持的浏览器：${cookiesFromBrowser}`)
    args.push('--cookies-from-browser', browser)
  }
  if (proxy) args.push('--proxy', proxy)
  if (Number.isFinite(maxBytes) && maxBytes > 0) args.push('--max-filesize', String(maxBytes))
  args.push(target.url)
  return args
}

export function createYtdlpEngine({ cfg, runProcImpl = runProc }) {
  const tasks = new Map()
  let probedAt = 0
  let probeResult = null

  async function probe() {
    if (probeResult && Date.now() - probedAt < 60_000) return probeResult
    probedAt = Date.now()
    try {
      if (path.isAbsolute(cfg.ytdlpPath)) {
        await fs.access(cfg.ytdlpPath)
        probeResult = { available: true, detail: cfg.ytdlpPath }
      } else {
        const out = await runProcImpl({ command: cfg.ytdlpPath, args: ['--version'], timeoutMs: 6000 })
        probeResult = { available: true, detail: `yt-dlp ${out.stdout.trim().slice(0, 40)}` }
      }
    } catch (error) {
      const detail = error.message
      let reason = 'unknown'
      if (error.code === 'ENOENT' || /not found|is not recognized|找不到|命令不存在/i.test(detail)) reason = 'cli-missing'
      else if (/超时|timeout/i.test(detail)) reason = 'timeout'
      probeResult = { available: false, detail, reason }
    }
    return probeResult
  }

  return {
    id: 'ytdlp',
    label: 'yt-dlp',
    capabilities: { pause: false, resume: true, purge: false, list: true, multipleFiles: true, resumeFromBreak: true },
    accepts(target) {
      return target.kind === 'video'
    },
    probe,
    async submit({ target, saveDir, filename, quality, format, subtitles, playlist, cookiesFromBrowser, proxy, signal, onProgress, maxBytes = cfg.maxBytes }) {
      const available = await probe()
      if (!available.available) {
        throw new ConductorError('E_ENGINE_UNAVAILABLE', `yt-dlp 不可用：${available.detail}`)
      }
      if (cookiesFromBrowser && (!cfg.allowBrowserCookies || target.kind !== 'video')) {
        throw new ConductorError('E_ENGINE_REJECTED', '浏览器 cookies 未启用或目标不是视频站', {
          hint: '需要读取登录态时设 DSH_DOWNLOAD_ALLOW_BROWSER_COOKIES=1，并且只对视频站使用。',
        })
      }
      const nativeId = randomUUID()
      const staging = createStagingDir(saveDir, 'ytdlp')
      const args = buildArgs({
        target,
        saveDir: staging,
        quality,
        format,
        subtitles,
        playlist,
        cookiesFromBrowser,
        proxy,
        filename,
        maxBytes,
      })
      const files = []
      let last = null
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
        maxBytes,
        pollMs: 1000,
        onExceed: (error) => {
          limitError = error
          limitController.abort()
        },
      })
      budget.start()
      const handleLine = (line) => {
        const progress = parseYtdlpProgress(line)
        if (progress) {
          last = progress
          if (typeof onProgress === 'function') onProgress(progress)
        }
      }
      try {
        const result = await runProcImpl({
          command: cfg.ytdlpPath,
          args,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
          signal: limitController.signal,
          timeoutMs: Math.max(60_000, cfg.maxWaitSeconds * 1000),
          onStderrLine: handleLine,
          onStdoutLine: handleLine,
        })
        measured = measureTree(staging)
        if (Number.isFinite(maxBytes) && maxBytes > 0 && measured.bytes > maxBytes) {
          removeTreeNoFollow(staging)
          throw new ConductorError('E_IO', `yt-dlp 产物 ${measured.bytes} 字节超过上限 ${maxBytes} 字节`, {
            info: { kind: 'limit', bytes: measured.bytes, max_bytes: maxBytes },
          })
        }
        const reported = []
        for (const line of result.stdout.split(/\r?\n/)) {
          const file = line.trim()
          if (file && path.isAbsolute(file)) reported.push(file)
        }
        if (reported.length === 0) {
          throw new ConductorError('E_ENGINE_REJECTED', 'yt-dlp 没有报告输出文件路径')
        }
        for (const file of reported) {
          const real = assertInside(staging, file)
          const stat = await fs.lstat(real)
          if (stat.isSymbolicLink()) {
            throw new ConductorError('E_TARGET', `yt-dlp 产出符号链接，已拒绝：${file}`)
          }
          assertSafeFilename(path.basename(real), { allowExecutable: Boolean(cfg.allowExecutable) })
          files.push(moveFileNoOverwrite(real, saveDir))
        }
        removeTreeNoFollow(staging)
        const finalPath = files[files.length - 1]
        const task = {
          taskId: nativeId,
          type: 'ytdlp',
          name: path.basename(finalPath),
          status: 'completed',
          progress: 100,
          bytesDone: measured.bytes,
          bytesTotal: measured.bytes,
          speedBps: last?.speedBps || 0,
          etaSec: null,
          saveDir,
          finalPath,
          files,
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
          type: 'ytdlp',
          name: target.url,
          status: 'error',
          progress: last?.progress || 0,
          bytesDone: measured.bytes,
          bytesTotal: measured.bytes,
          speedBps: 0,
          etaSec: null,
          saveDir,
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
      throw new ConductorError('E_UNSUPPORTED', 'yt-dlp 任务不支持暂停/恢复/删除')
    },
    async waitFor(nativeId) {
      return { task: tasks.get(nativeId) || null, timedOut: false }
    },
  }
}
