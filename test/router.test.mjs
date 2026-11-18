import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTarget } from '../lib/classify.mjs'
import { planRoute, planExplicit } from '../lib/router.mjs'

const cfg = { connections: 16 }
const accel = { proxy: 'http://127.0.0.1:7890' }
const all = { motrix: true, ytdlp: true, hf: true, direct: true }

test('routes each target kind to the intended engine', () => {
  assert.equal(planRoute(classifyTarget('magnet:?xt=urn:btih:abc'), { cfg, available: all, accel }).engineId, 'motrix')
  assert.equal(planRoute(classifyTarget('https://huggingface.co/o/r'), { cfg, available: all, accel }).engineId, 'hf')
  assert.equal(planRoute(classifyTarget('https://www.bilibili.com/video/BV1xx'), { cfg, available: all, accel }).engineId, 'ytdlp')
  assert.equal(planRoute(classifyTarget('https://example.com/a.bin'), { cfg, available: all, accel }).engineId, 'motrix')
  assert.equal(planRoute(classifyTarget('ftp://example.com/a.iso'), { cfg, available: all, accel }).engineId, 'motrix')
})

test('falls back to direct only for a generic URL when Motrix is unavailable', () => {
  const directOnly = { motrix: false, ytdlp: false, hf: false, direct: true }
  const route = planRoute(classifyTarget('https://example.com/a.bin'), { cfg, available: directOnly, accel })
  assert.equal(route.engineId, 'direct')
  assert.throws(
    () => planRoute(classifyTarget('magnet:?xt=urn:btih:abc'), { cfg, available: directOnly, accel }),
    (error) => error.code === 'E_ENGINE_UNAVAILABLE',
  )
})

test('rejects package and GitHub repo pages with an actionable error', () => {
  for (const target of ['https://pypi.org/project/requests/', 'https://github.com/owner/repo']) {
    assert.throws(
      () => planRoute(classifyTarget(target), { cfg, available: all, accel }),
      (error) => error.code === 'E_UNSUPPORTED',
    )
  }
})

test('explicit engine never falls back across types', () => {
  const magnet = classifyTarget('magnet:?xt=urn:btih:abc')
  assert.equal(planExplicit('motrix', magnet, { cfg, available: all, accel }).engineId, 'motrix')
  assert.throws(
    () => planExplicit('direct', magnet, { cfg, available: all, accel }),
    (error) => error.code === 'E_ENGINE_REJECTED',
  )
  assert.throws(
    () => planExplicit('direct', classifyTarget('ftp://example.com/a.iso'), { cfg, available: all, accel }),
    (error) => error.code === 'E_ENGINE_REJECTED',
  )
  assert.throws(
    () => planExplicit('motrix', classifyTarget('https://huggingface.co/o/r'), { cfg, available: all, accel }),
    (error) => error.code === 'E_ENGINE_REJECTED',
  )
  assert.throws(
    () => planExplicit('hf', classifyTarget('https://example.com/a.bin'), { cfg, available: all, accel }),
    (error) => error.code === 'E_ENGINE_REJECTED',
  )
})

test('explicit auto is the same as the classifier route', () => {
  const target = classifyTarget('https://example.com/a.bin')
  assert.equal(planExplicit('auto', target, { cfg, available: all, accel }).engineId, 'motrix')
})

test('explicit engine that is not available is rejected', () => {
  assert.throws(
    () => planExplicit('ytdlp', classifyTarget('https://www.youtube.com/watch?v=x'), {
      cfg,
      available: { ...all, ytdlp: false },
      accel,
    }),
    (error) => error.code === 'E_ENGINE_UNAVAILABLE',
  )
})
