import test from 'node:test'
import assert from 'node:assert/strict'
import { probeHfMetadata } from '../lib/hf-metadata.mjs'

test('probeHfMetadata paginates, encodes revision and applies include globs', async () => {
  const urls = []
  const pages = [
    {
      json: [
        { type: 'file', path: 'config.json', size: 10 },
        { type: 'file', path: 'model.bin', lfs: { size: 90 } },
      ],
      headers: { link: '<https://huggingface.co/next>; rel="next"' },
    },
    {
      json: [
        { type: 'file', path: 'sub/tokenizer.json', size: 20 },
        { type: 'directory', path: 'sub' },
      ],
      headers: {},
    },
  ]
  const result = await probeHfMetadata({
    repo: 'owner/name',
    revision: 'refs/pr/1',
    include: ['*.json'],
    cfg: { useHfMirror: false },
    requestJsonImpl: async ({ url }) => {
      urls.push(url)
      return pages.shift()
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.count, 2)
  assert.equal(result.bytes, 30)
  assert.equal(result.pages, 2)
  assert.equal(result.maxFile, 20)
  assert.equal(result.maxFilePath, 'sub/tokenizer.json')
  assert.match(urls[0], /tree\/refs%2Fpr%2F1/)
})

test('probeHfMetadata treats missing sizes as incomplete, not zero', async () => {
  const result = await probeHfMetadata({
    repo: 'owner/name',
    cfg: { useHfMirror: false },
    requestJsonImpl: async () => ({ json: [{ type: 'file', path: 'x.bin' }], headers: {} }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'incomplete-metadata')
})

test('probeHfMetadata fails closed for network errors and no-match is explicit', async () => {
  const failed = await probeHfMetadata({
    repo: 'owner/name',
    cfg: { useHfMirror: false },
    requestJsonImpl: async () => { throw new Error('down') },
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.reason, 'network')
  const empty = await probeHfMetadata({
    repo: 'owner/name',
    include: ['nothing-*'],
    cfg: { useHfMirror: false },
    requestJsonImpl: async () => ({ json: [{ type: 'file', path: 'a.json', size: 1 }], headers: {} }),
  })
  assert.equal(empty.ok, true)
  assert.equal(empty.noMatch, true)
})

test('probeHfMetadata never sends the token to an HF mirror', async () => {
  let auth = ''
  await probeHfMetadata({
    repo: 'owner/name',
    cfg: { useHfMirror: true, hfMirror: 'https://hf-mirror.com' },
    env: { HF_TOKEN: 'secret' },
    requestJsonImpl: async ({ headers }) => {
      auth = headers.authorization || ''
      return { json: [{ type: 'file', path: 'a.json', size: 1 }], headers: {} }
    },
  })
  assert.equal(auth, '')
})
