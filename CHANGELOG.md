# Changelog

## 0.6.11 — 2026-11-18

发行前体检（遗留系统工程师 + 代码审查工程师）之后的必修项。只碰发行物、定位基准与文案，不动下载行为。

- **浮层定位基准**：`.dc-root` 上的 `container: dc / inline-size` 会施加 layout containment，让面板盒成为 `position: fixed` 后代的包含块 —— `.dc-toast` 与 `.dc-modal-backdrop` 于是以可滚动的面板盒为基准，长页签里等于飘到视口外。容器查询移到新增的内层 `.dc-shell`，浮层用 `data-dc-overlay` 标出、留在 shell 外面。
- **dirty 归属**：`ytdlpPath` / `hfPath` 渲染在引擎页，却记在 `TAB_FIELDS.download` 里 —— 改执行路径时「下载」页签亮，「引擎」页签恒为 0，报错跳转也找不到落点。新增 `TAB_FIELDS.engines`，并加「每个可编辑字段有且只有一个归属页签」的守卫。
- **安全文案**：「当前环境未开启」原本写死在常量里，用户用 `DSH_DOWNLOAD_ALLOW_SHELL=1` 开了之后，左边显示「开」、右边仍说「未开启」。三个只读开关的描述改为按运行时值生成。
- **引擎页说明**：原文案说「状态由 available 与原始 detail 归类」，与实际实现（直接读 Host 的 `state`）相反，且违反同文件里「不要从 detail 字符串二次推断状态」的约定。
- **工具输出 bug**：`tools/index.mjs` 的 `renderProvision` 用字面 `join('\n')`（两个字符反斜杠 + n）拼多行，`motrix_provision` 的结果会糊成一行。改为真换行。
- **发行物卫生**：`cordis.patch.yml` 删掉写死的 `defaultSaveDir` / `allowedRoots`（缺省走 Host 的 `<主目录>/Downloads`），否则装到别人机器上默认落到不存在的目录；README 的示例包名与路径去个人化；`files` 去掉 4 个没人引用的根图标（省约 197 KB）与重复的 `lib/*.js`；插件目录自带 `.gitignore`。
- 新增 `test/release-guards.test.mjs`（7 例）：dirty 归属、配置模板与 README 不含个人路径、files 只带运行必需、`.gitignore` 规则、`renderProvision` 真换行、容器查询载体不是 `.dc-root`。**208 例全绿**。

## 0.6.10 — 2026-11-18

总览页「安全边界」右上角多出一条横线。

- 根因：分隔线规则是 `.dc-row { border-top }` + `.dc-row:first-of-type { border-top: 0 }`。安全边界用 `.dc-grid-2` 铺成两列，第二列的首行「目录白名单」在 DOM 里是第 2 个子元素，`:first-of-type` 管不到它，于是它照样画了上边框 —— 视觉上就是右列顶部一条孤线。
- 修法：新增 `.dc-grid-2 > .dc-row:nth-child(2) { border-top: 0; }`；并在 `@container dc (max-width: 640px)` 里把线放回来，因为单列时第 2 行本来就该有分隔线。
- 新增回归用例（含「单列补回」那一半），避免以后改栅格又漏掉。200 例全绿。

## 0.6.9 — 2026-11-18

六阶段剩下的「视觉回归」：把能不能读这件事做成可复算的数值闸门，顺手修掉四处真实缺陷。

**新增 `scripts/contrast-audit.mjs`（34 项检查）**
- 直接从 `lib/client.js` 的令牌算 WCAG 2.1 对比度；面板透明后底色由壁纸决定，所以每组都按「最深壁纸 #0b1425」与「纯白壁纸 #ffffff」各算一次，取最差。
- 支持 `color-mix(in srgb, var(--x, #abc) 58%, #5b81b4)` 的解析（按括号深度切参，不能直接 split(',')——`var(--x, #abc)` 自带逗号）。

**修掉的四处**
1. `.dc-toast` 原来借 `var(--dc-text)` 当底色、`var(--dc-ink-solid)` 当字色：深色下正常，浅色下两者都是深色 → **1.13:1**。改成成对令牌 `--dc-toast-bg / --dc-toast-ink / --dc-toast-error-bg / --dc-toast-error-ink`，深浅各一份；错误态不再写死 `#fff`（深色红底上只有 2.96:1，现 6.21:1）。
2. 浅色 `--dc-faint` `#7b879c` → `#5f6d84`（3.42:1 → 4.93:1）。
3. 浅色 `--dc-line` `#dbe3f0` → `#c2cee2`（对卡片 1.22:1 → 1.50:1），`--dc-line-soft` 同步 `#d8e0ee`。
4. 输入框与卡片几乎同色（1.03:1）：深色 `--dc-field` 改实色 `#050b15`、浅色 `#ffffff`，边界交给 1px 描边（1.97 / 1.50）。近黑/近白的填充在 WCAG 里差不出 1.1，所以填充差不再做数值判定，改由「控件必须有实描边」这条结构断言兜。

