import { loadConfig } from './lib/config.mjs'
import { createConductor } from './lib/conductor.mjs'
import { createPreExecuteHook } from './guard/hook.mjs'
import { createPromptSection } from './prompt.mjs'
import { createStatusService } from './lib/status.mjs'
import { createStatusRoute } from './lib/status-route.mjs'
import { createProvisioningService } from './lib/provisioning/service.mjs'
import { createTools } from './tools/index.mjs'

export { Config } from './lib/schema.mjs'

export const name = 'dsh-download-nexus'
export const inject = ['tools']

function ownEffect(ctx, factory) {
  ctx.effect(() => {
    const dispose = factory()
    if (typeof dispose === 'function') return dispose
    if (dispose && typeof dispose.dispose === 'function') return () => dispose.dispose()
    return () => {}
  })
}

export function apply(ctx, config = {}) {
  const cfg = loadConfig(config, { cwd: process.cwd(), env: process.env })
  const conductor = createConductor({ cfg, env: process.env, platform: process.platform })
  ownEffect(ctx, () => () => conductor.dispose())

  const provisioning = createProvisioningService({
    cfg,
    conductor,
    env: process.env,
    platform: process.platform,
    arch: process.arch,
  })
  ownEffect(ctx, () => () => provisioning.dispose())

  // The guard runs before other pre-execute hooks so a shell download is
  // denied before another plugin can rewrite the call.
  ownEffect(ctx, () => ctx.on('tools/pre-execute', createPreExecuteHook({ cfg }), { prepend: true }))

  const tools = createTools({ conductor, cfg, provisioning })
  for (const tool of tools) {
    ownEffect(ctx, () => ctx.tools.register(tool))
  }

  const status = createStatusService({ cfg, conductor, tools })

  // Host-side facade for other plugins. The browser page uses the HTTP route
  // below because browser services cannot reach a Host-only cordis service.
  if (typeof ctx.provide === 'function') {
    ownEffect(ctx, () => ctx.provide('downloadNexusStatus', status))
  }

  try {
    // The browser page cannot read Host services, and a local port is not an
    // authorization boundary. Reuse the token DSH already issues for its web
    // connection, then require it on every status request. Keep the inject
    // disposer inside ctx.effect so a reload/uninstall removes the route.
    if (typeof ctx.inject === 'function') {
      ownEffect(ctx, () => ctx.inject(['webServer', 'connection'], (scope) => {
        try {
          const webServer = scope.get('webServer')
          const connection = scope.get('connection')
          if (!webServer || typeof webServer.register !== 'function') return
          if (!connection || typeof connection.admit !== 'function') {
            console.warn('[dsh-download-nexus] 配置页状态路由未注册：connection 服务不可用')
            return
          }
          const authenticate = (req) => {
            try {
              const admission = connection.admit({ headers: req.headers || {} })
              if (admission && admission.peer) return { ok: true }
              return {
                ok: false,
                status: Number(admission?.rejection) || 401,
                code: 'E_AUTH',
                message: '未授权：缺少 DSH 会话凭据',
              }
            } catch (error) {
              return { ok: false, status: 401, code: 'E_AUTH', message: error?.message || '认证失败' }
            }
          }
          const dispose = webServer.register({
            kind: 'exact',
            path: '/api/dsh-download-nexus/status',
            handler: createStatusRoute({ status, authenticate }),
          })
          return () => dispose?.()
        } catch (error) {
          console.warn(`[dsh-download-nexus] 配置页状态路由注册失败：${error?.message ?? error}`)
        }
      }))
    }
  } catch (error) {
    console.warn(`[dsh-download-nexus] 配置页状态路由注册失败：${error?.message ?? error}`)
  }

  // Best-effort: a missing systemPrompt service must not break the tools.
  try {
    const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : undefined
    if (systemPrompt && typeof systemPrompt.section === 'function') {
      ownEffect(ctx, () => systemPrompt.section(createPromptSection({ cfg })))
    }
  } catch (error) {
    console.warn(`[dsh-download-nexus] 提示词片段注册失败：${error?.message ?? error}`)
  }
}
