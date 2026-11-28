// 渲染烟测：真正把 Page 跑起来。
//
// 0.5.2 的白屏是「渲染期抛错 → 整块插件位消失」，而当时的 184 例测试全绿——
// 因为它们只碰 __test 纯函数与 CSS 字符串，从不 render。这个文件补上那条路：
// 用带 hook 槽位的假 React 渲染每个 early return 分支和五个 Tab，
// 再按用户真实路径点 Tab，任何「读了空属性」都会在这里当场红。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const SRC_PATH = fileURLToPath(new URL('../lib/client.js', import.meta.url))

// ── 假 React：hook 有槽位、跨轮次保留，setState 只标脏 ────────────
function makeRuntime() {
  const slots = new Map()
  const stack = []
  let dirty = 0
  const top = () => stack[stack.length - 1]
  const slot = (init) => {
    const frame = top()
    const key = `${frame.path}#${frame.cursor++}`
    if (!slots.has(key)) slots.set(key, { value: typeof init === 'function' ? init() : init })
    return slots.get(key)
  }
  const hookSlot = (deps) => {
    const s = slot(null)
    s.changed = !s.deps || !deps || s.deps.length !== deps.length || deps.some((dep, i) => !Object.is(dep, s.deps[i]))
    s.deps = deps
    return s
  }
  const React = {
    Fragment: Symbol.for('fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(init) {
      const s = slot(init)
      return [s.value, (next) => { s.value = typeof next === 'function' ? next(s.value) : next; dirty += 1 }]
    },
    useRef: (init) => slot(init),
    useMemo(fn, deps) {
      const s = hookSlot(deps)
      if (s.changed) s.value = fn()
      return s.value
    },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      if (hookSlot(deps).changed) top().effects.push(fn)
    },
    useLayoutEffect(fn, deps) { React.useEffect(fn, deps) },
  }
  const collected = { buttons: [], texts: [] }
  const flatText = (node) => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(flatText).join(' ')
    if (typeof node === 'object') return flatText(node.children)
    return ''
  }

  function render(node, path) {
    if (node == null || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((child, i) => render(child, `${path}[${i}]`)); return }
    if (node.type === React.Fragment) { render(node.children, `${path}<frag>`); return }
    if (typeof node.type === 'function') {
      stack.push({ path: `${path}<${node.type.name || 'anon'}>`, cursor: 0, effects: [] })
      const out = node.type({ ...node.props, children: node.children })
      const frame = stack.pop()
      frame.effects.forEach((fn) => fn())
      render(out, `${path}<${node.type.name || 'anon'}>`)
      return
    }
    if (node.type === 'button') collected.buttons.push(node)
    if (typeof node.type === 'string') {
      const text = node.children.filter((c) => typeof c === 'string').join('')
      if (text) collected.texts.push(text)
    }
    render(node.children, path)
  }

  return {
    React, render, collected, flatText,
    get dirty() { return dirty },
    reset() { collected.buttons.length = 0; collected.texts.length = 0 },
    clearDirty() { dirty = 0 },
  }
}

function makeDom() {
  const appended = []
  const style = { dataset: {}, textContent: '' }
  const document = {
    head: { appendChild: (node) => appended.push(node) },
    createElement: () => style,
    querySelector: () => (appended.length ? style : null),
    querySelectorAll: () => appended.slice(),
    addEventListener() {}, removeEventListener() {},
    documentElement: { dataset: { theme: 'dark' }, style: {} },
    body: { appendChild() {}, classList: { add() {}, remove() {} } },
  }
  return { document, appended }
}

function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

