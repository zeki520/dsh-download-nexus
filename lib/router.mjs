import { ConductorError } from './errors.mjs'

function requireEngine(available, id) {
  if (!available[id]) {
    const names = { motrix: 'Motrix', ytdlp: 'yt-dlp', hf: 'hf CLI', direct: '内置直连' }
    throw new ConductorError('E_ENGINE_UNAVAILABLE', `${names[id] || id} 当前不可用`)
  }
}

export function planRoute(target, { cfg, available = {}, accel = {} } = {}) {
  const proxy = accel.proxy || null
  const connections = cfg?.connections || 16

  if (target.kind === 'magnet' || target.kind === 'torrent') {
    requireEngine(available, 'motrix')
    return { engineId: 'motrix', proxy, connections, reason: '磁力/种子任务必须由 Motrix 接管' }
  }
  if (target.kind === 'hf') {
    requireEngine(available, 'hf')
    return { engineId: 'hf', proxy: null, connections, reason: 'Hugging Face 仓库交给 hf CLI（支持 include / revision）' }
  }
  if (target.kind === 'video') {
    requireEngine(available, 'ytdlp')
    return { engineId: 'ytdlp', proxy, connections, reason: '媒体页面交给 yt-dlp 解析真实流地址' }
  }
  if (target.kind === 'github-page') {
    throw new ConductorError('E_UNSUPPORTED', '给的是 GitHub 仓库页面，不是文件直链', {
      hint: '请给 release asset / archive / raw 直链；仓库本身请用 git clone。',
    })
  }
  if (target.kind === 'package') {
    throw new ConductorError('E_UNSUPPORTED', '包管理资源不应由下载插件代拉', {
      hint: 'pip 用 pip config 配镜像，npm 用 npm config set registry；插件只负责普通文件/视频/模型/BT。',
    })
  }
  if (target.kind !== 'url') {
    throw new ConductorError('E_UNSUPPORTED', `不认识的目标类型：${target.kind}`)
  }

  if (target.protocol === 'ftp:' || target.protocol === 'ftps:') {
    requireEngine(available, 'motrix')
    return { engineId: 'motrix', proxy, connections, reason: 'FTP 交给 Motrix / aria2' }
  }

  if (available.motrix) {
    return {
      engineId: 'motrix',
      proxy,
      connections,
      reason: target.github
        ? 'GitHub 文件走 Motrix（多连接 + 本地代理；GitHub 线路本身可能仍慢）'
        : 'Motrix / aria2 可用，优先多连接',
    }
  }
  requireEngine(available, 'direct')
  return { engineId: 'direct', proxy, connections, reason: 'Motrix 不可用，回退到内置直连下载器' }
}

export function planExplicit(engineId, target, { cfg, available = {}, accel = {} } = {}) {
  if (engineId === 'auto') return planRoute(target, { cfg, available, accel })
  if (!['motrix', 'direct', 'ytdlp', 'hf'].includes(engineId)) {
    throw new ConductorError('E_UNSUPPORTED', `未知引擎：${engineId}（可选 auto/motrix/direct/ytdlp/hf）`)
  }
  requireEngine(available, engineId)
  if (target.kind === 'hf' && engineId !== 'hf') {
    throw new ConductorError('E_ENGINE_REJECTED', 'Hugging Face 仓库请用 hf 引擎')
  }
  if (engineId === 'hf' && target.kind !== 'hf') {
    throw new ConductorError('E_ENGINE_REJECTED', 'hf 引擎只接受 Hugging Face 仓库链接')
  }
  if (target.kind === 'video' && engineId !== 'ytdlp') {
    throw new ConductorError('E_ENGINE_REJECTED', '视频页面请用 ytdlp 引擎')
  }
  if ((target.kind === 'magnet' || target.kind === 'torrent') && engineId !== 'motrix') {
    throw new ConductorError('E_ENGINE_REJECTED', '磁力/种子只能交给 Motrix')
  }
  if ((target.protocol === 'ftp:' || target.protocol === 'ftps:') && engineId === 'direct') {
    throw new ConductorError('E_ENGINE_REJECTED', '内置直连不支持 FTP，请用 motrix 引擎')
  }
  if (target.kind === 'package' || target.kind === 'github-page') {
    throw new ConductorError('E_UNSUPPORTED', '这个目标不是可下载文件直链')
  }
  return { engineId, proxy: accel.proxy || null, connections: cfg?.connections || 16, reason: `用户指定 ${engineId}` }
}
