import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadClientModule } from './client-loader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')

// ── dirty 归属：徽章按页签计数，字段必须各有且只有一个归属 ──────────────
test('dirty 归属：每个可编辑字段都有且只有一个负责页签', () => {
  const { __test } = loadClientModule()
  const owner = new Map()
  for (const tab of Object.keys(__test.TAB_FIELDS)) {
    for (const field of Array.from(__test.TAB_FIELDS[tab])) {
      assert.equal(owner.has(field), false, `${field} 同时挂在 ${owner.get(field)} 与 ${tab}`)
      owner.set(field, tab)
    }
  }
  for (const field of Array.from(__test.EDITABLE)) {
    assert.ok(owner.has(field), `${field} 没有归属页签：改它时徽章不亮，报错也不会跳到正确页签`)
  }
  assert.equal(owner.size, __test.EDITABLE.length, '页签映射里不该有 EDITABLE 之外的字段')
  // 执行路径渲染在引擎页，脏标记也必须落在引擎页
  assert.deepEqual(Array.from(__test.TAB_FIELDS.engines || []), ['ytdlpPath', 'hfPath'])
  assert.equal(Array.from(__test.TAB_FIELDS.download).includes('ytdlpPath'), false)
  assert.equal(Array.from(__test.TAB_FIELDS.download).includes('hfPath'), false)
})

// ── 发行物卫生：不许把开发机的路径、备份文件、临时产物带出去 ────────────
test('发行物：配置模板里不含个人绝对路径', () => {
  const yml = read('cordis.patch.yml')
  assert.equal(yml.includes('C:\\Users\\'), false, 'cordis.patch.yml 不应写死任何用户目录')
  assert.equal(yml.includes('F:\\dsh'), false, 'cordis.patch.yml 不应写死开发机目录')
  assert.equal(/^\s*defaultSaveDir:/m.test(yml), false, 'defaultSaveDir 留空由 Host 取 <主目录>/Downloads')
  assert.equal(/^\s*allowedRoots:/m.test(yml), false, 'allowedRoots 同理，不能把别人的目录当默认允许目录')
})

test('发行物：README 与源码不含个人绝对路径', () => {
  for (const rel of ['README.md', 'lib/client.js']) {
    const text = read(rel)
    assert.equal(text.includes('97292'), false, `${rel} 仍残留开发机用户名`)
    assert.equal(text.includes('F:\\dsh插件工作区'), false, `${rel} 仍残留开发机工作区路径`)
  }
})

test('发行物：package.json 只带运行必需文件', () => {
  const pkg = JSON.parse(read('package.json'))
  const files = pkg.files
  assert.equal(files.includes('icon.png'), false, '根目录图标没被任何字段引用，属死重')
  assert.equal(files.includes('icon.svg'), false)
  assert.equal(files.includes('icon-128.ico'), false)
  assert.equal(files.includes('icon-256.ico'), false)
  assert.equal(files.includes('lib/*.js'), false, 'lib/*.js 是 lib/**/*.js 的子集，重复')
  assert.ok(files.includes('lib/**/*.js'), '运行时仍需要 lib 下的 js')
  assert.ok(files.includes('assets'), 'package.json 的 icon 指向 assets/icon/icon-128.png')
  assert.equal(pkg.icon, 'assets/icon/icon-128.png')
})

test('发行物：插件目录自带 .gitignore，备份与临时产物不进仓', () => {
  const gi = read('.gitignore')
  for (const rule of ['node_modules/', '.backups/', '.scratch/', '*.tgz', '*.bak']) {
    assert.ok(gi.includes(rule), `.gitignore 缺少 ${rule}`)
  }
})

// ── 多行输出：join 的参数被写成字面反斜杠 n 时，一条命令的第 2 行起会拼在上面
test('工具输出：renderProvision 用真换行分隔多行', () => {
  const src = read('tools/index.mjs')
  assert.equal(src.includes("join('\\\\n')"), false, "join('\\\\n') 会输出字面 \\n，多行结果会糊成一行")
  assert.ok(src.includes("lines.join('\\n')"), 'Provisioning 结果应按真换行拼接')
})

// ── 浮层定位基准：container-type 会施加 layout containment ────────────
test('浮层：容器查询载体不是 .dc-root', () => {
  const src = read('lib/client.js')
  const cssStart = src.indexOf('const CSS = `')
  const cssEnd = src.indexOf('`\n\n    function ensureStyle', cssStart)
  const css = src.slice(cssStart, cssEnd > 0 ? cssEnd : cssStart + 40000)
  const rootStart = css.indexOf('.dc-root {')
  const rootRule = css.slice(rootStart, css.indexOf('}', rootStart) + 1)
  assert.equal(/container(-type)?\s*:/.test(rootRule), false, '.dc-root 声明 container 会把 toast/modal 的 fixed 基准改成面板盒')
  assert.ok(/\.dc-shell\s*\{\s*container:\s*dc \/ inline-size/.test(css), '容器查询应挂在 .dc-shell 上')
})
