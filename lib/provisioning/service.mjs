import { ConductorError } from '../errors.mjs'
import { detectAccel } from '../accel.mjs'
import { downloadAsset } from './download.mjs'
import { detectMotrix, endpointPathFor } from './detect.mjs'
import { extractPortable, findMotrixExe, runInstaller, startMotrix, waitBridge } from './installer.mjs'
import { MOTRIX_VERSION, assetFor, manifestSummary } from './manifest.mjs'
import {
  acquireProvisioningLock,
  provisioningPaths,
  readProvisioningState,
  writeProvisioningState,
} from './state.mjs'

const TERMINAL = new Set(['ready', 'ready-existing', 'failed', 'cancelled'])

function errorState(error) {
  return {
    code: error?.code || 'E_PROVISION',
    message: error?.message || String(error),
    hint: error?.hint || '',
    info: error?.info || null,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Motrix auto-provisioning. Detection is read-only; install requires an
 * explicit `confirm:true` from the caller and never installs over an existing
 * compatible Motrix.
 */
export function createProvisioningService({
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  conductor,
  cfg,
  fetchImpl = globalThis.fetch,
  detectImpl = detectMotrix,
  downloadAssetImpl = downloadAsset,
  installerImpl = runInstaller,
  extractImpl = extractPortable,
  findExeImpl = findMotrixExe,
  startImpl = startMotrix,
  waitBridgeImpl = waitBridge,
  paths = provisioningPaths(env),
  now = () => Date.now(),
} = {}) {
  const state = {
    phase: 'idle',
    mode: null,
    version: MOTRIX_VERSION,
    progress: null,
    error: null,
    installedPath: '',
    portableDir: '',
    startedAt: null,
    finishedAt: null,
  }
  let controller = null
  let job = null
  let currentJob = null

  function setPhase(phase, patch = {}) {
    state.phase = phase
    Object.assign(state, patch)
    if (TERMINAL.has(phase)) state.finishedAt = new Date().toISOString()
  }

  async function detection() {
    const persisted = await readProvisioningState(paths.stateFile)
    return await detectImpl({
      env,
      platform,
      arch,
      state: persisted.portableDir ? persisted : null,
      fetchImpl,
    })
  }

  function fallbackFor(detectionResult) {
    return {
      direct: true,
      ytdlp: true,
      hf: true,
      magnet: Boolean(detectionResult?.bridge?.ready),
    }
  }

  function payload(detectionResult, extra = {}) {
    return {
      ok: true,
      phase: extra.phase || state.phase,
      mode: state.mode || null,
      version: MOTRIX_VERSION,
      progress: state.progress,
      error: state.error,
      detection: detectionResult,
      installed: {
        found: Boolean(detectionResult?.installation?.found),
        path: detectionResult?.installation?.path || '',
        version: detectionResult?.installation?.version || '',
        source: detectionResult?.installation?.source || '',
        compatible: Boolean(detectionResult?.installation?.compatible),
      },
      bridge: detectionResult?.bridge || null,
      manifest: manifestSummary(arch),
      fallback: fallbackFor(detectionResult),
      ...extra,
    }
  }

  async function status() {
    const result = await detection()
    return payload(result, { phase: result.bridge?.ready ? 'ready-existing' : state.phase })
  }

  async function runInstall(mode) {
    const asset = assetFor(arch, mode)
    const ac = new AbortController()
    controller = ac
    let lock = null
    try {
      lock = await acquireProvisioningLock(paths.lockFile, { now: now() })
      const persisted = await readProvisioningState(paths.stateFile)
      const before = await detection()
      if (before.bridge?.ready) {
        setPhase('ready-existing', { mode, detection: before })
        await writeProvisioningState(paths.stateFile, {
          ...persisted,
          phase: 'ready',
          mode,
          installedPath: before.installation?.path || '',
          bridge: before.bridge,
        })
        return
      }
      if (before.installation?.found) {
        throw new ConductorError('E_PROVISION_EXISTS', '已检测到 Motrix，不覆盖现有安装', {
          hint: before.installation.compatible
            ? '可直接使用现有 Motrix；如需启动，请调用 motrix_provision action=start。'
            : '现有版本不兼容；请手动升级 Motrix，0.3 不自动覆盖。',
          info: before.installation,
        })
      }
      if (before.running?.running) {
        throw new ConductorError('E_PROVISION_RUNNING', 'Motrix 正在运行，但 bridge 未就绪', {
          hint: '不会启动第二个实例，也不会终止它；请让用户检查 Motrix 的浏览器桥接设置。',
          info: before.running,
        })
      }

      setPhase('downloading', { mode, progress: { phase: 'download', bytes_done: 0, bytes_total: asset.bytes } })
      await writeProvisioningState(paths.stateFile, { ...persisted, phase: 'downloading', mode, version: MOTRIX_VERSION })
      const accel = await detectAccel({ cfg, env, force: true }).catch(() => ({ proxy: null }))
      const downloaded = await downloadAssetImpl({
        asset,
        cacheDir: paths.cacheDir,
        netPolicy: conductor?.netPolicy,
        proxy: accel?.proxy || null,
        signal: ac.signal,
        onProgress: ({ bytes }) => {
          state.progress = { phase: 'download', bytes_done: bytes, bytes_total: asset.bytes }
        },
      })
      if (ac.signal.aborted) throw new ConductorError('E_CANCELLED', '安装已取消')

      setPhase('installing', { progress: { phase: 'install', bytes_done: 0, bytes_total: 0 } })
      let portableDir = ''
      if (mode === 'installer') {
        await installerImpl(downloaded.path, { signal: ac.signal, env })
      } else {
        portableDir = `${paths.portableRoot}\\${MOTRIX_VERSION}-${arch}`
        await extractImpl(downloaded.path, portableDir, { signal: ac.signal, env })
        const exe = await findExeImpl(portableDir)
        if (!exe) throw new ConductorError('E_PROVISION_INSTALL', '便携包已解压但找不到 Motrix.exe', {
          hint: '请检查官方 ZIP 是否完整；不会执行未验证的文件。',
        })
      }

      const after = await detection()
      if (after.bridge?.ready) {
        setPhase('ready', { installedPath: after.installation?.path || '', portableDir })
        await writeProvisioningState(paths.stateFile, {
          phase: 'ready',
          mode,
          version: MOTRIX_VERSION,
          installedPath: after.installation?.path || '',
          portableDir,
        })
        return
      }
      if (!after.installation?.found) {
        throw new ConductorError('E_PROVISION_INSTALL', '安装器结束但未检测到 Motrix', {
          hint: '可能是 UAC 拒绝、SmartScreen 拦截或安装路径未被识别；不会自动覆盖或卸载。',
        })
      }
      if (after.installation.compatible === false) {
        throw new ConductorError('E_PROVISION_INSTALL', `安装后的 Motrix 版本不兼容：${after.installation.version || '未知'}`)
      }

      setPhase('starting', { installedPath: after.installation.path, portableDir })
      if (!after.running?.running) {
        await startImpl(after.installation.path, { env })
      }
      setPhase('waiting-bridge')
      await waitBridgeImpl({
        endpointFile: endpointPathFor(env),
        timeoutMs: 60_000,
        pollMs: 500,
        fetchImpl,
        signal: ac.signal,
      })
      setPhase('ready', { installedPath: after.installation.path, portableDir })
      await writeProvisioningState(paths.stateFile, {
        phase: 'ready',
        mode,
        version: MOTRIX_VERSION,
        installedPath: after.installation.path,
        portableDir,
      })
    } catch (error) {
      if (error?.code === 'E_CANCELLED' || ac.signal.aborted) {
        setPhase('cancelled', { error: null })
        await writeProvisioningState(paths.stateFile, { phase: 'cancelled', mode, version: MOTRIX_VERSION }).catch(() => {})
      } else {
        setPhase('failed', { error: errorState(error) })
        await writeProvisioningState(paths.stateFile, {
          phase: 'failed',
          mode,
          version: MOTRIX_VERSION,
          error: errorState(error),
        }).catch(() => {})
      }
      throw error
    } finally {
      controller = null
      currentJob = null
      if (lock) await lock.release().catch(() => {})
    }
  }

  async function install({ mode = 'installer', confirm = false, waitSeconds = 0 } = {}) {
    if (platform !== 'win32') {
      throw new ConductorError('E_PROVISION_UNSUPPORTED', '只支持 Windows 自动部署 Motrix', {
        hint: 'macOS/Linux 请手动安装 Motrix；Direct/yt-dlp/HF 仍可用。',
      })
    }
    if (mode !== 'installer' && mode !== 'portable') {
      throw new ConductorError('E_PROVISION_UNSUPPORTED', 'mode 只能是 installer 或 portable')
    }
    if (confirm !== true) {
      throw new ConductorError('E_PROVISION_CONSENT', '安装 Motrix 需要用户明确确认', {
        hint: '请先展示版本、来源、SHA-256、未签名/UAC 提示，再由用户确认；AI 不能代替用户确认。',
      })
    }
    if (job) throw new ConductorError('E_PROVISION_BUSY', '已有安装任务在进行中')

    setPhase('detecting', { mode, error: null, progress: null })
    const before = await detection()
    if (before.installation?.found) {
      if (before.bridge?.ready) {
        setPhase('ready-existing', { mode, installedPath: before.installation.path })
        return payload(before)
      }
      throw new ConductorError('E_PROVISION_EXISTS', '已检测到 Motrix，不覆盖现有安装', {
        hint: before.installation.compatible
          ? '可直接使用现有 Motrix；如需启动，请调用 motrix_provision action=start。'
          : '现有版本不兼容；请手动升级 Motrix，0.3 不自动覆盖。',
        info: before.installation,
      })
    }
    if (before.running?.running) {
      throw new ConductorError('E_PROVISION_RUNNING', 'Motrix 正在运行但 bridge 未就绪', {
        hint: '不会启动第二个实例，也不会终止它；请先检查浏览器桥接。',
      })
    }

    setPhase('downloading', { mode, progress: { phase: 'download', bytes_done: 0, bytes_total: assetFor(arch, mode).bytes } })
    const promise = runInstall(mode)
    job = promise
    currentJob = promise
    promise.finally(() => {
      if (job === promise) job = null
    }).catch(() => {})
    if (Number(waitSeconds) > 0) {
      await Promise.race([promise, sleep(Math.min(Number(waitSeconds), 3600) * 1000)])
    }
    const result = await detection()
    return payload(result)
  }

  async function start() {
    const before = await detection()
    if (before.bridge?.ready) return payload(before, { phase: 'ready-existing' })
    if (before.running?.running) {
      throw new ConductorError('E_PROVISION_RUNNING', 'Motrix 正在运行但 bridge 未就绪', {
        hint: '不会启动第二个实例；请检查 Motrix 的浏览器桥接设置。',
      })
    }
    if (!before.installation?.found) {
      throw new ConductorError('E_PROVISION_NOT_INSTALLED', '未检测到 Motrix', {
        hint: '请先调用 motrix_provision action=install，或手动安装官方 Motrix。',
      })
    }
    if (!before.installation.compatible) {
      throw new ConductorError('E_PROVISION_INCOMPATIBLE', 'Motrix 版本不兼容', {
        hint: `需要 ${MOTRIX_VERSION}（兼容 >=2.4.1 <3.0.0）；请手动升级。`,
      })
    }
    setPhase('starting', { installedPath: before.installation.path })
    await startImpl(before.installation.path, { env })
    setPhase('waiting-bridge')
    await waitBridgeImpl({
      endpointFile: endpointPathFor(env),
      timeoutMs: 60_000,
      pollMs: 500,
      fetchImpl,
    })
    setPhase('ready', { installedPath: before.installation.path })
    return status()
  }

  async function cancel() {
    if (!job) {
      return { ok: true, phase: state.phase, cancelled: false }
    }
    controller?.abort()
    try {
      await Promise.race([job, sleep(5_000)])
    } catch {}
    return { ok: true, phase: state.phase, cancelled: true }
  }

  async function recover() {
    const persisted = await readProvisioningState(paths.stateFile)
    const next = { ...persisted, phase: 'idle', error: null }
    await writeProvisioningState(paths.stateFile, next)
    setPhase('idle', { error: null, progress: null })
    return status()
  }

  async function dispose() {
    controller?.abort()
    job = null
    currentJob = null
    controller = null
  }

  return {
    status,
    install,
    start,
    cancel,
    recover,
    dispose,
    /** Test seam only. */
    _state: state,
    _paths: paths,
  }
}
