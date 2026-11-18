import { ConductorError } from './errors.mjs'

const HF_HOSTS = new Set(['huggingface.co', 'hf.co', 'hf-mirror.com'])
const GITHUB_HOSTS = new Set([
  'github.com',
  'codeload.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'gist.githubusercontent.com',
])
const VIDEO_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'bilibili.com',
  'b23.tv',
  'vimeo.com',
  'tiktok.com',
  'douyin.com',
  'ixigua.com',
  'twitch.tv',
  'dailymotion.com',
  'nicovideo.jp',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
])
const PACKAGE_HOSTS = new Set([
  'pypi.org',
  'files.pythonhosted.org',
  'registry.npmjs.org',
  'npmjs.com',
  'yarnpkg.com',
  'crates.io',
  'static.crates.io',
  'pkg.go.dev',
  'proxy.golang.org',
  'repo.maven.apache.org',
  'repo1.maven.org',
  'rubygems.org',
  'packagist.org',
  'nuget.org',
  'api.nuget.org',
  'conda.anaconda.org',
  'anaconda.org',
])

function hostOf(url) {
  return String(url.hostname || '').toLowerCase().replace(/^www\./, '')
}

function basenameOf(pathname) {
  const last = String(pathname || '').split('/').filter(Boolean).pop() || ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

function parseHf(url) {
  const segments = url.pathname.split('/').filter(Boolean)
  let repoType = 'model'
  if (segments[0] === 'datasets') {
    repoType = 'dataset'
    segments.shift()
  } else if (segments[0] === 'spaces') {
    repoType = 'space'
    segments.shift()
  }
  const owner = segments[0]
  const name = segments[1]
  if (!owner || !name || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new ConductorError('E_TARGET', `无法从 Hugging Face 链接解析仓库：${url.href}`)
  }
  const repo = `${owner}/${name}`
  let revision = 'main'
  let include
  const marker = segments.findIndex((part) => part === 'resolve' || part === 'blob' || part === 'tree')
  if (marker >= 0) {
    revision = segments[marker + 1] || 'main'
    const rest = segments.slice(marker + 2)
    if (rest.length > 0 && (segments[marker] === 'resolve' || segments[marker] === 'blob')) {
      include = [rest.join('/')]
    }
  }
  return { repo, repoType, revision, include }
}

/**
 * Turn a user/model supplied target string into a typed target. This function
 * does not touch the network; DNS/SSRF checks happen at transfer time.
 */
export function classifyTarget(raw) {
  const text = String(raw || '').trim()
  if (!text) throw new ConductorError('E_TARGET', '下载目标为空')
  if (/^magnet:\?/i.test(text)) {
    return { kind: 'magnet', url: text, host: '', protocol: 'magnet:', filename: '' }
  }

  let url
  try {
    url = new URL(text)
  } catch (error) {
    throw new ConductorError('E_TARGET', `无法识别的下载目标：${text}`, { cause: error })
  }
  if (url.username || url.password) {
    throw new ConductorError('E_TARGET', '下载链接不允许内嵌用户名或密码')
  }
  const protocol = url.protocol.toLowerCase()
  if (!['http:', 'https:', 'ftp:', 'ftps:'].includes(protocol)) {
    throw new ConductorError('E_TARGET', `不支持的协议：${protocol}（支持 http/https/ftp/ftps/magnet/torrent）`)
  }

  const host = hostOf(url)
  const filename = basenameOf(url.pathname)

  if (protocol === 'http:' || protocol === 'https:') {
    if (/\.torrent$/i.test(url.pathname)) {
      return { kind: 'torrent', url: url.href, host, protocol, filename, torrentUrl: true }
    }
    if (HF_HOSTS.has(host)) {
      const hf = parseHf(url)
      return { kind: 'hf', url: url.href, host, protocol, filename, ...hf }
    }
    if (GITHUB_HOSTS.has(host)) {
      const fileLike =
        host !== 'github.com' ||
        /\/(releases\/download|releases\/latest\/download|archive|raw)\//.test(url.pathname) ||
        /\.(zip|tar\.gz|tgz|exe|msi|dmg|pkg|deb|rpm|whl|jar|7z|rar)$/i.test(url.pathname)
      return { kind: fileLike ? 'url' : 'github-page', url: url.href, host, protocol, filename, github: true }
    }
    if (VIDEO_HOSTS.has(host)) {
      return { kind: 'video', url: url.href, host, protocol, filename }
    }
    if (PACKAGE_HOSTS.has(host)) {
      return { kind: 'package', url: url.href, host, protocol, filename }
    }
    return { kind: 'url', url: url.href, host, protocol, filename }
  }

  return { kind: 'url', url: url.href, host, protocol, filename }
}

export function targetKindLabel(kind) {
  return (
    {
      url: '普通文件',
      magnet: '磁力链接',
      torrent: 'BT 种子',
      hf: 'Hugging Face 仓库',
      video: '视频页面',
      package: '包管理资源',
      'github-page': 'GitHub 页面',
    }[kind] || kind
  )
}
