import { spawn } from 'node:child_process'
import path from 'node:path'
import { ConductorError } from '../lib/errors.mjs'

const MAX_CAPTURE = 1024 * 1024

function appendCapture(state, chunk) {
  state.total += chunk.length
  if (state.total > MAX_CAPTURE) {
    const keep = Math.max(0, MAX_CAPTURE - chunk.length)
    state.text = (state.text + chunk.toString('utf8').slice(-keep)).slice(-MAX_CAPTURE)
    return
  }
  state.text += chunk.toString('utf8')
}

async function killTree(child) {
  if (!child || !child.pid || child.exitCode !== null) return
  if (process.platform === 'win32') {
    const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
    await new Promise((resolve) => {
      const killer = spawn(taskkill, ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      const timer = setTimeout(resolve, 2_000)
      killer.on('close', () => { clearTimeout(timer); resolve() })
      killer.on('error', () => { clearTimeout(timer); resolve() })
    })
    return
  }
  try {
    child.kill('SIGTERM')
  } catch {
    // already gone
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
  try {
    child.kill('SIGKILL')
  } catch {
    // already gone
  }
}

/**
 * Run a trusted local tool with a fixed argv array (no shell). Child output is
 * captured up to 1 MiB; the call is bounded by timeoutMs and signal.
 */
export function runProc({ command, args = [], env, cwd, signal, timeoutMs = 120_000, onStderrLine, onStdoutLine }) {
  return new Promise((resolve, reject) => {
    if (!command || typeof command !== 'string') {
      reject(new ConductorError('E_ENGINE_UNAVAILABLE', '缺少可执行文件路径'))
      return
    }
    let child
    try {
      child = spawn(command, args, {
        cwd,
        env: env || process.env,
        windowsHide: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(new ConductorError('E_ENGINE_UNAVAILABLE', `无法启动 ${command}：${error.message}`, { cause: error }))
      return
    }

    const stdout = { text: '', total: 0 }
    const stderr = { text: '', total: 0 }
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let settled = false
    let timer

    function fail(error) {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      void killTree(child).finally(() => reject(error))
    }

    function finish(code, signalName) {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (signal?.aborted) {
        reject(new ConductorError('E_CANCELLED', '下载已取消'))
        return
      }
      if (code === 0) {
        resolve({ code, stdout: stdout.text, stderr: stderr.text })
        return
      }
      const tail = stderr.text.trim().split(/\r?\n/).slice(-5).join('\n')
      reject(
        new ConductorError('E_ENGINE_REJECTED', `${command} 退出码 ${code ?? signalName}`, {
          info: { tail },
        }),
      )
    }

    child.stdout.on('data', (chunk) => {
      appendCapture(stdout, chunk)
      stdoutBuffer += chunk.toString('utf8')
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() || ''
      if (typeof onStdoutLine === 'function') {
        for (const line of lines) {
          if (line.trim()) onStdoutLine(line)
        }
      }
    })
    child.stderr.on('data', (chunk) => {
      appendCapture(stderr, chunk)
      stderrBuffer += chunk.toString('utf8')
      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() || ''
      if (typeof onStderrLine === 'function') {
        for (const line of lines) {
          if (line.trim()) onStderrLine(line)
        }
      }
    })
    child.on('error', (error) => {
      fail(new ConductorError('E_ENGINE_UNAVAILABLE', `无法启动 ${command}：${error.message}`, { cause: error }))
    })
    child.on('close', (code, signalName) => finish(code, signalName))

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => fail(new ConductorError('E_IO', `${command} 超时（${timeoutMs}ms）`)), timeoutMs)
    }
    if (signal) {
      if (signal.aborted) {
        fail(new ConductorError('E_CANCELLED', '下载已取消'))
      } else {
        signal.addEventListener('abort', () => fail(new ConductorError('E_CANCELLED', '下载已取消')), { once: true })
      }
    }
  })
}
