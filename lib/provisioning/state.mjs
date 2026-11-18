import { open, readFile, rename, unlink, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { ConductorError } from '../errors.mjs'

export function provisioningPaths(env = process.env) {
  const local = env.LOCALAPPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Local')
  const baseDir = path.join(local, 'dsh-download-nexus', 'provisioning')
  return Object.freeze({
    baseDir,
    stateFile: path.join(baseDir, 'state.json'),
    lockFile: path.join(baseDir, 'state.lock'),
    cacheDir: path.join(baseDir, 'cache'),
    portableRoot: path.join(local, 'dsh-download-nexus', 'motrix'),
  })
}

export async function readProvisioningState(stateFile) {
  try {
    const raw = await readFile(stateFile, 'utf8')
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    return { error: error?.message || 'state 不可读' }
  }
}

export async function writeProvisioningState(stateFile, state) {
  await mkdir(path.dirname(stateFile), { recursive: true })
  const tmp = `${stateFile}.${process.pid}.tmp`
  const payload = { ...state, updatedAt: new Date().toISOString() }
  await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8')
  await rename(tmp, stateFile)
  return payload
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function acquireProvisioningLock(lockFile, { now = Date.now(), staleMs = 30 * 60_000 } = {}) {
  await mkdir(path.dirname(lockFile), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fh = await open(lockFile, 'wx')
      await fh.writeFile(JSON.stringify({ pid: process.pid, at: now }), 'utf8')
      await fh.close()
      let released = false
      return {
        path: lockFile,
        async release() {
          if (released) return
          released = true
          await unlink(lockFile).catch(() => {})
        },
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      let info = {}
      try {
        info = JSON.parse(await readFile(lockFile, 'utf8'))
      } catch {}
      const age = now - Number(info.at || 0)
      const stale = age > staleMs || !pidAlive(Number(info.pid))
      if (!stale) {
        throw new ConductorError('E_PROVISION_BUSY', '另一个 Motrix 安装/检测进程正在运行', {
          hint: '等待现有安装结束，或先取消；不要并发启动第二个安装器。',
        })
      }
      await unlink(lockFile).catch(() => {})
    }
  }
  throw new ConductorError('E_PROVISION_BUSY', '无法获取安装锁')
}