**断点对齐验收矩阵**：容器断点 1040 / 860 / 620 → **1080 / 880 / 640**，`@supports not (container-type)` 的媒体兜底同步 880 / 640。

**测试**：新增 `test/client-contrast.test.mjs`（4 例，直接 import `runAudit()` 断言 0 失败 + 正文 4.5 + toast 成对 + 五态 3:1）；`test/client-ui-v2.test.mjs` 补两条结构断言（控件必须 1px 实描边、断点必须是 1080/880/640 且旧断点清干净），并把 `rgbOf` 扩成接受十六进制实色。**199 例全绿**。

**报告**：`docs/ui/visual-regression-0.6.9.md`（含完整 34 行数值表与四处缺陷的前后对比）。

## 0.6.8 — 2026-11-18

上一版阴影看不出来，换成「暗边 + 细亮边」双层轮廓阴影。

- `filter: drop-shadow(0 3px 9px rgba(2,6,12,.62)) drop-shadow(0 0 1px rgba(214,230,255,.30))`。
- 原因：单层深色阴影只在背景比图更亮时才看得出；这张壁纸那块偏深蓝，深色阴影贴着同色背景就消失了。加一层 1px 的浅蓝亮边，任何背景上都能勾出图标轮廓 —— 暗处靠亮边、亮处靠暗边。
- 仍是 `drop-shadow`（读 alpha 通道，沿圆角轮廓），没有 `box-shadow` 的矩形边。193 例全绿。

## 0.6.7 — 2026-11-18

图标加一层沿轮廓的落影，求一点浮起感，仍然没有背景板。

- `.dc-logo img` 加 `filter: drop-shadow(0 2px 6px rgba(3, 7, 14, .45))`。
- 为什么用 `drop-shadow` 而不是 `box-shadow`：前者读图片的 alpha 通道，阴影沿紫色圆角块的轮廓走；后者按盒子画，圆角处会露出一圈矩形阴影边，等于把刚去掉的方框又画回来（只是变柔和了）。
- 测试加一条：logo 的 img 必须带 `filter: drop-shadow(`，防止以后改回 box-shadow。193 例全绿。

## 0.6.6 — 2026-11-18

去掉图标后面的背景板。

- `.dc-logo` 去掉 `background: var(--dc-card)` 与 `box-shadow: inset 0 0 0 1px var(--dc-line)`，改成 `background: none; box-shadow: none; border: 0`，只保留 44px 尺寸与 `place-items: center`。
- 原因：图标素材本身是带紫色圆角底的完整方块（四角已烘焙透明圆角），外层再铺一层卡片色，圆角处的透明区就会透出深色方框，看着像「底板上贴了张图」。现在是纯图，没有多余边框。
- `.dc-logo img` 不变：`100% × 100% + object-fit: contain + border-radius: 12px`。
- 测试口径改为「必须 `background: none` / `box-shadow: none` / `border: 0`」，并删掉已无意义的 `overflow: hidden` 断言。193 例全绿。

## 0.6.5 — 2026-11-18

直接放大图标，不再靠内缩抠细节。

- `.dc-logo` 30px → **44px**，`padding` 1px → 0，圆角 9/8px → 12px；图仍是 `100% × 100% + object-fit: contain`，实际图案约 42px（0.6.4 是 26.6px，0.6.3 是 21px）。
- 描边继续用 `box-shadow: inset 0 0 0 1px`，不占盒宽。
- 文字比例跟上，不然图标会显得压住标题：`.dc-title` 13 → 15px（行高 20px）、`.dc-sub` 11 → 12px、header `gap` 10 → 12px、`min-height` 36 → 44px。
- 测试口径同步：图标块必须 44px、`padding: 0`。193 例全绿。

## 0.6.4 — 2026-11-18

图标太小了，放大到「占满但不切边」。

- 先量了素材本身：`assets/icon/icon-128.png` 的有效像素 bbox 是 (3,0)-(125,125)，四角已烘焙透明圆角 —— 图只有 ~95% 画布，再套 3px 内缩就显得小。
- 去掉 `.dc-logo` 的 `border: 1px solid`（它吃盒宽，30px 块里只剩 28px），改 `box-shadow: inset 0 0 0 1px var(--dc-line)`：视觉描边照旧，但不占空间。
- 内缩 3px → 1px，`img` 仍是 `100% × 100% + object-fit: contain`、圆角 8px。有效绘制区 28px，实际图形约 26.6px（比上版 21px 大 27%），四角仍留 1px 呼吸，不会被圆角裁掉。
- 测试同步改口径：断言内缩 0–1px、无 `border: 1px solid`、有 inset 描边。193 例全绿。

