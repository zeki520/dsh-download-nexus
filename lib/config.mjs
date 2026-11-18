import os from 'node:os'
import path from 'node:path'
import { validateRootPath } from './paths.mjs'

export const DEFAULT_CONFIG = Object.freeze({
  /**
   * Empty means the drop-in names (download / download_status / ...).
   * During development we install with `conductor_` so the old plugin can
   * stay active until the new one has passed its live checks.
   */
  toolPrefix: '',
  defaultSaveDir: path.join(os.homedir(), 'Downloads'),
  allowedRoots: [path.join(os.homedir(), 'Downloads')],
  allowExecutable: false,
  allowShell: false,
  guardFailClosed: true,
  allowBrowserCookies: false,
  connections: 16,
  maxBytes: 20 * 1024 * 1024 * 1024,
  requestTimeoutMs: 60_000,
  pollMs: 500,
  maxWaitSeconds: 3600,
  proxyCandidates: [7890, 31181],
  autoStartMotrix: false,
  motrixStateDir: '',
  ytdlpPath: 'yt-dlp',
  hfPath: 'hf',
  hfMirror: 'https://hf-mirror.com',
  useHfMirror: false,
  githubMirrorBase: 'https://ghfast.top/',
  githubMirrorDefault: false,
  promptOrder: 5900,
  promptName: 'download-nexus',
})

function toPositiveInt(value, fallback) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/[;\n]/)
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

/**
 * Cordis wraps `.volatile()` fields in `{ get }` references. Reading them as
 * plain values silently changes their meaning: `Boolean({ get })` is true, so
 * allowShell would become true and the guard would short-circuit. Unwrap once
 * at the plugin boundary, recursively.
 */
export function unwrapConfig(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => unwrapConfig(item))
  if (typeof value.get === 'function' && !Object.hasOwn(value, 'length')) {
    return unwrapConfig(value.get())
  }
  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = unwrapConfig(item)
    return out
  }
  return value
}

export function loadConfig(raw = {}, { cwd = process.cwd(), env = process.env } = {}) {
  const unwrapped = unwrapConfig(raw)
  const input = unwrapped && typeof unwrapped === 'object' ? unwrapped : {}
  const cfg = { ...DEFAULT_CONFIG, ...input }
  cfg.cwd = path.resolve(cwd)
  cfg.toolPrefix = typeof cfg.toolPrefix === 'string' ? cfg.toolPrefix.trim() : ''
  const fallbackDir = path.join(os.homedir(), 'Downloads')
  const defaultCheck = validateRootPath(cfg.defaultSaveDir || fallbackDir, { cwd: cfg.cwd, mustExist: false })
  cfg.defaultSaveDir = defaultCheck.ok ? defaultCheck.normalized : fallbackDir
  const roots = toStringArray(cfg.allowedRoots)
    .map((root) => validateRootPath(root, { cwd: cfg.cwd, mustExist: false }))
    .filter((result) => result.ok)
    .map((result) => result.normalized)
  cfg.allowedRoots = [...new Set([cfg.defaultSaveDir, ...roots])]
  cfg.allowExecutable = Boolean(cfg.allowExecutable)
  cfg.allowShell = Boolean(cfg.allowShell) || env.DSH_DOWNLOAD_ALLOW_SHELL === '1'
  cfg.guardFailClosed = Boolean(cfg.guardFailClosed)
  cfg.allowBrowserCookies =
    Boolean(cfg.allowBrowserCookies) || env.DSH_DOWNLOAD_ALLOW_BROWSER_COOKIES === '1'
  cfg.connections = toPositiveInt(cfg.connections, DEFAULT_CONFIG.connections)
  cfg.maxBytes = toPositiveInt(cfg.maxBytes, DEFAULT_CONFIG.maxBytes)
  cfg.requestTimeoutMs = toPositiveInt(cfg.requestTimeoutMs, DEFAULT_CONFIG.requestTimeoutMs)
  cfg.pollMs = toPositiveInt(cfg.pollMs, DEFAULT_CONFIG.pollMs)
  cfg.maxWaitSeconds = toPositiveInt(cfg.maxWaitSeconds, DEFAULT_CONFIG.maxWaitSeconds)
  const proxyCandidates = toStringArray(cfg.proxyCandidates)
    .map((p) => Number(p))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
  cfg.proxyCandidates = proxyCandidates.length ? proxyCandidates : [...DEFAULT_CONFIG.proxyCandidates]
  cfg.autoStartMotrix = false // deliberately not configurable in v0.1: no implicit exe launch
  cfg.motrixStateDir = typeof cfg.motrixStateDir === 'string' ? cfg.motrixStateDir.trim() : ''
  cfg.ytdlpPath = String(cfg.ytdlpPath || 'yt-dlp')
  cfg.hfPath = String(cfg.hfPath || 'hf')
  cfg.hfMirror = String(cfg.hfMirror || '')
  cfg.useHfMirror = Boolean(cfg.useHfMirror)
  cfg.githubMirrorBase = String(cfg.githubMirrorBase || DEFAULT_CONFIG.githubMirrorBase).trim()
  cfg.githubMirrorDefault = Boolean(cfg.githubMirrorDefault)
  cfg.promptOrder = toPositiveInt(cfg.promptOrder, DEFAULT_CONFIG.promptOrder)
  cfg.promptName = String(cfg.promptName || DEFAULT_CONFIG.promptName)
  return cfg
}

export function toolName(cfg, base) {
  return `${cfg.toolPrefix || ''}${base}`
}
