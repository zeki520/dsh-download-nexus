import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClientModule, clientSource } from './client-loader.mjs'

const ruleOf = (css, selector) => {
  const at = css.indexOf(selector)
  assert.ok(at >= 0, `${selector} 缺失`)
  const end = css.indexOf('}', at)
  assert.ok(end > at, `${selector} 没有闭合`)
  const piece = css.slice(at, end)
  assert.ok(piece.length > 12, `${selector} 切出的片段过短，可能命中了注释`)
  return piece
}

// 主题持久化：宿主没有把主题存下来的能力时，浅色样式是死代码。
test('主题：readTheme 读持久值，非法值回落 dark', () => {
  const { __test } = loadClientModule()
  assert.equal(typeof __test.readTheme, 'function')
  assert.equal(__test.readTheme({ getItem: () => 'light' }), 'light')
  assert.equal(__test.readTheme({ getItem: () => null }), 'dark')
  assert.equal(__test.readTheme({ getItem: () => 'garbage' }), 'dark')
  const writes = []
  __test.persistTheme('light', { setItem: (key, value) => writes.push([key, value]) })
  assert.deepEqual(writes, [['dsh-download-nexus:theme', 'light']])
})

// 单文件上限：输入框清空时 Number('') === 0，旧实现会把 maxBytes 写成 0，
// 等于「一个字节都不许下」，而且保存按钮因此变脏。
test('单文件上限：清空输入不产生新值', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.coerceField('maxBytes', ''), undefined)
  assert.equal(__test.coerceField('maxBytes', '   '), undefined)
  assert.equal(__test.coerceField('maxBytes', 'abc'), undefined)
  assert.equal(__test.coerceField('maxBytes', '0'), undefined)
  assert.equal(__test.coerceField('maxBytes', '1.5'), 1610612736)
})

test('单文件上限：有值时按 GB 换算成字节', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.coerceField('maxBytes', '5'), 5368709120)
  assert.equal(__test.coerceField('maxBytes', '64'), 68719476736)
})

// 代理候选端口：输入框只按逗号切，粘贴「7890；31181」或空格分隔会被过滤成空数组，
// 用户看起来像「刚粘完就被清空」。
test('代理端口：混合分隔符与非法段', () => {
  const { __test } = loadClientModule()
  // client.js 在 vm 的独立 realm 里执行，返回的数组原型不同，比对前落到本 realm。
  const parse = (raw) => Array.from(__test.parseProxyList(raw))
  assert.deepEqual(parse('7890, 31181'), [7890, 31181])
  assert.deepEqual(parse('7890；31181'), [7890, 31181])
  assert.deepEqual(parse('7890 31181'), [7890, 31181])
  assert.deepEqual(parse('7890\n31181'), [7890, 31181])
  assert.deepEqual(parse('   '), [])
  assert.deepEqual(parse('0,70000,8080,abc'), [8080])
  assert.deepEqual(parse([8080, '3128']), [8080, 3128])
})

test('代理端口：序列化稳定，不因回写改变用户输入', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.formatProxyList([7890, 31181]), '7890, 31181')
  assert.equal(__test.formatProxyList([]), '')
  assert.equal(__test.formatProxyList(null), '')
})

// 保存：allowedRoots / defaultSaveDir 本来就在 EDITABLE 里，旧实现又补推了一遍，
// 同一条路径在 ops 里出现两次。Host 侧对重复 set 没有幂等保证。
test('保存：同一路径只下发一次 op', () => {
  const { __test } = loadClientModule()
  const baseline = { defaultSaveDir: 'C:/a', allowedRoots: ['C:/a'], connections: 4, motrix: { connected: true } }
  const draft = { defaultSaveDir: 'C:/b', allowedRoots: ['C:/a', 'C:/b'], connections: 4 }
  const ops = Array.from(__test.collectOps(['allowedRoots', 'defaultSaveDir'], baseline, draft))
  assert.deepEqual(ops.map((op) => op.path.join('.')), ['allowedRoots', 'defaultSaveDir'])
  assert.equal(ops[1].value, 'C:/b')
})

test('保存：目录被规范化改变时即使不在 dirty 里也下发', () => {
  const { __test } = loadClientModule()
  const baseline = { defaultSaveDir: 'C:/a', allowedRoots: ['C:/a'] }
  const draft = { defaultSaveDir: 'C:/A/', allowedRoots: ['C:\\a'] }
  const ops = Array.from(__test.collectOps([], baseline, draft))
  assert.deepEqual(ops.map((op) => op.path.join('.')), ['allowedRoots', 'defaultSaveDir'])
})

// 页签徽章：旧实现无论点开哪个页签都显示「脏字段总数」，下载页会报出策略页的数字。
test('页签徽章：按组计数', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.badgeCount([], 'download'), 0)
  assert.equal(__test.badgeCount(['maxBytes'], 'download'), 1)
  assert.equal(__test.badgeCount(['maxBytes', 'pollMs', 'hfMirror'], 'download'), 2)
  assert.equal(__test.badgeCount(['maxBytes', 'pollMs', 'hfMirror'], 'policy'), 1)
  assert.equal(__test.badgeCount(['maxBytes'], 'policy'), 0)
  assert.equal(__test.badgeCount(['maxBytes'], 'overview'), 0)
  assert.equal(__test.badgeCount(['maxBytes'], 'engines'), 0)
})