## 0.6.3 — 2026-11-18

两件事：把 0.6.2 那版错方向的布局回滚，修掉左上角图标被切掉一角的问题。

- 回滚布局：`--dc-maxw` 回 1240px、`.dc-root` 回 `16px 20px 88px`、`.dc-header` 下间距回 12px。0.6.2 把列宽交给宿主是理解错方向，页签与卡片本来的缩进是对的。
- 图标块：`.dc-logo` 改 `box-sizing: border-box`（1px 边框原本压在 30px 之外，内容盒只剩 28px）+ `padding: 3px` 内缩；`.dc-logo img` 从写死 `30px×30px` 改成 `100%×100% + object-fit: contain`。原来固定 30px 的图会溢出 28px 内容盒 2px，再被 `overflow: hidden` 从圆角处切掉一角，看起来就是「漏了一点边」。
- 新增回归测试：图标块必须 border-box + 2–4px 内缩 + img 走 100% 与 contain，防止以后再退回固定尺寸。测试 193 例全绿。

## 0.6.2 — 2026-11-18

把「左边那一截没来由的缩进」去掉。面板透明之后，页面已经没有自己的边界，再留 20px 内边距就会在宿主内容左缘之外多缩一层。

- `--dc-maxw` 1240px → 100%：列宽交回宿主，不再在宽窗口里水平居中。
- `.dc-root` 内边距 16/20/88 → 8/0/80：只留纵向呼吸，横向不叠加任何内缩；标题块、页签、卡片因此共用宿主内容框的同一条左基线。
- `.dc-header` 下间距 12 → 10，顶部空档收掉一半。
- 其余（透明面板、卡片配色、token、五页结构、折叠区、单位后缀、锁标记、渲染烟测）一律不动；测试 192 例全绿。

## 0.6.1 — 2026-11-18

背景改回去：0.6.0 把主面板加回 `rgba(15,29,52,.90)` 是错的方向，0.5.5 的「背景去掉、卡片自己站住」才是用户认可的观感。

- `--dc-panel` 恢复 `transparent`；`.dc-root::before` 恢复 `display: none`（结构留着，将来要一层极淡玻璃只改 display 与 background 两行）。
- 不再有面板底色、不再有 `backdrop-filter`；壁纸原样是页面底色，`.dc-header` 的文字阴影继续负责让标题在光晕上站住。
- 0.6.0 的其余改动全部保留：间距/圆角/字号/高度 token、容器查询提到 `.dc-root`、页签强调线、`ensureStyle` 内容比对、单位后缀、参数分组与折叠、镜像关闭态禁用与「不生效」提示、引擎 detail 折叠、安全页中文主标题 + 锁、开发者信息折叠、`getSnapshot` 崩溃加固、渲染烟测。
- 测试跟着改口：面板断言从「alpha 落在 0.88–0.93」改成「必须是 transparent 且伪元素 display: none」，防止后续又被悄悄加回来。测试 192 例全绿。

## 0.6.0 — 2026-11-18

把配置中心从「深色玻璃板」改成一套有规范的界面系统：先立全局 token 与层次，再逐页收口。

**全局**
- 三级层次回到设计稿：壁纸 → 主面板 `rgba(15,29,52,.90)` + `backdrop-filter: blur(12px) saturate(1.10)` → 卡片 `rgba(9,18,33,.88)` / 内层 `rgba(7,14,27,.90)` / 输入 `rgba(5,11,21,.90)` / 按钮 `rgba(28,52,86,.86)` / 浮层 `rgba(13,24,42,.92)`。模糊只挂在 `.dc-root::before` 伪元素上，面板本体不挂 `backdrop-filter`，`.dc-toast` 的 `position: fixed` 基准不受影响。
- 新增间距/圆角/字号/高度 token（radius 14/10/8、pad 20/16、gap 16/12/8、h 36/32/32、fs 20/16/14/12/11），卡片与控件开始吃 token 而不是散落字面量。
- `container: dc / inline-size` 从 `.dc-main` 提到 `.dc-root`，底部悬浮条的响应式断点这才真正命中；四处 `max-width:1240px` 收敛为 `--dc-maxw`。
- 页签选中态改为「轻背景 + 底部 2px 强调线」，与宿主 tab 语言一致。
- `ensureStyle()` 改为内容比对后再决定是否重插：改了 CSS 不再需要重启才有反应（生产路径仍是同一份样式）。
- 删掉三处内联样式覆盖（引擎图标 24px 压掉 CSS 22px、对勾内联色、`.dc-right` 内联 flex），并把 `.dc-check .ok` 与 `.dc-check.ok` 并列，修掉对勾颜色永不生效的后代选择器。

