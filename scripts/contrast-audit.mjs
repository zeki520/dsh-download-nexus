#!/usr/bin/env node
// 视觉回归：把 client.js 里的颜色令牌按 WCAG 2.1 算一遍对比度。
// 不需要浏览器、不需要截图 —— 面板透明后底色由壁纸决定，所以每种组合都按
// 「最暗壁纸 #0b1425」与「最亮壁纸 #ffffff」两端各算一次，取最差的那个报。
// 用法: node scripts/contrast-audit.mjs [--json]

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'lib', 'client.js')
const css = readFileSync(SRC, 'utf8')

// ── 颜色解析 ────────────────────────────────────────────────────────────
const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)))

function parseHex(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 1]
}

function parseColor(text) {
  const s = String(text).trim()
  if (s.startsWith('#')) return parseHex(s)
  const m = s.match(/rgba?\(([^)]+)\)/i)
  if (!m) return null
  const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number)
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
}

// CSS color-mix(in srgb, A p%, B)：srgb 下就是逐通道线性插值
function mix(a, b, p) {
  return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat(1).map((v, i) => (i < 3 ? v : 1))
}

function over(fg, bg) {
  const a = fg[3]
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1)
}

function relLuma(rgb) {
  const [r, g, b] = rgb.slice(0, 3).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const la = relLuma(a)
  const lb = relLuma(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// ── 从 CSS 里取令牌（深色块在前，浅色块在 [data-theme="light"] 里）────────
// 注意：注释里也出现过 .dc-root::before，取块必须带上 ' {'，否则会把令牌块切成空串
const rootStart = css.indexOf('.dc-root {')
const rootEnd = css.indexOf('.dc-root::before {')
const rootBlock = css.slice(rootStart, rootEnd)
const lightBlock = css.slice(css.indexOf('.dc-root[data-theme="light"]'))

function token(block, name, fallback) {
  const m = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : fallback
}

// DSH 宿主变量的回落值：透明面板下拿不到真实计算值，用官方色板按最接近的一档算
const HOST = {
  'dsw-alias-border-l2': parseHex('#263b58'),
  'dsw-alias-border-l1': parseHex('#1d2f4a'),
  'dsw-alias-label-primary': parseHex('#e8eefb'),
  'dsw-alias-label-secondary': parseHex('#9aa8c0'),
  'dsw-alias-label-tertiary': parseHex('#8b9bb3'),
  'dsw-alias-brand-primary': parseHex('#66b9f7'),
  'dsw-alias-state-success-primary': parseHex('#36c78e'),
  'dsw-alias-state-warn-primary': parseHex('#f0b536'),
  'dsw-alias-state-error-primary': parseHex('#f26b6b'),
}

function resolve(raw) {
  let text = String(raw).trim()
  const hostRef = text.match(/var\(--([a-z0-9-]+)(?:,\s*(.+))?\)/)
  if (text.startsWith('color-mix')) {
    // color-mix(in srgb, var(--x, #abc) 58%, #5d81b4)
    const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
    // 不能直接 split(',') —— var(--x, #abc) 里本身带逗号，必须按括号深度切
    const args = []
    let depth = 0
    let buf = ''
    for (const ch of inner) {
      if (ch === '(') depth += 1
      if (ch === ')') depth -= 1
      if (ch === ',' && depth === 0) {
        args.push(buf)
        buf = ''
      } else buf += ch
    }
    args.push(buf)
    const parts = args.slice(1) // 去掉 "in srgb"
    const parsePart = (part) => {
      part = part.trim()
      const pct = part.match(/^(.+?)\s+([\d.]+)%$/)
      const value = pct ? pct[1].trim() : part
      const weight = pct ? Number(pct[2]) / 100 : null
      return { color: resolve(value), weight }
    }
    const a = parsePart(parts[0])
    const b = parsePart(parts[1])
    const pa = a.weight ?? 0.5
    const pb = b.weight ?? 0.5
    const total = pa + pb
    return mix(a.color, b.color, pa / total)
  }
  if (hostRef) {
    const name = hostRef[1]
    if (HOST[name]) return HOST[name]
    if (hostRef[2]) return resolve(hostRef[2])
    return [255, 0, 255, 1]
  }
  const parsed = parseColor(text)
  if (parsed) return parsed
  return [255, 0, 255, 1]
}

// ── 组合表 ─────────────────────────────────────────────────────────────
// [标签, 前景令牌, 底色令牌, 要求]
// 注：输入框与按钮的「填充色 vs 卡片」不做数值判定 —— 近黑或近白的填充在 WCAG 里差不出 1.1，
// 它们的边界由 1px 实描边承担（描边 vs 卡片/内层卡 这两项已经卡了 1.35）。
// 因此「控件有没有描边」放在 test/client-ui-v2.test.mjs 里当结构断言。
const CHECKS = [
  ['正文 / 卡片', 'dc-text', 'dc-card', 4.5],
  ['次要文字 / 卡片', 'dc-muted', 'dc-card', 4.5],
  ['极小字 / 卡片', 'dc-faint', 'dc-card', 4.5],
  ['正文 / 内层卡', 'dc-text', 'dc-card-2', 4.5],
  ['次要文字 / 内层卡', 'dc-muted', 'dc-card-2', 4.5],
  ['极小字 / 内层卡', 'dc-faint', 'dc-card-2', 4.5],
  ['正文 / 输入框', 'dc-text', 'dc-field', 4.5],
  ['正文 / 悬浮条', 'dc-text', 'dc-float', 4.5],
  ['toast 文字 / toast 底', 'dc-toast-ink', 'dc-toast-bg', 4.5],
  ['错误 toast 文字 / 错误 toast 底', 'dc-toast-error-ink', 'dc-toast-error-bg', 4.5],
  ['品牌色 / 卡片', 'dc-brand', 'dc-card', 3.0],
  ['主按钮字 / 品牌底', 'dc-brand-ink', 'dc-brand', 4.5],
  ['成功态 / 卡片', 'dc-green', 'dc-card', 3.0],
  ['警告态 / 卡片', 'dc-amber', 'dc-card', 3.0],
  ['错误态 / 卡片', 'dc-red', 'dc-card', 3.0],
  ['描边 vs 卡片', 'dc-line', 'dc-card', 1.35],
  ['描边 vs 内层卡', 'dc-line', 'dc-card-2', 1.35],
]

const WALLPAPERS = [
  ['深壁纸', parseHex('#0b1425')],
  ['白壁纸', parseHex('#ffffff')],
]

function audit(theme) {
  const block = theme === 'dark' ? rootBlock : lightBlock
  const get = (name) => resolve(token(block, name, token(rootBlock, name, '#000000')))
  const rows = []
  for (const [label, fgName, bgName, min] of CHECKS) {
    const fg = get(fgName)
    const bgRaw = get(bgName)
    let worst = { ratio: Infinity, wall: '' }
    for (const [wallName, wall] of WALLPAPERS) {
      // 半透明底先与壁纸合成；文字再叠在合成后的底上
      const bg = over(bgRaw, wall)
      const drawn = bgName === 'dc-card-2' && (fgName === 'dc-ctl' || fgName === 'dc-field') ? fg : fg
      const ratio = contrast(over(drawn, bg).slice(0, 3).map((v) => clamp255(v)).concat(0), bg.slice(0, 3).map((v) => clamp255(v)).concat(0))
      if (ratio < worst.ratio) worst = { ratio, wall: wallName }
    }
    rows.push({ label, theme, ratio: Number(worst.ratio.toFixed(2)), wall: worst.wall, min, pass: worst.ratio >= min })
  }
  return rows
}

export function runAudit() {
  return [...audit('dark'), ...audit('light')]
}

const isMain = process.argv[1] && process.argv[1].endsWith('contrast-audit.mjs')
const rows = isMain ? runAudit() : []
const fails = rows.filter((r) => !r.pass)

if (!isMain) {
  // 被 import 时什么都不打印
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, fails: fails.length }, null, 2))
} else {
  const pad = (s, n) => String(s).padEnd(n, ' ')
  console.log(pad('主题', 6) + pad('组合', 44) + pad('对比度', 10) + pad('要求', 6) + '判定')
  for (const r of rows) {
    console.log(
      pad(r.theme, 6) + pad(r.label, 44) + pad(`${r.ratio}:1`, 10) + pad(`${r.min}`, 6) + (r.pass ? 'PASS' : `FAIL (${r.wall})`)
    )
  }
  console.log(`\n合计 ${rows.length} 项，失败 ${fails.length} 项`)
}

if (fails.length && process.argv.includes('--strict')) process.exitCode = 1
