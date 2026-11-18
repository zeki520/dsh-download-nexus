import { ConductorError } from './errors.mjs'

/**
 * Mirrors we will prefix for GitHub downloads. This is deliberately a small
 * allow-list: signed CDN URLs (objects.githubusercontent.com) and gist hosts
 * are not safe to rewrite.
 */
export const GITHUB_MIRROR_HOSTS = Object.freeze([
  'github.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
])

const HOST_SET = new Set(GITHUB_MIRROR_HOSTS)

export function normalizeGithubMirrorBase(raw) {
  let url
  try {
    url = new URL(String(raw || ''))
  } catch (error) {
    throw new ConductorError('E_TARGET', 'GitHub 镜像地址无效', {
      hint: '配置项 githubMirrorBase 必须是 https://.../ 形式的反代地址。',
      cause: error,
    })
  }
  if (url.protocol !== 'https:') {
    throw new ConductorError('E_TARGET', 'GitHub 镜像地址必须使用 https', {
      hint: '只接受 https，避免明文下载。',
    })
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConductorError('E_TARGET', 'GitHub 镜像地址不允许带凭据、查询串或片段', {
      hint: '镜像地址只应是 https://host/ 或 https://host/prefix/。',
    })
  }
  return url.href.replace(/\/+$/, '') + '/'
}

/**
 * Opt-in GitHub mirror. Only rewrites a concrete GitHub file URL, never the
 * classifier result or the original URL stored for the user. Disabled by
 * default; callers must pass enabled=true explicitly (or set the config
 * default for a user who asked for it).
 */
export function applyGithubMirror(target, { enabled = false, base = '' } = {}) {
  if (!enabled || !target || target.github !== true) {
    return { target, applied: false }
  }
  if (!HOST_SET.has(String(target.host || '').toLowerCase())) {
    return { target, applied: false }
  }
  const normalized = normalizeGithubMirrorBase(base)
  const original = String(target.url || '')
  if (!original || original.startsWith(normalized)) {
    return { target, applied: false }
  }
  return {
    applied: true,
    base: normalized,
    target: {
      ...target,
      url: normalized + original,
      originalUrl: original,
      mirrored: true,
    },
  }
}