**逐页**
- 总览：hero 文案压到一行；四引擎卡仍是「快速判断可用性」，策略/加速/安全各自成卡。
- 下载：数值字段改成「标签 + 输入框 + 单位后缀」（单文件上限 GB、超时 秒、轮询 毫秒）；传输参数分「传输」「超时与轮询（默认折叠）」两组；目录 chip 长路径省略并可悬停看全文，默认目录仍不可删。
- 策略：GitHub 镜像与 HF 镜像的开关移到卡片标题同行；关闭时输入框禁用并给出「当前未启用，不参与改写 / 不注入子进程」的明确提示；「开启后会发生什么」与「包管理器诊断」都改为默认折叠。
- 引擎：detail 超过 44 字折成可展开的一行（原文不改写，只负责不把卡片撑爆）。
- 安全：只读项统一为「中文主标题 + 英文键作副标题」（失败即拒绝 / 自动拉起 Motrix），行首加锁标记；内部标识收进「开发者信息」折叠区。

**加固**
- `controller.getSnapshot()` 抛错不再冒泡：effect 里抛出会拆掉整棵 Page，表现就是「插件整块消失」（0.5.2 白屏同款）。现在降级成空快照 + 顶部横幅。
- 新增 `test/client-render-smoke.test.mjs`：带 hook 槽位的假 React 真渲染 Page，依次点开五个 Tab、走错误分支、点检测，并禁止 `h('svg'` 回潮——0.5.2 那类「测试全绿但页面没了」的问题从此会红。
- 测试 192 例（188 → +4 结构守卫）；`lib/*.bak-*` 移出 `lib/` 并收窄 `files`，不再打进 tarball（50 → 48 文件）。

## 0.5.5 — 2026-11-18

面板背景整体交出去。卡片、页签、输入框这些「实物」的配色一个没动，只把面板这一层清空。

- `--dc-panel` → `transparent`（深浅色都是）；`.dc-root::before` 玻璃层停用（`display: none`，结构留着，将来要加回一层极淡玻璃改一行即可）。
- 不再有 backdrop-filter，也不再有任何压暗；壁纸原样成为页面底色。
- `.dc-header` 的文字阴影加强到 `0 1px 2px rgba(3,7,14,.75), 0 0 12px rgba(3,7,14,.45)`——它现在直接压在壁纸的台灯光晕上，需要自己站住。
- 行首图标对齐、卡片配色、输入框、悬浮条、按钮、下载接口与安全边界均未改；测试 184 例全绿。

## 0.5.4 — 2026-11-18

卡片配色不动，只把「背景板还是暗」和「策略页图标不对齐」两件事做掉。

- 面板 `rgba(14,26,46,.46)` → `rgba(10,20,38,.30)`。
- 玻璃层渐变改成「只压两头」：顶部 `.20`、16%~62% 完全不压、底部 `.10`。中段就是壁纸本身。
- `backdrop-filter` 从 `blur(30px) saturate(.72) brightness(.84)` 改成 `blur(26px) saturate(.86) brightness(1.04)`——只柔化、微微提亮，不再整体压暗。
- 行首图标不再用绝对定位：图标行改为 `align-items: flex-start`，标题行固定 `line-height: 18px`，图标框 22px + `margin-top: -2px`，框的中线正好落在标题行中线上；对勾 `line-height: 18px`。整组仍在 `@supports selector(:has(> *))` 内，不支持时退回原表现。
- 卡片、输入框、悬浮条、按钮、文字层级、下载接口与安全边界均未改；测试 184 例全绿。

## 0.5.3 — 2026-11-18

0.5.2 装上去之后下载页整块不见了。回滚到 0.5.1（界面恢复），这一版按最小改动重做：**改动只剩 CSS**，不碰任何标记与组件代码，避免再出现一次白屏。

- 撤回 0.5.2 的内联 SVG 图标改造（`ICON_PATHS` / `iconSvg` / `routeRows` / `securityLine` 全部回到 0.5.1 的写法），标记结构与 0.5.1 逐字一致。
- 透明度照 0.5.2 的目标落地：面板 `rgba(14,26,46,.46)`、卡片 `rgba(28,50,82,.78)`、内层 `rgba(18,33,56,.84)`、输入框 `rgba(10,19,33,.92)`、悬浮条 `rgba(24,42,68,.90)`。
- 玻璃层：`blur(30px) saturate(.72) brightness(.84)`，渐变只在顶部压 `.40`（控制条与页签文字），中段 `.05` —— 壁纸的灯感能透上来。
- 按钮 `--dc-ctl` `rgba(38,66,102,.82)`，比内层卡亮一档，降透明后不与卡片糊在一起。
- 说明文字向亮端混一档（muted 68%、faint 55%），`.dc-header` 加 `text-shadow`。
- 图标对齐改用纯 CSS：`.dc-row` 相对定位，`.dc-row:has(> .dc-engine-icon)` / `:has(> .dc-check)` 留出 34px 左侧位置，图标与对勾绝对定位贴标题行（`top: 3px`）。整组规则包在 `@supports selector(:has(> *))` 里，不支持 `:has()` 时退回原来的居中表现，不会压字。
- 界面外未改：下载接口、引擎探测、SSRF / 资源限制 / Shell 守卫、配置字段与标签。测试 184 例全绿。

