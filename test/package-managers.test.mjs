import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  classifyRegistry,
  diagnosePackageManagers,
  parseCargoConfig,
  parseIni,
  parseNpmrc,
} from '../lib/package-managers.mjs'

const HOME = path.join('C:', 'Users', 'tester')

function fakeReader(files) {
  return async (file) => {
    if (!files.has(file)) {
      const error = new Error(`ENOENT: ${file}`)
      error.code = 'ENOENT'
      throw error
    }
    return files.get(file)
  }
}

test('parses pip INI, npmrc and cargo source replacement', () => {
  const pip = parseIni('[global]\nindex-url = https://pypi.tuna.tsinghua.edu.cn/simple\n')
  assert.equal(pip.global['index-url'], 'https://pypi.tuna.tsinghua.edu.cn/simple')

  const npm = parseNpmrc('registry=https://registry.npmmirror.com\n//registry.npmjs.org/:_authToken=secret\n')
  assert.equal(npm.registry, 'https://registry.npmmirror.com')
  assert.equal(npm['//registry.npmjs.org/:_authToken'], 'secret')

  const cargo = parseCargoConfig(`
[source.crates-io]
replace-with = "rsproxy-sparse"

[source.rsproxy-sparse]
registry = "https://rsproxy.cn/index/"
`)
  assert.equal(cargo.registry, 'https://rsproxy.cn/index/')
  assert.equal(cargo.source, 'source.rsproxy-sparse')
})

test('classifies default, mirror and custom registries', () => {
  assert.equal(classifyRegistry('pip', 'https://pypi.org/simple'), 'default')
  assert.equal(classifyRegistry('pip', 'https://pypi.tuna.tsinghua.edu.cn/simple'), 'mirror')
  assert.equal(classifyRegistry('npm', 'https://registry.npmjs.org/'), 'default')
  assert.equal(classifyRegistry('npm', 'https://registry.npmmirror.com'), 'mirror')
  assert.equal(classifyRegistry('cargo', 'https://crates.io/'), 'default')
  assert.equal(classifyRegistry('cargo', 'https://rsproxy.cn/index/'), 'mirror')
  assert.equal(classifyRegistry('npm', 'https://example.com/registry'), 'custom')
})

test('diagnoses env overrides, config files and defaults', async () => {
  const npmrc = path.join(HOME, '.npmrc')
  const pipIni = path.join(HOME, 'AppData', 'Roaming', 'pip', 'pip.ini')
  const cargoToml = path.join(HOME, '.cargo', 'config.toml')
  const files = new Map([
    [npmrc, 'registry=https://registry.npmmirror.com\n'],
    [pipIni, '[global]\nindex-url = https://mirrors.aliyun.com/pypi/simple/\n'],
    [
      cargoToml,
      '[source.crates-io]\nreplace-with = "rsproxy-sparse"\n[source.rsproxy-sparse]\nregistry = "https://rsproxy.cn/index/"\n',
    ],
  ])
  const report = await diagnosePackageManagers({
    env: { APPDATA: path.join(HOME, 'AppData', 'Roaming') },
    homeDir: HOME,
    platform: 'win32',
    readFile: fakeReader(files),
  })
  assert.equal(report.pip.classification, 'mirror')
  assert.equal(report.pip.registry, 'https://mirrors.aliyun.com/pypi/simple/')
  assert.equal(report.npm.classification, 'mirror')
  assert.equal(report.npm.registry, 'https://registry.npmmirror.com/')
  assert.equal(report.cargo.classification, 'mirror')
  assert.equal(report.cargo.registry, 'https://rsproxy.cn/index/')
})

test('env wins over files and credentials are redacted', async () => {
  const report = await diagnosePackageManagers({
    env: {
      PIP_INDEX_URL: 'https://user:pass@example.com/simple',
      npm_config_registry: 'https://registry.npmjs.org/',
    },
    homeDir: HOME,
    platform: 'win32',
    readFile: fakeReader(new Map()),
  })
  assert.equal(report.pip.source, 'env:PIP_INDEX_URL')
  assert.equal(report.pip.registry, 'https://example.com/simple')
  assert.equal(report.pip.classification, 'custom')
  assert.equal(report.npm.source, 'env:npm_config_registry')
  assert.equal(report.npm.classification, 'default')
  assert.equal(report.cargo.classification, 'default')
  assert.equal(report.cargo.recommendation, 'https://rsproxy.cn/index/')
})

test('missing config files fall back to official registries', async () => {
  const report = await diagnosePackageManagers({
    env: {},
    homeDir: HOME,
    platform: 'win32',
    readFile: fakeReader(new Map()),
  })
  assert.deepEqual(
    Object.fromEntries(Object.entries(report).map(([id, row]) => [id, row.classification])),
    { pip: 'default', npm: 'default', cargo: 'default' },
  )
})
