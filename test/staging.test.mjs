import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createStagingDir,
  moveFileNoOverwrite,
  moveTreeNoOverwrite,
  readTextFileBounded,
  measureTree,
  removeTreeNoFollow,
  scanTree,
  sweepStaging,
} from '../lib/staging.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-staging-'))

test('scanTree flags Windows double-click types but allows code assets', () => {
  const dir = createStagingDir(tmp, 'test')
  fs.mkdirSync(path.join(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'src', 'index.js'), 'console.log(1)')
  fs.writeFileSync(path.join(dir, 'README.md'), '# hi')
  const clean = scanTree(dir)
  assert.deepEqual(clean.violations, [])
  fs.writeFileSync(path.join(dir, 'run.exe'), 'MZ')
  const dirty = scanTree(dir)
  assert.equal(dirty.violations.length, 1)
  assert.equal(dirty.violations[0].reason, 'ext')
})

test('removeTreeNoFollow deletes a link, never its target', (t) => {
  const dir = createStagingDir(tmp, 'links')
  const target = path.join(tmp, 'outside.txt')
  fs.writeFileSync(target, 'keep me')
  try {
    fs.symlinkSync(target, path.join(dir, 'link.txt'))
  } catch {
    t.skip('symlink creation is not permitted on this host')
    return
  }
  const scan = scanTree(dir)
  assert.equal(scan.violations[0].reason, 'link')
  removeTreeNoFollow(dir)
  assert.equal(fs.existsSync(target), true)
  assert.equal(fs.existsSync(dir), false)
})

test('moveFileNoOverwrite chooses a new name instead of overwriting', () => {
  const src = path.join(tmp, 'same.bin')
  const dst = path.join(tmp, 'dst')
  fs.mkdirSync(dst, { recursive: true })
  fs.writeFileSync(src, 'one')
  const first = moveFileNoOverwrite(src, dst)
  fs.writeFileSync(src, 'two')
  const second = moveFileNoOverwrite(src, dst)
  assert.notEqual(first, second)
  assert.equal(fs.readFileSync(first, 'utf8'), 'one')
  assert.equal(fs.readFileSync(second, 'utf8'), 'two')
})

test('moveTreeNoOverwrite preserves nested files', () => {
  const src = path.join(tmp, 'tree-src')
  const dst = path.join(tmp, 'tree-dst')
  fs.mkdirSync(path.join(src, 'nested'), { recursive: true })
  fs.writeFileSync(path.join(src, 'nested', 'a.txt'), 'a')
  moveTreeNoOverwrite(src, dst)
  assert.equal(fs.readFileSync(path.join(dst, 'nested', 'a.txt'), 'utf8'), 'a')
})

test('readTextFileBounded rejects oversize and NUL files', () => {
  const big = path.join(tmp, 'big.txt')
  fs.writeFileSync(big, 'x'.repeat(1024 * 1024 + 1))
  assert.throws(() => readTextFileBounded(big), (error) => error.code === 'E_TARGET')
  const nul = path.join(tmp, 'nul.txt')
  fs.writeFileSync(nul, 'a\u0000b')
  assert.throws(() => readTextFileBounded(nul), (error) => error.code === 'E_TARGET')
})

test('measureTree sums file bytes and counts entries', () => {
  const dir = createStagingDir(tmp, 'measure')
  fs.writeFileSync(path.join(dir, 'a.bin'), '12345')
  fs.mkdirSync(path.join(dir, 'nested'))
  fs.writeFileSync(path.join(dir, 'nested', 'b.bin'), '678')
  assert.deepEqual(measureTree(dir), { bytes: 8, entries: 3 })
})

test('sweepStaging removes only stale engine staging trees', () => {
  const root = path.join(tmp, '.download-nexus', 'staging')
  const oldDir = path.join(root, 'ytdlp-11111111-1111-4111-8111-111111111111')
  const freshDir = path.join(root, 'hf-22222222-2222-4222-8222-222222222222')
  fs.mkdirSync(oldDir, { recursive: true })
  fs.mkdirSync(freshDir, { recursive: true })
  fs.writeFileSync(path.join(oldDir, 'old.bin'), 'old')
  fs.writeFileSync(path.join(freshDir, 'fresh.bin'), 'fresh')
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(oldDir, old, old)
  const result = sweepStaging(tmp, { ttlMs: 1000 })
  assert.equal(result.removed, 1)
  assert.equal(fs.existsSync(oldDir), false)
  assert.equal(fs.existsSync(freshDir), true)
})

test('detects a Windows directory junction and never deletes its target', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows junction test')
    return
  }
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-junction-target-'))
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep')
  const dir = createStagingDir(tmp, 'junction')
  const link = path.join(dir, 'escape')
  try {
    fs.symlinkSync(outside, link, 'junction')
  } catch (error) {
    fs.rmSync(outside, { recursive: true, force: true })
    t.skip(`junction creation not permitted: ${error.code}`)
    return
  }
  try {
    const scan = scanTree(dir)
    assert.equal(scan.violations.length, 1)
    assert.equal(scan.violations[0].reason, 'link')
    assert.throws(() => measureTree(dir), (error) => error.code === 'E_TARGET')
    removeTreeNoFollow(dir)
    assert.equal(fs.existsSync(path.join(outside, 'keep.txt')), true)
    assert.equal(fs.existsSync(dir), false)
  } finally {
    fs.rmSync(outside, { recursive: true, force: true })
  }
})