## 0.5.2 — 2026-11-18

上一版还是像块黑胶板：`brightness(.56)` 把壁纸压没了，卡片又接近实色。这一版把压暗交还给壁纸本身，只留一点顶部压光给控制条文字。

- 面板 rgba(12,22,40,.68) → rgba(14,26,46,.46)；卡片 .86 → .78、内层 .90 → .84；输入框 .92、悬浮条 .90 仍是最实的一档。
- 玻璃层：`blur(30px) saturate(.72) brightness(.84)`，竖向渐变只在顶部压 .40（保控制条与页签的对比），中段只压 .05，壁纸的明暗关系能透上来。
- 按钮单列 `--dc-ctl` rgba(38,66,102,.82)，比内层卡亮一档，降透明后不再和卡片糊在一起。
- 文字：`--dc-muted` / `--dc-faint` 各向亮端混一档（68% / 55%），面板透出来的底子变亮后说明文字不再发灰；`.dc-header` 加 `text-shadow` 让裸面板上的标题站住。
- 对齐修复：策略页行首图标（通用 URL / Magnet / 视频 / HF）从 `P ⇅ ▷ H` 字形换成内联 SVG（`ICON_PATHS` + `iconSvg()`），容器 `.dc-row-icon` 24×24、`align-self:flex-start` + `margin-top:1px`；安全页对勾换成 `.dc-row-check` 里的 SVG，`align-self:flex-start` + `margin-top:3px`，不再跟着两行文字垂直居中。
- 界面外：下载接口、引擎探测、SSRF / 资源限制 / Shell 守卫、配置字段与标签一字未改。测试 184 例全绿。

## 0.5.1 — 2026-11-17

玻璃层调回「透一点点」：面板不再是一块不透明深色板。只调视觉层次，不动下载行为、安全边界与配置 Schema。

- 面板透明：`--dc-panel` 深色 rgba(11,20,37,.94) → rgba(12,22,40,.68)；模糊与压暗改由 `.dc-root::before` 承担（`blur(28px) saturate(.65) brightness(.56)`），面板本体仍不加 `backdrop-filter`，避免它成为 backdrop root 而改掉 `.dc-toast` 的 fixed 基准。
- 越往里越实：卡片 rgba(22,40,63,.86) → 内层 rgba(14,26,44,.90) → 输入框 `--dc-field` rgba(9,17,30,.92)，按钮单列 `--dc-ctl` 一档，降透明后不再陷进内层卡。
- 层次改靠光效：卡片 / hero / 悬浮条 / 弹层加 `inset 0 1px 0 rgba(255,255,255,.06~.07)` 顶光，阴影改为大模糊负 spread，深色下靠边缘而不是加黑分离。
- 提示文字：`--dc-faint` 深色提到 #8B9BB3，`.dc-section-title` 从极弱档改为 `--dc-muted`；极弱档只留在实底上。
- 解耦：新增 `--dc-ink-solid`，`.dc-toast` 的文字色不再引用面板色（否则面板一改 alpha，toast 对比度会静默变化）。
- 降级：`@supports not (backdrop-filter)`、`prefers-reduced-transparency` 回到 0.5.0 实底；`max-width: 760px` 面板提回 .84；`forced-colors: active` 走 Canvas / CanvasText。
- 界面外：下载接口、引擎探测、SSRF / 资源限制 / Shell 守卫、配置字段与标签一字未改（23 个字段标签集合与 0.5.0 一致）。

## 0.5.0 — 2026-11-17

UI v2：深海玻璃质感 + 专业控制台。只改视觉与交互反馈，不动下载工具参数、引擎行为、SSRF / 资源限制 / Shell 守卫，也不改配置 Schema 语义。

