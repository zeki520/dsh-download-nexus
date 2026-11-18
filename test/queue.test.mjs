import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineQueue } from '../lib/engine-queue.mjs'

const LIMITS = { motrix: { concurrency: 2, queue: 1, waitMs: 80 } }

test('queue enforces per-engine concurrency and hands slots directly to waiters', async () => {
  const queue = createEngineQueue({ limits: LIMITS })
  const a = await queue.acquire('motrix')
  const b = await queue.acquire('motrix')
  let third
  const waiting = queue.acquire('motrix').then((lease) => {
    third = lease
    return lease
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(queue.stats().motrix, { active: 2, limit: 2, queued: 1, queue: 1 })
  await assert.rejects(queue.acquire('motrix', { timeoutMs: 0 }), (error) => error.code === 'E_ENGINE_BUSY')
  a.release()
  const c = await waiting
  assert.equal(c, third)
  assert.equal(queue.stats().motrix.active, 2)
  b.release()
  c.release()
  assert.equal(queue.stats().motrix.active, 0)
  queue.dispose()
})

test('queue aborts a waiter without consuming a slot', async () => {
  const queue = createEngineQueue({ limits: LIMITS })
  const a = await queue.acquire('motrix')
  const b = await queue.acquire('motrix')
  const controller = new AbortController()
  const pending = queue.acquire('motrix', { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, (error) => error.code === 'E_CANCELLED')
  assert.equal(queue.stats().motrix.queued, 0)
  b.release()
  assert.equal(queue.stats().motrix.active, 1)
  a.release()
  assert.equal(queue.stats().motrix.active, 0)
  queue.dispose()
})

test('queue rejects all waiters on dispose', async () => {
  const queue = createEngineQueue({ limits: LIMITS })
  const a = await queue.acquire('motrix')
  const b = await queue.acquire('motrix')
  const pending = queue.acquire('motrix')
  queue.dispose()
  await assert.rejects(pending, (error) => error.code === 'E_CANCELLED')
  await assert.rejects(queue.acquire('motrix'), (error) => error.code === 'E_CANCELLED')
  a.release()
  b.release()
})
