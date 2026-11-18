import { toolName } from '../lib/config.mjs'

function stripQuotes(command) {
  return String(command || '')
    .replace(/'(?:[^']*)'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

function hasFileRedirect(command) {
  const stripped = stripQuotes(command)
  const re = /(^|[^>])>>?/g
  let match
  while ((match = re.exec(stripped))) {
    const rest = stripped.slice(re.lastIndex)
    if (rest.startsWith('&')) continue
    const target = rest.trimStart().split(/[\s;|&]/)[0]
    if (isNullSink(target)) continue
    return true
  }
  return false
}

function tokenize(command) {
  const out = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(command))) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

function firstUrl(command) {
  const withoutProxy = String(command)
    .replace(/--proxy(?:-server)?(?:=|\s+)\S+/gi, ' ')
    .replace(/(^|\s)-x(?:=|\s+)\S+/gi, ' ')
  const m = withoutProxy.match(/https?:\/\/[^\s"'<>|]+/i)
  return m ? m[0] : ''
}

function isNullSink(value) {
  const v = String(value || '').toLowerCase()
  return v === '-' || v === '/dev/null' || v === 'nul' || v === 'nul:' || v === '/dev/stdout'
}

function commandWord(token) {
  return String(token || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/\.(exe|com|bat|cmd)$/i, '')
}

/**
 * Return a decision for one shell command. This is a guardrail, not a
 * sandbox: it blocks the obvious curl/wget/iwr/BITS file writers so the model
 * is steered to the download tool, and keeps read-only probes usable.
 */
export function evaluateShellCommand(command, { cfg, depth = 0 } = {}) {
  const text = String(command || '')
  if (!text.trim()) return { kind: 'allow' }
  if (cfg.allowShell) return { kind: 'allow' }

  const tokens = tokenize(text)
  const words = tokens.map(commandWord)
  const deny = (detail) => ({
    kind: 'deny',
    reason: [
      `拦截：这条命令会写文件（${detail}）。`,
      `请改用 ${toolName(cfg, 'download')} 工具，url="${firstUrl(text) || '<URL>'}"，save_dir="${cfg.defaultSaveDir}"。`,
      '只读探测（curl -I / --spider、yt-dlp --skip-download、aria2c --version）仍然放行；如果确实要执行原命令，请让用户显式设置 DSH_DOWNLOAD_ALLOW_SHELL=1。',
    ].join('\n'),
    info: { kind: 'shell-download', command: text, detail },
  })

  for (let i = 0; i < tokens.length; i += 1) {
    const word = words[i]
    const raw = tokens[i]

    if (word === 'aria2c') {
      const rest = words.slice(i + 1)
      if (rest.includes('--version') || rest.includes('--help')) continue
      return deny('aria2c 会自行落盘')
    }
    if (word === 'yt-dlp' || word === 'youtube-dl') {
      const rest = words.slice(i + 1)
      const readOnly = rest.includes('--skip-download') || rest.includes('--simulate') || rest.includes('--version') || rest.includes('--help')
      const alsoWrites = rest.some((flag) =>
        /^--write-(subs|auto-subs|info-json|thumbnail|description|annotations|comments|playlist-metadata)$/.test(flag),
      )
      if (readOnly && !alsoWrites) continue
      return deny('yt-dlp 会自行落盘')
    }
    if (word === 'hf' && words[i + 1] === 'download') return deny('hf download 会自行落盘')
    if (word === 'start-bitstransfer') return deny('Start-BitsTransfer 会写文件')

    if ((word === 'powershell' || word === 'pwsh') && depth < 2) {
      const rest = tokens.slice(i + 1)
      if (rest.some((token) => /^-(encodedcommand|enc)$/i.test(token))) {
        return deny('PowerShell -EncodedCommand 会执行隐藏脚本')
      }
      const commandIndex = rest.findIndex((token) => /^-(command|c)$/i.test(token))
      if (commandIndex >= 0) {
        const body = rest.slice(commandIndex + 1).join(' ')
        if (body) {
          const nested = evaluateShellCommand(body, { cfg, depth: depth + 1 })
          if (nested.kind === 'deny') return nested
        }
      }
    }

    if (word === 'certutil' && tokens.slice(i + 1).some((token) => /^-(urlcache|decode)$/i.test(token))) {
      return deny('certutil 可把远程文件写入本地')
    }
    if (word === 'bitsadmin' && tokens.slice(i + 1).some((token) => /^\/transfer$/i.test(token))) {
      return deny('bitsadmin /transfer 会写文件')
    }
    if (word === 'mshta') return deny('mshta 会执行远程 HTA 文件')

    if (/^(invoke-webrequest|iwr|invoke-restmethod|irm)$/i.test(word) && /(^|\s)-outfile(?:[:=]|\s|$)/i.test(text)) {
      return deny('Invoke-WebRequest -OutFile 会写文件')
    }

    if (word === 'curl' || word === 'curl.exe') {
      let headOnly = false
      for (let j = i + 1; j < tokens.length; j += 1) {
        const opt = tokens[j]
        if (opt === '-I' || opt === '--head' || opt === '--spider') headOnly = true
        if (opt === '--output' || opt === '--output-dir') {
          if (!isNullSink(tokens[j + 1])) return deny(`curl ${opt} 会写文件`)
          j += 1
          continue
        }
        if (/^--output=/.test(opt)) {
          if (!isNullSink(opt.slice('--output='.length))) return deny('curl --output= 会写文件')
          continue
        }
        if (opt === '-O' || opt === '--remote-name' || opt === '--remote-name-all' || opt === '--remote-header-name') {
          return deny(`curl ${opt} 会写文件`)
        }
        const attached = /^-([A-Za-z]*o)(.+)$/.exec(opt)
        if (attached) {
          if (!isNullSink(attached[2])) return deny('curl -o<path> 会写文件')
          continue
        }
        if (/^-[A-Za-z]+$/.test(opt) && opt.includes('o')) {
          if (!isNullSink(tokens[j + 1])) return deny('curl -o 会写文件')
          j += 1
        }
      }
      if (!headOnly && hasFileRedirect(text)) return deny('curl 输出被重定向到文件')
      continue
    }

    if (word === 'wget' || word === 'wget.exe') {
      let spider = false
      let writes = false
      let toNull = false
      for (let j = i + 1; j < tokens.length; j += 1) {
        const opt = tokens[j]
        if (opt === '--spider') spider = true
        if (opt === '-O' || opt === '--output-document') {
          if (isNullSink(tokens[j + 1])) toNull = true
          else writes = true
          j += 1
          continue
        }
        if (/^--output-document=/.test(opt)) {
          if (isNullSink(opt.slice('--output-document='.length))) toNull = true
          else writes = true
          continue
        }
        if (/^-[A-Za-z]*O-$/.test(opt)) {
          toNull = true
          continue
        }
        if (/^-[A-Za-z]*O[A-Za-z]*$/.test(opt)) {
          if (isNullSink(tokens[j + 1])) toNull = true
          else writes = true
          j += 1
        }
      }
      if (writes) return deny('wget -O 会写文件')
      if (!spider && !toNull && hasFileRedirect(text)) return deny('wget 输出被重定向到文件')
      if (!spider && !toNull) return deny('wget 默认会把文件写到当前目录')
      continue
    }

    if (word === 'python' || word === 'python3' || word === 'py') {
      let j = i + 1
      while (j < tokens.length && /^(-u|-X|-3|-B|-O|utf8|--input-type=module|-p)$/i.test(tokens[j])) j += 1
      if (tokens[j] === '-c') {
        const code = tokens.slice(j + 1).join(' ')
        if (/urllib|requests|httpx|urlopen|write\(|open\([^)]*['"](?:w|wb|a)/i.test(code) && /https?:/i.test(code)) {
          return deny('python 内联代码在下载并写文件')
        }
      }
    }

    if (word === 'node') {
      let j = i + 1
      while (j < tokens.length && /^(-e|--eval|-p|--print|--input-type=module|--input-type=commonjs)$/i.test(tokens[j])) {
        if (tokens[j] === '-e' || tokens[j] === '--eval' || tokens[j] === '-p' || tokens[j] === '--print') break
        j += 1
      }
      if (tokens[j] === '-e' || tokens[j] === '--eval') {
        const code = tokens.slice(j + 1).join(' ')
        if (/fetch\s*\(|https?\.get/i.test(code) && /writeFile|createWriteStream|appendFile/i.test(code)) {
          return deny('node 内联代码在下载并写文件')
        }
      }
    }
  }

  return { kind: 'allow' }
}