- 玻璃厚度：面板不再透成壁纸（`--dc-panel` 深色 rgba(11,20,37,.94) / 浅色 rgba(244,247,252,.96)），卡片再高一层实色；整页移除 `backdrop-filter`，模糊不再承担可读性。
- 设计令牌：品牌色改为参考色 #66B9F7（浅色 #1F6FB2），状态色统一绿 / 琥珀 / 红 / 灰 / 蓝五态；字号 20/15/13/12/11 五级，间距走 8 栅格，圆角统一 12 / 8。
- 标题去重：「下载控制中心」原来在宿主 header、插件控制条、总览 hero 各出现一次；现在页面内不再重复，控制条写「统一下载入口」，总览只留一行说明 + 三个指标块（已就绪 / 需处理 / 未检测，按状态着色）。
- 下载页：保存目录与允许目录集中在左卡，传输参数按功能留在右卡；`yt-dlp` 与 `hf` 执行路径移入引擎页「执行路径」卡（它们属于引擎能力，不是传输参数）。
- 引擎页：五态徽章带描边与文字，失败不再复用红色给「未安装」；新增执行路径卡，诊断卡保持只读。
- 表单反馈：新增 `validateDraft()`，数字范围（连接数 1–16、单文件 1 MiB–64 GiB、超时 1–600s、轮询 100–60000ms、最长等待 30–86400s）、镜像 URL 协议与查询串、默认目录非空都在字段下方就近报错，输入框描边转红；保存时若仍有错误，跳到出错页签并提示首条原因，不静默下发。
- 悬浮保存条：页面底部常驻一条与顶部保存按钮共用同一份草稿、同一对 save/discard 的保存条；有校验错误时条内直接写出首条原因。
- 窄屏：断点从窗口宽度改为容器查询（`@container dc`），会话区被侧栏挤压时按实际可用宽度降列；不支持容器查询时回落到等价媒体查询。
- 按钮与输入：主按钮品牌色 + 反色文字，禁用态改为低对比而不是半透明；输入框统一 36px 高、悬停描边、聚焦 3px 光晕。
- 测试：新增 `test/client-ui-v2.test.mjs`（校验器、版面去重、玻璃厚度 / 容器查询 / 五态、保存条绑定），全量 177 → 183 例，全绿。

## 0.4.1 — 2026-11-17

UI 地基修复（不含视觉改动；样式一行没动，留待 0.5.0 的 UI v2）：

- 主题：`readTheme()` 原先硬编码返回 `dark`，浅色主题是死代码；现从 `localStorage['dsh-download-nexus:theme']` 读取并持久化，非法值回落 `dark`。
- 主题令牌：`--dsw-alias-state-warning-primary` 改为宿主真名 `--dsw-alias-state-warn-primary`，`--ds-font-family-base` 改为 `--dsw-font-family`（原写法导致琥珀色与字体继承从未生效）。
- 单文件上限：输入框清空时不再把 `maxBytes` 写成 `0`（等于禁止一切下载）；空值/非法/≤0 一律保持原配置。数值输入统一走 `coerceField`。
- 代理候选端口：解析器支持 `,` `;` `，` `；` `、` 与空白，越界与非法段忽略并去重；输入框改为本地缓冲，粘「7890；31181」不再被清空，编辑到一半也不会被回写冲掉。
- 保存：`allowedRoots` / `defaultSaveDir` 原先会在 ops 里出现两次，现由 `collectOps` 去重，同一路径只下发一次；被 Host 规范化改过的目录字段仍会补发。
- 页签徽章：原先显示全站脏字段总数，现按 `TAB_FIELDS` 分组计数，安全页（无可编辑项）恒为 0。
- 引擎五态：`not-installed` 与 `failed` 原先同为红色，现未安装用灰（`dc-state-idle`）、失败保持红，五态各有独立文案。
- 根节点：主 return 缺 `ref` 导致 conversation surface 标记靠首次 loading 分支侥幸挂上；四个分支现统一走 `dcRoot(theme, ref, ...)`。
- 测试：新增 `test/client-loader.mjs`（Node 内用 vm + 假 React 加载 `lib/client.js`）与 `test/client-ui.test.mjs`；全量 162 → 177 例，全绿。

## 0.3.7 — 2026-11-17

- 修复插件列表图标/描述不显示的根因：`exports` 未导出 `./package.json`，DSH 的 `readPluginMeta` 读不到 manifest，导致 title/description/icon 全部回退默认。现补充 `"./package.json": "./package.json"`。
- 图标使用 `assets/icon/icon-128.png`（128×128 PNG）；配置页 header 保存按钮保持深色高对比配色。

## 0.3.6 — 2026-11-17

- 插件列表图标改为与 `dsh-boot-nexus` 相同的 `assets/icon/icon-128.png`（128×128 PNG），避开宿主对 SVG/ICO 图标管线的差异。
- 保留根目录 `icon.svg`/`icon.png`/ICO；配置页头部继续使用内嵌 PNG。

## 0.3.5 — 2026-11-17

- 插件列表图标改为纯矢量 `icon.svg`，不再依赖 SVG 内嵌 PNG，避免宿主图标管线解码失败。
- 深色模式 header 的“保存”按钮改为固定蓝色底 + 白字；禁用态改为深蓝灰底 + 浅灰字，不再用半透明白底白字。

## 0.3.3 — 2026-11-17

- 保存/放弃从底部固定条移到顶部 header，放在版本号与可用数旁边；移除底部保存条。
- 顶部「下载」tab 继续使用 DSH conversation surface，隐藏聊天输入区与宽度手柄。

