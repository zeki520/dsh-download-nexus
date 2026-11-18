import { spawn } from 'node:child_process'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  MOTRIX_MIN_VERSION,
  MOTRIX_VERSION,
  isCompatibleVersion,
} from './manifest.mjs'

function systemRoot(env = process.env) {
  return env.SystemRoot || env.windir || 'C:\\Windows'
}

function system32(name, env) {
  return path.join(systemRoot(env), 'System32', name)
}

export function runFixed(command, args, { timeoutMs = 8_000, env = process.env } = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    let child
    try {
      child = spawn(command, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...env },
      })
    } catch (error) {
      finish({ ok: false, code: null, stdout: '', stderr: '', error: error.message })
      return
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      finish({ ok: false, code: null, stdout, stderr, error: 'timeout' })
    }, timeoutMs)
    child.stdout?.on('data', (chunk) => {
      if (stdout.length < 512 * 1024) stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 512 * 1024) stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      finish({ ok: false, code: null, stdout, stderr, error: error.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ ok: code === 0, code, stdout, stderr })
    })
  })
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

export async function detectInstalledViaRegistry({
  env = process.env,
  run = runFixed,
} = {}) {
  const script = [
    "$roots = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');",
    "Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue |",
    "Where-Object { $_.DisplayName -like '*Motrix*' } |",
    'Select-Object DisplayName,DisplayVersion,InstallLocation,DisplayIcon | ConvertTo-Json -Compress',
  ].join(' ')
  const result = await run(
    path.join(systemRoot(env), 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { env, timeoutMs: 8_000 },
  )
  if (!result.ok || !result.stdout.trim()) return []
  let rows
  try {
    rows = JSON.parse(result.stdout.trim())
  } catch {
    return []
  }
  const list = Array.isArray(rows) ? rows : [rows]
  const out = []
  for (const row of list) {
    const name = String(row?.DisplayName || '')
    if (!/motrix/i.test(name)) continue
    const installLocation = String(row?.InstallLocation || '').trim()
    const displayIcon = String(row?.DisplayIcon || '').replace(/^"|"$/g, '').replace(/,\d+$/, '').trim()
    const candidate = installLocation
      ? path.join(installLocation, 'Motrix.exe')
      : displayIcon && /Motrix\.exe$/i.test(displayIcon)
        ? displayIcon
        : ''
    out.push({
      name,
      version: String(row?.DisplayVersion || '').trim(),
      path: candidate,
      source: 'registry',
    })
  }
  return out
}

export async function detectRunning({ env = process.env, run = runFixed } = {}) {
  const script = [
    "Get-Process -Name Motrix -ErrorAction SilentlyContinue |",
    'Select-Object Id,Path | ConvertTo-Json -Compress',
  ].join(' ')
  const result = await run(
    path.join(systemRoot(env), 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { env, timeoutMs: 6_000 },
  )
  if (!result.ok || !result.stdout.trim()) return []
  try {
    const rows = JSON.parse(result.stdout.trim())
    const list = Array.isArray(rows) ? rows : [rows]
    return list
      .filter((row) => Number.isInteger(Number(row?.Id)))
      .map((row) => ({ pid: Number(row.Id), path: String(row.Path || '') }))
  } catch {
    return []
  }
}

export async function readExeVersion(exePath, { env = process.env, run = runFixed } = {}) {
  if (!exePath) return ''
  const script = [
    `(Get-Item -LiteralPath ${psQuote(exePath)} -ErrorAction Stop).VersionInfo.ProductVersion`,
  ].join(' ')
  const result = await run(
    path.join(systemRoot(env), 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { env, timeoutMs: 6_000 },
  )
  return result.ok ? result.stdout.trim() : ''
}

export function endpointPathFor(env = process.env) {
  const appData = env.APPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Roaming')
  return path.join(appData, 'Motrix', 'bridge', 'endpoint.json')
}

export async function readEndpoint(endpointFile, { readFileImpl = readFile } = {}) {
  try {
    const raw = await readFileImpl(endpointFile, 'utf8')
    const data = JSON.parse(raw)
    const port = Number(data.port)
    const localToken = typeof data.localToken === 'string' ? data.localToken : ''
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !localToken) {
      return { ok: false, error: 'endpoint 字段不完整' }
    }
    return { ok: true, port, localToken, generation: data.generation ?? null }
  } catch (error) {
    return { ok: false, error: error?.code || error?.message || 'endpoint 不可读' }
  }
}

export async function probeBridge({ endpointFile, fetchImpl = globalThis.fetch, timeoutMs = 1_500, readFileImpl = readFile } = {}) {
  const endpoint = await readEndpoint(endpointFile, { readFileImpl })
  if (!endpoint.ok) return { ready: false, port: null, endpointFile, error: endpoint.error }
  let response
  try {
    response = await fetchImpl(`http://127.0.0.1:${endpoint.port}/mdxp`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${endpoint.localToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'stats/get', params: {} }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    return { ready: false, port: endpoint.port, endpointFile, error: error?.message || 'bridge 不可达' }
  }
  if (!response.ok) {
    return { ready: false, port: endpoint.port, endpointFile, error: `HTTP ${response.status}` }
  }
  return { ready: true, port: endpoint.port, endpointFile, error: null }
}

export function defaultInstallCandidates(env = process.env) {
  const local = env.LOCALAPPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Local')
  const programFiles = env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  return [
    path.join(local, 'Programs', 'Motrix', 'Motrix.exe'),
    path.join(programFiles, 'Motrix', 'Motrix.exe'),
    path.join(programFilesX86, 'Motrix', 'Motrix.exe'),
  ]
}

/**
 * Read-only detection. Never launches, installs, kills, or writes Motrix files.
 * Every external dependency is injectable so Windows-specific parsing is testable.
 */
export async function detectMotrix({
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  state = null,
  run = runFixed,
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  existsImpl = null,
} = {}) {
  const endpointFile = endpointPathFor(env)
  const base = {
    platform,
    arch,
    expectedVersion: MOTRIX_VERSION,
    minVersion: MOTRIX_MIN_VERSION,
    endpointFile,
    installation: { found: false, path: '', version: '', source: '', compatible: false },
    running: { running: false, pids: [], path: '' },
    bridge: { ready: false, port: null, endpointFile, error: null },
    state: 'unsupported',
    warnings: [],
  }
  if (platform !== 'win32') {
    return { ...base, state: 'unsupported', warnings: ['只支持 Windows 自动部署；其他平台请手动安装 Motrix。'] }
  }

  const exists = existsImpl || (async (p) => {
    try {
      const { access } = await import('node:fs/promises')
      await access(p)
      return true
    } catch {
      return false
    }
  })

  const registry = await detectInstalledViaRegistry({ env, run })
  const running = await detectRunning({ env, run })
  const portableDir = state?.portableDir ? String(state.portableDir) : ''
  const portableExe = portableDir ? path.join(portableDir, 'Motrix.exe') : ''
  const candidates = []
  if (portableExe && await exists(portableExe)) {
    candidates.push({ path: portableExe, version: '', source: 'portable' })
  }
  for (const row of registry) {
    if (row.path && await exists(row.path)) candidates.push(row)
  }
  for (const p of defaultInstallCandidates(env)) {
    if (await exists(p)) candidates.push({ path: p, version: '', source: 'default-path' })
  }

  let installation = candidates[0] || null
  if (!installation && running[0]?.path) {
    installation = { path: running[0].path, version: '', source: 'process' }
  }
  if (installation) {
    const version = installation.version || await readExeVersion(installation.path, { env, run })
    installation = {
      found: true,
      path: installation.path,
      version,
      source: installation.source,
      compatible: isCompatibleVersion(version),
    }
  }

  const bridge = await probeBridge({ endpointFile, fetchImpl, readFileImpl })
  const runningInfo = {
    running: running.length > 0,
    pids: running.map((p) => p.pid),
    path: running[0]?.path || '',
  }

  let stateName
  if (bridge.ready) stateName = 'ready'
  else if (installation?.found && installation.compatible === false) stateName = 'incompatible'
  else if (installation?.found && !installation.version) stateName = 'unknown-version'
  else if (runningInfo.running) stateName = 'running-no-bridge'
  else if (installation?.found) stateName = 'installed'
  else stateName = 'absent'

  const warnings = []
  if (installation?.found && !installation.compatible) {
    warnings.push(`Motrix 版本 ${installation.version || '未知'} 不在兼容范围 ${MOTRIX_MIN_VERSION}–<3.0.0。`)
  }
  if (runningInfo.running && !bridge.ready) {
    warnings.push('Motrix 进程在运行，但 bridge 未就绪；不会启动第二个实例，也不会终止它。')
  }

  return {
    ...base,
    installation: installation || base.installation,
    running: runningInfo,
    bridge,
    state: stateName,
    warnings,
  }
}
