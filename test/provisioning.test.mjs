import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  MOTRIX_MIN_VERSION,
  MOTRIX_VERSION,
  assetFor,
  compareVersion,
  isCompatibleVersion,
  manifestSummary,
} from '../lib/provisioning/manifest.mjs'
import { detectMotrix, endpointPathFor, readEndpoint } from '../lib/provisioning/detect.mjs'
import { sha256File, fileMatches, downloadAsset } from '../lib/provisioning/download.mjs'
import { findMotrixExe } from '../lib/provisioning/installer.mjs'
import { acquireProvisioningLock, provisioningPaths, readProvisioningState, writeProvisioningState } from '../lib/provisioning/state.mjs'
import { createProvisioningService } from '../lib/provisioning/service.mjs'

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'nexus-prov-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('manifest pins Motrix 2.4.3 and rejects unknown arch', () => {
  assert.equal(MOTRIX_VERSION, '2.4.3')
  assert.equal(MOTRIX_MIN_VERSION, '2.4.1')
  const x64 = assetFor('x64', 'installer')
  assert.equal(x64.bytes, 133_386_225)
  assert.equal(x64.sha256, '422992d06158a33f59459e76c721d87193146764b2a72c741fd43d0b1e0e961a')
  assert.match(x64.url, /^https:\/\/github\.com\/agalwood\/Motrix\/releases\/download\/v2\.4\.3\//)
  assert.equal(assetFor('arm64', 'portable').sha256.length, 64)
  assert.throws(() => assetFor('ia32', 'installer'), /不支持的 CPU 架构/)
  const summary = manifestSummary('x64')
  assert.equal(summary.version, '2.4.3')
  assert.match(summary.source, /releases\/tag\/v2\.4\.3/)
})

test('version compatibility is semver-like and empty is incompatible', () => {
  assert.equal(isCompatibleVersion('2.4.1'), true)
  assert.equal(isCompatibleVersion('2.4.3'), true)
  assert.equal(isCompatibleVersion('2.9.9'), true)
  assert.equal(isCompatibleVersion('3.0.0'), false)
  assert.equal(isCompatibleVersion('2.4.0'), false)
  assert.equal(isCompatibleVersion(''), false)
  assert.equal(compareVersion('2.4.3', '2.4.1'), 1)
  assert.equal(compareVersion('2.4.3', '2.4.3'), 0)
})

test('readEndpoint accepts a complete endpoint and rejects partial data', async (t) => {
  const dir = await tempDir(t)
  const file = path.join(dir, 'endpoint.json')
  await writeFile(file, JSON.stringify({ port: 16802, localToken: 'x' }))
  assert.deepEqual(await readEndpoint(file), { ok: true, port: 16802, localToken: 'x', generation: null })
  await writeFile(file, JSON.stringify({ port: 0, localToken: '' }))
  assert.equal((await readEndpoint(file)).ok, false)
  assert.equal((await readEndpoint(path.join(dir, 'missing.json'))).ok, false)
})

function fakeRun({ registry = [], processes = [], version = '2.4.3' } = {}) {
  return async (_command, args) => {
    const script = args?.[args.length - 1] || ''
    if (script.includes('Get-ItemProperty')) {
      return { ok: true, code: 0, stdout: JSON.stringify(registry), stderr: '' }
    }
    if (script.includes('Get-Process')) {
      return { ok: true, code: 0, stdout: JSON.stringify(processes), stderr: '' }
    }
    if (script.includes('VersionInfo')) {
      return { ok: true, code: 0, stdout: version, stderr: '' }
    }
    return { ok: false, code: 1, stdout: '', stderr: '' }
  }
}

test('detectMotrix finds a registry install and reports absent without bridge', async (t) => {
  const dir = await tempDir(t)
  const exe = path.join(dir, 'Motrix.exe')
  await writeFile(exe, 'x')
  const result = await detectMotrix({
    env: { APPDATA: dir, LOCALAPPDATA: dir, SystemRoot: 'C:\\Windows', USERPROFILE: dir },
    platform: 'win32',
    arch: 'x64',
    run: fakeRun({ registry: [{ DisplayName: 'Motrix', DisplayVersion: '2.4.3', InstallLocation: dir }] }),
    readFileImpl: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) },
    fetchImpl: async () => ({ ok: false, status: 500 }),
    existsImpl: async (p) => p.toLowerCase() === exe.toLowerCase(),
  })
  assert.equal(result.installation.found, true)
  assert.equal(result.installation.path, exe)
  assert.equal(result.installation.compatible, true)
  assert.equal(result.bridge.ready, false)
  assert.equal(result.state, 'installed')
})

