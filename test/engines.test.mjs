import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { createHfEngine } from '../engines/hf.mjs'
import { createYtdlpEngine } from '../engines/ytdlp.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-engines-'))
const cfg = loadConfig(
  {
    defaultSaveDir: tmp,
    allowedRoots: [tmp],
    proxyCandidates: [],
    ytdlpPath: process.execPath,
    hfPath: process.execPath,
    useHfMirror: true,
  },
  { cwd: tmp, env: {} },
)

function fakeRun({ writeName = 'clip.mp4' } = {}) {
  const seen = []
  const run = async ({ args, env }) => {
    seen.push({ args, env })
    if (args[0] === '--version' || args[0] === '--help') return { stdout: 'fake', stderr: '' }
    const pathsAt = args.indexOf('--paths')
    const localAt = args.indexOf('--local-dir')
    const dir = pathsAt >= 0 ? args[pathsAt + 1] : args[localAt + 1]
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, writeName)
    fs.writeFileSync(file, 'downloaded')
    return { stdout: localAt >= 0 ? '' : `${file}\n`, stderr: '' }
  }
  return { run, seen }
}

test('yt-dlp downloads into staging, validates the file and moves it to saveDir', async () => {
  const { run } = fakeRun()
  const engine = createYtdlpEngine({ cfg, runProcImpl: run })
  const { task } = await engine.submit({
    target: { kind: 'video', url: 'https://example.com/v' },
    saveDir: tmp,
    filename: 'clip.mp4',
  })
  assert.equal(task.status, 'completed')
  assert.equal(task.finalPath, path.join(tmp, 'clip.mp4'))
  assert.equal(fs.readFileSync(task.finalPath, 'utf8'), 'downloaded')
  const stagingRoot = path.join(tmp, '.conductor', 'staging')
  const leftovers = fs.existsSync(stagingRoot)
    ? fs.readdirSync(stagingRoot).filter((name) => name.startsWith('ytdlp-'))
    : []
  assert.deepEqual(leftovers, [])
})

test('yt-dlp refuses an executable produced by the download', async () => {
  const { run } = fakeRun({ writeName: 'evil.exe' })
  const engine = createYtdlpEngine({ cfg, runProcImpl: run })
  await assert.rejects(
    engine.submit({ target: { kind: 'video', url: 'https://example.com/v' }, saveDir: tmp }),
    (error) => error.code === 'E_EXEC_EXT',
  )
  assert.equal(fs.existsSync(path.join(tmp, 'evil.exe')), false)
})

test('yt-dlp refuses a reported path outside staging', async () => {
  const outside = path.join(os.tmpdir(), 'outside-conductor.mp4')
  fs.writeFileSync(outside, 'x')
  const engine = createYtdlpEngine({
    cfg,
    runProcImpl: async ({ args }) => {
      if (args[0] === '--version') return { stdout: 'fake', stderr: '' }
      return { stdout: `${outside}\n`, stderr: '' }
    },
  })
  await assert.rejects(
    engine.submit({ target: { kind: 'video', url: 'https://example.com/v' }, saveDir: tmp }),
    (error) => error.code === 'E_TARGET',
  )
  fs.rmSync(outside, { force: true })
})

test('yt-dlp requires the browser-cookie opt-in', async () => {
  const engine = createYtdlpEngine({ cfg, runProcImpl: fakeRun().run })
  await assert.rejects(
    engine.submit({
      target: { kind: 'video', url: 'https://example.com/v' },
      saveDir: tmp,
      cookiesFromBrowser: 'edge',
    }),
    (error) => error.code === 'E_ENGINE_REJECTED',
  )
})

test('HF downloads into staging, scans, and moves to the repo directory', async () => {
  const { run, seen } = fakeRun({ writeName: 'config.json' })
  const engine = createHfEngine({ cfg, env: { HF_TOKEN: 'secret' }, runProcImpl: run })
  const { task } = await engine.submit({
    target: { kind: 'hf', repo: 'owner/name' },
    saveDir: tmp,
  })
  const finalDir = path.join(tmp, 'owner--name')
  assert.equal(task.finalPath, finalDir)
  assert.equal(fs.readFileSync(path.join(finalDir, 'config.json'), 'utf8'), 'downloaded')
  assert.equal(seen.at(-1).env.HF_TOKEN, undefined)
  assert.equal(seen.at(-1).env.HF_ENDPOINT, cfg.hfMirror)
})

test('HF refuses an executable in the downloaded tree', async () => {
  const { run } = fakeRun({ writeName: 'setup.exe' })
  const engine = createHfEngine({ cfg, env: {}, runProcImpl: run })
  await assert.rejects(
    engine.submit({ target: { kind: 'hf', repo: 'owner/name' }, saveDir: tmp }),
    (error) => error.code === 'E_EXEC_EXT',
  )
  assert.equal(fs.existsSync(path.join(tmp, 'owner--name', 'setup.exe')), false)
})

test('yt-dlp passes --max-filesize and rejects an over-limit staging tree', async () => {
  const limitCfg = loadConfig(
    {
      defaultSaveDir: tmp,
      allowedRoots: [tmp],
      proxyCandidates: [],
      ytdlpPath: process.execPath,
      maxBytes: 5,
    },
    { cwd: tmp, env: {} },
  )
  const { run, seen } = fakeRun({ writeName: 'clip.mp4' })
  const engine = createYtdlpEngine({ cfg: limitCfg, runProcImpl: run })
  await assert.rejects(
    engine.submit({ target: { kind: 'video', url: 'https://example.com/v' }, saveDir: tmp }),
    (error) => error.code === 'E_IO' && error.info?.kind === 'limit',
  )
  const args = seen.at(-1).args
  assert.equal(args[args.indexOf('--max-filesize') + 1], '5')
})

test('HF rejects an over-limit staging tree', async () => {
  const limitCfg = loadConfig(
    {
      defaultSaveDir: tmp,
      allowedRoots: [tmp],
      proxyCandidates: [],
      hfPath: process.execPath,
      maxBytes: 5,
    },
    { cwd: tmp, env: {} },
  )
  const { run } = fakeRun({ writeName: 'config.json' })
  const engine = createHfEngine({ cfg: limitCfg, env: {}, runProcImpl: run })
  await assert.rejects(
    engine.submit({ target: { kind: 'hf', repo: 'owner/name' }, saveDir: tmp }),
    (error) => error.code === 'E_IO' && error.info?.kind === 'limit',
  )
})
