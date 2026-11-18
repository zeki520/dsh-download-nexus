import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createTools } from '../tools/index.mjs'
import { apply, name, inject } from '../index.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conductor-tools-'))
const cfg = {
  toolPrefix: 'conductor_',
  defaultSaveDir: tmp,
  allowedRoots: [tmp],
  maxWaitSeconds: 3600,
  promptName: 'download-nexus',
  promptOrder: 5900,
}

const fakeConductor = {
  async download() {
    return {
      ok: true,
      engine: 'motrix',
      task_ref: 'motrix:abc',
      reason: 'Motrix 可用',
      task: { status: 'completed', final_path: path.join(tmp, 'a.bin'), bytes_done: 10 },
    }
  },
  async status() {
    return {
      ok: true,
      tasks: [
        { task_ref: 'motrix:abc', engine: 'motrix', status: 'downloading', progress: 42, name: 'a.bin' },
      ],
      stats: { downloadSpeed: 1024, activeTasks: 1, waitingTasks: 0 },
    }
  },
  async control() {
    return { ok: true, task_ref: 'motrix:abc', action: 'pause' }
  },
  async doctor() {
    return {
      ok: true,
      default_save_dir: tmp,
      allowed_roots: [tmp],
      accel: { detail: '127.0.0.1:7890', proxy: 'http://127.0.0.1:7890' },
      engines: { motrix: { available: true, detail: 'ok' } },
    }
  },
}

test('creates the five prefixed tools with output renderers', () => {
  const tools = createTools({ conductor: fakeConductor, cfg })
  assert.deepEqual(tools.map((tool) => tool.name), [
    'conductor_download',
    'conductor_download_status',
    'conductor_download_control',
    'conductor_download_doctor',
    'conductor_motrix_provision',
  ])
  for (const tool of tools) {
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.timeoutMs, 'number')
    assert.ok(tool.output && tool.output.schema && typeof tool.output.render === 'function')
  }
})

test('download renderer reports the final path', async () => {
  const tools = createTools({ conductor: fakeConductor, cfg })
  const value = await tools[0].execute({ url: 'https://example.com/a', save_dir: tmp })
  const blocks = tools[0].output.render({}, value)
  assert.equal(blocks[0].type, 'text')
  assert.match(blocks[0].text, /下载完成/)
  assert.match(blocks[0].text, /a\.bin/)
})

test('tool errors become actionable text, not thrown exceptions', async () => {
  const failing = {
    ...fakeConductor,
    async download() {
      const error = new Error('目录不在允许范围内')
      error.code = 'E_SAVE_DIR'
      error.hint = '换一个目录'
      throw error
    },
  }
  const tools = createTools({ conductor: failing, cfg })
  const value = await tools[0].execute({ url: 'https://example.com/a', save_dir: 'C:\\Windows' })
  assert.equal(value.ok, false)
  assert.equal(value.code, 'E_SAVE_DIR')
  const text = tools[0].output.render({}, value)[0].text
  assert.match(text, /E_SAVE_DIR/)
  assert.match(text, /怎么办/)
})

test('plugin apply registers tools, a prepended hook and a prompt section', () => {
  const tools = []
  const hooks = []
  const sections = []
  const ctx = {
    effect(factory) {
      const dispose = factory()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    on(event, handler, options) {
      hooks.push({ event, handler, options })
      return () => {}
    },
    tools: {
      register(tool) {
        tools.push(tool)
        return () => {}
      },
    },
    get(service) {
      if (service !== 'systemPrompt') return undefined
      return {
        section(section) {
          sections.push(section)
          return () => {}
        },
      }
    },
  }

  const dispose = apply(ctx, {
    toolPrefix: 'conductor_',
    defaultSaveDir: tmp,
    allowedRoots: [tmp],
  })
  assert.equal(name, 'dsh-download-nexus')
  assert.deepEqual(inject, ['tools'])
  assert.deepEqual(tools.map((tool) => tool.name), [
    'conductor_download',
    'conductor_download_status',
    'conductor_download_control',
    'conductor_download_doctor',
    'conductor_motrix_provision',
  ])
  assert.equal(hooks.length, 1)
  assert.equal(hooks[0].event, 'tools/pre-execute')
  assert.equal(hooks[0].options.prepend, true)
  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, 'download-nexus')
  assert.equal(sections[0].order, 5900)
  assert.match(sections[0].text, /conductor_download/)
})

test('status route registers behind connection.admit and is disposed with the plugin', () => {
  const effects = []
  let route = null
  let routeDisposed = false
  const ctx = {
    effect(factory) {
      const dispose = factory()
      effects.push(dispose)
      return dispose
    },
    on() { return () => {} },
    tools: { register() { return () => {} } },
    provide() { return () => {} },
    get() { return undefined },
    inject(services, callback) {
      assert.deepEqual(services, ['webServer', 'connection'])
      return callback({
        get(name) {
          if (name === 'webServer') {
            return {
              register(spec) {
                route = spec
                return () => { routeDisposed = true }
              },
            }
          }
          if (name === 'connection') {
            return { admit() { return { peer: { id: 'p1' } } } }
          }
          return undefined
        },
      })
    },
  }
  apply(ctx, { toolPrefix: '', defaultSaveDir: tmp, allowedRoots: [tmp] })
  assert.equal(route.path, '/api/dsh-download-nexus/status')
  assert.equal(typeof route.handler, 'function')
  for (const dispose of effects) {
    if (typeof dispose === 'function') dispose()
  }
  assert.equal(routeDisposed, true)
})

test('status route denies when connection.admit rejects', async () => {
  const effects = []
  let route = null
  const ctx = {
    effect(factory) { const dispose = factory(); effects.push(dispose); return dispose },
    on() { return () => {} },
    tools: { register() { return () => {} } },
    provide() { return () => {} },
    get() { return undefined },
    inject(services, callback) {
      return callback({
        get(name) {
          if (name === 'webServer') return { register(spec) { route = spec; return () => {} } }
          if (name === 'connection') return { admit() { return { rejection: 403 } } }
          return undefined
        },
      })
    },
  }
  apply(ctx, { toolPrefix: '', defaultSaveDir: tmp, allowedRoots: [tmp] })
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
  await route.handler({ method: 'GET', url: '/api/dsh-download-nexus/status?op=snapshot', headers: {} }, res)
  assert.equal(res.statusCode, 403)
  assert.match(res.body, /E_AUTH/)
  for (const dispose of effects) if (typeof dispose === 'function') dispose()
})
