import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  assertSafeDir,
  assertSafeFilename,
  chooseTargetPath,
  ensureDir,
  filenameFromDisposition,
  filenameFromUrl,
  formatBytes,
} from '../lib/paths.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-paths-'))
const cfg = { cwd: tmp, defaultSaveDir: tmp, allowedRoots: [tmp] }

test('assertSafeDir accepts the configured root and a child directory', () => {
  assert.equal(assertSafeDir(tmp, cfg).dir, fs.realpathSync.native(tmp))
  const child = path.join(tmp, 'a', 'b')
  assert.equal(assertSafeDir(child, cfg).dir, path.join(fs.realpathSync.native(tmp), 'a', 'b'))
})

test('assertSafeDir rejects empty, outside, UNC, device and ADS paths', () => {
  const cases = ['', 'C:\\Windows\\System32', '\\\\server\\share\\x', '\\\\?\\C:\\temp', path.join(tmp, 'a:b'), 'C:temp']
  for (const value of cases) {
    assert.throws(() => assertSafeDir(value, cfg), (error) => error.code === 'E_SAVE_DIR', value)
  }
})

test('ensureDir creates nested directories and returns a real path', () => {
  const dir = path.join(tmp, 'nested', 'deep')
  const real = ensureDir(dir)
  assert.ok(fs.statSync(real).isDirectory())
  assert.equal(real, fs.realpathSync.native(dir))
})

test('assertSafeFilename strips traversal and rejects executables by default', () => {
  assert.equal(assertSafeFilename('..\\..\\pwn.exe', { allowExecutable: true }), 'pwn.exe')
  assert.throws(() => assertSafeFilename('pwn.exe'), (error) => error.code === 'E_EXEC_EXT')
  assert.equal(assertSafeFilename('报告 2026.pdf'), '报告 2026.pdf')
  assert.equal(assertSafeFilename('CON.txt'), '_CON.txt')
  assert.equal(assertSafeFilename('a<b>c.txt'), 'a_b_c.txt')
})

test('filenameFromDisposition prefers RFC 5987 and recovers UTF-8', () => {
  assert.equal(
    filenameFromDisposition("attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A%202026.pdf"),
    '报告 2026.pdf',
  )
  assert.equal(filenameFromDisposition('attachment; filename="报告 2026.pdf"'), '报告 2026.pdf')
  assert.equal(filenameFromDisposition('attachment; filename="plain.bin"'), 'plain.bin')
  assert.equal(filenameFromDisposition(''), '')
})

test('filenameFromUrl decodes the basename', () => {
  assert.equal(filenameFromUrl('https://example.com/a/%E6%8A%A5%E5%91%8A.pdf?x=1'), '报告.pdf')
  assert.equal(filenameFromUrl('https://example.com/'), '')
})

test('chooseTargetPath never returns an existing path', () => {
  const dir = path.join(tmp, 'targets')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'a.bin'), 'x')
  const picked = chooseTargetPath(dir, 'a.bin')
  assert.equal(path.basename(picked), 'a (1).bin')
  assert.equal(fs.existsSync(picked), false)
})

test('formatBytes is stable for the UI', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(-1), '未知')
})
