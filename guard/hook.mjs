import path from 'node:path'
import { evaluateShellCommand } from './policy.mjs'
import { realpathLoose, isInside } from '../lib/paths.mjs'
import { readTextFileBounded } from '../lib/staging.mjs'

const SHELL_TOOL = /bash|shell|powershell|pwsh|terminal|exec/i
const DOWNLOAD_SHAPE =
  /(curl|wget|iwr|invoke-webrequest|invoke-restmethod|aria2c|yt-dlp|youtube-dl|hf\s+download|start-bitstransfer|certutil|bitsadmin|mshta|https?:\/\/|ftp:\/\/)/i

function deny(reason) {
  return { kind: 'deny', reason, info: { kind: 'shell-download' } }
}

function readScript(args, cfg, exec) {
  const raw = args.script_path
  if (typeof raw !== 'string' || !raw.trim()) return null
  const base =
    exec?.agent?.session?.header?.cwd ||
    exec?.agent?.session?.cwd ||
    exec?.cwd ||
    cfg.cwd ||
    process.cwd()
  const abs = path.resolve(base, raw)
  const real = realpathLoose(abs)
  const roots = [...(cfg.allowedRoots || []), base]
  if (!isInside(real, roots)) {
    return { error: `script_path 越界：${real}` }
  }
  try {
    return { text: readTextFileBounded(real) }
  } catch (error) {
    return { error: `script_path 读取失败：${error.message}` }
  }
}

/**
 * tools/pre-execute hook. This is a guardrail, not a sandbox: run_code and
 * workflow scripts are out of scope.
 */
export function createPreExecuteHook({ cfg }) {
  return function handlePreExecute(exec, next) {
    if (!exec || typeof next !== 'function') return next()
    try {
      const name = String(exec.name || '')
      if (!SHELL_TOOL.test(name)) return next()
      const args = exec.arguments || exec.args || {}
      const command =
        (typeof args.command === 'string' && args.command) ||
        (typeof args.cmd === 'string' && args.cmd) ||
        (typeof args.script === 'string' && args.script) ||
        ''
      const script = readScript(args, cfg, exec)
      if (script?.error) return deny(`${script.error}；拒绝执行，不退回 fail-open。`)

      const texts = []
      if (command) texts.push(command)
      if (script?.text) texts.push(script.text)
      if (texts.length === 0) return next()

      for (const text of texts) {
        const decision = evaluateShellCommand(text, { cfg })
        if (decision.kind === 'deny') {
          return { kind: 'deny', reason: decision.reason, info: decision.info }
        }
      }
      return next()
    } catch (error) {
      const args = exec?.arguments || exec?.args || {}
      const raw = [args.command, args.cmd, args.script].filter((v) => typeof v === 'string').join(' ')
      if (cfg.guardFailClosed !== false && DOWNLOAD_SHAPE.test(raw)) {
        return deny(`守卫评估异常，且命令呈下载形状，已按 fail-closed 拒绝：${error.message}`)
      }
      // A guard bug must not brick unrelated shell calls.
      return next()
    }
  }
}
