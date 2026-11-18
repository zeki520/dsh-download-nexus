import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DEFAULT_CONFIG, loadConfig, toolName } from '../lib/config.mjs'

const cwd = path.resolve('F:\\dsh插件工作区\\dsh-download-nexus')

test('defaults are safe: tool prefix empty and auto-start off', () => {
  const cfg = loadConfig({}, { cwd, env: {} })
  assert.equal(cfg.toolPrefix, '')
  assert.equal(cfg.autoStartMotrix, false)
  assert.equal(cfg.allowExecutable, false)
  assert.equal(cfg.allowShell, false)
  assert.equal(cfg.connections, DEFAULT_CONFIG.connections)
  assert.equal(cfg.maxBytes, DEFAULT_CONFIG.maxBytes)
})

test('prefix and tool names stay in sync', () => {
  const cfg = loadConfig({ toolPrefix: 'conductor_' }, { cwd, env: {} })
  assert.equal(toolName(cfg, 'download'), 'conductor_download')
  assert.equal(toolName(cfg, 'download_status'), 'conductor_download_status')
  assert.equal(toolName(loadConfig({}, { cwd, env: {} }), 'download'), 'download')
})

test('DSH_DOWNLOAD_ALLOW_SHELL=1 is the documented escape hatch', () => {
  assert.equal(loadConfig({}, { cwd, env: {} }).allowShell, false)
  assert.equal(loadConfig({}, { cwd, env: { DSH_DOWNLOAD_ALLOW_SHELL: '1' } }).allowShell, true)
})

test('allowed roots are absolute, include the default dir and are deduplicated', () => {
  const cfg = loadConfig(
    { defaultSaveDir: 'out', allowedRoots: ['out', 'F:\\dsh插件工作区'] },
    { cwd, env: {} },
  )
  assert.ok(cfg.allowedRoots.includes(path.join(cwd, 'out')))
  assert.ok(cfg.allowedRoots.includes(path.resolve('F:\\dsh插件工作区')))
  assert.equal(new Set(cfg.allowedRoots).size, cfg.allowedRoots.length)
})

test('invalid numbers fall back instead of producing NaN', () => {
  const cfg = loadConfig(
    { connections: 'many', maxBytes: 0, requestTimeoutMs: -1, pollMs: 1.5, maxWaitSeconds: null },
    { cwd, env: {} },
  )
  assert.equal(cfg.connections, DEFAULT_CONFIG.connections)
  assert.equal(cfg.maxBytes, DEFAULT_CONFIG.maxBytes)
  assert.equal(cfg.requestTimeoutMs, DEFAULT_CONFIG.requestTimeoutMs)
  assert.equal(cfg.pollMs, DEFAULT_CONFIG.pollMs)
  assert.equal(cfg.maxWaitSeconds, DEFAULT_CONFIG.maxWaitSeconds)
})

test('autoStartMotrix cannot be turned on by config', () => {
  assert.equal(loadConfig({ autoStartMotrix: true }, { cwd, env: {} }).autoStartMotrix, false)
})

test('security switches default off and have explicit env opt-ins', () => {
  assert.equal(loadConfig({}, { cwd, env: {} }).guardFailClosed, true)
  assert.equal(loadConfig({}, { cwd, env: {} }).allowBrowserCookies, false)
  assert.equal(
    loadConfig({}, { cwd, env: { DSH_DOWNLOAD_ALLOW_BROWSER_COOKIES: '1' } }).allowBrowserCookies,
    true,
  )
  assert.equal(loadConfig({ guardFailClosed: false }, { cwd, env: {} }).guardFailClosed, false)
})