// 一轮「挂载 → 推进 → 点 Tab」的完整生命周期
function boot({ snapshot, probe, snapshotFails = false } = {}) {
  const runtime = makeRuntime()
  const { document } = makeDom()
  const storage = makeStorage()
  const fetchCalls = []
  const fetch = (url, init) => {
    const body = init && init.body ? String(init.body) : ''
    fetchCalls.push({ url: String(url), body })
    if (new URL(url, 'http://127.0.0.1').searchParams.get('op') === 'probe') {
      if (probe === 'throw') return Promise.reject(new Error('probe boom'))
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: probe || { engines: {} } }) })
    }
    if (snapshotFails) return Promise.reject(new Error('snapshot boom'))
    return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: snapshot || {} }) })
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: (mod) => { sandbox.__mod = mod } }, location: { origin: 'http://127.0.0.1' } },
    document,
    localStorage: storage,
    fetch,
    URLSearchParams,
    console,
    setTimeout: (fn) => { fn(); return 0 },
    clearTimeout() {},
    requestAnimationFrame: (fn) => fn(0),
  }
  vm.runInNewContext(readFileSync(SRC_PATH, 'utf8'), sandbox, { filename: 'lib/client.js' })
  assert.ok(sandbox.__mod, 'client.js 没有调用 window.__ModuleLoader__.load')

  const registered = {}
  const mod = sandbox.__mod.factory((name) => {
    if (name === 'react') return runtime.React
    throw new Error(`unexpected require(${name})`)
  })

  // 真实 API：getSnapshot 同步返回快照、subscribe 返回退订函数、mutate 返回是否成功
  const controller = {
    getSnapshot: () => {
      if (snapshotFails) throw new Error('snapshot boom')
      return { ...(snapshot || {}), revision: 1 }
    },
    subscribe: () => () => {},
    mutate: () => true,
  }
  const ctx = {
    slots: {
      inject: (name, fn) => fn(),
      register: (meta, component) => { registered[meta.name] = component; return component },
    },
    configForms: { get: () => controller },
    on: () => () => {},
    effect: (fn) => { const cleanup = fn(); return typeof cleanup === 'function' ? cleanup : () => {} },
  }
  mod.apply(ctx)

  const view = registered['conversation.view']
  assert.ok(typeof view === 'function', '没有注册视图组件')

  const settle = () => {
    for (let pass = 0; pass < 12; pass += 1) {
      runtime.reset()
      runtime.clearDirty()
      runtime.render(runtime.React.createElement(view, { configForms: ctx.configForms }), 'root')
      if (!runtime.dirty) break
    }
  }
  return { runtime, registered, ctx, settle, fetchCalls }
}

test('渲染烟测：五个 Tab 依次点开都不抛错', () => {
  const snapshot = {
    plugin: { version: '0.0.0-test' },
    running: true,
    config: { defaultSaveDir: 'C:\\tmp', allowedRoots: ['C:\\tmp'], connections: 8, maxBytes: 1024, proxyCandidates: [7890] },
    engines: { motrix: { state: 'ready', available: true }, direct: { state: 'not-running' }, ytdlp: { state: 'unchecked' }, hf: { state: 'failed', detail: 'boom' } },
  }
  const boot1 = boot({ snapshot })
  boot1.settle()
  const tabs = ['总览', '下载', '策略', '引擎', '安全']
  for (const label of tabs) {
    const hit = boot1.runtime.collected.buttons.find((btn) => boot1.runtime.flatText(btn.children).includes(label))
    assert.ok(hit, `找不到「${label}」页签按钮`)
    hit.props.onClick()
    boot1.settle()
  }
  assert.ok(boot1.runtime.collected.texts.length > 0, '渲染后应有可见文案')
})

test('渲染烟测：快照失败时走错误分支也不抛错', () => {
  const b = boot({ snapshotFails: true })
  b.settle()
  const text = b.runtime.collected.texts.join(' ')
  assert.ok(text.length > 0, '错误分支至少要渲染出文案，而不是空白')
})

test('渲染烟测：探测失败时引擎卡仍渲染', () => {
  const snapshot = { plugin: { version: '0.0.0-test' }, running: true, config: { allowedRoots: [], proxyCandidates: [] }, engines: {} }
  const b = boot({ snapshot, probe: 'throw' })
  b.settle()
  const probeBtn = b.runtime.collected.buttons.find((btn) => b.runtime.flatText(btn.children).includes('检测'))
  if (probeBtn && probeBtn.props.onClick) probeBtn.props.onClick()
  b.settle()
})

test('首次加载允许用缓存，两个页签手动检测全部都强制刷新', async () => {
  const b = boot()
  const probes = () => b.fetchCalls.map(({ url }) => new URL(url, 'http://127.0.0.1').searchParams)
    .filter((params) => params.get('op') === 'probe')
  const button = (label, tab = false) => {
    const hit = b.runtime.collected.buttons.find((btn) => {
      const text = b.runtime.flatText(btn.children).trim()
      return tab ? btn.props.role === 'tab' && text.includes(label) : text === label
    })
    assert.ok(hit, `找不到「${label}」按钮`)
    return hit
  }
  const settle = async () => {
    b.settle()
    await new Promise(setImmediate)
    b.settle()
  }
  await settle()
  assert.equal(probes()[0]?.get('force'), '0')
  for (const [tab, label] of [['总览', '全部检测'], ['引擎', '检测全部']]) {
    if (tab === '引擎') {
      button(tab, true).props.onClick()
      await settle()
    }
    const start = probes().length
    const hit = button(label)
    await hit.props.onClick()
    const [request] = probes().slice(start)
    assert.equal(request?.get('ids'), 'all', tab)
    assert.equal(request?.get('force'), '1', tab)
    await settle()
  }
})

test('渲染禁忌：源码里不允许出现内联 SVG（0.5.2 白屏同款改动）', () => {
  const source = readFileSync(SRC_PATH, 'utf8')
  assert.equal(/h\('svg'/.test(source), false, '不要用 h("svg") 造图标；需要线性图标用字形 + CSS')
  assert.equal(/createElement\('svg'/.test(source), false)
})
