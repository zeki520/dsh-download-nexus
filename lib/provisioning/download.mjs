import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { ConductorError } from '../errors.mjs'
import { downloadDirect } from '../http.mjs'

export async function sha256File(file) {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function fileMatches(file, asset) {
  try {
    const info = await stat(file)
    if (!info.isFile()) return false
    if (Number.isFinite(asset.bytes) && info.size !== asset.bytes) return false
    return (await sha256File(file)) === asset.sha256
  } catch {
    return false
  }
}

/**
 * Download one frozen release asset into the provisioning cache.
 * The URL and expected hash come from the frozen manifest, never from a caller.
 */
export async function downloadAsset({
  asset,
  cacheDir,
  netPolicy,
  proxy = null,
  signal,
  onProgress,
  downloadDirectImpl = downloadDirect,
}) {
  if (!asset?.url || !asset?.sha256 || !asset?.name) {
    throw new ConductorError('E_PROVISION_MANIFEST', '发行资产清单不完整')
  }
  await mkdir(cacheDir, { recursive: true })
  const canonical = path.join(cacheDir, asset.name)
  if (await fileMatches(canonical, asset)) {
    return { path: canonical, bytes: asset.bytes, cached: true }
  }
  await unlink(canonical).catch(() => {})

  const maxBytes = Number(asset.bytes) + 16 * 1024 * 1024
  const result = await downloadDirectImpl({
    url: asset.url,
    saveDir: cacheDir,
    filename: asset.name,
    maxBytes,
    netPolicy,
    proxy,
    allowExecutable: true,
    timeoutMs: 120_000,
    signal,
    onProgress,
  })

  const actual = await sha256File(result.path)
  if (actual !== asset.sha256) {
    await unlink(result.path).catch(() => {})
    throw new ConductorError('E_PROVISION_HASH', `SHA-256 不匹配：${asset.name}`, {
      hint: '已删除下载文件；不会执行未通过校验的安装包。',
      info: { expected: asset.sha256, actual },
    })
  }

  if (path.resolve(result.path) !== path.resolve(canonical)) {
    await unlink(canonical).catch(() => {})
    await rename(result.path, canonical)
  }
  return { path: canonical, bytes: result.bytes, cached: false }
}
