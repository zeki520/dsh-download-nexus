import { requestJson } from './http.mjs'

const API_TYPES = Object.freeze({ model: 'models', dataset: 'datasets', space: 'spaces' })
const MAX_PAGES = 50
const DEFAULT_BASE = 'https://huggingface.co'

function globToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

function normalizePatterns(include) {
  if (include === undefined || include === null) return []
  const rows = Array.isArray(include) ? include : [include]
  return rows.map((row) => String(row || '').trim()).filter(Boolean)
}

function entrySize(entry) {
  const candidates = [entry?.lfs?.size, entry?.size]
  for (const value of candidates) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

function nextLink(headers) {
  const raw = headers?.link
  if (!raw) return ''
  const value = Array.isArray(raw) ? raw.join(',') : String(raw)
  const match = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(value)
  return match ? match[1] : ''
}

/**
 * Best-effort HF repository size probe. Returns `{ok:false}` whenever the
 * metadata is incomplete; the caller must then rely on the runtime staging
 * budget instead of treating the download as unbounded.
 */
export async function probeHfMetadata({
  repo,
  repoType = 'model',
  revision = 'main',
  include,
  cfg,
  env = process.env,
  netPolicy,
  proxy,
  requestJsonImpl = requestJson,
  maxPages = MAX_PAGES,
} = {}) {
  const id = String(repo || '').trim()
  if (!id) return { ok: false, reason: 'missing-repo' }
  const type = String(repoType || 'model').toLowerCase()
  const apiType = API_TYPES[type]
  if (!apiType) return { ok: false, reason: 'bad-repo-type' }

  const base = String((cfg?.useHfMirror ? cfg.hfMirror : DEFAULT_BASE) || DEFAULT_BASE).replace(/\/+$/, '')
  const revisionValue = String(revision || 'main')
  const repoPath = id.split('/').map((part) => encodeURIComponent(part)).join('/')
  const patterns = normalizePatterns(include)
  const matchers = patterns.map(globToRegExp)
  const wants = (entryPath) => matchers.length === 0 || matchers.some((re) => re.test(entryPath))

  const token = !cfg?.useHfMirror && env?.HF_TOKEN ? String(env.HF_TOKEN) : ''
  const headers = {
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }

  let next = `${base}/api/${apiType}/${repoPath}/tree/${encodeURIComponent(revisionValue)}?recursive=true&expand=true&limit=1000`
  let pages = 0
  let count = 0
  let bytes = 0
  let maxFile = 0
  let maxFilePath = ''
  try {
    while (next) {
      pages += 1
      if (pages > maxPages) return { ok: false, reason: 'too-many-pages', pages }
      const { json, headers: responseHeaders } = await requestJsonImpl({
        url: next,
        headers,
        proxy,
        netPolicy,
        timeoutMs: 8_000,
      })
      if (!Array.isArray(json)) return { ok: false, reason: 'bad-response', pages }
      for (const entry of json) {
        if (!entry || entry.type !== 'file') continue
        const entryPath = String(entry.path || '')
        if (!entryPath || !wants(entryPath)) continue
        const size = entrySize(entry)
        if (size === null) return { ok: false, reason: 'incomplete-metadata', pages, path: entryPath }
        count += 1
        bytes += size
        if (size > maxFile) {
          maxFile = size
          maxFilePath = entryPath
        }
      }
      const link = nextLink(responseHeaders)
      next = link || ''
    }
  } catch (error) {
    return { ok: false, reason: 'network', pages, error: error?.message || String(error) }
  }

  if (count === 0) return { ok: true, count, bytes, pages, maxFile, maxFilePath, noMatch: true }
  return { ok: true, count, bytes, pages, maxFile, maxFilePath }
}

export { globToRegExp }
