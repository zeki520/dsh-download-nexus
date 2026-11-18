import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyTarget, targetKindLabel } from '../lib/classify.mjs'

test('classifies magnet and torrent targets', () => {
  assert.equal(classifyTarget('magnet:?xt=urn:btih:abc').kind, 'magnet')
  const torrent = classifyTarget('https://example.com/ubuntu-24.04.torrent')
  assert.equal(torrent.kind, 'torrent')
  assert.equal(torrent.torrentUrl, true)
})

test('classifies a Hugging Face repo and file link', () => {
  const repo = classifyTarget('https://huggingface.co/Qwen/Qwen2.5-7B-Instruct')
  assert.equal(repo.kind, 'hf')
  assert.equal(repo.repo, 'Qwen/Qwen2.5-7B-Instruct')
  assert.equal(repo.repoType, 'model')
  assert.equal(repo.revision, 'main')

  const file = classifyTarget('https://huggingface.co/datasets/owner/data/resolve/v2/train.parquet')
  assert.equal(file.kind, 'hf')
  assert.equal(file.repoType, 'dataset')
  assert.equal(file.revision, 'v2')
  assert.deepEqual(file.include, ['train.parquet'])
})

test('distinguishes a GitHub file link from a repo page', () => {
  const asset = classifyTarget('https://github.com/yt-dlp/yt-dlp/releases/download/2026.01.01/yt-dlp.exe')
  assert.equal(asset.kind, 'url')
  assert.equal(asset.github, true)

  const archive = classifyTarget('https://github.com/owner/repo/archive/refs/heads/main.zip')
  assert.equal(archive.kind, 'url')
  assert.equal(archive.github, true)

  const page = classifyTarget('https://github.com/owner/repo')
  assert.equal(page.kind, 'github-page')
  assert.equal(page.github, true)
})

test('classifies video, package and generic targets', () => {
  assert.equal(classifyTarget('https://www.bilibili.com/video/BV1xx411c7mD').kind, 'video')
  assert.equal(classifyTarget('https://b23.tv/abc').kind, 'video')
  assert.equal(classifyTarget('https://pypi.org/project/requests/').kind, 'package')
  assert.equal(classifyTarget('https://registry.npmjs.org/react').kind, 'package')
  assert.equal(classifyTarget('https://example.com/file.iso').kind, 'url')
  assert.equal(classifyTarget('ftp://example.com/file.iso').kind, 'url')
})

test('rejects unknown protocols and embedded credentials', () => {
  assert.throws(() => classifyTarget('file:///etc/passwd'), (error) => error.code === 'E_TARGET')
  assert.throws(() => classifyTarget('https://user:pass@example.com/x'), (error) => error.code === 'E_TARGET')
  assert.throws(() => classifyTarget('not a url'), (error) => error.code === 'E_TARGET')
})

test('targetKindLabel is user facing', () => {
  assert.equal(targetKindLabel('hf'), 'Hugging Face 仓库')
  assert.equal(targetKindLabel('magnet'), '磁力链接')
})
