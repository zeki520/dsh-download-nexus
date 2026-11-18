import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createConductor } from '../lib/conductor.mjs'
import { loadConfig } from '../lib/config.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-limits-'))
const cfg = loadConfig(
  { defaultSaveDir: tmp, allowedRoots: [tmp], proxyCandidates: [] },
  { cwd: tmp, env: {} },
)
const exec = { agent: { id: 'limits-session' } }
const task = {
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
const netPolicy = {
  async assertRemoteTargetAllowed() {
    return { binding: 'pinned-direct', verifiable: true, fakeIp: false }
  },
  async assertUrlAllowed() {
    return { addresses: [], url: '' }
  },
}

function engine(overrides = {}) {
  return {
    async probe() { return { available: true, detail: 'fake' } },
    async submit() { return { nativeId: 'abc', task } },
    async status() { return { ...task, status: 'completed', progress: 100, finalPath: path.join(tmp, 'a.bin') } },
    async waitFor() { return { task: { ...task, status: 'completed', progress: 100 }, timedOut: false } },
    async control() {},
    async info() { return { connected: true, port: 16802 } },
    ...overrides,
  }
}

function lease() {
  let released = 0
  return { get released() { return released }, release() { released += 1 } }
}

function build({ hf = engine(), queue, watchdog, probeHfMetadata } = {}) {
  return createConductor({
    cfg,
    env: {},
    homeDir: tmp,
    netPolicy,
    engines: { motrix: engine(), direct: engine(), ytdlp: engine(), hf },
    queue,
    watchdog,
    probeHfMetadata,
    probeContentLength: async () => null,
  })
}

test('download acquires one queue lease and releases it when the wait is terminal', async () => {
  const l = lease()
  const q = { acquired: 0, async acquire() { this.acquired += 1; return l } }
  const conductor = build({ queue: q })
  const result = await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp, wait_seconds: 1 }, exec)
  assert.equal(result.task.status, 'completed')
  assert.equal(q.acquired, 1)
  assert.equal(l.released, 1)
})

test('download with wait_seconds=0 hands the lease to the watchdog', async () => {
  const l = lease()
  const tracks = []
  const q = { async acquire() { return l } }
  const wd = {
    track(entry) { tracks.push(entry); return true },
    stop() { return true },
    closeAll() {},
  }
  const conductor = build({ queue: q, watchdog: wd })
  await conductor.download({ url: 'https://example.com/a.bin', save_dir: tmp, wait_seconds: 0 }, exec)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].ref, 'motrix:abc')
  assert.equal(l.released, 0)
})

test('HF metadata over-limit is rejected before submit', async () => {
  let submits = 0
  const hf = engine({ async submit() { submits += 1; return { nativeId: 'abc', task } } })
  const conductor = build({
    hf,
    probeHfMetadata: async () => ({ ok: true, bytes: cfg.maxBytes + 1, maxFile: 1 }),
  })
  await assert.rejects(
    conductor.download({ url: 'https://huggingface.co/owner/name', save_dir: tmp }, exec),
    (error) => error.code === 'E_IO',
  )
  assert.equal(submits, 0)
})

test('HF metadata no-match is an explicit target error', async () => {
  const conductor = build({
    probeHfMetadata: async () => ({ ok: true, noMatch: true }),
  })
  await assert.rejects(
    conductor.download({ url: 'https://huggingface.co/owner/name', save_dir: tmp, include: ['nothing-*'] }, exec),
    (error) => error.code === 'E_TARGET',
  )
})
