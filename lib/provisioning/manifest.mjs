import { ConductorError } from '../errors.mjs'

/**
 * Frozen Motrix release manifest. Do not fetch a "latest" manifest at runtime:
 * a compromised network answer must not be able to redirect the installer.
 *
 * Source: https://github.com/agalwood/Motrix/releases/tag/v2.4.3
 * SHA-256 values are the GitHub Release API `digest` values captured on
 * 2026-11-17. Keep this list reviewed in code when the pinned version changes.
 */
export const MOTRIX_VERSION = '2.4.3'
export const MOTRIX_MIN_VERSION = '2.4.1'

const RELEASES = Object.freeze({
  x64: Object.freeze({
    arch: 'x64',
    installer: Object.freeze({
      name: 'Motrix-Setup-2.4.3.exe',
      bytes: 133_386_225,
      sha256: '422992d06158a33f59459e76c721d87193146764b2a72c741fd43d0b1e0e961a',
    }),
    portable: Object.freeze({
      name: 'Motrix-2.4.3-x64.zip',
      bytes: 141_298_303,
      sha256: '727b1873d4d5862a8fe1b90f0824670a558e14a15796a78e3b49b7b0ffb1ac68',
    }),
  }),
  arm64: Object.freeze({
    arch: 'arm64',
    installer: Object.freeze({
      name: 'Motrix-Setup-2.4.3-arm64.exe',
      bytes: 127_416_808,
      sha256: 'cf5f14943cfeee3b9fb9dde7b65524f231a9f1b7e46d275cc0a9f7567062f468',
    }),
    portable: Object.freeze({
      name: 'Motrix-2.4.3-arm64.zip',
      bytes: 133_981_540,
      sha256: '9a043a6299d6ae5d8dabd2a10266cc7a54f93fac93813ce6d7a232c0b0f57781',
    }),
  }),
})

const BASE_URL = `https://github.com/agalwood/Motrix/releases/download/v${MOTRIX_VERSION}`

export function releaseForArch(arch = process.arch) {
  const release = RELEASES[arch]
  if (!release) {
    throw new ConductorError('E_PROVISION_UNSUPPORTED', `不支持的 CPU 架构：${arch}`, {
      hint: '0.3 只自动部署 Windows x64 / arm64；其他平台请手动安装官方 Motrix。',
    })
  }
  return release
}

export function assetFor(arch, mode) {
  const release = releaseForArch(arch)
  const asset = release[mode]
  if (!asset) {
    throw new ConductorError('E_PROVISION_UNSUPPORTED', `不支持的安装模式：${mode}`, {
      hint: 'mode 只能是 installer 或 portable。',
    })
  }
  return Object.freeze({ ...asset, url: `${BASE_URL}/${asset.name}`, version: MOTRIX_VERSION })
}

export function manifestSummary(arch = process.arch) {
  const release = releaseForArch(arch)
  return Object.freeze({
    version: MOTRIX_VERSION,
    minVersion: MOTRIX_MIN_VERSION,
    arch,
    installer: { ...release.installer, url: `${BASE_URL}/${release.installer.name}` },
    portable: { ...release.portable, url: `${BASE_URL}/${release.portable.name}` },
    source: `https://github.com/agalwood/Motrix/releases/tag/v${MOTRIX_VERSION}`,
  })
}

/** Parse a dotted version into a comparable tuple. */
export function parseVersion(raw) {
  const match = String(raw ?? '').match(/\d+(?:\.\d+){0,3}/)
  if (!match) return null
  const parts = match[0].split('.').map((n) => Number(n))
  while (parts.length < 4) parts.push(0)
  return parts.slice(0, 4)
}

export function compareVersion(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return 0
  for (let i = 0; i < 4; i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1
  }
  return 0
}

export function isCompatibleVersion(version) {
  if (!parseVersion(version)) return false
  return compareVersion(version, MOTRIX_MIN_VERSION) >= 0 && compareVersion(version, '3.0.0') < 0
}
