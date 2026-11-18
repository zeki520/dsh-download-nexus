import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import tls from 'node:tls'
import { copyFile, link, open, unlink } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ConductorError } from './errors.mjs'
import {
  assertSafeFilename,
  chooseTargetPath,
  filenameFromDisposition,
  filenameFromUrl,
  randomPartPath,
} from './paths.mjs'
import { assertLocalProxy, createPinnedLookup } from './net-policy.mjs'

const MAX_REDIRECTS = 5
const ALLOWED_HEADERS = new Set([
  'authorization',
  'cookie',
  'user-agent',
  'accept',
  'accept-language',
  'referer',
  'range',
  'if-range',
  'cache-control',
])
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'host', 'referer'])

export function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {}
  const out = {}
  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = String(rawName || '').trim().toLowerCase()
    const value = typeof rawValue === 'string' ? rawValue : rawValue == null ? '' : String(rawValue)
    if (!name || !ALLOWED_HEADERS.has(name)) continue
    if (!value || /[\r\n]/.test(value)) continue
    out[name] = value
  }
  return out
}

export function stripSensitive(headers) {
  const out = {}
  for (const [name, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(name)) out[name] = value
  }
  return out
}

function originOf(raw) {
  const url = new URL(raw)
  return `${url.protocol}//${url.host}`
}

export function normalizeAddress(value) {
  const raw = String(value || '').replace(/^\[|\]$/g, '').toLowerCase()
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw
}

export function assertRemoteAddress(allowed, res) {
  const remote = res?.socket?.remoteAddress
  if (!remote) return
  const expected = (allowed?.addresses || []).map((entry) => normalizeAddress(entry.address))
  if (!expected.includes(normalizeAddress(remote))) {
    res.destroy()
    throw new ConductorError('E_TARGET', `实际连接地址与 DNS 解析结果不一致：${remote}`, {
      info: { remote, expected },
    })
  }
}

function connectTunnel(proxy, targetUrl, { timeoutMs, signal } = {}) {
  return new Promise((resolve, reject) => {
    const host = targetUrl.hostname.replace(/^\[|\]$/g, '')
    const port = Number(targetUrl.port) || 443
    const req = http.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers: { Host: `${host}:${port}` },
      timeout: timeoutMs,
      signal,
    })
    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy()
        reject(new ConductorError('E_NEED_ACCEL', `代理 CONNECT 失败：HTTP ${res.statusCode}`))
        return
      }
      const tlsSocket = tls.connect({ socket, servername: host })
      tlsSocket.once('secureConnect', () => resolve(tlsSocket))
      tlsSocket.once('error', reject)
    })
    req.on('timeout', () => req.destroy(new ConductorError('E_IO', '代理连接超时')))
    req.on('error', reject)
    req.end()
  })
}

function requestOnce({ allowed, headers, proxy, timeoutMs, signal, method = 'GET' }) {
  return new Promise((resolve, reject) => {
    const { url, addresses } = allowed
    const lookup = createPinnedLookup(addresses)
    const targetHost = url.hostname.replace(/^\[|\]$/g, '')
    let req

    if (proxy) {
      if (url.protocol === 'https:') {
        connectTunnel(proxy, url, { timeoutMs, signal })
          .then((socket) => {
            const agent = new https.Agent({
              keepAlive: false,
              maxSockets: 1,
              createConnection: () => socket,
            })
            req = https.request(
              {
                host: targetHost,
                port: Number(url.port) || 443,
                path: `${url.pathname}${url.search}`,
                method,
                headers,
                agent,
                signal,
              },
              resolve,
            )
            req.setTimeout(timeoutMs, () => req.destroy(new ConductorError('E_IO', '下载连接超时')))
            req.on('error', reject)
            req.end()
          })
          .catch(reject)
        return
      }
      req = http.request(
        {
          host: proxy.host,
          port: proxy.port,
          path: url.toString(),
          method,
          headers: { ...headers, Host: url.host },
          signal,
        },
        resolve,
      )
    } else {
      const transport = url.protocol === 'https:' ? https : http
      req = transport.request(
        {
          host: targetHost,
          port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          lookup,
          signal,
        },
        resolve,
      )
    }

    req.setTimeout(timeoutMs, () => req.destroy(new ConductorError('E_IO', '下载连接超时')))
    req.on('error', (error) => {
      if (signal?.aborted) reject(new ConductorError('E_CANCELLED', '下载已取消'))
      else reject(error)
    })
    req.end()
  })
}

