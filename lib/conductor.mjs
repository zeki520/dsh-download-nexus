import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ConductorError } from './errors.mjs'
import { assertSafeDir, assertSafeFilename, ensureDir } from './paths.mjs'
import { createNetPolicy } from './net-policy.mjs'
import { sessionKeyFor } from './session-key.mjs'
import { normalizeHeaders, downloadDirect, stripSensitive, probeContentLength } from './http.mjs'
import { detectAccel } from './accel.mjs'
import { classifyTarget } from './classify.mjs'
import { planExplicit, planRoute } from './router.mjs'
import { applyGithubMirror, GITHUB_MIRROR_HOSTS } from './mirror.mjs'
import { diagnosePackageManagers } from './package-managers.mjs'
import { createTaskRegistry } from '../registry/tasks.mjs'
import { createMotrixEngine } from '../engines/motrix.mjs'
import { createDirectEngine } from '../engines/direct.mjs'
import { createYtdlpEngine } from '../engines/ytdlp.mjs'
import { createHfEngine } from '../engines/hf.mjs'
import { sweepStaging } from './staging.mjs'
import { createEngineQueue } from './engine-queue.mjs'
import { createWatchdog } from './watchdog.mjs'
import { probeHfMetadata } from './hf-metadata.mjs'

const PROBE_CACHE_MS = 5_000

