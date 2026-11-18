import { errorPayload } from '../lib/errors.mjs'
import { formatBytes } from '../lib/paths.mjs'
import { toolName } from '../lib/config.mjs'

function textBlock(text) {
  return [{ type: 'text', text }]
}

function formatSpeed(bps) {
  const n = Number(bps)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${formatBytes(n)}/s`
}

function statusLabel(status) {
  return (
    {
      queued: '排队中',
      fetching_metadata: '获取元数据',
      downloading: '下载中',
      paused: '已暂停',
      seeding: '做种中',
      finalizing: '收尾中',
      completed: '已完成',
      error: '出错',
      cancelled: '已取消',
      stopped: '已停止',
    }[status] || status || '未知'
  )
}

function renderFailure(value) {
  const code = value?.code ? `[${value.code}] ` : ''
  const lines = [`❌ ${code}${value?.message || '下载失败'}`]
  if (value?.hint) lines.push(`怎么办：${value.hint}`)
  if (value?.task_ref) lines.push(`任务：${value.task_ref}`)
  if (value?.info && typeof value.info === 'object') {
    const detail = value.info.tail || value.info.detail
    if (detail) lines.push(`细节：${String(detail).slice(0, 600)}`)
  }
  return textBlock(lines.join('\n'))
}

function renderDownload(_args, value, cfg) {
  if (!value || value.ok !== true) return renderFailure(value)
  const task = value.task || {}
  const lines = []
  if (task.status === 'completed') {
    lines.push(`✅ 下载完成（${value.engine}）`)
    lines.push(`文件：${task.final_path || value.final_path || '(未报告路径)'}`)
    if (task.bytes_done) lines.push(`大小：${formatBytes(task.bytes_done)}`)
  } else if (task.status === 'error') {
    lines.push(`❌ 下载失败（${value.engine}）`)
    if (task.error) lines.push(`错误：${task.error}`)
  } else {
    lines.push(`⬇️ 已提交下载（${value.engine}）`)
    lines.push(`任务：${value.task_ref}`)
    lines.push(`状态：${statusLabel(task.status)} · ${Number(task.progress) || 0}%`)
    if (task.bytes_total) lines.push(`进度：${formatBytes(task.bytes_done)} / ${formatBytes(task.bytes_total)}`)
    const speed = formatSpeed(task.speed_bps)
    if (speed) lines.push(`速度：${speed}`)
    if (Number.isFinite(task.eta_sec) && task.eta_sec > 0) lines.push(`预计剩余：${Math.round(task.eta_sec)} 秒`)
  }
  if (task.save_dir) lines.push(`保存目录：${task.save_dir}`)
  if (value.reason) lines.push(`路由：${value.reason}`)
  if (value.mirror?.applied) lines.push(`镜像：${value.mirror.base}`)
  if (value.timed_out && task.status !== 'completed') {
    lines.push(`⏳ 已到等待上限，任务仍在继续；用 ${toolName(cfg, 'download_status')} 查 ${value.task_ref}`)
  }
  return textBlock(lines.join('\n'))
}

function renderStatus(_args, value) {
  if (!value || value.ok !== true) return renderFailure(value)
  if (Array.isArray(value.tasks)) {
    const lines = ['📋 当前会话的下载任务']
    if (value.stats) {
      lines.push(
        `全局速度：${formatSpeed(value.stats.downloadSpeed) || '0 B/s'} · 活跃 ${value.stats.activeTasks || 0} · 等待 ${value.stats.waitingTasks || 0}`,
      )
    }
    if (value.tasks.length === 0) lines.push('（还没有本插件签发的任务）')
    for (const task of value.tasks) {
      lines.push(
        `- ${task.task_ref} · ${task.engine} · ${statusLabel(task.status)} ${task.progress || 0}% · ${task.name || task.final_path || ''}`,
      )
    }
    return textBlock(lines.join('\n'))
  }
  const task = value.task || {}
  const lines = [
    `${task.status === 'completed' ? '✅' : '⬇️'} ${statusLabel(task.status)} · ${task.progress || 0}%（${value.engine}）`,
    `任务：${value.task_ref}`,
  ]
  if (task.name) lines.push(`文件：${task.name}`)
  if (task.bytes_total) lines.push(`进度：${formatBytes(task.bytes_done)} / ${formatBytes(task.bytes_total)}`)
  const speed = formatSpeed(task.speed_bps)
  if (speed) lines.push(`速度：${speed}`)
  if (Number.isFinite(task.eta_sec) && task.eta_sec > 0) lines.push(`预计剩余：${Math.round(task.eta_sec)} 秒`)
  if (task.final_path) lines.push(`路径：${task.final_path}`)
  if (task.error) lines.push(`错误：${task.error}`)
  if (value.timed_out && task.status !== 'completed') lines.push('⏳ 等待超时，任务仍在继续')
  return textBlock(lines.join('\n'))
}

function renderControl(_args, value) {
  if (!value || value.ok !== true) return renderFailure(value)
  const label = { pause: '已暂停', resume: '已恢复', cancel: '已取消（保留文件）', purge: '已删除任务和文件' }[value.action]
  return textBlock(`${label || value.action}：${value.task_ref}`)
}

function renderProvision(_args, value) {
  if (!value || value.ok !== true) return renderFailure(value)
  const detection = value.detection || {}
  const lines = [`Motrix 自动部署：${value.phase || 'unknown'}`]
  if (value.mode) lines.push(`模式：${value.mode}`)
  if (value.version) lines.push(`固定版本：${value.version}`)
  if (detection.state) lines.push(`检测：${detection.state}`)
  if (detection.installation?.found) {
    lines.push(`安装：${detection.installation.path || '(未报告路径)'} · ${detection.installation.version || '版本未知'}`)
  }
  if (detection.bridge) lines.push(`bridge：${detection.bridge.ready ? '已就绪' : '未就绪'}${detection.bridge.error ? ` · ${detection.bridge.error}` : ''}`)
  if (value.progress) {
    lines.push(`进度：${value.progress.phase} ${value.progress.bytes_done || 0}/${value.progress.bytes_total || 0} B`)
  }
  if (value.error) lines.push(`错误：${value.error.code || ''} ${value.error.message || ''}`.trim())
  if (value.fallback) lines.push(`回退：Direct=${value.fallback.direct ? '可用' : '不可用'} · yt-dlp=${value.fallback.ytdlp ? '可用' : '不可用'} · HF=${value.fallback.hf ? '可用' : '不可用'} · magnet=${value.fallback.magnet ? '可用' : '不可用'}`)
  if (value.phase === 'consent-required' || value.consent_required) lines.push('需要用户明确确认后才能安装；AI 不能代替确认。')
  return textBlock(lines.join('\n'))
}

function renderDoctor(_args, value) {
  if (!value || value.ok !== true) return renderFailure(value)
  const lines = [`🩺 dsh-download-nexus ${value.version || ''} 诊断`.trim()]
  lines.push(`默认目录：${value.default_save_dir}`)
  lines.push(`允许根目录：${(value.allowed_roots || []).join('；')}`)
  lines.push(`加速：${value.accel?.detail || '未发现'}${value.accel?.proxy ? `（${value.accel.proxy}）` : ''}`)
  for (const [id, row] of Object.entries(value.engines || {})) {
    lines.push(`- ${id}: ${row.available ? '可用' : '不可用'}${row.detail ? ` · ${row.detail}` : ''}`)
  }
  if (value.github_mirror) {
    lines.push(`GitHub 镜像：${value.github_mirror.base}（默认${value.github_mirror.default_enabled ? '开启' : '关闭'}）`)
  }
  for (const [id, row] of Object.entries(value.package_managers || {})) {
    if (row?.registry) lines.push(`- ${id}: ${row.classification} · ${row.registry}`)
  }
  if (value.motrix?.endpointFile) lines.push(`Motrix 端点：${value.motrix.endpointFile}（端口 ${value.motrix.port || '?'}）`)
  if (value.probe_url) lines.push(`URL 探测：${value.probe_url.allowed ? '允许' : '拒绝'} · ${value.probe_url.url}`)
  return textBlock(lines.join('\n'))
}

const GENERIC_OUTPUT = {
  type: 'object',
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean' },
    code: { type: 'string' },
    message: { type: 'string' },
    hint: { type: 'string' },
    task_ref: { type: 'string' },
    engine: { type: 'string' },
    final_path: { type: 'string' },
    saved_to: { type: 'string' },
    timed_out: { type: 'boolean' },
  },
}

export function createTools({ conductor, cfg, provisioning }) {
  const download = {
    name: toolName(cfg, 'download'),
    description:
      '把网络资源下载到本地：自动按目标类型选择引擎（普通文件→Motrix/直连，视频→yt-dlp，Hugging Face→hf CLI，magnet/.torrent→Motrix）。必须给 save_dir；大文件先 wait_seconds=0 拿 task_ref，再用 download_status 轮询。GitHub 直链默认直连；用户明确要求镜像时才传 github_mirror:true。不要在 shell 里用 curl/wget 写盘，会被拦截。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string', description: '要下载的 URL、magnet 链接或 .torrent URL' },
        save_dir: { type: 'string', description: `必填：下载到哪个目录（默认 ${cfg.defaultSaveDir}，必须在允许根目录内）` },
        filename: { type: 'string', description: '另存文件名（仅单文件 HTTP/HTTPS 下载；不要带路径）' },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: '额外请求头（只允许 authorization/cookie/user-agent/accept/referer/range 等安全头）',
        },
        engine: {
          type: 'string',
          enum: ['auto', 'motrix', 'direct', 'ytdlp', 'hf'],
          default: 'auto',
          description: 'auto=按类型路由；显式指定则不跨引擎回退',
        },
        github_mirror: {
          type: 'boolean',
          default: false,
          description:
            'GitHub 直链是否走 ghfast.top 镜像（默认关；只对 github.com/raw.githubusercontent.com/codeload.github.com 生效，且需用户同意）',
        },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 3600,
          default: 0,
          description: '最多等待完成的秒数；0=提交后立即返回',
        },
        quality: {
          type: 'string',
          enum: ['best', '1080', '720', '480', '360', 'audio'],
          description: '视频清晰度（yt-dlp 引擎）',
        },
        format: { type: 'string', description: '自定义 yt-dlp format selector（高级；一般用 quality）' },
        subtitles: { type: 'boolean', description: '同时下载中英字幕（yt-dlp）' },
        playlist: { type: 'boolean', description: '允许下载整个播放列表（默认 false）' },
        cookies_from_browser: { type: 'string', description: '从浏览器读取 cookies：chrome/edge/firefox/brave/chromium/opera/vivaldi/safari' },
        repo_type: { type: 'string', enum: ['model', 'dataset', 'space'], description: 'Hugging Face 仓库类型' },
        revision: { type: 'string', description: 'Hugging Face revision（分支/tag/commit，默认 main）' },
        include: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hugging Face 文件 glob，如 ["*.safetensors","*.json"]；不给则整仓',
        },
      },
      required: ['url', 'save_dir'],
    },
    output: { schema: GENERIC_OUTPUT, render: (args, value) => renderDownload(args, value, cfg) },
    timeoutMs: Math.max(120_000, (cfg.maxWaitSeconds + 60) * 1000),
    async execute(args, exec) {
      try {
        return await conductor.download(args, exec)
      } catch (error) {
        return errorPayload(error)
      }
    },
  }

  const status = {
    name: toolName(cfg, 'download_status'),
    description:
      '查询本插件签发的下载任务：给 task_ref 查详情并可等待；不给 task_ref 列出当前会话任务和 Motrix 全局速度。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task_ref: { type: 'string', description: 'download 返回的 task_ref，例如 motrix:<uuid> 或 direct:<uuid>' },
        wait_seconds: { type: 'integer', minimum: 0, maximum: 3600, default: 0, description: '最多等待完成的秒数' },
      },
    },
    output: { schema: GENERIC_OUTPUT, render: renderStatus },
    timeoutMs: Math.max(120_000, (cfg.maxWaitSeconds + 60) * 1000),
    async execute(args, exec) {
      try {
        return await conductor.status(args, exec)
      } catch (error) {
        return errorPayload(error)
      }
    },
  }

  const control = {
    name: toolName(cfg, 'download_control'),
    description:
      '控制本插件签发的下载任务：pause 暂停、resume 恢复、cancel 取消但保留文件、purge 删除任务和文件（必须 confirm:true）。只接受本插件返回的 task_ref。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task_ref: { type: 'string', description: 'download 返回的 task_ref' },
        action: { type: 'string', enum: ['pause', 'resume', 'cancel', 'purge'] },
        confirm: { type: 'boolean', description: 'purge 时必须为 true；其他动作忽略' },
      },
      required: ['task_ref', 'action'],
    },
    output: { schema: GENERIC_OUTPUT, render: renderControl },
    timeoutMs: 30_000,
    async execute(args, exec) {
      try {
        return await conductor.control(args, exec)
      } catch (error) {
        return errorPayload(error)
      }
    },
  }

  const doctor = {
    name: toolName(cfg, 'download_doctor'),
    description:
      '诊断下载环境：检查 Motrix 桥、内置直连、yt-dlp、hf CLI 是否可用，探测本地代理，读取允许目录；也可只读探测一个 URL 是否被 SSRF 策略允许。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        probe_url: { type: 'string', description: '可选：只做分类和 SSRF 检查，不下载' },
        verbose: { type: 'boolean', description: '输出更完整的配置' },
      },
    },
    output: { schema: GENERIC_OUTPUT, render: renderDoctor },
    timeoutMs: 15_000,
    async execute(args) {
      try {
        return await conductor.doctor(args)
      } catch (error) {
        return errorPayload(error)
      }
    },
  }

  const provision = {
    name: toolName(cfg, 'motrix_provision'),
    description:
      'Motrix 自动部署：只读检测已有安装/进程/bridge/版本；install 需要用户明确 confirm:true 后才下载官方固定版本并安装。默认官方 NSIS 安装包，portable 为可选。不覆盖已有安装、不终止用户 Motrix、不绕过 SmartScreen/UAC。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'install', 'start', 'cancel', 'recover'],
          default: 'status',
          description: 'status=只读检测；install=安装（需 confirm）；start=启动已安装 Motrix；cancel/recover 处理安装任务',
        },
        mode: {
          type: 'string',
          enum: ['installer', 'portable'],
          default: 'installer',
          description: 'installer=官方 NSIS 安装包；portable=官方便携 ZIP（解压到本插件目录）',
        },
        confirm: {
          type: 'boolean',
          default: false,
          description: 'install 必须为 true，表示用户已明确同意安装；AI 不能代替用户确认',
        },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 3600,
          default: 0,
          description: 'install 时最多等待的秒数；0=后台继续，用 status 查询',
        },
      },
    },
    output: { schema: GENERIC_OUTPUT, render: renderProvision },
    timeoutMs: Math.max(120_000, (cfg.maxWaitSeconds + 60) * 1000),
    async execute(args) {
      try {
        if (!provisioning) {
          return { ok: false, code: 'E_PROVISION_UNAVAILABLE', message: 'Motrix 自动部署服务不可用' }
        }
        const action = String(args?.action || 'status')
        if (action === 'status') return await provisioning.status()
        if (action === 'install') {
          return await provisioning.install({
            mode: args?.mode === 'portable' ? 'portable' : 'installer',
            confirm: args?.confirm === true,
            waitSeconds: Number(args?.wait_seconds) || 0,
          })
        }
        if (action === 'start') return await provisioning.start()
        if (action === 'cancel') return await provisioning.cancel()
        if (action === 'recover') return await provisioning.recover()
        return { ok: false, code: 'E_PROVISION_UNSUPPORTED', message: `未知 action：${action}` }
      } catch (error) {
        return errorPayload(error)
      }
    },
  }

  return [download, status, control, doctor, provision]
}