async function openResponse({ startUrl, headers, proxy, netPolicy, timeoutMs, signal, method = 'GET' }) {
  let current = startUrl
  let currentHeaders = { ...headers }
  let redirects = MAX_REDIRECTS
  for (;;) {
    const allowed = await netPolicy.assertUrlAllowed(current, {
      proxy: Boolean(proxy),
      allowFakeIp: Boolean(proxy),
    })
    const res = await requestOnce({ allowed, headers: currentHeaders, proxy, timeoutMs, signal, method })
    if (!proxy) assertRemoteAddress(allowed, res)
    const status = res.statusCode || 0
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume()
      if (redirects <= 0) throw new ConductorError('E_TARGET', '重定向次数过多')
      redirects -= 1
      const next = new URL(res.headers.location, current).toString()
      if (originOf(current) !== originOf(next)) currentHeaders = stripSensitive(currentHeaders)
      current = next
      continue
    }
    if (status < 200 || status >= 300) {
      res.resume()
      throw new ConductorError('E_IO', `HTTP ${status} ${res.statusMessage || ''}`.trim(), {
        info: { status, url: current },
      })
    }
    return { res, finalUrl: current, allowed }
  }
}

function nextCandidate(dir, filename, ordinal) {
  const ext = filename.slice(filename.lastIndexOf('.')) || ''
  const stem = ext ? filename.slice(0, -ext.length) : filename
  return path.join(dir, `${stem} (${ordinal})${ext}`)
}

async function placeAtomically(partPath, target, dir, filename) {
  let finalPath = target
  for (let i = 0; i < 50; i += 1) {
    try {
      await link(partPath, finalPath)
      await unlink(partPath).catch(() => {})
      return finalPath
    } catch (error) {
      if (error.code === 'EEXIST') {
        finalPath = nextCandidate(dir, filename, i + 1)
        continue
      }
      if (error.code === 'EPERM' || error.code === 'ENOSYS' || error.code === 'EACCES') {
        // Filesystems without hard links: COPYFILE_EXCL still refuses to
        // overwrite an existing target, so the no-clobber guarantee holds.
        try {
          await copyFile(partPath, finalPath, fs.constants.COPYFILE_EXCL)
          await unlink(partPath).catch(() => {})
          return finalPath
        } catch (copyError) {
          if (copyError.code === 'EEXIST') {
            finalPath = nextCandidate(dir, filename, i + 1)
            continue
          }
          await unlink(partPath).catch(() => {})
          throw copyError
        }
      }
      await unlink(partPath).catch(() => {})
      throw error
    }
  }
  await unlink(partPath).catch(() => {})
  throw new ConductorError('E_IO', '无法为下载文件找到不冲突的目标名')
}

/**
 * Read Content-Length without writing a file. HEAD is tried first; some CDNs
 * reject HEAD, so a one-byte ranged GET is used as a fallback. Any network or
 * protocol failure is fail-open (null) except an SSRF-policy rejection, which
 * must remain a hard error.
 */
