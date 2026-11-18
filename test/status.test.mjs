import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { Config } from '../lib/schema.mjs'
import { loadConfig } from '../lib/config.mjs'
import { createStatusService } from '../lib/status.mjs'
import { createStatusRoute } from '../lib/status-route.mjs'

test('Config exposes 23 fields with the 14 editable fields volatile', () => {
  const value = Config({})
  const keys = Object.keys(value)
  assert.equal(keys.length, 23)
  assert.equal(typeof value.connections?.get, 'function')
  assert.equal(value.allowShell, false)
  assert.equal(value.allowExecutable, false)
  assert.equal(value.guardFailClosed, true)
  assert.equal(value.autoStartMotrix, false)
  assert.equal(value.toolPrefix, '')
  assert.equal(value.defaultSaveDir.get(), 'C:\\Users\\97292\\Downloads')
})

test('legacy string numbers survive unwrap and loadConfig', () => {
  const config = Config({ connections: '8' })
  const cfg = loadConfig(config, { cwd: process.cwd(), env: {} })
  assert.equal(cfg.connections, 8)
  assert.equal(cfg.allowShell, false)
  assert.equal(cfg.allowExecutable, false)
  assert.equal(cfg.autoStartMotrix, false)
})

test('legacy semicolon proxyCandidates migrate to a number array', () => {
  const cfg = loadConfig({ proxyCandidates: '7890;31181' }, { cwd: process.cwd(), env: {} })
  assert.deepEqual(cfg.proxyCandidates, [7890, 31181])
})

const fakeConductor = {
  netPolicy: {
    async assertUrlAllowed(url) {
      if (String(url).includes('127.0.0.1')) {
        const error = new Error('目标地址不允许（回环/私网/链路本地/保留地址）')
        error.code = 'E_TARGET'
        throw error
      }
      return { url, addresses: ['93.184.216.34'] }
    },
  },
  async probeAll() {
    return {
      motrix: { available: false, detail: 'ECONNREFUSED' },
      direct: { available: true, detail: '内置直连' },
      ytdlp: { available: true, detail: '2026.10.26' },
      hf: { available: false, detail: 'hf not found' },
    }
  },
  async doctor() {
    return {
      ok: true,
      version: '0.1.6',
      allowed_roots: ['C:\\\\Users\\\\97292\\\\Downloads'],
      engines: {
        motrix: { available: false, detail: 'ECONNREFUSED' },
        direct: { available: true, detail: '内置直连' },
        ytdlp: { available: true, detail: '2026.10.26' },
        hf: { available: false, detail: 'hf not found' },
      },
      accel: { proxy: 'http://127.0.0.1:7890', source: 'env' },
      motrix: { connected: false, port: 16802, endpointFile: 'C:\\\\Users\\\\97292\\\\AppData\\\\Roaming\\\\Motrix\\\\bridge\\\\endpoint.json', error: 'ECONNREFUSED' },
    }
  },
}

const cfg = loadConfig({}, { cwd: process.cwd(), env: {} })

test('status snapshot is JSON-safe and does not include tasks, tokens or userinfo', async () => {
  const status = createStatusService({ cfg, conductor: fakeConductor, tools: [{ name: 'download' }] })
  const snapshot = await status.snapshot()
  assert.equal(snapshot.plugin.name, 'dsh-download-nexus')
  assert.match(snapshot.plugin.version, /^\d+\.\d+\.\d+$/)
  assert.deepEqual(snapshot.plugin.tools, ['download'])
  assert.equal(snapshot.runtime.session_tasks, null)
  assert.equal(snapshot.config.allowShell, false)
  assert.equal(snapshot.config.autoStartMotrix, false)
  const json = JSON.stringify(snapshot)
  assert.ok(!json.includes('localToken'))
  assert.ok(!json.includes('sessionId'))
  assert.ok(!json.includes('task_ref'))
})

