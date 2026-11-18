import test from 'node:test'
import assert from 'node:assert/strict'
import { loadClientModule, clientSource } from './client-loader.mjs'

// ── 0.5.0 视觉层：取值校验、版面去重、玻璃厚度与窄屏断点 ────────────────
const VALID_DRAFT = {
  defaultSaveDir: 'C:\\Users\\97292\\Downloads',
  connections: 4,
  maxBytes: 5 * 1024 * 1024 * 1024,
  requestTimeoutMs: 30000,
  pollMs: 1000,
  maxWaitSeconds: 600,
  githubMirrorBase: 'https://ghfast.top',
  hfMirror: 'https://hf-mirror.com',
}

test('取值校验：合法草稿没有错误', () => {
  const { __test } = loadClientModule()
  assert.deepEqual({ ...__test.validateDraft(VALID_DRAFT) }, {})
})

test('取值校验：越界与非法协议就近报错', () => {
  const { __test } = loadClientModule()
  const bad = __test.validateDraft({
    ...VALID_DRAFT,
    defaultSaveDir: '   ',
    connections: 17,
    maxBytes: 1024,
    requestTimeoutMs: 600001,
    pollMs: 50,
    maxWaitSeconds: 10,
    githubMirrorBase: 'http://ghfast.top',
    hfMirror: 'hf-mirror.com',
  })
  for (const key of ['connections', 'maxBytes', 'requestTimeoutMs', 'pollMs', 'maxWaitSeconds', 'githubMirrorBase', 'hfMirror', 'defaultSaveDir']) {
    assert.ok(bad[key], `${key} 应该报错`)
  }
})

test('取值校验：镜像地址带查询串或凭据时报错', () => {
  const { __test } = loadClientModule()
  assert.ok(__test.validateDraft({ ...VALID_DRAFT, githubMirrorBase: 'https://ghfast.top/?x=1' }).githubMirrorBase)
  assert.ok(__test.validateDraft({ ...VALID_DRAFT, githubMirrorBase: 'https://user:pw@ghfast.top' }).githubMirrorBase)
  assert.equal(__test.validateDraft({ ...VALID_DRAFT, githubMirrorBase: '' }).githubMirrorBase, undefined)
})

test('版面：标题不再三处重复，执行路径移到引擎页', () => {
  const source = clientSource()
  assert.equal((source.match(/下载控制中心/g) || []).length, 0, '页面内不再出现与宿主重复的大标题')
  // 字段只在引擎页出现一次（FIELD_LABELS 里的那处是文案表，不是渲染点）
  assert.equal((source.match(/label: 'yt-dlp 路径'/g) || []).length, 1)
  const enginesAt = source.indexOf("'执行路径'")
  assert.ok(enginesAt > 0)
  assert.ok(source.indexOf("label: 'yt-dlp 路径'") > enginesAt, 'yt-dlp 路径应该在引擎页')
  // 下载页不再渲染这两个路径输入
  const downloadTab = source.slice(source.indexOf('function renderDownload()'), source.indexOf('function renderPolicy()'))
  assert.equal(downloadTab.includes('ytdlpPath'), false)
  assert.equal(downloadTab.includes('hfPath'), false)
})

const ruleOf = (css, selector) => {
  const at = css.indexOf(selector)
  assert.ok(at >= 0, `${selector} 缺失`)
  const end = css.indexOf('}', at)
  assert.ok(end > at, `${selector} 没有闭合`)
  const piece = css.slice(at, end)
  // 切错片段（命中注释、或多个选择器共用一条规则）会让断言变成假绿，这里直接拦。
  assert.ok(piece.length > 20, `${selector} 切出的片段过短，规则可能不是你以为的那条`)
  return piece
}