export async function requestJson({
  url,
  headers,
  proxy,
  netPolicy,
  timeoutMs = 8_000,
  signal,
  maxBytes = 4 * 1024 * 1024,
} = {}) {
  const res = await openResponse({
    startUrl: url,
    headers: normalizeHeaders(headers),
    proxy,
    netPolicy,
    timeoutMs,
    signal,
    method: 'GET',
  })
  let total = 0
  const chunks = []
  for await (const chunk of res) {
    total += chunk.length
    if (total > maxBytes) {
      res.destroy()
      throw new ConductorError('E_IO', `JSON 响应超过 ${maxBytes} 字节`, {
        info: { kind: 'limit', bytes: total, max_bytes: maxBytes },
      })
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return { json: JSON.parse(text), headers: res.headers }
  } catch (error) {
    throw new ConductorError('E_IO', 'JSON 响应无法解析', { cause: error, info: { url } })
  }
}

export async function probeContentLength({ url, proxy, netPolicy, timeoutMs = 5_000, signal, headers } = {}) {
  if (!netPolicy) throw new ConductorError('E_TARGET', '缺少出站策略')
  const proxyInfo = proxy ? (typeof proxy === 'string' ? assertLocalProxy(proxy) : proxy) : null
  const cleanHeaders = normalizeHeaders(headers)
  try {
    const { res } = await openResponse({
      startUrl: url,
      headers: cleanHeaders,
      proxy: proxyInfo,
      netPolicy,
      timeoutMs,
      signal,
      method: 'HEAD',
    })
    const expected = Number(res.headers['content-length'])
    res.resume()
    if (Number.isFinite(expected) && expected > 0) return expected
  } catch (error) {
    if (error?.code === 'E_TARGET') throw error
  }

  try {
    const { res } = await openResponse({
      startUrl: url,
      headers: { ...cleanHeaders, range: 'bytes=0-0' },
      proxy: proxyInfo,
      netPolicy,
      timeoutMs,
      signal,
      method: 'GET',
    })
    const range = String(res.headers['content-range'] || '')
    res.destroy()
    const match = range.match(/\/(\d+)\s*$/)
    if (match) return Number(match[1])
  } catch (error) {
    if (error?.code === 'E_TARGET') throw error
  }
  return null
}

/**
 * Hardened direct HTTP(S) downloader.
 *
 * Differences from the reference fallback:
 *   - SSRF policy on every URL and every redirect (DNS resolved + pinned)
 *   - sensitive headers stripped on cross-origin redirects
 *   - header allow-list, no Host override
 *   - byte cap, `.part` with random suffix, atomic no-clobber placement
 *   - optional loopback HTTP proxy (CONNECT for HTTPS)
 */
export async function downloadDirect({
  url,
  saveDir,
  filename,
  headers,
  proxy,
  maxBytes,
  netPolicy,
  timeoutMs = 60_000,
  signal,
  onProgress,
  allowExecutable = false,
}) {
  if (!netPolicy) throw new ConductorError('E_TARGET', '缺少出站策略')
  const proxyInfo = proxy ? (typeof proxy === 'string' ? assertLocalProxy(proxy) : proxy) : null
  const cleanHeaders = normalizeHeaders(headers)
  const { res, finalUrl } = await openResponse({
    startUrl: url,
    headers: cleanHeaders,
    proxy: proxyInfo,
    netPolicy,
    timeoutMs,
    signal,
  })

  const contentType = String(res.headers['content-type'] || '')
  const expected = Number(res.headers['content-length'])
  if (Number.isFinite(expected) && expected > 0 && expected > maxBytes) {
    res.destroy()
    throw new ConductorError('E_IO', `文件大小 ${expected} 字节超过上限 ${maxBytes} 字节`, {
      hint: '如果确实需要，请让用户调大插件 config.maxBytes 后重启 DSH。',
    })
  }

  const explicit = filename ? assertSafeFilename(filename, { allowExecutable }) : ''
  const suggested =
    filenameFromDisposition(res.headers['content-disposition']) ||
    filenameFromUrl(finalUrl) ||
    'download'
  const safeName = explicit || assertSafeFilename(suggested, { allowExecutable })
  const target = chooseTargetPath(saveDir, safeName)
  const partPath = randomPartPath(target)
  const fh = await open(partPath, 'wx')

  let bytes = 0
  let done = false
  try {
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length
        if (bytes > maxBytes) {
          callback(new ConductorError('E_IO', `下载超过上限 ${maxBytes} 字节`))
          return
        }
        if (typeof onProgress === 'function') onProgress({ bytes, total: Number.isFinite(expected) ? expected : null })
        callback(null, chunk)
      },
    })
    await pipeline(res, counter, fh.createWriteStream({ autoClose: true }))
    if (Number.isFinite(expected) && expected >= 0 && bytes !== expected) {
      throw new ConductorError('E_IO', `下载不完整：收到 ${bytes} / ${expected} 字节`)
    }
    const finalPath = await placeAtomically(partPath, target, saveDir, safeName)
    done = true
    return {
      path: finalPath,
      bytes,
      contentType,
      finalUrl,
      saveDir,
      filename: safeName,
    }
  } finally {
    if (!done) {
      await unlink(partPath).catch(() => {})
    }
    if (signal?.aborted) {
      throw new ConductorError('E_CANCELLED', '下载已取消')
    }
  }
}
