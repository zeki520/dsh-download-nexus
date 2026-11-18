import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTarget } from '../lib/classify.mjs'
import { applyGithubMirror, normalizeGithubMirrorBase } from '../lib/mirror.mjs'

const BASE = 'https://ghfast.top/'
const release = 'https://github.com/o/r/releases/download/v1/a.zip'

test('mirror is off unless explicitly enabled', () => {
  const target = classifyTarget(release)
  const result = applyGithubMirror(target, { enabled: false, base: BASE })
  assert.equal(result.applied, false)
  assert.equal(result.target, target)
})

test('mirrors a GitHub release asset without touching the original URL', () => {
  const target = classifyTarget(release)
  const result = applyGithubMirror(target, { enabled: true, base: BASE })
  assert.equal(result.applied, true)
  assert.equal(result.base, BASE)
  assert.equal(result.target.url, `${BASE}${release}`)
  assert.equal(result.target.originalUrl, release)
  assert.equal(target.url, release)
})

test('mirrors raw and codeload hosts, but not signed CDN or gist hosts', () => {
  const raw = classifyTarget('https://raw.githubusercontent.com/o/r/main/a.txt')
  assert.equal(applyGithubMirror(raw, { enabled: true, base: BASE }).applied, true)
  const codeload = classifyTarget('https://codeload.github.com/o/r/zip/refs/heads/main')
  assert.equal(applyGithubMirror(codeload, { enabled: true, base: BASE }).applied, true)
  const cdn = classifyTarget('https://objects.githubusercontent.com/abc/a.zip')
  assert.equal(applyGithubMirror(cdn, { enabled: true, base: BASE }).applied, false)
  const gist = classifyTarget('https://gist.githubusercontent.com/u/id/raw/a.txt')
  assert.equal(applyGithubMirror(gist, { enabled: true, base: BASE }).applied, false)
})

test('does not mirror non-GitHub targets or an already mirrored URL', () => {
  const generic = classifyTarget('https://example.com/a.zip')
  assert.equal(applyGithubMirror(generic, { enabled: true, base: BASE }).applied, false)
  const already = classifyTarget(`${BASE}${release}`)
  assert.equal(applyGithubMirror(already, { enabled: true, base: BASE }).applied, false)
})

test('rejects unsafe mirror bases', () => {
  assert.throws(() => normalizeGithubMirrorBase('http://ghfast.top/'), (error) => error.code === 'E_TARGET')
  assert.throws(() => normalizeGithubMirrorBase('https://u:p@ghfast.top/'), (error) => error.code === 'E_TARGET')
  assert.throws(() => normalizeGithubMirrorBase('not a url'), (error) => error.code === 'E_TARGET')
  assert.equal(normalizeGithubMirrorBase('https://ghfast.top'), 'https://ghfast.top/')
  assert.equal(normalizeGithubMirrorBase('https://ghfast.top/gh/'), 'https://ghfast.top/gh/')
})