async function packageVersion() {
  try {
    const raw = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')
    return JSON.parse(raw).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function clampWait(value, cfg) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(Math.floor(n), cfg.maxWaitSeconds)
}

function idempotencyKey(target, saveDir, filename) {
  return `dsh-download-nexus-${createHash('sha256')
    .update(`${target.url}\n${saveDir}\n${filename || ''}`)
    .digest('hex')
    .slice(0, 16)}-${randomUUID()}`
}

function isPaused(status) {
  return status === 'paused' || status === 'stopped'
}

function describeTask(task) {
  if (!task) return null
  return {
    task_ref: task.task_ref,
    engine: task.engine,
    status: task.status,
    progress: task.progress,
    bytes_done: task.bytesDone,
    bytes_total: task.bytesTotal,
    speed_bps: isPaused(task.status) ? 0 : task.speedBps,
    eta_sec: isPaused(task.status) ? null : task.etaSec,
    name: task.name,
    save_dir: task.saveDir,
    final_path: task.finalPath,
    files: task.files || (task.finalPath ? [task.finalPath] : []),
    error: task.error || '',
    error_code: task.errorCode || '',
  }
}

export function createConductor({
  cfg,
  env = process.env,
  platform,
  homeDir = os.homedir(),
  engines: providedEngines,
  netPolicy: providedNetPolicy,
  registry: providedRegistry,
  queue: providedQueue,
  watchdog: providedWatchdog,
  probeContentLength: probeContentLengthImpl = probeContentLength,
  probeHfMetadata: probeHfMetadataImpl = probeHfMetadata,
} = {}) {
  const netPolicy = providedNetPolicy || createNetPolicy({ allowLoopback: false })
  const registry = providedRegistry || createTaskRegistry()
  const engines = providedEngines || {
    motrix: createMotrixEngine({ cfg, env }),
    direct: createDirectEngine({ cfg, netPolicy }),
    ytdlp: createYtdlpEngine({ cfg }),
    hf: createHfEngine({ cfg, env }),
  }
  const probeCache = new Map()
  const queue = providedQueue || createEngineQueue()
  const activeRuns = new Set()

  function markTaskError(ref, task, error, code) {
    if (!ref) return
    const current = task || {}
    registry.update(ref, {
      ...current,
      status: 'error',
      progress: current.progress ?? 0,
      speedBps: 0,
      etaSec: null,
      error: error?.message || String(error || ''),
      errorCode: code || error?.code || 'E_IO',
      finishedAt: Date.now(),
    })
  }

  const TERMINAL_STATUSES = new Set(['completed', 'error', 'failed', 'cancelled', 'stopped'])
  function isTerminalStatus(status) {
    return TERMINAL_STATUSES.has(String(status || '').toLowerCase())
  }

  const watchdog = providedWatchdog || createWatchdog({
    status: (nativeId) => engines.motrix.status(nativeId),
    control: (nativeId, action, opts) => engines.motrix.control(nativeId, action, opts),
    update: (ref, task) => registry.update(ref, task),
    onLimit: (entry, task, error) => markTaskError(entry.ref, task, error, 'E_IO'),
    onError: (entry, taskOrError, reason) => {
      const error = taskOrError instanceof Error ? taskOrError : taskOrError || new Error(String(reason || ''))
      markTaskError(entry.ref, taskOrError instanceof Error ? null : taskOrError, error, error?.code || 'E_ENGINE_UNAVAILABLE')
    },
  })

  function dispose() {
    watchdog.closeAll()
    queue.dispose()
    for (const controller of activeRuns) {
      try {
        controller.abort()
      } catch {
        // ignore
      }
    }
    activeRuns.clear()
  }

  function beginRun(exec) {
    const controller = new AbortController()
    const outer = exec?.signal
    const onAbort = () => controller.abort()
    if (outer) {
      if (outer.aborted) controller.abort()
      else if (typeof outer.addEventListener === 'function') outer.addEventListener('abort', onAbort, { once: true })
    }
    activeRuns.add(controller)
    return {
      signal: controller.signal,
      done() {
        if (outer && typeof outer.removeEventListener === 'function') outer.removeEventListener('abort', onAbort)
        activeRuns.delete(controller)
      },
    }
  }

  async function probeEngine(id, { force = false } = {}) {
    if (id === 'direct') return { available: true, detail: '内置直连' }
    const cached = probeCache.get(id)
    if (!force && cached && Date.now() - cached.at < PROBE_CACHE_MS) return cached.result
    let result
    try {
      result = await engines[id].probe()
    } catch (error) {
      result = { available: false, detail: error.message }
    }
    probeCache.set(id, { at: Date.now(), result })
    return result
  }

  async function probeFor(target, explicit) {
    const ids = new Set(['direct'])
    if (explicit && explicit !== 'auto') {
      ids.add(explicit)
    } else if (target.kind === 'url') {
      ids.add('motrix')
    } else if (target.kind === 'magnet' || target.kind === 'torrent') {
      ids.add('motrix')
    } else if (target.kind === 'hf') {
      ids.add('hf')
    } else if (target.kind === 'video') {
      ids.add('ytdlp')
    }
    const rows = await Promise.all([...ids].map(async (id) => [id, await probeEngine(id)]))
    return Object.fromEntries(rows.map(([id, row]) => [id, row.available]))
  }

  async function probeAll({ force = true } = {}) {
    const rows = await Promise.all(
      ['motrix', 'direct', 'ytdlp', 'hf'].map(async (id) => [id, await probeEngine(id, { force })]),
    )
    return Object.fromEntries(rows)
  }

  async function fetchTorrentBase64(target, saveDir, accel, signal) {
    const tempDir = ensureDir(path.join(saveDir, '.download-nexus'))
    const nativeName = assertSafeFilename(`torrent-${randomUUID()}.torrent`, { allowExecutable: cfg.allowExecutable })
    const result = await downloadDirect({
      url: target.url,
      saveDir: tempDir,
      filename: nativeName,
      maxBytes: Math.min(8 * 1024 * 1024, cfg.maxBytes),
      netPolicy,
      proxy: accel.proxy || null,
      timeoutMs: cfg.requestTimeoutMs,
      signal,
      allowExecutable: cfg.allowExecutable,
    })
    try {
      const bytes = await fs.readFile(result.path)
      return { base64: bytes.toString('base64'), displayName: target.filename.replace(/\.torrent$/i, '') || 'download' }
    } finally {
      await fs.unlink(result.path).catch(() => {})
    }
  }

  async function download(args = {}, exec = {}) {
    const owner = sessionKeyFor(exec)
    const target = classifyTarget(args.url)
    const mirror = applyGithubMirror(target, {
      enabled: args.github_mirror === true || cfg.githubMirrorDefault === true,
      base: cfg.githubMirrorBase,
    })
    const effectiveTarget = mirror.target
    let headers = normalizeHeaders(args.headers)
    if (mirror.applied) headers = stripSensitive(headers)
    const { dir: saveDir } = assertSafeDir(args.save_dir ?? cfg.defaultSaveDir, cfg)
    ensureDir(saveDir)
    registry.prune?.()
    try {
      sweepStaging(saveDir)
    } catch {
      // Best effort; stale staging must never block a new download.
    }
    const filename = args.filename
      ? assertSafeFilename(args.filename, { allowExecutable: cfg.allowExecutable })
      : undefined
    const accel = await detectAccel({ cfg, env })
    let policy = null
    if (effectiveTarget.kind !== 'magnet') {
      const remoteUrl = effectiveTarget.kind === 'torrent' ? effectiveTarget.torrentUrl : effectiveTarget.url
      const proxy = Boolean(accel.proxy)
      const policyOpts = { proxy, allowFakeIp: proxy }
      policy = await netPolicy.assertRemoteTargetAllowed(remoteUrl, policyOpts)
      if (target.url !== remoteUrl) await netPolicy.assertRemoteTargetAllowed(target.url, policyOpts)
    }
    const explicit = args.engine && args.engine !== 'auto' ? String(args.engine) : null
    const available = await probeFor(target, explicit)
    const plan = explicit
      ? planExplicit(explicit, target, { cfg, available, accel })
      : planRoute(target, { cfg, available, accel })
    const engine = engines[plan.engineId]
    if (!engine) throw new ConductorError('E_ENGINE_UNAVAILABLE', `没有引擎 ${plan.engineId}`)

    if (plan.engineId === 'hf') {
      const metadata = await probeHfMetadataImpl({
        repo: target.repo,
        repoType: args.repo_type || target.repoType,
        revision: args.revision || target.revision,
        include: args.include || target.include,
        cfg,
        env,
        netPolicy,
        proxy: plan.proxy,
        signal: exec.signal,
      }).catch(() => ({ ok: false }))
      if (metadata.ok) {
        if (metadata.noMatch) {
          throw new ConductorError('E_TARGET', 'HF include 没有匹配到任何文件', {
            hint: '检查 include glob 或仓库 revision。',
          })
        }
        const largest = Number(metadata.maxFile) || 0
        const total = Number(metadata.bytes) || 0
        if (largest > cfg.maxBytes || total > cfg.maxBytes) {
          throw new ConductorError('E_IO', `HF 预检超过单文件/总量上限 ${cfg.maxBytes} 字节`, {
            info: {
              kind: 'limit',
              stage: 'hf-metadata',
              file_bytes: largest,
              total_bytes: total,
              max_bytes: cfg.maxBytes,
              file: metadata.maxFilePath || '',
            },
          })
        }
      }
    }

    if (plan.engineId === 'motrix' && effectiveTarget.kind === 'url') {
      const declared = await probeContentLengthImpl({
        url: effectiveTarget.url,
        proxy: plan.proxy,
        netPolicy,
        timeoutMs: Math.min(cfg.requestTimeoutMs, 5_000),
        signal: exec.signal,
      })
      if (Number.isFinite(declared) && declared > cfg.maxBytes) {
        throw new ConductorError('E_IO', `预检 Content-Length ${declared} 字节超过上限 ${cfg.maxBytes} 字节`, {
          info: { kind: 'limit', bytes: declared, max_bytes: cfg.maxBytes, stage: 'preflight' },
        })
      }
    }

    const run = beginRun(exec)
    let lease
    try {
      lease = await queue.acquire(plan.engineId, { signal: run.signal })
    } catch (error) {
      run.done()
      throw error
    }

    try {
      let torrentBase64
      let displayName = filename
      if (effectiveTarget.kind === 'torrent' && effectiveTarget.torrentUrl) {
        const torrent = await fetchTorrentBase64(effectiveTarget, saveDir, accel, run.signal)
        torrentBase64 = torrent.base64
        displayName = filename || torrent.displayName
      }

      const submitted = await engine.submit({
        target: effectiveTarget,
        saveDir,
        filename: displayName,
        headers,
        quality: args.quality,
        format: args.format,
        subtitles: args.subtitles === true,
        playlist: args.playlist === true,
        cookiesFromBrowser: args.cookies_from_browser,
        repoType: args.repo_type,
        revision: args.revision,
        include: args.include,
        proxy: plan.proxy,
        connections: plan.connections,
        torrentBase64,
        idempotencyKey: idempotencyKey(effectiveTarget, saveDir, displayName),
        maxBytes: cfg.maxBytes,
        signal: run.signal,
      })

      const record = registry.issue(
        plan.engineId,
        submitted.nativeId,
        {
          url: target.url,
          downloadUrl: effectiveTarget.url,
          saveDir,
          task: submitted.task,
        },
        owner,
      )
      let task = submitted.task
      let timedOut = false
      const waitSeconds = clampWait(args.wait_seconds, cfg)
      if (waitSeconds > 0) {
        const waited = await engine.waitFor(submitted.nativeId, {
          waitSeconds,
          pollMs: cfg.pollMs,
          signal: run.signal,
          maxBytes: cfg.maxBytes,
        })
        task = waited.task || task
        timedOut = waited.timedOut
        registry.update(record.ref, task)
        if (timedOut && plan.engineId === 'motrix') {
          if (!watchdog.track({ ref: record.ref, nativeId: submitted.nativeId, maxBytes: cfg.maxBytes, lease })) {
            lease.release()
          }
          lease = null
        } else {
          lease.release()
          lease = null
        }
      } else if (plan.engineId === 'motrix') {
        if (!watchdog.track({ ref: record.ref, nativeId: submitted.nativeId, maxBytes: cfg.maxBytes, lease })) {
          lease.release()
        }
        lease = null
      } else {
        lease.release()
        lease = null
      }

      return {
      ok: true,
      task_ref: record.ref,
      engine: plan.engineId,
      reason: mirror.applied ? `${plan.reason}；GitHub 镜像 ${mirror.base}` : plan.reason,
      timed_out: timedOut,
      target_kind: target.kind,
      task: describeTask({ ...task, task_ref: record.ref, engine: plan.engineId }),
      final_path: task?.finalPath || '',
      saved_to: task?.saveDir || saveDir,
      limits: { max_bytes: cfg.maxBytes },
      ssrf: policy
        ? {
            binding: plan.engineId === 'direct' ? policy.binding : 'engine-managed',
            verifiable: plan.engineId === 'direct' ? policy.verifiable : false,
            fake_ip: Boolean(policy.fakeIp),
          }
        : null,
      mirror: mirror.applied
        ? { applied: true, base: mirror.base, original_url: target.url, download_url: effectiveTarget.url }
        : { applied: false },
      }
    } catch (error) {
      if (lease) lease.release()
      throw error
    } finally {
      run.done()
    }
  }

  async function status(args = {}, exec = {}) {
    const owner = sessionKeyFor(exec)
    if (!args.task_ref) {
      const records = registry.listFor(owner, 20)
      const tasks = []
      for (const record of records) {
        let task = record.task
        try {
          task = (await engines[record.engineId].status(record.nativeId)) || task
        } catch {
          // keep the last known state
        }
        if (isTerminalStatus(task?.status)) watchdog.stop(record.ref, 'status')
        tasks.push(describeTask({ ...task, task_ref: record.ref, engine: record.engineId }))
      }
      return { ok: true, tasks }
    }

    const record = registry.mustGetOwned(args.task_ref, owner)
    let task = (await engines[record.engineId].status(record.nativeId)) || record.task
    let timedOut = false
    const waitSeconds = clampWait(args.wait_seconds, cfg)
    if (waitSeconds > 0) {
      const waited = await engines[record.engineId].waitFor(record.nativeId, {
        waitSeconds,
        pollMs: cfg.pollMs,
        signal: exec.signal,
      })
      task = waited.task || task
      timedOut = waited.timedOut
    }
    registry.update(record.ref, task)
    if (isTerminalStatus(task?.status)) watchdog.stop(record.ref, 'status')
    return {
      ok: true,
      task_ref: record.ref,
      engine: record.engineId,
      timed_out: timedOut,
      task: describeTask({ ...task, task_ref: record.ref, engine: record.engineId }),
      final_path: task?.finalPath || '',
      saved_to: task?.saveDir || record.saveDir,
    }
  }

  async function control(args = {}, exec = {}) {
    const owner = sessionKeyFor(exec)
    const record = registry.mustGetOwned(args.task_ref, owner)
    const action = String(args.action || '').toLowerCase()
    if (!['pause', 'resume', 'cancel', 'purge'].includes(action)) {
      throw new ConductorError('E_UNSUPPORTED', `未知操作：${args.action}（pause/resume/cancel/purge）`)
    }
    if (action === 'purge' && args.confirm !== true) {
      throw new ConductorError('E_NEED_INPUT', 'purge 会删除已下载文件，需要 confirm:true', {
        hint: '如果只想移除任务、保留文件，用 action:"cancel"。',
      })
    }
    const engine = engines[record.engineId]
    if (action === 'pause') {
      await engine.control(record.nativeId, action, { deleteFiles: false })
      if (record.engineId === 'motrix' && typeof engines.motrix.waitForPaused === 'function') {
        await engines.motrix.waitForPaused(record.nativeId, { signal: exec.signal })
      }
      watchdog.stop(record.ref, 'pause')
    } else if (action === 'resume') {
      const lease = await queue.acquire(record.engineId, { signal: exec.signal, timeoutMs: 0 })
      try {
        await engine.control(record.nativeId, action, { deleteFiles: false })
      } catch (error) {
        lease.release()
        throw error
      }
      if (!watchdog.track({ ref: record.ref, nativeId: record.nativeId, maxBytes: cfg.maxBytes, lease })) {
        lease.release()
      }
    } else {
      await engine.control(record.nativeId, action, { deleteFiles: action === 'purge' })
      watchdog.stop(record.ref, action)
      if (action === 'purge' || action === 'cancel') {
        registry.remove?.(record.ref)
      }
    }
    return { ok: true, task_ref: record.ref, action, engine: record.engineId }
  }

  async function doctor(args = {}) {
    const enginesReport = await probeAll({ force: true })
    const accel = await detectAccel({ cfg, env, force: true })
    const report = {
      ok: true,
      version: await packageVersion(),
      node: process.version,
      platform: platform || process.platform,
      default_save_dir: cfg.defaultSaveDir,
      allowed_roots: cfg.allowedRoots,
      tool_prefix: cfg.toolPrefix,
      allow_shell: cfg.allowShell,
      engines: Object.fromEntries(
        Object.entries(enginesReport).map(([id, row]) => [id, { available: row.available, detail: row.detail }]),
      ),
      accel,
      github_mirror: {
        base: cfg.githubMirrorBase,
        default_enabled: cfg.githubMirrorDefault,
        hosts: GITHUB_MIRROR_HOSTS,
      },
      package_managers: await diagnosePackageManagers({
        env,
        homeDir,
        platform: platform || process.platform,
      }).catch((error) => ({ error: error.message })),
      motrix: await engines.motrix.info().catch((error) => ({ connected: false, error: error.message })),
    }
    if (args.probe_url) {
      const target = classifyTarget(args.probe_url)
      const allowed = await netPolicy.assertRemoteTargetAllowed(target.url, {
        proxy: Boolean(accel.proxy),
        allowFakeIp: Boolean(accel.proxy),
      })
      report.probe_url = {
        url: target.url,
        kind: target.kind,
        host: target.host,
        allowed: true,
        binding: allowed.binding,
        verifiable: allowed.verifiable,
        addresses: allowed.addresses,
      }
    }
    if (args.verbose) {
      report.config = {
        connections: cfg.connections,
        max_bytes: cfg.maxBytes,
        request_timeout_ms: cfg.requestTimeoutMs,
        poll_ms: cfg.pollMs,
        max_wait_seconds: cfg.maxWaitSeconds,
        proxy_candidates: cfg.proxyCandidates,
        ytdlp_path: cfg.ytdlpPath,
        hf_path: cfg.hfPath,
        hf_mirror: cfg.useHfMirror ? cfg.hfMirror : '',
        github_mirror_base: cfg.githubMirrorBase,
        github_mirror_default: cfg.githubMirrorDefault,
      }
    }
    return report
  }

  return {
    cfg,
    netPolicy,
    engines,
    registry,
    download,
    status,
    control,
    doctor,
    probeAll,
    probeEngine,
    queue,
    watchdog,
    dispose,
  }
}