test('status probe stamps at and force is passed through', async () => {
  let seen
  const status = createStatusService({
    cfg,
    conductor: {
      ...fakeConductor,
      async probeAll(options) {
        seen = options
        return { motrix: { available: false, detail: 'ECONNREFUSED' } }
      },
    },
    tools: [],
  })
  const result = await status.probe(['motrix'], { force: true })
  assert.equal(seen.force, true)
  assert.equal(result.engines.motrix.available, false)
  assert.match(result.engines.motrix.at, /^\d{4}-/)
})

test('status diagnose exposes basename only and no token', async () => {
  const status = createStatusService({ cfg, conductor: fakeConductor, tools: [] })
  const result = await status.diagnose({ verbose: true })
  assert.equal(result.motrix.endpoint_file, 'endpoint.json')
  assert.ok(!JSON.stringify(result).includes('localToken'))
  assert.ok(result.checks.some((check) => check.id === 'proxy' && check.status === 'pass'))
})

test('status checkUrl converts a policy throw to a JSON result', async () => {
  const status = createStatusService({ cfg, conductor: fakeConductor, tools: [] })
  const result = await status.checkUrl('http://127.0.0.1:16802/mdxp')
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'E_TARGET')
})

test('status validateRoot returns the normalized path and checks', async () => {
  const status = createStatusService({ cfg, conductor: fakeConductor, tools: [] })
  const result = await status.validateRoot(os.tmpdir())
  assert.equal(result.ok, true)
  assert.ok(result.normalized)
  assert.ok(Array.isArray(result.checks))
})

test('status route serves snapshot and rejects unknown operations', async () => {
  const status = createStatusService({ cfg, conductor: fakeConductor, tools: [] })
  const response = () => ({
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value },
    end(body) { this.body = body },
  })

  const denied = createStatusRoute({
    status,
    authenticate: () => ({ ok: false, status: 401, code: 'E_AUTH', message: '未授权' }),
  })
  const unauthorized = response()
  await denied({ method: 'GET', url: '/api/dsh-download-nexus/status?op=snapshot', headers: {} }, unauthorized)
  assert.equal(unauthorized.statusCode, 401)

  const handler = createStatusRoute({
    status,
    authenticate: () => ({ ok: true }),
  })

  const ok = response()
  await handler({ method: 'GET', url: '/api/dsh-download-nexus/status?op=snapshot', headers: {} }, ok)
  assert.equal(ok.statusCode, 200)
  assert.equal(JSON.parse(ok.body).ok, true)

  const bad = response()
  await handler({ method: 'GET', url: '/api/dsh-download-nexus/status?op=nope', headers: {} }, bad)
  assert.equal(bad.statusCode, 400)

  const method = response()
  await handler({ method: 'POST', url: '/api/dsh-download-nexus/status', headers: {} }, method)
  assert.equal(method.statusCode, 405)
})

test('probe maps explicit reasons to the five UI states', async () => {
  const status = createStatusService({
    cfg,
    conductor: {
      ...fakeConductor,
      async probeAll() {
        return {
          motrix: { available: false, reason: 'connect-refused', detail: 'ECONNREFUSED' },
          direct: { available: true, detail: 'ok' },
          ytdlp: { available: false, reason: 'cli-missing', detail: 'ENOENT' },
          hf: { available: false, reason: 'timeout', detail: 'timed out' },
        }
      },
    },
    tools: [],
  })
  const result = await status.probe(['all'])
  assert.equal(result.engines.motrix.state, 'not-running')
  assert.equal(result.engines.direct.state, 'ready')
  assert.equal(result.engines.ytdlp.state, 'not-installed')
  assert.equal(result.engines.hf.state, 'failed')
})

test('bridge-missing is unknown, not a confirmed not-running state', async () => {
  const status = createStatusService({
    cfg,
    conductor: { ...fakeConductor, async probeAll() { return { motrix: { available: false, reason: 'bridge-missing', detail: 'endpoint.json missing' } } } },
    tools: [],
  })
  const result = await status.probe(['motrix'])
  assert.equal(result.engines.motrix.state, 'failed')
})
