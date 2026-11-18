import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DEFAULTS = Object.freeze({
  pip: 'https://pypi.org/simple',
  npm: 'https://registry.npmjs.org/',
  cargo: 'https://crates.io/',
})

const RECOMMENDATIONS = Object.freeze({
  pip: 'https://pypi.tuna.tsinghua.edu.cn/simple',
  npm: 'https://registry.npmmirror.com',
  cargo: 'https://rsproxy.cn/index/',
})

const MIRROR_HOSTS = Object.freeze({
  pip: [
    'pypi.tuna.tsinghua.edu.cn',
    'mirrors.aliyun.com',
    'pypi.mirrors.ustc.edu.cn',
    'mirrors.cloud.tencent.com',
    'repo.huaweicloud.com',
    'mirrors.bfsu.edu.cn',
  ],
  npm: ['registry.npmmirror.com', 'registry.npm.taobao.org', 'mirrors.cloud.tencent.com'],
  cargo: ['rsproxy.cn', 'mirrors.tuna.tsinghua.edu.cn', 'mirrors.ustc.edu.cn', 'mirrors.sjtug.sjtu.edu.cn'],
})

function hostOf(value) {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function sanitizeUrl(value) {
  try {
    const url = new URL(String(value))
    url.username = ''
    url.password = ''
    url.hash = ''
    return url.href
  } catch {
    return String(value || '')
  }
}

export function classifyRegistry(kind, value) {
  const host = hostOf(value)
  if (!host) return 'unknown'
  if (MIRROR_HOSTS[kind]?.includes(host)) return 'mirror'
  if (kind === 'pip' && host === 'pypi.org') return 'default'
  if (kind === 'npm' && host === 'registry.npmjs.org') return 'default'
  if (kind === 'cargo' && (host === 'crates.io' || host === 'index.crates.io')) return 'default'
  return 'custom'
}

/** Parse the subset of INI that pip uses: [section] key = value. */
export function parseIni(text) {
  const sections = {}
  let current = ''
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*[#;].*$/, '').trim()
    if (!line) continue
    const section = line.match(/^\[([^\]]+)\]$/)
    if (section) {
      current = section[1].trim()
      sections[current] ||= {}
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/)
    if (pair && current) sections[current][pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '')
  }
  return sections
}

/** Parse the subset of .npmrc we need; auth tokens are ignored. */
export function parseNpmrc(text) {
  const result = {}
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*[;#].*$/, '').trim()
    const pair = line.match(/^([^=]+?)\s*=\s*(.*)$/)
    if (pair) result[pair[1].trim()] = pair[2].trim().replace(/^["']|["']$/g, '')
  }
  return result
}

/** Parse the cargo source replacement we need, without a TOML dependency. */
export function parseCargoConfig(text) {
  const sections = {}
  let current = ''
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*#.*$/, '').trim()
    if (!line) continue
    const section = line.match(/^\[([^\]]+)\]$/)
    if (section) {
      current = section[1].trim()
      sections[current] ||= {}
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*["']([^"']*)["']/)
    if (pair && current) sections[current][pair[1]] = pair[2]
  }
  const replacedBy = sections['source.crates-io']?.['replace-with']
  if (replacedBy) {
    const registry = sections[`source.${replacedBy}`]?.registry
    if (registry) return { registry, source: `source.${replacedBy}` }
  }
  return { registry: '', source: '' }
}

async function readIfExists(readFile, file) {
  if (!file) return null
  try {
    return { file, text: await readFile(file, 'utf8') }
  } catch {
    return null
  }
}

async function firstExisting(readFile, files) {
  for (const file of files) {
    const found = await readIfExists(readFile, file)
    if (found) return found
  }
  return null
}

function row(kind, registry, { source, configFile = '' } = {}) {
  const value = sanitizeUrl(registry || DEFAULTS[kind])
  return {
    registry: value,
    source,
    config_file: configFile,
    classification: classifyRegistry(kind, value),
    recommended: RECOMMENDATIONS[kind],
    recommendation: classifyRegistry(kind, value) === 'mirror' ? '' : RECOMMENDATIONS[kind],
  }
}

/**
 * Read-only diagnosis of pip / npm / cargo registry configuration. This never
 * writes a config file and never calls the package manager.
 */
export async function diagnosePackageManagers({
  env = process.env,
  homeDir = os.homedir(),
  platform = process.platform,
  readFile = fs.readFile,
} = {}) {
  const appData = env.APPDATA || ''
  const pipFiles = [
    env.PIP_CONFIG_FILE,
    platform === 'win32' ? path.join(appData, 'pip', 'pip.ini') : '',
    platform === 'win32' ? path.join(homeDir, 'pip', 'pip.ini') : '',
    path.join(homeDir, '.config', 'pip', 'pip.conf'),
    path.join(homeDir, '.pip', 'pip.conf'),
  ].filter(Boolean)
  const npmFiles = [
    env.npm_config_userconfig,
    path.join(homeDir, '.npmrc'),
  ].filter(Boolean)
  const cargoHome = env.CARGO_HOME || path.join(homeDir, '.cargo')
  const cargoFiles = [path.join(cargoHome, 'config.toml'), path.join(cargoHome, 'config')]

  const [pipFile, npmFile, cargoFile] = await Promise.all([
    firstExisting(readFile, pipFiles),
    firstExisting(readFile, npmFiles),
    firstExisting(readFile, cargoFiles),
  ])

  const pipIni = pipFile ? parseIni(pipFile.text) : {}
  const pipRegistry = env.PIP_INDEX_URL || pipIni.global?.['index-url'] || DEFAULTS.pip
  const pipSource = env.PIP_INDEX_URL
    ? 'env:PIP_INDEX_URL'
    : pipIni.global?.['index-url']
      ? `file:${pipFile.file}`
      : 'default'

  const npmrc = npmFile ? parseNpmrc(npmFile.text) : {}
  const npmRegistry = env.npm_config_registry || npmrc.registry || DEFAULTS.npm
  const npmSource = env.npm_config_registry
    ? 'env:npm_config_registry'
    : npmrc.registry
      ? `file:${npmFile.file}`
      : 'default'

  const cargo = cargoFile ? parseCargoConfig(cargoFile.text) : { registry: '', source: '' }
  const cargoRegistry = cargo.registry || DEFAULTS.cargo
  const cargoSource = cargo.registry ? `file:${cargoFile.file} (${cargo.source})` : 'default'

  return {
    pip: row('pip', pipRegistry, { source: pipSource, configFile: pipFile?.file || '' }),
    npm: row('npm', npmRegistry, { source: npmSource, configFile: npmFile?.file || '' }),
    cargo: row('cargo', cargoRegistry, { source: cargoSource, configFile: cargoFile?.file || '' }),
  }
}

export { DEFAULTS as PACKAGE_MANAGER_DEFAULTS, RECOMMENDATIONS as PACKAGE_MANAGER_RECOMMENDATIONS }
