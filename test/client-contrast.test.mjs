// 视觉回归（可复算）：把 client.js 的颜色令牌按 WCAG 2.1 算对比度，
// 深浅两套主题 × 「最深壁纸 / 纯白壁纸」两端各算一次，取最差。
// 这不是审美判断，是数值闸门：任何一次改色如果让某个组合跌破阈值，这里先红。
import test from 'node:test'
import assert from 'node:assert/strict'
import { runAudit } from '../scripts/contrast-audit.mjs'

const rows = runAudit()

test('对比度：深浅两套主题全部达标', () => {
  const fails = rows.filter((row) => !row.pass)
  const detail = fails.map((f) => `${f.theme}/${f.label} = ${f.ratio}:1 < ${f.min} (${f.wall})`).join('\n')
  assert.equal(fails.length, 0, `对比度不达标：\n${detail}`)
})

test('对比度：正文与次要文字在卡片上至少 4.5:1', () => {
  for (const theme of ['dark', 'light']) {
    for (const label of ['正文 / 卡片', '次要文字 / 卡片', '极小字 / 卡片']) {
      const row = rows.find((r) => r.theme === theme && r.label === label)
      assert.ok(row, `缺少用例：${theme}/${label}`)
      assert.ok(row.ratio >= 4.5, `${theme}/${label} 只有 ${row.ratio}:1`)
    }
  }
})

test('对比度：toast 与其文字成对定义，不借别的层', () => {
  for (const theme of ['dark', 'light']) {
    const ok = rows.find((r) => r.theme === theme && r.label.startsWith('toast 文字'))
    const err = rows.find((r) => r.theme === theme && r.label.startsWith('错误 toast'))
    assert.ok(ok && ok.pass, `${theme} toast 对比度不足：${ok && ok.ratio}`)
    assert.ok(err && err.pass, `${theme} 错误 toast 对比度不足：${err && err.ratio}`)
  }
})

test('对比度：五态色在卡片上至少 3:1（颜色只作辅助，必须有文字）', () => {
  for (const theme of ['dark', 'light']) {
    for (const label of ['成功态 / 卡片', '警告态 / 卡片', '错误态 / 卡片', '品牌色 / 卡片']) {
      const row = rows.find((r) => r.theme === theme && r.label === label)
      assert.ok(row && row.ratio >= 3, `${theme}/${label} = ${row && row.ratio}`)
    }
  }
})
