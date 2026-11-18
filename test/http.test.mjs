import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createNetPolicy } from '../lib/net-policy.mjs'
import { assertRemoteAddress, downloadDirect, probeContentLength } from '../lib/http.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-http-'))
const netPolicy = createNetPolicy({ allowLoopback: true })

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

function download(url, extra = {}) {
  return downloadDirect({
    url,
    saveDir: tmp,
    netPolicy,
    timeoutMs: 5000,
    maxBytes: 1024 * 1024,
    ...extra,
  })
}

test('downloads a file and derives the name from the URL', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-length': '11', 'content-type': 'text/plain' })
    res.end('hello world')
  })
  try {
    const result = await download(`${base}/report.pdf`)
    assert.equal(result.filename, 'report.pdf')
    assert.equal(fs.readFileSync(result.path, 'utf8'), 'hello world')
    assert.equal(result.bytes, 11)
  } finally {
    await close(server)
  }
})

test('uses RFC 5987 Content-Disposition and preserves UTF-8', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, {
      'content-length': '4',
      'content-disposition': "attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A%202026.pdf",
    })
    res.end('data')
  })
  try {
    const result = await download(`${base}/ignored`)
    assert.equal(result.filename, '报告 2026.pdf')
    assert.ok(fs.existsSync(result.path))
  } finally {
    await close(server)
  }
})

test('an explicit filename wins over the server name', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-length': '2', 'content-disposition': 'attachment; filename="server.txt"' })
    res.end('ok')
  })
  try {
    const result = await download(`${base}/x`, { filename: 'chosen.txt' })
    assert.equal(result.filename, 'chosen.txt')
  } finally {
    await close(server)
  }
})

test('follows redirects and strips credentials on a cross-origin hop', async () => {
  let seen = null
  const b = await listen((req, res) => {
    seen = req.headers
    res.writeHead(200, { 'content-length': '2' })
    res.end('ok')
  })
  const a = await listen((req, res) => {
    res.writeHead(302, { location: `${b.base}/capture` })
    res.end()
  })
  try {
    const result = await download(`${a.base}/start`, {
      headers: { authorization: 'Bearer secret', cookie: 'session=1', 'user-agent': 'conductor-test' },
    })
    assert.equal(result.bytes, 2)
    assert.equal(seen.authorization, undefined)
    assert.equal(seen.cookie, undefined)
    assert.equal(seen['user-agent'], 'conductor-test')
  } finally {
    await close(a.server)
    await close(b.server)
  }
})

test('refuses an oversized Content-Length before writing', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-length': '5000' })
    res.end(Buffer.alloc(5000))
  })
  try {
    await assert.rejects(download(`${base}/big.bin`, { maxBytes: 100 }), (error) => error.code === 'E_IO')
    assert.equal(fs.readdirSync(tmp).some((name) => name.endsWith('.part')), false)
  } finally {
    await close(server)
  }
})

test('stops a chunked response that exceeds the byte cap', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'application/octet-stream' })
    res.end(Buffer.alloc(2000))
  })
  try {
    await assert.rejects(download(`${base}/chunked.bin`, { maxBytes: 1000 }), (error) => error.code === 'E_IO')
    assert.equal(fs.readdirSync(tmp).some((name) => name.endsWith('.part')), false)
  } finally {
    await close(server)
  }
})

test('never overwrites an existing file', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-length': '3' })
    res.end('new')
  })
  const existing = path.join(tmp, 'same.bin')
  fs.writeFileSync(existing, 'old')
  try {
    const result = await download(`${base}/same.bin`, { filename: 'same.bin' })
    assert.equal(path.basename(result.path), 'same (1).bin')
    assert.equal(fs.readFileSync(existing, 'utf8'), 'old')
    assert.equal(fs.readFileSync(result.path, 'utf8'), 'new')
  } finally {
    await close(server)
  }
})

test('rejects an http error status', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(404)
    res.end('nope')
  })
  try {
    await assert.rejects(download(`${base}/missing`), (error) => error.code === 'E_IO')
  } finally {
    await close(server)
  }
})

test('probeContentLength reads HEAD without writing a file', async () => {
  const { server, base } = await listen((req, res) => {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-length': '1234' })
      res.end()
      return
    }
    res.writeHead(405)
    res.end()
  })
  try {
    const size = await probeContentLength({ url: `${base}/x`, netPolicy, timeoutMs: 2000 })
    assert.equal(size, 1234)
  } finally {
    await close(server)
  }
})

test('probeContentLength falls back to a one-byte ranged GET', async () => {
  const { server, base } = await listen((req, res) => {
    if (req.method === 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    assert.equal(req.headers.range, 'bytes=0-0')
    res.writeHead(206, { 'content-range': 'bytes 0-0/4321' })
    res.end('x')
  })
  try {
    const size = await probeContentLength({ url: `${base}/x`, netPolicy, timeoutMs: 2000 })
    assert.equal(size, 4321)
  } finally {
    await close(server)
  }
})

test('probeContentLength keeps SSRF rejection hard', async () => {
  await assert.rejects(
    probeContentLength({ url: 'http://127.0.0.1:9/x', netPolicy: createNetPolicy(), timeoutMs: 500 }),
    (error) => error.code === 'E_TARGET',
  )
})

test('assertRemoteAddress rejects a socket that connected elsewhere', () => {
  const res = {
    destroyed: false,
    socket: { remoteAddress: '10.0.0.9' },
    destroy() { this.destroyed = true },
  }
  assert.throws(
    () => assertRemoteAddress({ addresses: [{ address: '93.184.216.34' }] }, res),
    (error) => error.code === 'E_TARGET',
  )
  assert.equal(res.destroyed, true)
  assert.doesNotThrow(() =>
    assertRemoteAddress({ addresses: [{ address: '93.184.216.34' }] }, { socket: { remoteAddress: '93.184.216.34' } }),
  )
})

test('probeContentLength fails open when the endpoint is unreachable', async () => {
  const size = await probeContentLength({
    url: 'http://127.0.0.1:1/unreachable',
    netPolicy,
    timeoutMs: 250,
  })
  assert.equal(size, null)
})

test('aborts a partial download and removes the .part file', async () => {
  const { server, base } = await listen((req, res) => {
    res.writeHead(200, { 'content-length': '1000000' })
    res.write('x'.repeat(4096))
    setTimeout(() => res.destroy(), 150)
  })
  const controller = new AbortController()
  try {
    const pending = download(`${base}/slow.bin`, { signal: controller.signal, timeoutMs: 5000 })
    setTimeout(() => controller.abort(), 50)
    await assert.rejects(pending, (error) => error.code === 'E_CANCELLED')
    assert.equal(fs.readdirSync(tmp).some((name) => name.endsWith('.part')), false)
  } finally {
    await close(server)
  }
})
