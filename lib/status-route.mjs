function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

/**
 * Host-only status endpoint for the bundle config page.
 *
 * Authorization is delegated to the DSH connection service (`admit`) so the
 * route uses the same launch-token/browser-session cookie as every other Host
 * API. sec-fetch-site is only a second browser-side signal, never the gate.
 */
export function createStatusRoute({ status, authenticate }) {
  return async function handleStatusRoute(req, res) {
    try {
      const auth = typeof authenticate === 'function'
        ? authenticate(req)
        : { ok: false, status: 503, code: 'E_AUTH_UNAVAILABLE', message: 'Host 认证服务不可用' }
      if (!auth?.ok) {
        sendJson(res, auth?.status || 401, {
          ok: false,
          error: {
            code: auth?.code || 'E_AUTH',
            message: auth?.message || '未授权：缺少 DSH 会话凭据',
          },
        })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: { code: 'E_METHOD', message: '只支持 GET' } })
        return
      }
      const site = String(req.headers?.['sec-fetch-site'] || '')
      if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
        sendJson(res, 403, { ok: false, error: { code: 'E_ORIGIN', message: '跨站请求被拒绝' } })
        return
      }

      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const op = url.searchParams.get('op') || 'snapshot'
      let data
      if (op === 'snapshot') {
        data = await status.snapshot()
      } else if (op === 'probe') {
        const ids = (url.searchParams.get('ids') || 'all').split(',').map((id) => id.trim()).filter(Boolean)
        const force = url.searchParams.get('force') === '1'
        data = await status.probe(ids, { force })
      } else if (op === 'diagnose') {
        data = await status.diagnose({ verbose: url.searchParams.get('verbose') === '1' })
      } else if (op === 'validateRoot') {
        data = await status.validateRoot(url.searchParams.get('path') || '')
      } else {
        sendJson(res, 400, { ok: false, error: { code: 'E_OP', message: `未知操作：${op}` } })
        return
      }
      sendJson(res, 200, { ok: true, data })
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: { code: error?.code || 'E_STATUS', message: error?.message || String(error) },
      })
    }
  }
}
