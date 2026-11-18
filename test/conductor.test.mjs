import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createConductor } from '../lib/conductor.mjs'
import { loadConfig } from '../lib/config.mjs'
import { createNetPolicy } from '../lib/net-policy.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-core-'))
const cfg = loadConfig(
  { defaultSaveDir: tmp, allowedRoots: [tmp], proxyCandidates: [] },
  { cwd: tmp, env: {} },
)

const baseTask = {
  taskId: 'abc',
  type: 'url',
  name: 'a.bin',
  status: 'downloading',
  progress: 10,
  bytesDone: 10,
  bytesTotal: 100,
  speedBps: 5,
  etaSec: 18,
  saveDir: tmp,
  finalPath: '',
  error: '',
  errorCode: '',
}

function makeEngine(overrides = {}) {
  return {
    async probe() {
      return { available: true, detail: 'fake' }
    },
    async submit() {
      return { nativeId: 'abc', task: baseTask }
    },
    async status() {
      return { ...baseTask, status: 'completed', progress: 100, bytesDone: 100, finalPath: path.join(tmp, 'a.bin') }
    },
    async waitFor() {
      return { task: { ...baseTask, status: 'completed', progress: 100 }, timedOut: false }
    },
    async control() {},
    async info() {
      return { connected: true, port: 16802 }
    },
    async stats() {
      return { totalDownloadSpeed: 0, totalUploadSpeed: 0, activeTasks: 0, waitingTasks: 0, stoppedTasks: 0 }
    },
    ...overrides,
  }
}

const execA = { agent: { id: 'session-a' } }
const execB = { agent: { id: 'session-b' } }
const fakeNetPolicy = {
  async assertRemoteTargetAllowed() {
    return { binding: 'pinned-direct', verifiable: true, fakeIp: false }
  },
  async assertUrlAllowed() {
    return { addresses: [], url: '' }
  },
}

function build(overrides = {}, {
  netPolicy: policy = fakeNetPolicy,
  probeContentLength = async () => null,
  probeHfMetadata,
  queue,
  watchdog,
} = {}) {
  const calls = []
  const engines = {
    motrix: makeEngine({
      async submit(params) {
        calls.push(params)
        return { nativeId: 'abc', task: baseTask }
      },
    }),
    direct: makeEngine(),
    ytdlp: makeEngine(),
    hf: makeEngine(),
    ...overrides,
  }
  return {
    conductor: createConductor({
      cfg,
      env: {},
      homeDir: tmp,
      engines,
      netPolicy: policy,
      probeContentLength,
      probeHfMetadata,
      queue,
      watchdog,
    }),
    calls,
  }
}

test('download routes a generic URL to Motrix, issues a ref and returns snake_case fields', async () => {
  const { conductor, calls } = build()
  const result = await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp, wait_seconds: 0 }, execA)
  assert.equal(result.ok, true)
  assert.equal(result.engine, 'motrix')
  assert.equal(result.task_ref, 'motrix:abc')
  assert.equal(result.task.status, 'downloading')
  assert.equal(result.task.bytes_done, 10)
  assert.equal(result.task.bytes_total, 100)
  assert.equal(result.task.speed_bps, 5)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].saveDir, fs.realpathSync.native(tmp))
  assert.equal(calls[0].connections, 16)
})

test('github_mirror is opt-in and only rewrites the submitted URL', async () => {
  const { conductor, calls } = build()
  const original = 'https://github.com/o/r/releases/download/v1/a.zip'
  const result = await conductor.download({ url: original, save_dir: tmp, github_mirror: true }, execA)
  assert.equal(result.ok, true)
  assert.equal(result.mirror.applied, true)
  assert.equal(result.mirror.original_url, original)
  assert.equal(result.mirror.download_url, `https://ghfast.top/${original}`)
  assert.equal(calls[0].target.url, `https://ghfast.top/${original}`)
  assert.equal(calls[0].target.originalUrl, original)
  assert.match(result.reason, /GitHub 镜像/)
})

