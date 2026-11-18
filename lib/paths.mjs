import fs from 'node:fs'
import path from 'node:path'
import { ConductorError } from './errors.mjs'

/**
 * Extensions that turn a download into code execution the next time the user
 * opens the file. They are denied by default; `allowExecutable: true` is an
 * explicit, restart-required opt-in.
 */
export const EXEC_EXT = new Set([
  '.exe', '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse',
  '.wsf', '.wsh', '.hta', '.msi', '.msp', '.dll', '.scr', '.com', '.pif',
  '.lnk', '.url', '.reg', '.jar', '.application', '.cpl', '.ocx',
  '.settingcontent-ms', '.desktop.ini', '.mjs', '.cjs', '.py', '.sh',
])

/**
 * A repository tree legitimately ships .js/.py/.sh/.mjs/.dll/.jar. The tree
 * scan therefore blocks only Windows "double-click runs it" types; single-file
 * downloads still use the stricter EXEC_EXT.
 */
export const TREE_EXEC_EXT = new Set([
  '.exe', '.com', '.scr', '.pif', '.bat', '.cmd', '.msi', '.msp', '.lnk',
  '.url', '.reg', '.hta', '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psm1',
  '.cpl', '.ocx', '.settingcontent-ms', '.desktop.ini',
])

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

/** Resolve symlinks on the longest existing prefix, then re-append the rest. */
export function realpathLoose(input) {
  const abs = path.resolve(String(input))
  let current = abs
  const tail = []
  for (;;) {
    try {
      const real = fs.realpathSync.native(current)
      return tail.length ? path.join(real, ...tail.reverse()) : real
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const parent = path.dirname(current)
      if (parent === current) return abs
      tail.push(path.basename(current))
      current = parent
    }
  }
}

export function isInside(realPath, roots) {
  return roots.some((root) => {
    const realRoot = realpathLoose(root)
    return realPath === realRoot || realPath.startsWith(realRoot + path.sep)
  })
}

export function assertInside(root, candidate) {
  const realRoot = realpathLoose(root)
  const realCandidate = realpathLoose(candidate)
  if (!isInside(realCandidate, [realRoot])) {
    throw new ConductorError('E_TARGET', `路径越界：${realCandidate}`, {
      hint: `所有产物必须位于 ${realRoot} 内。`,
    })
  }
  return realCandidate
}

const SYSTEM_ROOTS = [
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\programdata',
]

/**
 * Validate an allowed-root entry before it can become a write boundary.
 *
 * This is the shared validator for `loadConfig`, `assertSafeDir` roots and the
 * config page's `validateRoot()` API. Network/device prefixes are rejected
 * before any filesystem call so a UNC path cannot trigger an SMB lookup.
 */
export function validateRootPath(raw, { cwd = process.cwd(), platform = process.platform, mustExist = false } = {}) {
  const checks = []
  const add = (id, label, ok, detail) => checks.push({ id, label, status: ok ? 'pass' : 'fail', detail })
  const text = String(raw ?? '').trim()

  if (!text) {
    add('nonempty', '路径非空', false, '不能为空')
    return { ok: false, checks }
  }
  add('nonempty', '路径非空', true)

  if (/^[\\/]{2}/.test(text)) {
    add('unc', '非 UNC / 设备路径', false, '不允许 \\\\server、\\\\?\\ 或 \\\\.\\ 前缀')
    return { ok: false, checks }
  }
  add('unc', '非 UNC / 设备路径', true)

  if (/^[a-zA-Z]:(?![\\/])/.test(text)) {
    add('driveRelative', '非盘符相对路径', false, '请写成 C:\\dir 这样的绝对路径')
    return { ok: false, checks }
  }
  add('driveRelative', '非盘符相对路径', true)

  if (text.includes('\u0000')) {
    add('nul', '不含 NUL 字符', false, '路径含 NUL')
    return { ok: false, checks }
  }
  add('nul', '不含 NUL 字符', true)

  const abs = path.resolve(cwd, text)
  const parsed = path.parse(abs)
  if (parsed.root === abs) {
    add('notRoot', '不是盘符根目录', false, '不允许把整个盘符作为下载根')
    return { ok: false, checks }
  }
  add('notRoot', '不是盘符根目录', true)

  if (platform === 'win32') {
    const lower = abs.toLowerCase()
    if (SYSTEM_ROOTS.some((root) => lower === root || lower.startsWith(`${root}\\`))) {
      add('notSystem', '不是系统目录', false, '不允许 Windows / Program Files / ProgramData')
      return { ok: false, checks }
    }
    add('notSystem', '不是系统目录', true)
  }

  const rest = /^[a-zA-Z]:/.test(abs) ? abs.slice(2) : abs
  if (rest.includes(':')) {
    add('ads', '不含 NTFS 数据流', false, '路径段里不允许冒号')
    return { ok: false, checks }
  }
  add('ads', '不含 NTFS 数据流', true)

  const real = realpathLoose(abs)
  let st
  try {
    st = fs.statSync(real)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      add('readable', '路径可访问', false, error.message)
      return { ok: false, checks }
    }
    if (mustExist) {
      add('exists', '路径存在', false, '目录不存在')
      return { ok: false, checks }
    }
    add('exists', '路径存在（可稍后创建）', true, real)
    add('directory', '目录类型', true, '尚未创建')
    return { ok: true, normalized: real, checks }
  }

  if (!st.isDirectory()) {
    add('directory', '目录类型', false, '目标不是目录')
    return { ok: false, checks }
  }
  add('exists', '路径存在', true)
  add('directory', '目录类型', true, real)

  try {
    fs.accessSync(real, fs.constants.W_OK)
    add('writable', '当前用户可写', true)
  } catch (error) {
    add('writable', '当前用户可写', false, error.message)
    return { ok: false, checks }
  }

  return { ok: true, normalized: real, checks }
}

