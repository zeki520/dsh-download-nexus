import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createMotrixEngine, projectTask } from '../engines/motrix.mjs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-motrix-'))

test('projectTask normalizes a raw MDXP task', () => {
  const task = projectTask({
    id: 't1',
    type: 'url',
    name: 'a.bin',
    status: 'downloading',
    bytesDone: 50,
    bytesTotal: 200,
    speedBps: 10,
    etaSec: 15,
    saveDir: 'C:\\x',
  })
  assert.equal(task.taskId, 't1')
  assert.equal(task.progress, 25)
  assert.equal(task.bytesDone, 50)
  assert.equal(task.bytesTotal, 200)
  assert.equal(task.speedBps, 10)
})

test('speaks MDXP over the endpoint file and never leaks the token', async () => {
  const requests = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      const message = JSON.parse(body)
      requests.push({ auth: req.headers.authorization, message })
      res.setHeader('content-type', 'application/json')
      if (message.method === 'stats/get') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { totalDownloadSpeed: 10, activeTasks: 1 } }))
        return
      }
      if (message.method === 'download/add') {
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              id: 't1',
              type: message.params.kind,
              name: 'a.bin',
              status: 'downloading',
              bytesDone: 0,
              bytesTotal: 100,
              saveDir: message.params.saveDir,
            },
          }),
        )
        return
      }
      if (message.method === 'task/get') {
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: { task: { id: 't1', status: 'completed', bytesDone: 100, bytesTotal: 100, finalPath: 'C:\\x\\a.bin' } },
          }),
        )
        return
      }
      res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {} }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const endpointFile = path.join(tmp, 'endpoint.json')
  fs.writeFileSync(endpointFile, JSON.stringify({ port, localToken: 'secret-token' }))

  const engine = createMotrixEngine({ cfg: {}, env: { DSH_MOTRIX_ENDPOINT: endpointFile } })
  try {
    const probe = await engine.probe()
    assert.equal(probe.available, true)

    const result = await engine.submit({
      target: { kind: 'url', url: 'https://example.com/a.bin' },
      saveDir: tmp,
      filename: 'a.bin',
      headers: { authorization: 'Bearer x' },
      proxy: 'http://127.0.0.1:7890',
      connections: 16,
      idempotencyKey: 'idem-1',
    })
    assert.equal(result.nativeId, 't1')
    const add = requests.find((row) => row.message.method === 'download/add')
    assert.equal(add.auth, 'Bearer secret-token')
    assert.equal(add.message.params.kind, 'url')
    assert.deepEqual(add.message.params.uris, ['https://example.com/a.bin'])
    assert.deepEqual(add.message.params.headers, [{ name: 'authorization', value: 'Bearer x' }])
    assert.equal(add.message.params.proxy, 'http://127.0.0.1:7890')
    assert.equal(add.message.params.connections, 16)
    assert.equal(add.message.params.idempotencyKey, 'idem-1')

    const status = await engine.status('t1')
    assert.equal(status.status, 'completed')
    assert.equal(status.finalPath, 'C:\\x\\a.bin')

    const info = await engine.info()
    assert.equal(info.connected, true)
    assert.equal(info.port, port)
    assert.equal('token' in info, false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('waitFor purges and reports a limit breach before completion', async () => {
  const engine = createMotrixEngine({ cfg: {}, env: {} })
  const calls = []
  engine.status = async () => ({ taskId: 't1', status: 'downloading', bytesDone: 250 })
  engine.control = async (...args) => {
    calls.push(args)
  }
  await assert.rejects(
    engine.waitFor('t1', { waitSeconds: 1, pollMs: 1, maxBytes: 100 }),
    (error) => error.code === 'E_IO' && error.info?.kind === 'limit' && error.info?.cleanup === 'ok',
  )
  assert.deepEqual(calls, [['t1', 'purge', { deleteFiles: true }]])
})

test('waitForPaused only resolves after the task actually stops', async () => {
  const engine = createMotrixEngine({ cfg: {}, env: {} })
  let calls = 0
  engine.status = async () => ({ taskId: 't1', status: calls++ === 0 ? 'downloading' : 'paused' })
  const task = await engine.waitForPaused('t1', { timeoutMs: 500, pollMs: 1 })
  assert.equal(task.status, 'paused')
  assert.equal(calls >= 2, true)
})

test('waitForPaused rejects when the task keeps running past the deadline', async () => {
  const engine = createMotrixEngine({ cfg: {}, env: {} })
  engine.status = async () => ({ taskId: 't1', status: 'downloading' })
  await assert.rejects(
    engine.waitForPaused('t1', { timeoutMs: 5, pollMs: 1 }),
    (error) => error.code === 'E_ENGINE_REJECTED' && error.info?.status === 'downloading',
  )
})