test('页签徽章：安全页没有可编辑项，恒为 0', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.badgeCount(['allowExecutable', 'allowShell', 'guardFailClosed'], 'security'), 0)
})

// 五态：未安装被当成「检测失败」用红色，等于把「你没装 yt-dlp」和「引擎真的坏了」
// 说成同一件事；参考色板里未安装属于灰（无数据），失败才是红。
test('五态：未安装与检测失败不同色', () => {
  const { __test } = loadClientModule()
  const meta = __test.STATE_META
  assert.equal(meta.ready.cls, 'dc-state-ready')
  assert.equal(meta['not-running'].cls, 'dc-state-warn')
  assert.equal(meta['not-installed'].cls, 'dc-state-idle')
  assert.equal(meta.failed.cls, 'dc-state-bad')
  assert.equal(meta.unchecked.cls, 'dc-state-idle')
  assert.equal(new Set(Object.values(meta).map((row) => row.label)).size, 5)
})

test('五态：stateOf 只信 Host 给的 state', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.stateOf(null).key, 'unchecked')
  assert.equal(__test.stateOf({ state: 'not-installed' }).key, 'not-installed')
  assert.equal(__test.stateOf({ state: 'failed' }).key, 'failed')
  assert.equal(__test.stateOf({ available: true }).key, 'ready')
  // 没有 state 也没有 available：不能凭空乐观
  assert.equal(__test.stateOf({ available: false }).key, 'failed')
})

// 主题令牌：写错一个字母，var() 就静默回落，颜色和字体永远用不上宿主的主题。
test('主题令牌：琥珀与字体用宿主真名', () => {
  const { __test } = loadClientModule()
  const css = __test.stylesheet()
  assert.match(css, /--dsw-alias-state-warn-primary/)
  assert.doesNotMatch(css, /state-warning-primary/)
  assert.match(css, /--dsw-font-family\b/)
  assert.doesNotMatch(css, /--ds-font-family-base/)
})

// 根节点缺 ref：useConversationSurface 靠这个 ref 找 [data-conversation-scroll]，
// 缺了就打不上标记、composer 不隐藏。四个 return 分支必须走同一个构造函数。
test('根节点：dcRoot 带 className/主题/ref', () => {
  const { __test } = loadClientModule()
  const ref = { current: null }
  const el = __test.dcRoot('light', ref, 'child')
  assert.equal(el.type, 'div')
  assert.equal(el.props.className, 'dc-root')
  assert.equal(el.props['data-theme'], 'light')
  assert.equal(el.props.ref, ref)
  // 内容进 .dc-shell（容器查询载体），浮层留在外面 —— 见下一条用例
  assert.equal(el.children.length, 1)
  assert.equal(el.children[0].props.className, 'dc-shell')
  assert.deepEqual(el.children[0].children, ['child'])
})

// container-type 会施加 layout containment，让宿主盒成为 fixed 后代的包含块。
// 所以容器查询只能挂在内层 .dc-shell 上，浮层必须是它的兄弟节点，否则 toast 与
// modal 会以面板盒（可滚动、可能比视口高）为基准定位。
test('浮层：在 .dc-shell 外面，且根节点不声明 container', () => {
  const { __test } = loadClientModule()
  const el = __test.dcRoot('dark', { current: null },
    { type: 'div', props: { className: 'dc-main' }, children: [] },
    { type: 'div', props: { 'data-dc-overlay': true, className: 'dc-toast' }, children: [] })
  const shell = el.children[0]
  assert.equal(shell.props.className, 'dc-shell')
  assert.equal(shell.children.length, 1, '页面内容进 shell')
  const overlay = el.children[1]
  assert.equal(overlay.props['data-dc-overlay'], true, '浮层留在 shell 外面')

  const css = __test.stylesheet()
  const rootRule = ruleOf(css, '.dc-root {')
  assert.ok(!rootRule.includes('container'), '.dc-root 不能声明 container，否则改掉 fixed 基准')
  assert.ok(ruleOf(css, '.dc-shell {').includes('container: dc / inline-size'), '.dc-shell 才是容器查询载体')
})

test('根节点：源码里没有绕过 dcRoot 手写的根元素', () => {
  const source = clientSource()
  const handwritten = source.match(/className: 'dc-root'/g) || []
  assert.equal(handwritten.length, 1, 'dc-root 只允许在 dcRoot 内部出现一次')
})

// 受控输入回写：值由 draft 反算，用户打到一半（"7890," / "1."）会被格式化冲掉。
// 输入框自带缓冲，只有缓冲与外部值不等价时才同步。
test('输入缓冲：同值回写不打断编辑', () => {
  const { __test } = loadClientModule()
  assert.equal(__test.proxyResyncNeeded('7890,', [7890]), false)
  assert.equal(__test.proxyResyncNeeded('7890', [7890]), false)
  assert.equal(__test.proxyResyncNeeded('7890', [31181]), true)
  assert.equal(__test.proxyResyncNeeded('', []), false)
  assert.equal(__test.proxyResyncNeeded('', [7890]), true)
})