/**
 * Validate `save_dir` against the configured allow-list.
 *
 * The reference plugin only did `path.resolve(cwd, arg)`, which let the model
 * write anywhere (including Startup). This function rejects:
 *   - UNC / device paths (`\\server`, `\\?\C:`)
 *   - drive-relative paths (`C:temp`)
 *   - NTFS alternate data streams (`name:stream`)
 *   - anything outside `allowedRoots` after realpath resolution
 */
export function assertSafeDir(raw, cfg) {
  const text = String(raw ?? '').trim()
  if (!text) {
    throw new ConductorError('E_SAVE_DIR', '缺少 save_dir：下载必须指定一个允许范围内的目录', {
      hint: `例如 ${cfg.defaultSaveDir}；不要省略这个参数。`,
    })
  }
  if (text.includes('\u0000')) {
    throw new ConductorError('E_SAVE_DIR', 'save_dir 含 NUL 字符')
  }
  if (/^[\\/]{2}/.test(text)) {
    throw new ConductorError('E_SAVE_DIR', '不允许 UNC / 设备路径', {
      hint: '请使用本机盘符路径，例如 C:\\Users\\<你>\\Downloads\\subdir。',
    })
  }
  if (/^[a-zA-Z]:(?![\\/])/.test(text)) {
    throw new ConductorError('E_SAVE_DIR', '不允许盘符相对路径（例如 C:temp）', {
      hint: '请写成 C:\\temp 这样的绝对路径，或相对会话目录的路径。',
    })
  }

  const abs = path.resolve(cfg.cwd || process.cwd(), text)
  const parts = abs.split(/[\\/]+/).filter(Boolean)
  for (let i = 1; i < parts.length; i += 1) {
    if (parts[i].includes(':')) {
      throw new ConductorError('E_SAVE_DIR', '不允许 NTFS 备用数据流（路径段里含冒号）', {
        hint: '去掉路径段里的冒号后再试。',
      })
    }
  }

  const real = realpathLoose(abs)
  if (!isInside(real, cfg.allowedRoots)) {
    throw new ConductorError('E_SAVE_DIR', `目录不在允许范围内：${real}`, {
      hint:
        `允许的根目录：${cfg.allowedRoots.join('；')}。` +
        '把 save_dir 换到这些目录下，或在插件 config.allowedRoots 增加该目录后重启 DSH。',
    })
  }

  try {
    const st = fs.statSync(real)
    if (!st.isDirectory()) {
      throw new ConductorError('E_SAVE_DIR', `目标已存在但不是目录：${real}`)
    }
  } catch (error) {
    if (error instanceof ConductorError) throw error
    if (error.code !== 'ENOENT') {
      throw new ConductorError('E_SAVE_DIR', `无法检查目录：${real}`, { cause: error })
    }
  }

  return { dir: real }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return realpathLoose(dir)
}

export function assertSafeFilename(raw, { allowExecutable = false } = {}) {
  let name = String(raw ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '')
    .pop() || ''
  name = name
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .trim()
    .replace(/[. ]+$/g, '')

  if (!name || name === '.' || name === '..') name = 'download'
  if (RESERVED.test(name)) name = `_${name}`

  const ext = path.extname(name).toLowerCase()
  if (EXEC_EXT.has(ext) && !allowExecutable) {
    throw new ConductorError('E_EXEC_EXT', `默认拒绝可执行扩展名 ${ext}：${name}`, {
      hint:
        '这是为了防止下载内容在下次登录时被执行。' +
        '如果确实需要，请让用户把插件 config.allowExecutable 设为 true 并重启 DSH。',
    })
  }

  if (name.length > 180) {
    const stem = ext ? name.slice(0, -ext.length) : name
    name = `${stem.slice(0, 180 - ext.length)}${ext}`
  }
  return name
}

/** Parse RFC 5987 `filename*` first, then the plain `filename=` parameter. */
export function filenameFromDisposition(header) {
  if (typeof header !== 'string' || !header) return ''
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(header)
  if (star && star[1]) {
    const value = star[1].trim().replace(/^"|"$/g, '')
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header)
  const value = (plain && (plain[1] || plain[2] || '')).trim()
  if (!value) return ''
  // Node exposes header bytes as latin1; recover UTF-8 when the bytes are valid.
  if (/[\u0080-\u00ff]/.test(value)) {
    const utf8 = Buffer.from(value, 'latin1').toString('utf8')
    if (!utf8.includes('\ufffd')) return utf8
  }
  return value
}

export function filenameFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const base = decodeURIComponent(path.posix.basename(parsed.pathname))
    return base && base !== '/' ? base : ''
  } catch {
    return ''
  }
}

/** Pick a non-existing target; the final write still uses an atomic link. */
export function chooseTargetPath(dir, filename) {
  const ext = path.extname(filename)
  const stem = ext ? filename.slice(0, -ext.length) : filename
  let candidate = path.join(dir, filename)
  for (let i = 1; i < 1000; i += 1) {
    if (!fs.existsSync(candidate)) return candidate
    candidate = path.join(dir, `${stem} (${i})${ext}`)
  }
  return path.join(dir, `${stem}-${Date.now()}${ext}`)
}

export function randomPartPath(target) {
  const suffix = `${process.pid}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`
  return `${target}.${suffix}.part`
}

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '未知'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
}