// 从 CSS 里取某个 token 的 alpha，用于「层次关系」断言而不是钉死字面量
const rgbOf = (css, name) => {
  const rgba = css.match(new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+)`))
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])]
  // 允许写成实色 #rrggbb（输入框就是不透明的一档）
  const hex = css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})\\b`, 'i'))
  assert.ok(hex, `--${name} 应是 rgba() 或 #rrggbb 令牌`)
  const h = hex[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// 感知亮度（近似）：越小越深，用来断言「越里越深」而不钉死具体数值
const lumaOf = (css, name) => {
  const [r, g, b] = rgbOf(css, name)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const alphaOf = (css, name) => {
  const m = css.match(new RegExp(`--${name}:\\s*rgba\\([^)]*?,\\s*(\\.\\d+)\\)`))
  assert.ok(m, `--${name} 应是不带透明度的 rgba 令牌`)
  return Number(m[1])
}

test('样式：面板交还壁纸，卡片自己站住', () => {
  const { __test } = loadClientModule()
  const css = __test.stylesheet()
  // 用户在 0.5.5 认可「背景去掉，卡片已经很清楚」，0.6.x 不得再偷偷把面板加回来
  assert.match(ruleOf(css, '.dc-root {'), /--dc-panel:\s*transparent/, '主面板必须保持 transparent')
  const glass = ruleOf(css, '.dc-root::before {')
  assert.ok(glass.includes('display: none'), '玻璃伪元素停用（结构留着，改 display 即可加回）')
  // 面板本体不能挂 backdrop-filter：那会把它变成 backdrop root，.dc-toast 的 fixed 基准会跟着变
  assert.equal(/backdrop-filter\s*:/.test(ruleOf(css, '.dc-root {')), false)
  for (const sel of ['.dc-card {', '.dc-engine {', '.dc-modal {', '.dc-input, .dc-select {']) {
    assert.equal(/backdrop-filter\s*:/.test(ruleOf(css, sel)), false, `${sel} 不应加模糊`)
  }
  // 越往里越深：卡片 > 内层卡 > 输入框（断关系不断字面量，精修调数值不用改测试）
  // 输入框允许写成实色（不再半透明），此时它天然「最实」，用亮度关系断言即可
  const fieldRaw = ruleOf(css, '.dc-root {').match(/--dc-field:\s*([^;]+);/)[1].trim()
  const fieldSolid = /^#[0-9a-f]{3,8}$/i.test(fieldRaw)
  assert.ok(fieldSolid || alphaOf(css, 'dc-field') >= 0.85, `输入框要实或够深：${fieldRaw}`)
  assert.ok(lumaOf(css, 'dc-card') > lumaOf(css, 'dc-card-2'), '内层比卡片更深')
  assert.ok(lumaOf(css, 'dc-card-2') >= lumaOf(css, 'dc-field'), '输入框最深，键入区不能随壁纸漂移')
  // toast 底色与字色必须成对给（借 dc-text/dc-panel 会在某一主题下撞成同色）
  const toast = ruleOf(css, '.dc-toast {')
  assert.ok(toast.includes('var(--dc-toast-bg)') && toast.includes('var(--dc-toast-ink)'), 'toast 要用成对令牌')
  for (const tok of ['--dc-toast-bg', '--dc-toast-ink', '--dc-toast-error-bg', '--dc-toast-error-ink']) {
    assert.equal(css.split(tok + ':').length - 1, 2, `${tok} 深色与浅色必须各定义一次`)
  }
  assert.ok(css.includes('@supports not ((backdrop-filter'), '缺少实底降级')
  assert.ok(css.includes('@container dc'))
  for (const cls of ['dc-state-ready', 'dc-state-warn', 'dc-state-bad', 'dc-state-idle']) {
    assert.ok(css.includes(`.${cls}`), `${cls} 缺失`)
  }
  assert.ok(css.includes('#66b9f7'), '品牌色回退值应为参考色')
})

test('对齐：行首图标与对勾跟标题行走同一条中线', () => {
  const source = clientSource()
  const css = loadClientModule().__test.stylesheet()
  // 标记不动：图标仍是 .dc-engine-icon 里的字形，对勾仍是 .dc-check.ok
  assert.ok(source.includes("className: 'dc-engine-icon'"))
  assert.ok(source.includes("className: 'dc-check ok'"))
  const rowRule = ruleOf(css, '.dc-row:has(> .dc-engine-icon), .dc-row:has(> .dc-check) {')
  assert.ok(rowRule.includes('align-items: flex-start'), '图标行要顶端对齐，不能跟着两行文字居中')
  assert.ok(ruleOf(css, '.dc-row-title {').includes('line-height: 18px'), '标题行高固定后图标才有确定的中线')
  const iconRule = ruleOf(css, '.dc-row > .dc-engine-icon {')
  assert.ok(iconRule.includes('height: 22px'), '图标框高度决定中线位置')
  assert.ok(iconRule.includes('margin-top: -2px'), '22px 框要靠 -2px 才能压到 18px 标题行中线上')
  const checkRule = ruleOf(css, '.dc-row > .dc-check {')
  assert.ok(checkRule.includes('line-height: 18px'))
})

test('样式：悬浮保存条与顶部按钮绑定同一份草稿', () => {
  const source = clientSource()
  assert.ok(source.includes("className: 'dc-savebar'"))
  const bar = source.slice(source.indexOf("className: 'dc-savebar'"))
  assert.ok(bar.includes('onClick: discard'))
  assert.ok(bar.includes('onClick: save'))
})

// ── 0.6.0：五页精修的结构守卫 ───────────────────────────────
test('精修：高级参数与诊断默认折叠，首屏不铺满', () => {
  const src = clientSource()
  const folds = src.match(/className: 'dc-adv'/g) || []
  assert.ok(folds.length >= 4, `折叠区至少 4 处（超时/镜像风险/包管理器/开发者信息），实际 ${folds.length}`)
  assert.match(src, /h\('summary', null, '超时与轮询'\)/)
  assert.match(src, /h\('summary', null, '包管理器诊断（只读）'\)/)
  assert.match(src, /h\('summary', null, '查看内部标识'\)/)
})

test('精修：数值字段带单位后缀，而不是把单位塞进标签', () => {
  const src = clientSource()
  assert.match(src, /props\.unit \? h\('div', \{ className: 'dc-input-unit' \}/)
  assert.equal(/label: '单文件上限（GB）'/.test(src), false, '单位应从标签移到输入框后缀')
  assert.match(src, /label: '单文件上限', unit: 'GB'/)
  assert.match(src, /\.dc-unit \{/)
})

test('精修：安全页中文主标题 + 英文键作副标题', () => {
  const src = clientSource()
  assert.equal(/dc-row-title' \}, 'guardFailClosed'\)/.test(src), false, '英文键不应再当标题')
  assert.match(src, /readonlySwitch\('guardFailClosed', '失败即拒绝'/)
  assert.match(src, /'自动拉起 Motrix'/)
  assert.match(src, /className: 'dc-lock'/)
})

test('精修：镜像未启用时配置区明确「不生效」', () => {
  const src = clientSource()
  assert.match(src, /当前未启用：上面的地址只保存，不参与任何下载改写。/)
  assert.match(src, /当前未启用：HF_ENDPOINT 不注入子进程。/)
  assert.match(src, /disabled: !draft\.githubMirrorDefault/)
  assert.match(src, /disabled: !draft\.useHfMirror/)
})

test('图标块：44px 铺满、无背景板、无描边、不被圆角切边', () => {
  const css = loadClientModule().__test.stylesheet()
  const logo = ruleOf(css, '.dc-logo {')
  assert.ok(logo.includes('box-sizing: border-box'), '尺寸要含边框，避免以后加边框又挤小图')
  assert.ok(/width:\s*44px/.test(logo) && /height:\s*44px/.test(logo), '图标块要够大（44px），图才能看清')
  assert.ok(/padding:\s*0/.test(logo), '不再内缩，图直接铺满图标块')
  assert.ok(/border:\s*0/.test(logo), '不留边框：图自带紫色圆角底，外面再加框就是多余的方框')
  assert.ok(/background:\s*none/.test(logo), '图标块不留底色：图自带紫色圆角底，再套卡片色会露出深色方框')
  assert.ok(/box-shadow:\s*none/.test(logo), '不再画描边，否则圆角处会看到一圈方框线')
  const img = ruleOf(css, '.dc-logo img {')
  assert.ok(img.includes('width: 100%') && img.includes('height: 100%'), '图跟内容盒走，不要写死像素尺寸（会溢出被切成缺角）')
  assert.ok(img.includes('object-fit: contain'), '保持比例，不拉伸')
  assert.ok(/filter:\s*drop-shadow\(/.test(img), '浮起感只能靠 drop-shadow（沿轮廓），不能用 box-shadow 画出矩形边')
})

test('控件边界靠 1px 实描边，不靠填充差', () => {
  const css = loadClientModule().__test.stylesheet()
  const input = ruleOf(css, '.dc-input, .dc-select {')
  assert.ok(input.includes('border: 1px solid var(--dc-line)'), '输入框必须有实描边：填充色与卡片差不出 1.1')
  const btn = ruleOf(css, '.dc-btn {')
  assert.ok(btn.includes('border: 1px solid var(--dc-line)'), '按钮同理')
  const modal = ruleOf(css, '.dc-modal {')
  assert.ok(modal.length > 20, '弹层规则应存在')
})

test('断点统一在 1080 / 880 / 640，与验收矩阵对齐', () => {
  const css = loadClientModule().__test.stylesheet()
  for (const w of ['1080', '880', '640']) {
    assert.ok(css.includes(`@container dc (max-width: ${w}px)`), `缺少 ${w}px 容器断点`)
  }
  assert.ok(!css.includes('(max-width: 1040px)'), '旧的 1040 断点要清掉，否则两套阈值打架')
  assert.ok(!css.includes('@container dc (max-width: 860px)'), '旧的 860 断点要清掉')
  assert.ok(!css.includes('@container dc (max-width: 620px)'), '旧的 620 断点要清掉')
})

test('两列栅格：第二列首行不画分隔线，单列时补回', () => {
  const css = loadClientModule().__test.stylesheet()
  assert.ok(css.includes('.dc-grid-2 > .dc-row:nth-child(2) { border-top: 0; }'), '第二列首行的上分隔线要清掉')
  // ruleOf 用的是 indexOf('}')，套娃的 @container 块会被切短，这里直接取原文一段
  const from = css.indexOf('@container dc (max-width: 640px) {')
  const narrow = css.slice(from, from + 400)
  assert.ok(narrow.includes('.dc-grid-2 > .dc-row:nth-child(2) { border-top: 1px solid var(--dc-line-soft); }'), '单列时要把分隔线放回来')
})
