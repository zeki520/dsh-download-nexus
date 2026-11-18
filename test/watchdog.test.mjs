import test from 'node:test'
import assert from 'node:assert/strict'
import { createWatchdog } from '../lib/watchdog.mjs'

function lease() {
  let released = 0
  return { get released() { return released }, release() { released += 1 } }
}

test('watchdog releases the lease and records a terminal task', async () => {
  const updates = []
  const l = lease()
  const wd = createWatchdog({
    status: async () => ({ status: 'completed', bytesDone: 4 }),
    control: async () => {},
    update: (ref, task) => updates.push([ref, task.status]),
  })
  assert.equal(wd.track({ ref: 'motrix:a', nativeId: 'a', maxBytes: 100, lease: l }), true)
  await wd.tickNow('motrix:a')
  assert.equal(wd.has('motrix:a'), false)
  assert.equal(l.released, 1)
  assert.equal(updates.at(-1)[1], 'completed')
  wd.closeAll()
})

test('watchdog purges an over-limit task and fires onLimit', async () => {
  const calls = []
  const limits = []
  const l = lease()
  const wd = createWatchdog({
    status: async () => ({ status: 'active', bytesDone: 200 }),
    control: async (nativeId, action, options) => calls.push([nativeId, action, options]),
    onLimit: (entry, task, error) => limits.push([entry.ref, task.bytesDone, error.code]),
  })
  wd.track({ ref: 'motrix:b', nativeId: 'b', maxBytes: 100, lease: l })
  await wd.tickNow('motrix:b')
  assert.deepEqual(calls, [['b', 'purge', { deleteFiles: true }]])
  assert.equal(limits[0][0], 'motrix:b')
  assert.equal(limits[0][2], 'E_IO')
  assert.equal(l.released, 1)
})

test('watchdog stops after repeated RPC failures and fires onError', async () => {
  const errors = []
  const l = lease()
  const wd = createWatchdog({
    maxFailures: 2,
    status: async () => { throw new Error('rpc down') },
    onError: (entry, error, reason) => errors.push([entry.ref, error.code, reason]),
  })
  wd.track({ ref: 'motrix:c', nativeId: 'c', maxBytes: 100, lease: l })
  await wd.tickNow('motrix:c')
  assert.equal(errors.length, 0)
  await wd.tickNow('motrix:c')
  assert.equal(errors[0][1], 'E_ENGINE_UNAVAILABLE')
  assert.equal(errors[0][2], 'rpc')
  assert.equal(l.released, 1)
})

test('watchdog closeAll clears timers and releases every lease', () => {
  const leases = [lease(), lease()]
  const wd = createWatchdog({ status: async () => ({ status: 'active' }) })
  wd.track({ ref: 'motrix:d', nativeId: 'd', maxBytes: 100, lease: leases[0] })
  wd.track({ ref: 'motrix:e', nativeId: 'e', maxBytes: 100, lease: leases[1] })
  wd.closeAll()
  assert.equal(wd.size(), 0)
  assert.deepEqual(leases.map((x) => x.released), [1, 1])
})