test('detectMotrix marks running without bridge and ready with bridge', async (t) => {
  const dir = await tempDir(t)
  const exe = path.join(dir, 'Motrix.exe')
  await writeFile(exe, 'x')
  const running = [{ Id: 10, Path: exe }]
  const base = {
    env: { APPDATA: dir, LOCALAPPDATA: dir, SystemRoot: 'C:\\Windows', USERPROFILE: dir },
    platform: 'win32',
    arch: 'x64',
    run: fakeRun({ registry: [], processes: running }),
    readFileImpl: async () => JSON.stringify({ port: 16802, localToken: 'tok' }),
    existsImpl: async (p) => p.toLowerCase() === exe.toLowerCase(),
  }
  const noBridge = await detectMotrix({ ...base, fetchImpl: async () => ({ ok: false, status: 500 }) })
  assert.equal(noBridge.running.running, true)
  assert.equal(noBridge.bridge.ready, false)
  assert.equal(noBridge.state, 'running-no-bridge')

  const ready = await detectMotrix({ ...base, fetchImpl: async () => ({ ok: true, status: 200 }) })
  assert.equal(ready.bridge.ready, true)
  assert.equal(ready.state, 'ready')
})

test('detectMotrix reports incompatible versions', async (t) => {
  const dir = await tempDir(t)
  const exe = path.join(dir, 'Motrix.exe')
  await writeFile(exe, 'x')
  const result = await detectMotrix({
    env: { APPDATA: dir, LOCALAPPDATA: dir, SystemRoot: 'C:\\Windows', USERPROFILE: dir },
    platform: 'win32',
    arch: 'x64',
    run: fakeRun({ registry: [{ DisplayName: 'Motrix', DisplayVersion: '2.0.0', InstallLocation: dir }] }),
    readFileImpl: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) },
    fetchImpl: async () => ({ ok: false, status: 500 }),
    existsImpl: async (p) => p.toLowerCase() === exe.toLowerCase(),
  })
  assert.equal(result.state, 'incompatible')
  assert.equal(result.installation.compatible, false)
  assert.match(result.warnings.join(' '), /不在兼容范围/)
})

test('sha256/fileMatches and cached asset reuse', async (t) => {
  const dir = await tempDir(t)
  const file = path.join(dir, 'asset.bin')
  await writeFile(file, 'hello')
  const hash = await sha256File(file)
  assert.equal(hash, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  const asset = { name: 'asset.bin', bytes: 5, sha256: hash, url: 'https://github.com/x' }
  assert.equal(await fileMatches(file, asset), true)
  assert.equal(await fileMatches(file, { ...asset, sha256: '0'.repeat(64) }), false)
  const result = await downloadAsset({
    asset,
    cacheDir: dir,
    netPolicy: {},
    downloadDirectImpl: async () => { throw new Error('must not download') },
  })
  assert.equal(result.cached, true)
  assert.equal(result.path, file)
})

test('downloadAsset deletes a hash-mismatched file', async (t) => {
  const dir = await tempDir(t)
  const target = path.join(dir, 'Motrix-Setup.exe')
  const result = await downloadAsset({
    asset: { name: 'Motrix-Setup.exe', bytes: 5, sha256: 'a'.repeat(64), url: 'https://github.com/x' },
    cacheDir: dir,
    netPolicy: {},
    downloadDirectImpl: async () => {
      await writeFile(target, 'hello')
      return { path: target, bytes: 5 }
    },
  }).catch((error) => error)
  assert.equal(result.code, 'E_PROVISION_HASH')
  await assert.rejects(stat(target), /ENOENT/)
})

test('findMotrixExe finds a nested executable', async (t) => {
  const dir = await tempDir(t)
  const nested = path.join(dir, 'Motrix-2.4.3', 'resources')
  await mkdir(nested, { recursive: true })
  const exe = path.join(nested, 'Motrix.exe')
  await writeFile(exe, 'x')
  assert.equal(await findMotrixExe(dir), exe)
  assert.equal(await findMotrixExe(path.join(dir, 'missing')), '')
})

test('provisioning state and lock round-trip, second lock is busy', async (t) => {
  const dir = await tempDir(t)
  const paths = provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir })
  await writeProvisioningState(paths.stateFile, { phase: 'idle', portableDir: dir })
  assert.equal((await readProvisioningState(paths.stateFile)).phase, 'idle')
  const lock = await acquireProvisioningLock(paths.lockFile)
  await assert.rejects(acquireProvisioningLock(paths.lockFile), /另一个 Motrix 安装/)
  await lock.release()
  const again = await acquireProvisioningLock(paths.lockFile)
  await again.release()
  const raw = JSON.parse(await readFile(paths.stateFile, 'utf8'))
  assert.equal(raw.phase, 'idle')
})

