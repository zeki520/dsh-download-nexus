import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConductorError } from './errors.mjs'
import { TREE_EXEC_EXT, assertInside, chooseTargetPath } from './paths.mjs'

function isLinkLike(fullPath, stat) {
  const entry = stat || fs.lstatSync(fullPath)
  if (entry.isSymbolicLink()) return true
  if (process.platform !== 'win32' || !entry.isDirectory()) return false
  try {
    return path.resolve(fs.realpathSync(fullPath)).toLowerCase() !== path.resolve(fullPath).toLowerCase()
  } catch {
    return true
  }
}

const MAX_ENTRIES = 50_000
const MAX_DEPTH = 32
const MAX_SCRIPT_BYTES = 1024 * 1024

const STAGING_DIR = '.download-nexus'
const LEGACY_STAGING_DIR = '.conductor'
const LEGACY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createStagingDir(saveDir, engine) {
  const dir = path.join(saveDir, STAGING_DIR, 'staging', `${engine}-${randomUUID()}`)
  assertInside(saveDir, dir)
  fs.mkdirSync(dir, { recursive: true })
  return assertInside(saveDir, dir)
}

/**
 * Walk a downloaded tree without following links. A link/junction is a
 * violation by itself; the caller deletes the whole staging dir on violation,
 * never the link target.
 */
export function scanTree(dir, { extSet = TREE_EXEC_EXT, maxEntries = MAX_ENTRIES, maxDepth = MAX_DEPTH } = {}) {
  const violations = []
  let entries = 0
  const rootStat = fs.lstatSync(dir)
  if (isLinkLike(dir, rootStat)) return { entries, violations: [{ path: dir, reason: 'link' }] }
  if (!rootStat.isDirectory()) throw new ConductorError('E_IO', `扫描目标不是目录：${dir}`)

  function walk(current, depth) {
    if (depth > maxDepth) {
      throw new ConductorError('E_IO', `下载目录层级超过 ${maxDepth}：${current}`)
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      entries += 1
      if (entries > maxEntries) {
        throw new ConductorError('E_IO', `下载目录条目超过 ${maxEntries}：${current}`)
      }
      const child = path.join(current, entry.name)
      const stat = fs.lstatSync(child)
      if (isLinkLike(child, stat)) {
        violations.push({ path: child, reason: 'link' })
        continue
      }
      if (stat.isDirectory()) {
        walk(child, depth + 1)
        continue
      }
      if (stat.isFile() && extSet.has(path.extname(entry.name).toLowerCase())) {
        violations.push({ path: child, reason: 'ext' })
      }
    }
  }

  walk(dir, 0)
  return { entries, violations }
}

/** Delete a tree without following symlinks/junctions. Never touches a target. */
export function removeTreeNoFollow(target) {
  let stat
  try {
    stat = fs.lstatSync(target)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  if (isLinkLike(target, stat)) {
    try {
      fs.unlinkSync(target)
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EISDIR') fs.rmdirSync(target)
      else throw error
    }
    return
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) removeTreeNoFollow(path.join(target, entry))
    fs.rmdirSync(target)
    return
  }
  fs.unlinkSync(target)
}

export function measureTree(dir, { maxEntries = MAX_ENTRIES, maxDepth = MAX_DEPTH } = {}) {
  let bytes = 0
  let entries = 0
  const rootStat = fs.lstatSync(dir)
  if (isLinkLike(dir, rootStat)) throw new ConductorError('E_TARGET', `下载目录是链接：${dir}`)
  if (!rootStat.isDirectory()) throw new ConductorError('E_IO', `测量目标不是目录：${dir}`)
  function walk(current, depth) {
    if (depth > maxDepth) throw new ConductorError('E_IO', `下载目录层级超过 ${maxDepth}：${current}`)
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      entries += 1
      if (entries > maxEntries) throw new ConductorError('E_IO', `下载目录条目超过 ${maxEntries}：${current}`)
      const child = path.join(current, entry.name)
      const stat = fs.lstatSync(child)
      if (isLinkLike(child, stat)) throw new ConductorError('E_TARGET', `下载目录包含链接：${child}`)
      if (stat.isDirectory()) {
        walk(child, depth + 1)
        continue
      }
      if (stat.isFile()) bytes += stat.size
    }
  }
  walk(dir, 0)
  return { bytes, entries }
}

function sweepRoot(root, { ttlMs, now }) {
  let entries
  try {
    entries = fs.readdirSync(root)
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }
  let removed = 0
  for (const name of entries) {
    if (!/^(motrix|direct|ytdlp|hf)-[0-9a-f-]{36}$/i.test(name)) continue
    const target = path.join(root, name)
    let stat
    try {
      stat = fs.lstatSync(target)
    } catch {
      continue
    }
    const stale = isLinkLike(target, stat) || (stat.isDirectory() && now - stat.mtimeMs > ttlMs)
    if (!stale) continue
    try {
      removeTreeNoFollow(target)
      removed += 1
    } catch {
      // Best effort; another task may still hold a handle.
    }
  }
  return removed
}

/** Remove stale staging trees only; never follows links/junctions. */
export function sweepStaging(saveDir, { ttlMs = 24 * 60 * 60 * 1000, now = Date.now() } = {}) {
  const removed = sweepRoot(path.join(saveDir, STAGING_DIR, 'staging'), { ttlMs, now })
  // Old layouts may still belong to a running pre-rename task. Give them a
  // much longer grace period and ignore them entirely when still fresh.
  const legacyRemoved = sweepRoot(path.join(saveDir, LEGACY_STAGING_DIR, 'staging'), {
    ttlMs: Math.max(ttlMs, LEGACY_TTL_MS),
    now,
  })
  return { removed: removed + legacyRemoved, legacyRemoved }
}

export function moveFileNoOverwrite(src, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true })
  for (let i = 0; i < 50; i += 1) {
    const target = chooseTargetPath(dstDir, path.basename(src))
    try {
      fs.linkSync(src, target)
      fs.unlinkSync(src)
      return target
    } catch (error) {
      if (error.code === 'EEXIST') continue
      if (error.code === 'EPERM' || error.code === 'ENOSYS' || error.code === 'EXDEV' || error.code === 'EACCES') {
        try {
          fs.copyFileSync(src, target, fs.constants.COPYFILE_EXCL)
          fs.unlinkSync(src)
          return target
        } catch (copyError) {
          if (copyError.code === 'EEXIST') continue
          throw copyError
        }
      }
      throw error
    }
  }
  throw new ConductorError('E_IO', `无法为 ${path.basename(src)} 找到不冲突的目标名`)
}

export function moveTreeNoOverwrite(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const stat = fs.lstatSync(src)
    if (stat.isSymbolicLink()) {
      throw new ConductorError('E_TARGET', `拒绝移动符号链接：${src}`)
    }
    if (stat.isDirectory()) {
      moveTreeNoOverwrite(src, path.join(dstDir, entry.name))
      continue
    }
    moveFileNoOverwrite(src, dstDir)
  }
  return dstDir
}

export function readTextFileBounded(file, { maxBytes = MAX_SCRIPT_BYTES } = {}) {
  const stat = fs.statSync(file)
  if (!stat.isFile()) throw new ConductorError('E_TARGET', `不是普通文件：${file}`)
  if (stat.size > maxBytes) {
    throw new ConductorError('E_TARGET', `文件超过 ${maxBytes} 字节：${file}`)
  }
  const text = fs.readFileSync(file, 'utf8')
  if (text.includes('\u0000')) throw new ConductorError('E_TARGET', `文件含 NUL：${file}`)
  return text
}