test('github_mirror strips authorization, cookie and referer before the third party', async () => {
  const { conductor, calls } = build()
  await conductor.download(
    {
      url: 'https://github.com/o/r/releases/download/v1/a.zip',
      save_dir: tmp,
      github_mirror: true,
      headers: {
        authorization: 'Bearer secret',
        cookie: 'session=1',
        referer: 'https://github.com/',
        accept: 'application/zip',
      },
    },
    execA,
  )
  assert.equal(calls[0].headers.authorization, undefined)
  assert.equal(calls[0].headers.cookie, undefined)
  assert.equal(calls[0].headers.referer, undefined)
  assert.equal(calls[0].headers.accept, 'application/zip')
})

test('github_mirror stays off by default', async () => {
  const { conductor, calls } = build()
  const original = 'https://github.com/o/r/releases/download/v1/a.zip'
  const result = await conductor.download({ url: original, save_dir: tmp }, execA)
  assert.equal(result.mirror.applied, false)
  assert.equal(calls[0].target.url, original)
})

test('download rejects loopback and private targets before the engine sees them', async () => {
  const { conductor, calls } = build({}, { netPolicy: createNetPolicy() })
  for (const args of [
    { url: 'http://127.0.0.1:8080/a', save_dir: tmp },
    { url: 'http://10.0.0.5/a', save_dir: tmp },
    { url: 'ftp://127.0.0.1/a', save_dir: tmp, engine: 'motrix' },
  ]) {
    await assert.rejects(conductor.download(args, execA), (error) => error.code === 'E_TARGET', args.url)
  }
  assert.equal(calls.length, 0)
})

test('status reads the engine and updates the registry', async () => {
  const { conductor } = build()
  await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp }, execA)
  const result = await conductor.status({ task_ref: 'motrix:abc' }, execA)
  assert.equal(result.ok, true)
  assert.equal(result.task.status, 'completed')
  assert.equal(result.task.final_path, path.join(tmp, 'a.bin'))
  assert.equal(result.task_ref, 'motrix:abc')
})

test('status without a ref lists only this session', async () => {
  const { conductor } = build()
  await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp }, execA)
  const result = await conductor.status({}, execA)
  assert.equal(result.ok, true)
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].task_ref, 'motrix:abc')
})

test('control rejects a foreign ref and requires confirmation for purge', async () => {
  const { conductor } = build()
  await assert.rejects(conductor.control({ task_ref: 'motrix:other', action: 'pause' }, execA), (error) => error.code === 'E_NOT_FOUND')
  await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp }, execA)
  await assert.rejects(conductor.control({ task_ref: 'motrix:abc', action: 'purge' }, execA), (error) => error.code === 'E_NEED_INPUT')
  const paused = await conductor.control({ task_ref: 'motrix:abc', action: 'pause' }, execA)
  assert.equal(paused.ok, true)
  await assert.rejects(conductor.control({ task_ref: 'motrix:abc', action: 'pause' }, execB), (error) => error.code === 'E_NOT_FOUND')
})

test('doctor reports engines and accel without downloading', async () => {
  const { conductor } = build()
  const report = await conductor.doctor({})
  assert.equal(report.ok, true)
  assert.match(report.version, /^\d+\.\d+\.\d+$/)
  assert.equal(report.engines.motrix.available, true)
  assert.equal(report.engines.direct.available, true)
  assert.equal(report.motrix.connected, true)
  assert.ok(report.accel.proxy === null || /^http:\/\/127\.0\.0\.1:\d+$/.test(report.accel.proxy))
  assert.equal(report.github_mirror.default_enabled, false)
  assert.equal(report.package_managers.pip.classification, 'default')
  assert.equal(report.package_managers.npm.classification, 'default')
  assert.equal(report.package_managers.cargo.classification, 'default')
})

test('motrix preflight rejects a declared oversize before submit', async () => {
  const { conductor, calls } = build({}, { probeContentLength: async () => Number.MAX_SAFE_INTEGER })
  await assert.rejects(
    conductor.download({ url: 'https://example.com/big.bin', save_dir: tmp }, execA),
    (error) => error.code === 'E_IO' && error.info?.stage === 'preflight',
  )
  assert.equal(calls.length, 0)
})

test('motrix preflight failure is fail-open and submit still runs', async () => {
  const { conductor, calls } = build({}, { probeContentLength: async () => null })
  const result = await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp }, execA)
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(result.ssrf.binding, 'engine-managed')
  assert.equal(result.ssrf.verifiable, false)
})
