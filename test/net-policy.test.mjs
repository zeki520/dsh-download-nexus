import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertLocalProxy,
  createNetPolicy,
  proxyFromEnv,
} from '../lib/net-policy.mjs'

const lookup = async () => [{ address: '93.184.216.34', family: 4 }]

test('assertUrlAllowed accepts a public host with a faked DNS answer', async () => {
  const policy = createNetPolicy()
  const result = await policy.assertUrlAllowed('https://example.com/a.bin', { lookup })
  assert.equal(result.url.hostname, 'example.com')
  assert.equal(result.addresses[0].address, '93.184.216.34')
})

test('assertUrlAllowed rejects loopback, private, link-local and metadata addresses', async () => {
  const policy = createNetPolicy()
  const cases = [
    'http://127.0.0.1/',
    'http://10.1.2.3/',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'http://[fe80::1]/',
  ]
  for (const url of cases) {
    await assert.rejects(policy.assertUrlAllowed(url), (error) => error.code === 'E_TARGET', url)
  }
})

test('assertUrlAllowed blocks a public name that resolves to a private address', async () => {
  const policy = createNetPolicy()
  const privateLookup = async () => [{ address: '192.168.0.10', family: 4 }]
  await assert.rejects(
    policy.assertUrlAllowed('https://evil.example/x', { lookup: privateLookup }),
    (error) => error.code === 'E_TARGET',
  )
})

test('assertUrlAllowed rejects non-http schemes and embedded credentials', async () => {
  const policy = createNetPolicy()
  await assert.rejects(policy.assertUrlAllowed('ftp://example.com/x'), (error) => error.code === 'E_TARGET')
  await assert.rejects(
    policy.assertUrlAllowed('https://user:pass@example.com/x', { lookup }),
    (error) => error.code === 'E_TARGET',
  )
  await assert.rejects(policy.assertUrlAllowed('not a url'), (error) => error.code === 'E_TARGET')
})

test('allowLoopback is an explicit escape hatch, not the default', async () => {
  const open = createNetPolicy({ allowLoopback: true })
  const result = await open.assertUrlAllowed('http://127.0.0.1:8080/x')
  assert.equal(result.url.hostname, '127.0.0.1')
})

test('assertUrlAllowed rejects the unspecified, NAT64 and 6to4 IPv6 ranges', async () => {
  const policy = createNetPolicy()
  for (const url of ['http://[::]/', 'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/']) {
    await assert.rejects(policy.assertUrlAllowed(url), (error) => error.code === 'E_TARGET', url)
  }
})

test('assertRemoteTargetAllowed accepts ftp and applies the fake-ip exception only with a proxy', async () => {
  const policy = createNetPolicy()
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]
  await policy.assertRemoteTargetAllowed('ftp://example.com/x', { lookup: publicLookup })

  const fakeLookup = async () => [{ address: '198.18.0.5', family: 4 }]
  const proxied = await policy.assertRemoteTargetAllowed('https://example.com/x', {
    lookup: fakeLookup,
    proxy: true,
    allowFakeIp: true,
  })
  assert.equal(proxied.fakeIp, true)
  await assert.rejects(
    policy.assertRemoteTargetAllowed('https://example.com/x', { lookup: fakeLookup }),
    (error) => error.code === 'E_TARGET',
  )
  await assert.rejects(
    policy.assertRemoteTargetAllowed('https://198.18.0.5/x', { proxy: true, allowFakeIp: true }),
    (error) => error.code === 'E_TARGET',
  )
  const mixedLookup = async () => [
    { address: '198.18.0.5', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ]
  await assert.rejects(
    policy.assertRemoteTargetAllowed('https://example.com/x', {
      lookup: mixedLookup,
      proxy: true,
      allowFakeIp: true,
    }),
    (error) => error.code === 'E_TARGET',
  )
})

test('assertLocalProxy accepts only loopback HTTP proxies', () => {
  assert.deepEqual(assertLocalProxy('http://127.0.0.1:7890'), {
    host: '127.0.0.1',
    port: 7890,
    url: 'http://127.0.0.1:7890',
  })
  assert.equal(assertLocalProxy('http://[::1]:7890').url, 'http://[::1]:7890')
  for (const bad of ['http://10.0.0.1:7890', 'socks5://127.0.0.1:7890', 'http://user:pass@127.0.0.1:7890', 'http://127.0.0.1:0']) {
    assert.throws(() => assertLocalProxy(bad), (error) => error.code === 'E_NEED_ACCEL', bad)
  }
})

test('proxyFromEnv ignores remote proxies and reports the local one', () => {
  assert.equal(proxyFromEnv({ HTTP_PROXY: 'http://10.0.0.1:7890' }), null)
  const found = proxyFromEnv({ HTTPS_PROXY: 'http://127.0.0.1:7890' })
  assert.equal(found.source, 'env')
  assert.equal(found.port, 7890)
})

test('DNS lookup failures become a policy error instead of a raw socket error', async () => {
  const policy = createNetPolicy()
  const failing = async () => {
    throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
  }
  await assert.rejects(
    policy.assertRemoteTargetAllowed('https://missing.example/x', { lookup: failing }),
    (error) => error.code === 'E_TARGET' && /域名解析失败/.test(error.message),
  )
})

test('binding metadata is explicit for direct and proxy transports', async () => {
  const policy = createNetPolicy()
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]
  const direct = await policy.assertRemoteTargetAllowed('https://example.com/x', { lookup: publicLookup })
  assert.equal(direct.binding, 'pinned-direct')
  assert.equal(direct.verifiable, true)

  const proxied = await policy.assertRemoteTargetAllowed('https://example.com/x', {
    lookup: publicLookup,
    proxy: true,
  })
  assert.equal(proxied.binding, 'proxy-connect')
  assert.equal(proxied.verifiable, false)

  const fake = await policy.assertRemoteTargetAllowed('https://example.com/x', {
    lookup: async () => [
      { address: '198.18.0.5', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ],
    proxy: true,
    allowFakeIp: true,
  })
  assert.equal(fake.fakeIp, true)
  assert.equal(fake.verifiable, false)
})