## 0.3.2 — 2026-11-17

- 修复顶部「下载」tab 仍显示聊天输入框的问题：页面挂载时给 `[data-conversation-scroll]` 标记 `data-dc-surface`，按 DSH 对话 surface 约定隐藏 `[data-composer-seat]` 与宽度手柄。
- 保存条与确认弹窗提升层级，避免被聊天输入区遮住；配置页恢复为完整可滚动页面。


## 0.3.1 — 2026-11-17

- 插件列表图标改用 `icon.svg`（内嵌 PNG），修复 `.ico` 不被插件列表图片管线接受的问题；配置页顶部同步使用同一图标。
- 保留 `icon-128.ico` / `icon-256.ico` 给 Windows 安装器；`icon.png` 继续随包。


## 0.3.0 — 2026-11-17

Motrix Auto Provisioning（自动部署）：

- 新增 `motrix_provision` 工具：`status` 只读检测安装/进程/bridge/版本；`install` 必须 `confirm:true`，安装与检测分离。
- 固定 Motrix v2.4.3 的 Windows x64/arm64 安装包与便携 ZIP 的 URL、大小、SHA-256；不匹配删除缓存并失败。
- 状态机 idle → detecting → downloading → installing → starting → waiting-bridge → ready；支持取消、恢复、并发锁与原子状态文件。
- 已有安装/进程不覆盖、不终止、不启动第二实例；NSIS 失败不自动卸载；便携版只回滚本次目录。
- 不关闭 Defender、不绕过 SmartScreen/UAC、不自动提权；失败保持 direct/yt-dlp/HF 可用。
- 插件列表图标改为 `icon.png`；ICO 文件保留给 Windows 安装器。
- 测试：162 例通过，0 skip；覆盖 manifest/哈希、检测状态、下载缓存、哈希失败、安装/便携、锁与状态、授权与已有安装拒绝。


## 0.2.7 — 2026-11-17

RES-1 资源限制收口与改名：

- 新增 per-engine 并发闸：direct 4 / Motrix 3 / yt-dlp 2 / HF 2；每引擎等待队列 8，排队最长 60s；队列满 `E_ENGINE_BUSY`，取消/abort 会移除 waiter 并释放 lease。
- Motrix `wait_seconds:0` 增加后台看门狗：500ms 轮询 `bytesDone`，超限自动 purge；连续 5 次 RPC 失败停止并报 `E_ENGINE_UNAVAILABLE`；7 天未终态只尝试 pause；DSH 重启后不自动接管旧任务。
- HF 下载前用 tree API 做单文件/总量预检（分页、revision 编码、include glob）；API 不可用时继续，由运行时 staging budget 兜底。
- yt-dlp / HF 增加每秒 staging 总量预算，超限杀进程并清理 staging；Motrix 为软上限，direct 为硬上限。
- 内部 staging 改为 `.download-nexus/staging`；旧 `.conductor/staging` 只按 7 天 TTL 兼容清扫，避免误删运行中旧任务。
- 包名/插件名/loader/路由/顶部 tab 改为 `dsh-download-nexus`；新增 `icon-128.ico` / `icon-256.ico`。
- 测试：147 例通过，0 skip；覆盖队列、看门狗、staging budget、HF tree 分页/glob、waitForPaused、超限与释放。

## 0.2.6 — 2026-11-17

资源上限与出站加固（RES-1 / SSRF-3）：

- Motrix URL 提交前 HEAD / one-byte Range 预检，明确超 `maxBytes` 直接拒绝；预检失败 fail-open。
- Motrix wait 轮询 `bytesDone`，超限自动 purge 并报 `E_IO`；yt-dlp 加 `--max-filesize`，yt-dlp/HF 完成后测量 staging 树；direct 失败清理 `.part`。
- staging TTL 清扫；registry TTL/容量上限，只淘汰终态任务。
- direct 连接后复核 `socket.remoteAddress`；DNS 失败统一 `E_TARGET`；`ssrf.binding/verifiable` 如实标注代理路径的不可验证性。
- `stateOf` 使用 Host `state`/`reason`：只有连接拒绝/桥缺失归「未运行」，CLI 缺失归「未安装」，timeout/DNS/TLS/unknown 归「检测失败」。
- 路由 dispose 随插件生命周期；`killTree` 等待并走绝对 `taskkill.exe`。
- 测试：128 例通过，0 skip；真实 Windows junction 用例已覆盖，direct 中断清理已覆盖。代理分支实际目标仍不可核验；Motrix `wait_seconds:0` 无后台大小看门狗；预检在真实 CDN 上的行为未逐站覆盖。

## 0.2.5 — 2026-11-17

UI 入口与状态归类：

