import dns from 'node:dns/promises'
import net from 'node:net'
import { ConductorError } from './errors.mjs'

const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

const BLOCKED_V6 = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
]

function stripBrackets(host) {
  return String(host || '').replace(/^\[|\]$/g, '')
}

function isLoopbackAddress(address) {
  const a = stripBrackets(address)
  return a === '::1' || a === '127.0.0.1' || a.startsWith('127.')
}

function isFakeIpv4(address) {
  const mapped = stripBrackets(address).toLowerCase().startsWith('::ffff:')
    ? stripBrackets(address).slice(7)
    : stripBrackets(address)
  if (net.isIP(mapped) !== 4) return false
  const [a, b] = mapped.split('.').map(Number)
  return a === 198 && (b === 18 || b === 19)
}

/**
 * Build the SSRF policy. The reference implementation checked only the URL
 * scheme, so a model-supplied URL could read loopback services, private LAN
 * hosts or cloud metadata. This policy resolves the hostname first and checks
 * every address, then the HTTP client pins that answer and re-checks the
 * connected socket.
 */
export function createNetPolicy({ allowLoopback = false } = {}) {
  const blockList = new net.BlockList()
  for (const [address, prefix] of BLOCKED_V4) blockList.addSubnet(address, prefix, 'ipv4')
  for (const [address, prefix] of BLOCKED_V6) blockList.addSubnet(address, prefix, 'ipv6')

  function blocked(address) {
    const raw = stripBrackets(address)
    if (allowLoopback && isLoopbackAddress(raw)) return false
    const mapped = raw.toLowerCase().startsWith('::ffff:') ? raw.slice(7) : raw
    const family = net.isIP(mapped)
    if (family === 4) return blockList.check(mapped, 'ipv4')
    if (family === 6) return blockList.check(mapped, 'ipv6')
    return true
  }

  async function resolve(hostname, { lookup = dns.lookup } = {}) {
    const host = stripBrackets(hostname)
    const literal = net.isIP(host)
    if (literal) return [{ address: host, family: literal }]
    let rows
    try {
      rows = await lookup(host, { all: true, verbatim: true })
    } catch (error) {
      throw new ConductorError('E_TARGET', `域名解析失败：${host}`, { cause: error })
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ConductorError('E_TARGET', `域名解析不到地址：${host}`)
    }
    return rows
  }

  async function assertRemoteTargetAllowed(
    raw,
    { lookup = dns.lookup, proxy = false, allowFakeIp = false, protocols = ['http:', 'https:', 'ftp:', 'ftps:'] } = {},
  ) {
    let url
    try {
      url = new URL(String(raw))
    } catch (error) {
      throw new ConductorError('E_TARGET', `无效 URL：${raw}`, { cause: error })
    }
    if (!protocols.includes(url.protocol)) {
      throw new ConductorError('E_TARGET', `不支持的协议：${url.protocol}`)
    }
    if (url.username || url.password) {
      throw new ConductorError('E_TARGET', 'URL 不允许内嵌用户名或密码')
    }

    const literal = net.isIP(stripBrackets(url.hostname))
    const addresses = await resolve(url.hostname, { lookup })
    if (addresses.length === 0) {
      throw new ConductorError('E_TARGET', `域名解析不到地址：${url.hostname}`)
    }

    // A local proxy with fake-ip DNS (FlClash TUN) may return 198.18/15 for
    // public names. Trust that range only for hostnames, only with a local
    // proxy, and only when no other answer is a blocked real address. Mixed
    // A+AAAA answers (fake-ip + real public IPv6) must not be rejected; a real
    // private address in the same answer set must still be rejected.
    const hasFakeIp = addresses.some((entry) => isFakeIpv4(entry.address))
    if (!literal && proxy && allowFakeIp && hasFakeIp) {
      const offending = addresses.find((entry) => !isFakeIpv4(entry.address) && blocked(entry.address))
      if (!offending) {
        return {
          url,
          addresses,
          fakeIp: true,
          binding: url.protocol === 'https:' ? 'proxy-connect' : 'proxy-absolute',
          verifiable: false,
        }
      }
    }

    for (const entry of addresses) {
      if (blocked(entry.address)) {
        throw new ConductorError('E_TARGET', `目标地址不允许（回环/私网/链路本地/保留地址）：${entry.address}`, {
          hint:
            '普通下载不要指向 localhost 或内网。' +
            '如果你确实需要这个内网资源，请在本机 Motrix 客户端中手动添加该链接。',
        })
      }
    }
    return {
      url,
      addresses,
      fakeIp: false,
      binding: proxy ? (url.protocol === 'https:' ? 'proxy-connect' : 'proxy-absolute') : 'pinned-direct',
      verifiable: !proxy,
    }
  }

  async function assertUrlAllowed(raw, { lookup = dns.lookup, proxy = false, allowFakeIp = false } = {}) {
    return assertRemoteTargetAllowed(raw, {
      lookup,
      proxy,
      allowFakeIp,
      protocols: ['http:', 'https:'],
    })
  }

  return {
    allowLoopback,
    blocked,
    resolve,
    assertRemoteTargetAllowed,
    assertUrlAllowed,
    isLoopbackAddress,
  }
}

/** Pin the DNS answer so redirects cannot re-resolve to a different address. */
export function createPinnedLookup(addresses) {
  return (hostname, options, callback) => {
    let opts = options
    let cb = callback
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
      cb(new Error(`没有可用的解析结果：${hostname}`))
      return
    }
    if (opts && opts.all) {
      cb(null, addresses)
      return
    }
    cb(null, addresses[0].address, addresses[0].family)
  }
}

/** Only loopback HTTP proxies are accepted; no credentials, no remote proxy. */
export function assertLocalProxy(raw) {
  let url
  try {
    url = new URL(String(raw))
  } catch (error) {
    throw new ConductorError('E_NEED_ACCEL', `代理地址无效：${raw}`, { cause: error })
  }
  if (url.protocol !== 'http:') {
    throw new ConductorError('E_NEED_ACCEL', '只支持 http:// 形式的本地代理')
  }
  if (url.username || url.password) {
    throw new ConductorError('E_NEED_ACCEL', '代理地址不允许带用户名/密码')
  }
  const host = stripBrackets(url.hostname)
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    throw new ConductorError('E_NEED_ACCEL', `代理必须在本机：${host}`)
  }
  const port = Number(url.port)
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    throw new ConductorError('E_NEED_ACCEL', `代理端口无效：${raw}`)
  }
  return { host, port, url: `http://${host.includes(':') ? `[${host}]` : host}:${port}` }
}

export function proxyFromEnv(env = process.env) {
  const raw = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || ''
  if (!raw) return null
  try {
    const proxy = assertLocalProxy(raw)
    return { ...proxy, source: 'env' }
  } catch {
    return null
  }
}
