import { spawn } from 'node:child_process'
import { mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { ConductorError } from '../errors.mjs'
import { probeBridge } from './detect.mjs'

function systemRoot(env = process.env) {
  return env.SystemRoot || env.windir || 'C:\\Windows'
}

function taskkillPath(env) {
  return path.join(systemRoot(env), 'System32', 'taskkill.exe')
}

async function killTree(child, env) {
  if (!child || child.exitCode !== null) return
  try {
    child.kill()
  } catch {}
  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      try {
        const killer = spawn(taskkillPath(env), ['/pid', String(child.pid), '/T', '/F'], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore',
        })
        const timer = setTimeout(() => { try { killer.kill() } catch {}; finish() }, 2_000)
        killer.on('close', () => { clearTimeout(timer); finish() })
        killer.on('error', () => { clearTimeout(timer); finish() })
      } catch {
        finish()
      }
    })
  }
}

export async function runInstaller(exePath, { signal, env = process.env, timeoutMs = 300_000 } = {}) {
  return await new Promise((resolve, reject) => {
    let settled = false
    let child
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      fn(value)
    }
    const onAbort = () => {
      void killTree(child, env).finally(() => {
        finish(reject, new ConductorError('E_CANCELLED', '安装已取消'))
      })
    }
    const timer = setTimeout(() => {
      void killTree(child, env).finally(() => {
        finish(reject, new ConductorError('E_PROVISION_INSTALL', '安装器超时', { hint: '请检查安装器是否被 UAC/SmartScreen 阻塞。' }))
      })
    }, timeoutMs)
    try {
      child = spawn(exePath, ['/S'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
        env: { ...env },
      })
    } catch (error) {
      finish(reject, new ConductorError('E_PROVISION_INSTALL', `无法启动安装器：${error.message}`))
      return
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
    child.on('error', (error) => {
      finish(reject, new ConductorError('E_PROVISION_INSTALL', `安装器启动失败：${error.message}`))
    })
    child.on('close', (code) => {
      if (code === 0) finish(resolve, { code })
      else finish(reject, new ConductorError('E_PROVISION_INSTALL', `安装器退出码 ${code}`, {
        hint: 'UAC 被拒绝、SmartScreen 拦截或安装器自身失败；不会自动卸载已有系统安装。',
      }))
    })
  })
}

export async function extractPortable(zipPath, destDir, { signal, env = process.env, timeoutMs = 120_000 } = {}) {
  await rm(destDir, { recursive: true, force: true })
  await mkdir(destDir, { recursive: true })
  return await new Promise((resolve, reject) => {
    let settled = false
    let child
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      fn(value)
    }
    const onAbort = () => {
      void killTree(child, env).finally(() => finish(reject, new ConductorError('E_CANCELLED', '解压已取消')))
    }
    const timer = setTimeout(() => {
      void killTree(child, env).finally(() => finish(reject, new ConductorError('E_PROVISION_INSTALL', '解压超时')))
    }, timeoutMs)
    try {
      child = spawn(path.join(systemRoot(env), 'System32', 'tar.exe'), ['-xf', zipPath, '-C', destDir], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
        env: { ...env },
      })
    } catch (error) {
      finish(reject, new ConductorError('E_PROVISION_INSTALL', `无法启动解压器：${error.message}`))
      return
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
    child.on('error', (error) => {
      finish(reject, new ConductorError('E_PROVISION_INSTALL', `解压失败：${error.message}`))
    })
    child.on('close', (code) => {
      if (code === 0) finish(resolve, { code })
      else finish(reject, new ConductorError('E_PROVISION_INSTALL', `解压退出码 ${code}`))
    })
  })
}

export async function findMotrixExe(rootDir, { maxDepth = 4 } = {}) {
  const queue = [{ dir: rootDir, depth: 0 }]
  while (queue.length) {
    const { dir, depth } = queue.shift()
    if (depth > maxDepth) continue
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'motrix.exe') return full
      if (entry.isDirectory()) queue.push({ dir: full, depth: depth + 1 })
    }
  }
  return ''
}

export async function startMotrix(exePath, { env = process.env } = {}) {
  const child = spawn(exePath, [], {
    shell: false,
    detached: true,
    windowsHide: false,
    stdio: 'ignore',
    env: { ...env },
  })
  child.unref()
  return { pid: child.pid || null }
}

export async function waitBridge({
  endpointFile,
  timeoutMs = 60_000,
  pollMs = 500,
  fetchImpl = globalThis.fetch,
  signal,
}) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) throw new ConductorError('E_CANCELLED', '等待 bridge 已取消')
    last = await probeBridge({ endpointFile, fetchImpl, timeoutMs: 1_500 })
    if (last.ready) return last
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  throw new ConductorError('E_PROVISION_BRIDGE', 'Motrix 已启动但 bridge 未就绪', {
    hint: '请确认 Motrix 已正常打开并启用浏览器桥接；Direct/yt-dlp/HF 仍可用。',
    info: { last: last?.error || null, endpointFile },
  })
}
