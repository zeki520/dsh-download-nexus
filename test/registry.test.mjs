import test from 'node:test'
import assert from 'node:assert/strict'
import { createTaskRegistry } from '../registry/tasks.mjs'

test('issues and retrieves a task by its own ref', () => {
  const registry = createTaskRegistry()
  const record = registry.issue('motrix', 'abc-123', { url: 'https://example.com/a', saveDir: 'C:\\\\x' }, 's:a')
  assert.equal(record.ref, 'motrix:abc-123')
  assert.equal(registry.get('motrix:abc-123').url, 'https://example.com/a')
  assert.equal(registry.mustGet('motrix:abc-123').nativeId, 'abc-123')
  assert.equal(registry.getOwned('motrix:abc-123', 's:b'), null)
  assert.equal(registry.getOwned('motrix:abc-123', 's:a').ref, 'motrix:abc-123')
})

test('rejects raw or malformed refs', () => {
  const registry = createTaskRegistry()
  for (const bad of ['abc-123', 'motrix:', 'unknown:abc', 'motrix:abc/../x', 'motrix:abc x']) {
    assert.throws(() => registry.get(bad), (error) => error.code === 'E_TARGET', bad)
  }
})

test('does not expose a task created outside the registry', () => {
  const registry = createTaskRegistry()
  assert.equal(registry.get('motrix:someone-else'), null)
  assert.throws(() => registry.mustGet('motrix:someone-else'), (error) => error.code === 'E_NOT_FOUND')
})

test('same ref from another session conflicts instead of taking over', () => {
  const registry = createTaskRegistry()
  registry.issue('motrix', 'shared', {}, 's:a')
  assert.throws(
    () => registry.issue('motrix', 'shared', {}, 's:b'),
    (error) => error.code === 'E_TASK_CONFLICT',
  )
  assert.equal(registry.issue('motrix', 'shared', {}, 's:a').owner, 's:a')
})

test('updates and removes a record', () => {
  const registry = createTaskRegistry()
  registry.issue('direct', 'd1', {}, 's:a')
  registry.update('direct:d1', { status: 'completed' }, { note: 'done' })
  assert.equal(registry.get('direct:d1').task.status, 'completed')
  assert.equal(registry.get('direct:d1').note, 'done')
  assert.equal(registry.remove('direct:d1'), true)
  assert.equal(registry.size(), 0)
})

test('list is newest first', () => {
  const registry = createTaskRegistry()
  registry.issue('direct', 'first', {}, 's:a')
  registry.issue('direct', 'second', {}, 's:a')
  assert.deepEqual(registry.list().map((row) => row.nativeId), ['second', 'first'])
})

test('listFor only returns the owner tasks, newest first', () => {
  const registry = createTaskRegistry()
  registry.issue('direct', 'a1', {}, 's:a')
  registry.issue('direct', 'b1', {}, 's:b')
  registry.issue('direct', 'a2', {}, 's:a')
  assert.deepEqual(registry.listFor('s:a').map((row) => row.nativeId), ['a2', 'a1'])
  assert.deepEqual(registry.listFor('s:none'), [])
})

test('prune drops stale terminal records but keeps active ones', () => {
  const registry = createTaskRegistry()
  registry.issue('direct', 'old', { task: { status: 'completed' } }, 's:a')
  registry.issue('direct', 'active', { task: { status: 'downloading' } }, 's:a')
  registry.issue('direct', 'fresh', { task: { status: 'completed' } }, 's:a')
  const old = registry.get('direct:old')
  old.createdAt = Date.now() - 10 * 24 * 60 * 60 * 1000
  const result = registry.prune({ staleMs: 7 * 24 * 60 * 60 * 1000 })
  assert.equal(result.removed, 1)
  assert.equal(registry.get('direct:old'), null)
  assert.ok(registry.get('direct:active'))
  assert.ok(registry.get('direct:fresh'))
})

test('prune enforces the record cap without evicting active tasks', () => {
  const registry = createTaskRegistry()
  registry.issue('motrix', 'active', { task: { status: 'downloading' } }, 's:a')
  for (let i = 0; i < 4; i += 1) {
    registry.issue('direct', `done-${i}`, { task: { status: 'completed' } }, 's:a')
  }
  const result = registry.prune({ maxRecords: 2 })
  assert.equal(result.size, 2)
  assert.ok(registry.get('motrix:active'))
})
