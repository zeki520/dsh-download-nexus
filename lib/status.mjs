import fs from 'node:fs'
import path from 'node:path'
import { validateRootPath } from './paths.mjs'

const PACKAGE_URL = new URL('../package.json', import.meta.url)

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_URL, 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function sanitizeUrl(value) {
  const text = String(value || '')
  try {
    const url = new URL(text)
    url.username = ''
    url.password = ''
    url.hash = ''
    return url.toString()
  } catch {
    return text
  }
}

function safeConfig(cfg) {
  return {
    toolPrefix: cfg.toolPrefix,
    defaultSaveDir: cfg.defaultSaveDir,
    allowedRoots: [...cfg.allowedRoots],
    allowExecutable: cfg.allowExecutable,
    allowShell: cfg.allowShell,
    guardFailClosed: cfg.guardFailClosed,
    allowBrowserCookies: cfg.allowBrowserCookies,
    connections: cfg.connections,
    maxBytes: cfg.maxBytes,
    requestTimeoutMs: cfg.requestTimeoutMs,
    pollMs: cfg.pollMs,
    maxWaitSeconds: cfg.maxWaitSeconds,
    proxyCandidates: [...cfg.proxyCandidates],
    autoStartMotrix: false,
    motrixStateDir: cfg.motrixStateDir,
    ytdlpPath: cfg.ytdlpPath,
    hfPath: cfg.hfPath,
    hfMirror: sanitizeUrl(cfg.hfMirror),
    useHfMirror: cfg.useHfMirror,
    githubMirrorBase: sanitizeUrl(cfg.githubMirrorBase),
    githubMirrorDefault: cfg.githubMirrorDefault,
    promptOrder: cfg.promptOrder,
    promptName: cfg.promptName,
  }
}

function probeState(row) {
  if (!row) return 'unchecked'
  if (row.available) return 'ready'
  if (row.reason === 'connect-refused') return 'not-running'
  if (row.reason === 'cli-missing') return 'not-installed'
  return 'failed'
}

function summarizeChecks(report) {
  const checks = []
  const push = (id, label, status, detail) => checks.push({ id, label, status, detail })
  push('plugin', '插件已加载', 'pass')
  push('roots', '允许目录已规范化', 'pass', `${report.allowed_roots?.length ?? 0} 个根`)
  if (report.motrix?.connected) push('motrix', 'Motrix 桥可用', 'pass', `端口 ${report.motrix.port ?? '-'}`)
  else push('motrix', 'Motrix 桥未连接', 'warn', report.motrix?.error || 'Motrix 未运行或桥接未开启')
  for (const [id, row] of Object.entries(report.engines || {})) {
    if (id === 'motrix') continue
    push(`engine:${id}`, `${id} 引擎`, row.available ? 'pass' : 'warn', row.detail)
  }
  if (report.accel?.proxy) push('proxy', '本地代理可用', 'pass', report.accel.proxy)
  else push('proxy', '未发现本地代理', 'warn', '下载仍可直连，但 GitHub 等线路可能较慢')
  return checks
}

export function createStatusService({ cfg, conductor, tools = [], version = readVersion() }) {
  const startedAt = new Date().toISOString()

  return {
    async snapshot() {
      let motrix = { connected: false }
      try {
        if (conductor?.engines?.motrix?.info) {
          motrix = await conductor.engines.motrix.info()
        }
      } catch (error) {
        motrix = { connected: false, error: error?.message || String(error) }
      }
      return {
        plugin: {
          name: 'dsh-download-nexus',
          version,
          started_at: startedAt,
          tools: tools.map((tool) => (typeof tool === 'string' ? tool : tool.name)).filter(Boolean),
        },
        config: safeConfig(cfg),
        motrix: {
          connected: Boolean(motrix.connected),
          port: motrix.port,
          endpoint_file: motrix.endpointFile ? path.basename(motrix.endpointFile) : undefined,
          error: motrix.error,
        },
        volatile: { generation: 0 },
        runtime: { session_tasks: null },
      }
    },

    async probe(ids = ['all'], { force = false } = {}) {
      const wanted = Array.isArray(ids) && ids.length ? ids : ['all']
      const all = wanted.includes('all')
      const allowed = new Set(['motrix', 'direct', 'ytdlp', 'hf'])
      const selected = all ? [...allowed] : wanted.filter((id) => allowed.has(id))
      const rows = await conductor.probeAll({ force: Boolean(force) })
      const engines = {}
      for (const id of selected) {
        const row = rows[id] || { available: false, detail: '未探测' }
        engines[id] = {
          available: Boolean(row.available),
          detail: String(row.detail ?? ''),
          ...(row.reason ? { reason: String(row.reason) } : {}),
          state: probeState(row),
          at: new Date().toISOString(),
        }
      }
      return { engines }
    },

    async diagnose({ verbose = false } = {}) {
      const report = await conductor.doctor({ verbose: Boolean(verbose) })
      const motrix = report.motrix || {}
      return {
        checks: summarizeChecks(report),
        motrix: {
          connected: Boolean(motrix.connected),
          port: motrix.port,
          endpoint_file: motrix.endpointFile ? path.basename(motrix.endpointFile) : undefined,
        },
        ...(verbose ? { config: safeConfig(cfg) } : {}),
      }
    },

    async validateRoot(raw) {
      const result = validateRootPath(raw, { cwd: cfg.cwd, mustExist: true })
      return {
        ok: Boolean(result.ok),
        normalized: result.normalized,
        checks: result.checks,
      }
    },

    async checkUrl(raw) {
      try {
        await conductor.netPolicy.assertUrlAllowed(String(raw || ''))
        return { allowed: true }
      } catch (error) {
        return {
          allowed: false,
          reason: error?.code || 'E_TARGET',
          message: error?.message || '目标地址不可用',
        }
      }
    },
  }
}