- 新增 `conversation.view` 顶部 tab「下载」（order 40），配置页可从对话顶部直接打开；与插件详情 README 下方的 `plugins.bundle.config` 共用同一页面。
- `dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-conversation`。
- Motrix `fetch failed` / `连不上 Motrix 桥` 归类为「未运行」（amber），不再误报「检测失败」（red）。
- 测试：106 例（105 pass / 1 skip）。

## 0.2.4 — 2026-11-17

稳定性与安全修复：

- 状态路由改为 DSH `connection.admit()` 会话鉴权，未授权请求 401；`sec-fetch-site` 仅次级检查。
- `proxyCandidates` 兼容旧字符串（`"7890;31181"`）并迁移为数组。
- 客户端移除硬编码个人目录，默认目录只来自 Host snapshot。
- 保存 409 冲突面板、路径规范化确认、删除允许目录二次确认。
- 诊断面板补 Motrix 状态；`doctor()` 版本从 `package.json` 读取。
- 测试：106 例通过。

## 0.2.3 — 2026-11-17

P0 配置页：

- 新增 `plugins.bundle.config` 原生配置页，五个分类：总览 / 下载 / 策略 / 引擎 / 安全。
- `static Config`（23 键，14 个 volatile 可编辑、9 个只读）+ `unwrapConfig`，避免 volatile `{get}` 引用把安全开关误判为 true。
- `lib/status.mjs` 只读 Host facade 与 `/api/dsh-download-nexus/status` 路由（snapshot / probe / diagnose / validateRoot / checkUrl）。
- 允许目录采用专用校验列表，`validateRoot()` 做 realpath、目录、权限、UNC/设备/ADS/系统目录检查；保存仍走 dsh-settings 的 revision。
- 保存后提示“重启 DSH 后生效”，P0 不做热更新；安全开关只读。
- 修复配置页主题污染（不再写 `document.documentElement.dataset.theme`），默认深色；yt-dlp/HF 探针超时从 2.5s 放宽到 6s。
- 测试：105 例通过。

## 0.2.2 — 2026-11-17

- 配置页默认深色、标题去掉“原型”；探针超时调整。
- 真实 DSH 页面验收。

## 0.2.1 — 2026-11-17

- 临时调试版：用于获取已认证 GUI URL 做真实页面截图；最终版已移除调试代码。

## 0.2.0 — 2026-11-17

- 配置页 Host/Client 首次落地：schema、status、status route、client entry、契约测试。

## 0.1.6 — 2026-11-16

安全修复（对应 `docs/SECURITY_AUDIT.md`）：

- **SSRF-1**：所有远程引擎在路由前校验 URL；禁止回环/私网/链路本地/元数据地址；字面 IP 永远逐地址检查；不提供内网逃生舱。代理 + fake-ip（198.18.0.0/15）仅在域名解析结果全部为 fake-ip 时放行。
- **SUPPLY-1**：开启 GitHub/HF 镜像时剥离 `Authorization` / `Cookie` / `Referer`；HF 镜像不继承 `HF_TOKEN`。
- **SECRET-3**：`cookies_from_browser` 默认关闭，仅允许视频站；`allowBrowserCookies` 配置或 `DSH_DOWNLOAD_ALLOW_BROWSER_COOKIES=1` 才打开。
- **PATH-1**：HF/yt-dlp 先写入 `.conductor/staging`；HF 扫描 Windows 双击执行类型；yt-dlp 校验报告路径在 staging 内并拒绝可执行文件；违规只清理 staging。
- **CMD-1**：guard 识别 `.exe/.com/.bat/.cmd`、`-o<path>`/`-so<path>`、PowerShell 引号体与 `-EncodedCommand`、`certutil`、`bitsadmin`、`mshta`、`--remote-name-all`；检查 `ops_bash` 的 `script_path`（realpath、边界、≤1 MiB、只读）。
- **AUTH-1**：任务 registry 按 session 归属；`status` 只列本会话；`control` 跨会话/旧 ref 返回 `E_NOT_FOUND`。

测试：97 例通过。

已知未关闭（下版）：**RES-1**（Motrix/yt-dlp/hf 无统一大小上限与 registry 容量上限）、**SSRF-3**（代理分支 DNS pinning / `remoteAddress` 复核）。

## 0.1.5 — 2026-11-16

- **A**：GitHub 镜像 `github_mirror:true`（默认关），只改写 github.com / raw / codeload 文件直链，保留 `mirror.original_url`。
- **B**：`download_doctor` 只读诊断 pip/npm/cargo registry，不写配置、不代拉包。

## 0.1.4 — 2026-11-16

- 接管无前缀 `download` / `download_status` / `download_control` / `download_doctor`；Siselea 旧插件移除。
- 引擎：Motrix（MDXP）、direct、yt-dlp、HF；pre-execute 严格 deny 写盘 shell。