function serviceDetection({ installed = false, running = false, bridge = false, version = '2.4.3' } = {}) {
  return {
    platform: 'win32',
    arch: 'x64',
    expectedVersion: '2.4.3',
    minVersion: '2.4.1',
    endpointFile: '',
    installation: installed
      ? { found: true, path: 'C:\\fake\\Motrix.exe', version, source: 'registry', compatible: isCompatibleVersion(version) }
      : { found: false, path: '', version: '', source: '', compatible: false },
    running: { running, pids: running ? [1] : [], path: running ? 'C:\\fake\\Motrix.exe' : '' },
    bridge: { ready: bridge, port: bridge ? 16802 : null, endpointFile: '', error: bridge ? null : 'offline' },
    state: bridge ? 'ready' : installed ? 'installed' : running ? 'running-no-bridge' : 'absent',
    warnings: [],
  }
}

test('provisioning install requires explicit confirmation', async (t) => {
  const dir = await tempDir(t)
  const service = createProvisioningService({
    env: { LOCALAPPDATA: dir, APPDATA: dir, USERPROFILE: dir },
    paths: provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir }),
    detectImpl: async () => serviceDetection(),
    downloadAssetImpl: async () => ({ path: 'fake' }),
    installerImpl: async () => ({}),
    startImpl: async () => ({}),
    waitBridgeImpl: async () => ({ ready: true }),
  })
  await assert.rejects(service.install({ confirm: false }), /需要用户明确确认/)
})

test('provisioning install refuses to overwrite existing install', async (t) => {
  const dir = await tempDir(t)
  const service = createProvisioningService({
    env: { LOCALAPPDATA: dir, APPDATA: dir, USERPROFILE: dir },
    paths: provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir }),
    detectImpl: async () => serviceDetection({ installed: true }),
    downloadAssetImpl: async () => ({ path: 'fake' }),
    installerImpl: async () => ({}),
    startImpl: async () => ({}),
    waitBridgeImpl: async () => ({ ready: true }),
  })
  await assert.rejects(service.install({ confirm: true }), /不覆盖现有安装/)
})

test('provisioning install refuses to start second instance while running without bridge', async (t) => {
  const dir = await tempDir(t)
  const service = createProvisioningService({
    env: { LOCALAPPDATA: dir, APPDATA: dir, USERPROFILE: dir },
    paths: provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir }),
    detectImpl: async () => serviceDetection({ running: true }),
    downloadAssetImpl: async () => ({ path: 'fake' }),
    installerImpl: async () => ({}),
    startImpl: async () => ({}),
    waitBridgeImpl: async () => ({ ready: true }),
  })
  await assert.rejects(service.install({ confirm: true }), /正在运行但 bridge 未就绪/)
})

test('provisioning installer success starts Motrix and waits for bridge', async (t) => {
  const dir = await tempDir(t)
  let bridge = false
  let detected = 0
  let started = 0
  const service = createProvisioningService({
    env: { LOCALAPPDATA: dir, APPDATA: dir, USERPROFILE: dir },
    paths: provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir }),
    detectImpl: async () => {
      detected += 1
      if (detected <= 2) return serviceDetection()
      return serviceDetection({ installed: true, bridge })
    },
    downloadAssetImpl: async () => ({ path: 'fake-setup.exe' }),
    installerImpl: async () => ({}),
    startImpl: async () => { started += 1 },
    waitBridgeImpl: async () => { bridge = true; return { ready: true } },
  })
  const result = await service.install({ confirm: true, waitSeconds: 5 })
  assert.equal(result.ok, true)
  assert.equal(started, 1)
  assert.equal(bridge, true)
  assert.equal(result.phase, 'ready')
})

test('provisioning portable success uses extract/find and writes portableDir', async (t) => {
  const dir = await tempDir(t)
  let bridge = false
  let extracted = 0
  let detected = 0
  const service = createProvisioningService({
    env: { LOCALAPPDATA: dir, APPDATA: dir, USERPROFILE: dir },
    paths: provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir }),
    detectImpl: async () => {
      detected += 1
      if (detected <= 2) return serviceDetection()
      return serviceDetection({ installed: true, bridge })
    },
    downloadAssetImpl: async () => ({ path: 'fake.zip' }),
    extractImpl: async () => { extracted += 1 },
    findExeImpl: async () => 'C:\\portable\\Motrix.exe',
    startImpl: async () => ({}),
    waitBridgeImpl: async () => { bridge = true; return { ready: true } },
  })
  const result = await service.install({ mode: 'portable', confirm: true, waitSeconds: 5 })
  await service.status()
  assert.equal(extracted, 1)
  assert.equal(result.phase, 'ready')
  const state = await readProvisioningState(pathsFor(dir).stateFile)
  assert.match(state.portableDir, /2\.4\.3-x64$/)
})

function pathsFor(dir) {
  return provisioningPaths({ LOCALAPPDATA: dir, USERPROFILE: dir })
}
