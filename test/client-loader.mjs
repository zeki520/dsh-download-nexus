// 在 Node 里加载 lib/client.js（浏览器模块）的唯一入口。
// client.js 以 window.__ModuleLoader__.load({ id, factory }) 自注册，
// factory(require) 返回 { apply, inject, __test }，所以测试只碰 __test 暴露的纯函数，
// 不渲染、不碰 DOM —— 渲染路径的验证留在宿主里的目视验收。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const SRC_PATH = fileURLToPath(new URL('../lib/client.js', import.meta.url))

function fakeReact() {
  const noop = () => {}
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useCallback: (fn) => fn,
    useEffect: noop,
    useLayoutEffect: noop,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value === undefined ? null : value }),
    useState: (value) => [typeof value === 'function' ? value() : value, noop],
  }
}

export function loadClientModule() {
  const source = readFileSync(SRC_PATH, 'utf8')
  let registered = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (mod) => { registered = mod } } },
    console,
    fetch: () => Promise.reject(new Error('network disabled in unit tests')),
  }
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })
  if (!registered) throw new Error('client.js 没有调用 window.__ModuleLoader__.load')
  const react = fakeReact()
  return registered.factory((name) => {
    if (name === 'react') return react
    throw new Error(`unexpected require(${name})`)
  })
}

export function clientSource() {
  return readFileSync(SRC_PATH, 'utf8')
}
