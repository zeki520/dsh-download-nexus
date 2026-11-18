import { ConductorError } from '../lib/errors.mjs'

const REF_PATTERN = /^(motrix|direct|ytdlp|hf):([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/

/**
 * In-memory task registry. download_control accepts only refs issued by this
 * process; there is no global task id access, so a model cannot pause, delete
 * or purge an unrelated Motrix task.
 */
export function createTaskRegistry() {
  const records = new Map()
  let sequence = 0

  function key(engineId, nativeId) {
    return `${engineId}:${nativeId}`
  }

  function parse(ref) {
    const match = REF_PATTERN.exec(String(ref || '').trim())
    if (!match) {
      throw new ConductorError('E_TARGET', `任务句柄不合法：${ref}`, {
        hint: '请使用 download 返回的 task_ref；不要直接传 Motrix/aria2 的原始 ID。',
      })
    }
    return { engineId: match[1], nativeId: match[2], ref: `${match[1]}:${match[2]}` }
  }

  function get(ref) {
    const parsed = parse(ref)
    return records.get(parsed.ref) || null
  }

  function issue(engineId, nativeId, meta = {}, owner = '') {
    if (!/^[a-z]+$/.test(engineId) || !nativeId) {
      throw new ConductorError('E_IO', '无法签发任务句柄')
    }
    if (!owner) throw new ConductorError('E_AUTH', '无法确定任务所属会话')
    const ref = key(engineId, nativeId)
    const existing = records.get(ref)
    if (existing) {
      if (existing.owner !== owner) {
        throw new ConductorError('E_TASK_CONFLICT', '该任务已由另一个会话创建', {
          hint: '请换一个 save_dir 或文件名重试；不要试图接管别的会话的任务。',
        })
      }
      existing.url = meta.url || existing.url
      existing.saveDir = meta.saveDir || existing.saveDir
      existing.task = meta.task || existing.task
      return existing
    }
    sequence += 1
    const record = {
      ref,
      engineId,
      nativeId,
      owner,
      url: meta.url || '',
      saveDir: meta.saveDir || '',
      createdAt: Date.now(),
      sequence,
      task: meta.task || null,
    }
    records.set(ref, record)
    return record
  }

  function getOwned(ref, owner) {
    const record = get(ref)
    if (!record || !owner || record.owner !== owner) return null
    return record
  }

  function mustGetOwned(ref, owner) {
    const record = getOwned(ref, owner)
    if (!record) {
      throw new ConductorError('E_NOT_FOUND', `找不到当前会话的任务：${ref}`, {
        hint: '任务句柄可能来自旧会话或别的会话；请重新调用 download 或 download_status 查当前会话。',
      })
    }
    return record
  }

  function listFor(owner, limit = 20) {
    if (!owner) return []
    return [...records.values()]
      .filter((record) => record.owner === owner)
      .sort((a, b) => b.sequence - a.sequence)
      .slice(0, limit)
  }

  function mustGet(ref) {
    const record = get(ref)
    if (!record) {
      throw new ConductorError('E_NOT_FOUND', `找不到本插件签发的任务：${ref}`, {
        hint: '任务句柄可能来自旧会话或别的插件；请重新调用 download 或 download_status 查当前会话。',
      })
    }
    return record
  }

  function update(ref, task, extra = {}) {
    const record = get(ref)
    if (!record) return null
    record.task = task || record.task
    Object.assign(record, extra)
    records.set(record.ref, record)
    return record
  }

  function list() {
    return [...records.values()].sort((a, b) => b.sequence - a.sequence)
  }

  function remove(ref) {
    const parsed = parse(ref)
    return records.delete(parsed.ref)
  }

  function size() {
    return records.size
  }

  /**
   * Drop terminal records only. Active downloads are never evicted: a caller
   * must still be able to poll/control them. TTL is intentionally longer than
   * maxWaitSeconds so a waited task cannot disappear mid-poll.
   */
  function prune({ now = Date.now(), maxRecords = 500, staleMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
    const terminal = (record) => {
      const status = String(record?.task?.status || '').toLowerCase()
      return ['completed', 'error', 'cancelled', 'failed', 'stopped'].includes(status)
    }
    const candidates = [...records.values()].filter(terminal).sort((a, b) => a.sequence - b.sequence)
    let removed = 0
    for (const record of candidates) {
      if (removed > 0 && now - record.createdAt <= staleMs && records.size <= maxRecords) break
      if (now - record.createdAt > staleMs || records.size > maxRecords) {
        records.delete(record.ref)
        removed += 1
      }
    }
    return { removed, size: records.size }
  }

  return { issue, parse, get, getOwned, mustGet, mustGetOwned, update, list, listFor, remove, size, prune }
}
