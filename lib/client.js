window.__ModuleLoader__.load({
  id: 'dsh-download-nexus',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React

    const NS = 'dsh-download-nexus'
    const PKG = 'dsh-download-nexus'
  const BRAND_ICON = 'data:image/png;base64,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'
    const SURFACE_COUNTS = new WeakMap()
    function useConversationSurface(ref) {
      useLayoutEffect(() => {
        const scroll = ref.current?.closest?.('[data-conversation-scroll]')
        if (!scroll) return undefined
        const count = SURFACE_COUNTS.get(scroll) || 0
        SURFACE_COUNTS.set(scroll, count + 1)
        scroll.setAttribute('data-dc-surface', '')
        return () => {
          const left = (SURFACE_COUNTS.get(scroll) || 1) - 1
          if (left > 0) SURFACE_COUNTS.set(scroll, left)
          else {
            SURFACE_COUNTS.delete(scroll)
            scroll.removeAttribute('data-dc-surface')
          }
        }
      }, [ref])
    }
    const API = '/api/dsh-download-nexus/status'

    const EDITABLE = [
      'defaultSaveDir',
      'allowedRoots',
      'connections',
      'maxBytes',
      'requestTimeoutMs',
      'pollMs',
      'maxWaitSeconds',
      'proxyCandidates',
      'ytdlpPath',
      'hfPath',
      'hfMirror',
      'useHfMirror',
      'githubMirrorBase',
      'githubMirrorDefault',
    ]

    const LABELS = {
      defaultSaveDir: '默认保存目录',
      allowedRoots: '允许目录',
      connections: '连接数',
      maxBytes: '单文件上限',
      requestTimeoutMs: '请求超时',
      pollMs: '轮询间隔',
      maxWaitSeconds: '最长等待',
      proxyCandidates: '代理候选端口',
      ytdlpPath: 'yt-dlp 路径',
      hfPath: 'hf 路径',
      hfMirror: 'HF 镜像地址',
      useHfMirror: '启用 HF 镜像',
      githubMirrorBase: 'GitHub 镜像 base URL',
      githubMirrorDefault: '默认启用 GitHub 镜像',
      toolPrefix: '工具名前缀',
      promptName: '提示词名称',
      promptOrder: '提示词顺序',
      allowShell: '允许 shell 下载',
      allowExecutable: '允许可执行文件',
      guardFailClosed: '守卫失败关闭',
      allowBrowserCookies: '浏览器 cookies',
      autoStartMotrix: '自动启动 Motrix',
      motrixStateDir: 'Motrix 状态目录',
    }

    const DEFAULTS = {
      // The Host snapshot is the only source of the default directory.
      defaultSaveDir: '',
      allowedRoots: [],
      connections: 16,
      maxBytes: 21474836480,
      requestTimeoutMs: 60000,
      pollMs: 500,
      maxWaitSeconds: 3600,
      proxyCandidates: [7890, 31181],
      ytdlpPath: 'yt-dlp',
      hfPath: 'hf',
      hfMirror: 'https://hf-mirror.com',
      useHfMirror: false,
      githubMirrorBase: 'https://ghfast.top/',
      githubMirrorDefault: false,
    }

    const ENGINE_META = {
      motrix: { name: 'Motrix', note: '通用 URL / magnet / torrent', icon: 'M' },
      direct: { name: 'Direct', note: '内置 HTTP / HTTPS', icon: 'D' },
      ytdlp: { name: 'yt-dlp', note: 'B 站 / YouTube / Vimeo', icon: 'Y' },
      hf: { name: 'Hugging Face', note: 'HF repo / include / revision', icon: 'H' },
    }

    const CSS = `
      /* ── 设计令牌：单层玻璃 + 专业控制台 ─────────────────────────────
         1. 透明感只花在「面板」这一层：.dc-root::before 负责模糊与压暗，面板底色只染色。
         2. 越往里越实：卡片 .86 → 内层 .90 → 输入框 .92，文字越密的地方越不透明。
         3. 面板本体既不挂 backdrop-filter 也不挂 container-type：两者都会让
            .dc-root 变成 fixed 后代的包含块，把 .dc-toast / .dc-modal-backdrop 的
            定位基准从视口改成面板盒。容器查询放在内层 .dc-shell 上，浮层留在 shell 外面。
         4. 颜色优先取 DSH 主题变量，取不到才用本插件的深海色板。 */
      .dc-root {
        --dc-bg: var(--dsw-alias-bg-base, #0b1425);
        --dc-panel: transparent;
        --dc-panel-light: #f4f7fc;
        --dc-card: rgba(9, 18, 33, .88);
        --dc-card-2: rgba(7, 14, 27, .90);
        --dc-field: #050b15;
        --dc-ctl: rgba(28, 52, 86, .86);
        --dc-float: rgba(13, 24, 42, .92);
        --dc-line: color-mix(in srgb, var(--dsw-alias-border-l2, #263b58) 58%, #5d81b4);
        --dc-line-soft: color-mix(in srgb, var(--dsw-alias-border-l1, #1d2f4a) 72%, #43628d);
        --dc-edge: inset 0 1px 0 rgba(255, 255, 255, .07);
        --dc-edge-card: inset 0 1px 0 rgba(255, 255, 255, .06);
        --dc-glow: radial-gradient(120% 62px at 50% 0, rgba(140, 180, 240, .10), transparent 72%);
        --dc-ink-solid: #0b1425;
        /* toast 是浮在所有层之上的一句话，底色与字色必须成对给，不能借别的令牌 */
        --dc-toast-bg: #e8eefb;
        --dc-toast-ink: #0b1425;
        --dc-toast-error-bg: #f26b6b;
        --dc-toast-error-ink: #0b1425;
        --dc-text: var(--dsw-alias-label-primary, #e8eefb);
        --dc-muted: color-mix(in srgb, var(--dsw-alias-label-secondary, #9aa8c0) 68%, #e8f0ff);
        --dc-faint: color-mix(in srgb, var(--dsw-alias-label-tertiary, #8b9bb3) 55%, #dbe6f7);
        --dc-brand: var(--dsw-alias-brand-primary, #66b9f7);
        --dc-brand-ink: #0b1425;
        --dc-brand-soft: rgba(102, 185, 247, .14);
        --dc-green: var(--dsw-alias-state-success-primary, #36c78e);
        --dc-amber: var(--dsw-alias-state-warn-primary, #f0b536);
        --dc-red: var(--dsw-alias-state-error-primary, #f26b6b);
        --dc-shadow-1: 0 1px 2px rgba(0, 0, 0, .22), 0 2px 6px rgba(2, 7, 16, .16);
        --dc-shadow-2: 0 18px 40px -12px rgba(2, 7, 16, .60), 0 2px 6px rgba(2, 7, 16, .30);
        --dc-radius-card: 14px;
        --dc-radius-sub: 10px;
        --dc-radius-ctl: 8px;
        --dc-pad-card: 20px;
        --dc-pad-sub: 16px;
        --dc-gap-page: 16px;
        --dc-gap-card: 12px;
        --dc-gap-field: 8px;
        --dc-h-input: 36px;
        --dc-h-btn: 36px;
        --dc-h-btn-sm: 32px;
        --dc-h-tab: 32px;
        --dc-fs-title: 20px;
        --dc-fs-head: 16px;
        --dc-fs-body: 14px;
        --dc-fs-muted: 12px;
        --dc-fs-chip: 11px;
        --dc-maxw: 1240px;
        --dc-mono: ui-monospace, SFMono-Regular, "Cascadia Mono", Consolas, monospace;
        background: var(--dc-panel);
        color: var(--dc-text);
        min-height: 100%;
        padding: 16px 20px 88px;
        font-family: var(--dsw-font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
        font-size: 13px;
        line-height: 1.55;
        color-scheme: dark;
        position: relative;
        isolation: isolate;
      }
      /* 容器查询的载体。必须是与浮层平级的内层盒子：
         container-type 会施加 layout containment，让这个盒子成为 fixed 后代的包含块。 */
      .dc-shell { container: dc / inline-size; }
      /* 层次：L1 壁纸就是页面底色 → L2 面板不再铺色（用户明确要求「背景去掉，卡片已经很清楚」），
         伪元素结构留着但停用，将来若要加回一层极淡玻璃，改 display 与 background 两行即可。
         → L3 卡片 / 内层 / 输入区（越里越深，靠细边框分层）。 */
      .dc-root::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        display: none;
        pointer-events: none;
        background: var(--dc-panel);
      }
      .dc-root[data-theme="light"] {
        --dc-panel: transparent;
        --dc-card: rgba(255, 255, 255, .97);
        --dc-card-2: #f5f8fd;
        --dc-field: #ffffff;
        --dc-ctl: #eef3fa;
        --dc-float: rgba(255, 255, 255, .98);
        --dc-line: #c2cee2;
        --dc-line-soft: #d8e0ee;
        --dc-edge: inset 0 1px 0 rgba(255, 255, 255, .9);
        --dc-edge-card: inset 0 1px 0 rgba(255, 255, 255, .9);
        --dc-glow: none;
        --dc-ink-solid: #0b1425;
        --dc-toast-bg: #162033;
        --dc-toast-ink: #f4f7fc;
        --dc-toast-error-bg: #b91c1c;
        --dc-toast-error-ink: #ffffff;
        --dc-text: #162033;
        --dc-muted: #55627a;
        --dc-faint: #5f6d84;
        --dc-brand: #1f6fb2;
        --dc-brand-ink: #ffffff;
        --dc-brand-soft: rgba(31, 111, 178, .1);
        --dc-green: #15803d;
        --dc-amber: #b45309;
        --dc-red: #b91c1c;
        --dc-shadow-1: 0 1px 2px rgba(22, 32, 51, .08), 0 2px 6px rgba(22, 32, 51, .06);
        --dc-shadow-2: 0 18px 36px -12px rgba(22, 32, 51, .18), 0 2px 6px rgba(22, 32, 51, .10);
        color-scheme: light;
      }
      .dc-root[data-theme="light"]::before { background: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
      [data-conversation-scroll][data-dc-surface] > [data-composer-seat]:not(:has([data-approval-key],[data-plan-review-key])),
      [data-conversation-scroll][data-dc-surface] ~ [data-width-handle] { display: none !important; }
      .dc-root * { box-sizing: border-box; }

      /* ── 控制条（宿主已显示插件名，这里不重复大标题） ── */
      .dc-header { display: flex; align-items: center; gap: 12px; max-width: var(--dc-maxw); margin: 0 auto 12px; min-height: 44px; text-shadow: 0 1px 2px rgba(3, 7, 14, .75), 0 0 12px rgba(3, 7, 14, .45); }
      /* 图标块：只当尺寸容器，不留底色也不留描边 —— 图本身就带紫色圆角底，
         再套一层卡片色会露出深色方框（圆角处尤其明显）。 */
      .dc-logo { box-sizing: border-box; width: 44px; height: 44px; padding: 0; display: grid; place-items: center; background: none; border: 0; box-shadow: none; }
      /* 双层轮廓阴影：第一层压暗边（在亮壁纸上把图从背景里托起来），第二层极细亮边
         （在暗壁纸上勾出轮廓）。都用 drop-shadow 走 alpha，不会出现矩形阴影边。 */
      .dc-logo img { width: 100%; height: 100%; display: block; object-fit: contain; border-radius: 12px; filter: drop-shadow(0 3px 9px rgba(2, 6, 12, .62)) drop-shadow(0 0 1px rgba(214, 230, 255, .30)); }
      .dc-title { font-size: 15px; font-weight: 650; letter-spacing: .1px; line-height: 20px; }
      .dc-sub { color: var(--dc-muted); font-size: 12px; margin-top: 2px; }
      .dc-header-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

      /* ── 状态胶囊：颜色只是辅助，永远带文字 ── */
      .dc-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--dc-line); border-radius: 999px; padding: 4px 9px; font-size: 11px; color: var(--dc-muted); background: var(--dc-card-2); white-space: nowrap; }
      .dc-chip strong { color: var(--dc-text); font-weight: 600; }
      .dc-chip.ok { color: var(--dc-green); border-color: color-mix(in srgb, var(--dc-green) 34%, var(--dc-line)); }
      .dc-chip.warn { color: var(--dc-amber); border-color: color-mix(in srgb, var(--dc-amber) 34%, var(--dc-line)); }
      .dc-chip.wait { color: var(--dc-brand); border-color: color-mix(in srgb, var(--dc-brand) 34%, var(--dc-line)); }
      .dc-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--dc-faint); flex: none; }

      /* ── 页签 ── */
      .dc-tabs { display: flex; gap: 2px; max-width: var(--dc-maxw); margin: 0 auto 12px; padding: 3px; border: 1px solid var(--dc-line); border-radius: 10px; background: var(--dc-card-2); overflow-x: auto; }
      .dc-tab { position: relative; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--dc-muted); padding: 6px 12px; border-radius: var(--dc-radius-ctl); cursor: pointer; font-size: var(--dc-fs-muted); white-space: nowrap; font-family: inherit; min-height: var(--dc-h-tab); }
      .dc-tab:hover { color: var(--dc-text); }
      .dc-tab[aria-selected="true"] { color: var(--dc-text); background: var(--dc-ctl); box-shadow: var(--dc-edge-card); font-weight: 600; }
      .dc-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: 2px; height: 2px; border-radius: 2px; background: var(--dc-brand); }
      .dc-tab-badge { min-width: 15px; height: 15px; padding: 0 4px; border-radius: 999px; background: var(--dc-brand); color: var(--dc-brand-ink); font-size: 10px; font-weight: 700; display: grid; place-items: center; }

      .dc-main { display: grid; gap: var(--dc-gap-page); max-width: var(--dc-maxw); margin: 0 auto; }
      .dc-banner { border: 1px solid color-mix(in srgb, var(--dc-amber) 38%, var(--dc-line)); background: color-mix(in srgb, var(--dc-amber) 10%, var(--dc-card)); color: var(--dc-text); border-radius: var(--dc-radius-ctl); padding: 9px 12px; font-size: 12px; }

      /* ── 总览摘要：一行副标题 + 三个指标，不再重复插件名 ── */
      .dc-hero { border: 1px solid var(--dc-line); border-radius: var(--dc-radius-card); padding: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--dc-brand) 10%, var(--dc-card)), var(--dc-card) 62%); box-shadow: var(--dc-edge-card), var(--dc-shadow-1); display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
      .dc-hero-body { min-width: 240px; flex: 1; }
      .dc-hero-sub { margin: 0; color: var(--dc-muted); font-size: 12px; max-width: 640px; }
      .dc-hero-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
      .dc-metrics { display: flex; gap: 8px; }
      .dc-metric { min-width: 78px; border: 1px solid var(--dc-line); border-radius: 10px; background: var(--dc-card-2); padding: 8px 10px; }
      .dc-metric b { display: block; font-size: 20px; line-height: 1.15; font-weight: 650; font-variant-numeric: tabular-nums; }
      .dc-metric span { color: var(--dc-muted); font-size: 11px; }
      .dc-metric.good b { color: var(--dc-green); }
      .dc-metric.warn b { color: var(--dc-amber); }
      .dc-metric.idle b { color: var(--dc-faint); }

      /* ── 卡片与栅格 ── */
      .dc-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; align-items: start; }
      .dc-card { border: 1px solid var(--dc-line); border-radius: var(--dc-radius-card); background: var(--dc-card); padding: var(--dc-pad-card); min-width: 0; box-shadow: var(--dc-edge-card), var(--dc-shadow-1); }
      .dc-card.span-4 { grid-column: span 4; } .dc-card.span-5 { grid-column: span 5; }
      .dc-card.span-6 { grid-column: span 6; } .dc-card.span-7 { grid-column: span 7; }
      .dc-card.span-8 { grid-column: span 8; } .dc-card.span-12 { grid-column: span 12; }
      .dc-card-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
      .dc-card-title { font-weight: 650; font-size: var(--dc-fs-head); line-height: 24px; letter-spacing: .1px; }
      .dc-card-note { color: var(--dc-muted); font-size: 11.5px; margin-top: 2px; }
      .dc-card-head .dc-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
      .dc-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--dc-muted); border: 1px solid var(--dc-line); border-radius: 6px; padding: 2px 6px; background: var(--dc-card-2); white-space: nowrap; }
      .dc-tag.readonly::before { content: "●"; color: var(--dc-brand); font-size: 7px; }

      /* ── 引擎卡：五态颜色 + 文字，颜色不单独承担语义 ── */
      .dc-engine-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .dc-engine { border: 1px solid var(--dc-line); border-radius: 10px; background: var(--dc-card-2); padding: 12px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .dc-engine-top { display: flex; align-items: center; gap: 8px; }
      .dc-engine-icon { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; background: var(--dc-brand-soft); color: var(--dc-brand); font-weight: 700; font-size: 11px; flex: none; }

      /* 行首图标 / 对勾贴标题行：.dc-row 默认 align-items: center，图标会被两行文字的中线拉走。 */
      .dc-row { position: relative; }
      @supports selector(:has(> *)) {
        /* 图标行改成顶端对齐：图标框与标题行从同一条基线开始，再按框高补一点负边距，
           让 22px 框的中线落在 18px 标题行的中线上——与字形高度、说明文字行数都无关。 */
        .dc-row:has(> .dc-engine-icon), .dc-row:has(> .dc-check) { align-items: flex-start; }
        .dc-row > .dc-engine-icon { width: 22px; height: 22px; margin-top: -2px; }
        .dc-row > .dc-check { margin-top: 1px; font-size: 12px; line-height: 18px; }
      }
      .dc-engine-name { font-weight: 650; font-size: 12px; }
      .dc-engine-note { color: var(--dc-muted); font-size: 10.5px; margin-top: 1px; overflow-wrap: anywhere; }
      .dc-engine-state { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; white-space: nowrap; border: 1px solid currentColor; border-radius: 999px; padding: 2px 7px; background: color-mix(in srgb, currentColor 10%, transparent); }
      .dc-state-ready { color: var(--dc-green); } .dc-state-ready .dc-dot { background: var(--dc-green); }
      .dc-state-warn { color: var(--dc-amber); } .dc-state-warn .dc-dot { background: var(--dc-amber); }
      .dc-state-bad { color: var(--dc-red); } .dc-state-bad .dc-dot { background: var(--dc-red); }
      .dc-state-idle { color: var(--dc-faint); } .dc-state-idle .dc-dot { background: var(--dc-faint); }
      .dc-engine-detail { color: var(--dc-muted); font-family: var(--dc-mono); font-size: 10.5px; min-height: 30px; overflow-wrap: anywhere; }
      .dc-engine-foot { display: flex; align-items: center; gap: 8px; margin-top: auto; color: var(--dc-faint); font-size: 10.5px; }
      .dc-engine-foot button { margin-left: auto; }

      /* ── 只读行 / 输入行 ── */
      .dc-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--dc-line-soft); min-height: 36px; }
      .dc-row:first-of-type { border-top: 0; }
      /* 两列栅格（安全边界 / 策略摘要）里，第二列首行在 DOM 里是第 2 个子元素，
         :first-of-type 管不到它，于是右上角会多出一条横线。只在这里补一条清除规则，
         单列（≤640px）时再把线放回来。 */
      .dc-grid-2 > .dc-row:nth-child(2) { border-top: 0; }
      .dc-row-main { min-width: 0; flex: 1; }
      .dc-row-title { font-size: 12px; line-height: 18px; }
      .dc-row-desc { color: var(--dc-muted); font-size: 11px; margin-top: 1px; overflow-wrap: anywhere; }
      .dc-row-value { color: var(--dc-muted); font-family: var(--dc-mono); font-size: 10.5px; }
      .dc-field { display: grid; gap: 6px; margin-bottom: 12px; }
      .dc-field:last-child { margin-bottom: 0; }
      .dc-field label { font-size: var(--dc-fs-muted); color: var(--dc-text); font-weight: 600; }
      .dc-field .dc-hint { color: var(--dc-muted); font-size: var(--dc-fs-chip); }
      .dc-field:has(.dc-field-error) .dc-input { border-color: var(--dc-red); }
      .dc-field-error { color: var(--dc-red); font-size: 11px; display: flex; gap: 5px; align-items: flex-start; }
      .dc-field-error::before { content: "!"; display: inline-grid; place-items: center; width: 13px; height: 13px; border-radius: 999px; border: 1px solid currentColor; font-size: 9px; font-weight: 700; flex: none; margin-top: 2px; }
      .dc-input-unit { display: flex; align-items: center; gap: 0; }
      .dc-input-unit .dc-input { border-top-right-radius: 0; border-bottom-right-radius: 0; }
      .dc-unit { display: inline-flex; align-items: center; height: var(--dc-h-input); padding: 0 10px; border: 1px solid var(--dc-line-soft); border-left: 0; border-radius: 0 var(--dc-radius-ctl) var(--dc-radius-ctl) 0; background: var(--dc-card-2); color: var(--dc-muted); font-size: var(--dc-fs-chip); white-space: nowrap; }
      .dc-group-label { margin: 4px 0 -2px; color: var(--dc-faint); font-size: var(--dc-fs-chip); letter-spacing: .04em; }
      .dc-adv { margin-top: 10px; border-top: 1px solid var(--dc-line-soft); padding-top: 8px; }
      .dc-adv > summary { cursor: pointer; color: var(--dc-muted); font-size: var(--dc-fs-muted); list-style: none; display: flex; align-items: center; gap: 6px; min-height: 26px; }
      .dc-adv > summary::-webkit-details-marker { display: none; }
      .dc-adv > summary::before { content: "▸"; color: var(--dc-faint); font-size: 10px; transition: transform .12s ease; }
      .dc-adv[open] > summary::before { transform: rotate(90deg); }
      .dc-adv > summary:hover { color: var(--dc-text); }
      .dc-adv > summary:focus-visible { outline: 2px solid var(--dc-brand); outline-offset: 2px; border-radius: var(--dc-radius-ctl); }
      .dc-engine-detail.adv > summary { font-size: var(--dc-fs-muted); }
      .dc-lock { flex: none; width: 18px; text-align: center; font-size: 12px; opacity: .75; align-self: flex-start; margin-top: 1px; }
      .dc-root-chip code { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dc-input, .dc-select { width: 100%; min-height: 36px; border: 1px solid var(--dc-line); border-radius: var(--dc-radius-ctl); background: var(--dc-field); color: var(--dc-text); padding: 7px 10px; font-size: 12px; font-family: inherit; outline: none; }
      .dc-input:hover, .dc-select:hover { border-color: color-mix(in srgb, var(--dc-brand) 40%, var(--dc-line)); }
      .dc-input:focus, .dc-select:focus { border-color: var(--dc-brand); box-shadow: 0 0 0 3px var(--dc-brand-soft); }
      .dc-input.invalid { border-color: var(--dc-red); }
      .dc-input:disabled, .dc-select:disabled { opacity: .6; cursor: not-allowed; }
      .dc-input.mono { font-family: var(--dc-mono); font-size: 11px; }
      .dc-input-row { display: flex; gap: 8px; }
      .dc-input-row .dc-input { flex: 1; min-width: 0; }
      .dc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }

      /* ── 按钮：主按钮用品牌色 + 反色文字，深浅色都由令牌保证对比度 ── */
      .dc-btn { min-height: 32px; border: 1px solid var(--dc-line); border-radius: var(--dc-radius-ctl); background: var(--dc-ctl); color: var(--dc-text); padding: 5px 11px; font-size: 11.5px; font-family: inherit; cursor: pointer; white-space: nowrap; }
      .dc-btn:hover:not(:disabled) { border-color: var(--dc-brand); }
      .dc-btn.primary { background: var(--dc-brand); border-color: var(--dc-brand); color: var(--dc-brand-ink); font-weight: 650; }
      .dc-btn.primary:hover:not(:disabled) { filter: brightness(1.06); }
      .dc-btn.primary:disabled { background: var(--dc-ctl); border-color: var(--dc-line); color: var(--dc-faint); opacity: 1; cursor: not-allowed; }
      .dc-btn.danger { color: var(--dc-red); border-color: color-mix(in srgb, var(--dc-red) 32%, var(--dc-line)); }
      .dc-btn.danger:hover:not(:disabled) { border-color: var(--dc-red); }
      .dc-btn:disabled { opacity: .55; cursor: not-allowed; }
      .dc-btn.primary:disabled { opacity: 1; }
      .dc-btn.sm { min-height: 26px; padding: 3px 8px; font-size: 10.5px; }
      .dc-icon-btn { width: 32px; height: 32px; border-radius: var(--dc-radius-ctl); border: 1px solid var(--dc-line); background: var(--dc-ctl); color: var(--dc-muted); display: grid; place-items: center; cursor: pointer; font-size: 13px; }
      .dc-icon-btn:hover { color: var(--dc-text); border-color: var(--dc-brand); }
      .dc-head-save, .dc-head-discard { min-height: 32px; font-size: 12px; }
      .dc-head-save { min-width: 56px; }

      /* ── 目录 chips ── */
      .dc-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .dc-root-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--dc-line); border-radius: var(--dc-radius-ctl); background: var(--dc-card-2); padding: 6px 8px; font-size: 11px; max-width: 100%; }
      .dc-root-chip code { font-family: var(--dc-mono); font-size: 10.5px; overflow-wrap: anywhere; }
      .dc-root-chip button { border: 0; background: transparent; color: var(--dc-faint); cursor: pointer; font-size: 13px; line-height: 1; padding: 0 1px; }
      .dc-root-chip button:hover { color: var(--dc-red); }
      .dc-root-chip.default { border-color: color-mix(in srgb, var(--dc-brand) 30%, var(--dc-line)); }
      .dc-empty { color: var(--dc-muted); font-size: 11.5px; padding: 10px 0; }

      /* ── 说明条 ── */
      .dc-note { border-radius: var(--dc-radius-ctl); padding: 8px 11px; font-size: 11px; line-height: 1.55; border: 1px solid var(--dc-line); background: var(--dc-card-2); color: var(--dc-muted); }
      .dc-note.info { border-color: color-mix(in srgb, var(--dc-brand) 26%, var(--dc-line)); background: color-mix(in srgb, var(--dc-brand) 8%, var(--dc-card)); color: var(--dc-text); }
      .dc-note.warn { border-color: color-mix(in srgb, var(--dc-amber) 30%, var(--dc-line)); background: color-mix(in srgb, var(--dc-amber) 8%, var(--dc-card)); color: var(--dc-text); }
      .dc-note.good { border-color: color-mix(in srgb, var(--dc-green) 30%, var(--dc-line)); background: color-mix(in srgb, var(--dc-green) 8%, var(--dc-card)); color: var(--dc-text); }
      .dc-kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 10px; font-size: 11.5px; }
      .dc-kv dt { color: var(--dc-muted); }
      .dc-kv dd { margin: 0; overflow-wrap: anywhere; }
      .dc-mono { font-family: var(--dc-mono); font-size: 10.5px; color: var(--dc-muted); }
      .dc-section-title { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--dc-muted); margin: 2px 0 8px; }

      /* ── 开关 ── */
      .dc-toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 11.5px; user-select: none; }
      .dc-toggle input { position: absolute; opacity: 0; pointer-events: none; }
      .dc-switch { width: 32px; height: 18px; border-radius: 999px; background: var(--dc-line); position: relative; transition: background .15s ease; flex: none; }
      .dc-switch::after { content: ""; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 2px; left: 2px; transition: transform .15s ease; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
      .dc-toggle input:checked + .dc-switch { background: var(--dc-brand); }
      .dc-toggle input:checked + .dc-switch::after { transform: translateX(14px); }
      .dc-toggle input:focus-visible + .dc-switch { outline: 2px solid var(--dc-brand); outline-offset: 2px; }
      .dc-toggle input:disabled + .dc-switch { opacity: .55; }

      /* ── 底部悬浮保存条：与顶部按钮绑定同一份草稿状态 ── */
      .dc-savebar { position: sticky; z-index: 30; bottom: 12px; max-width: var(--dc-maxw); margin: 12px auto 0; display: flex; align-items: center; gap: 10px; border: 1px solid var(--dc-line); border-radius: 12px; background: var(--dc-float); box-shadow: var(--dc-edge), var(--dc-shadow-2); padding: 8px 10px 8px 14px; backdrop-filter: blur(14px) saturate(.6) brightness(.78); -webkit-backdrop-filter: blur(14px) saturate(.6) brightness(.78); }
      .dc-savebar-text { font-size: 12px; }
      .dc-savebar-text b { color: var(--dc-brand); font-weight: 650; }
      .dc-savebar-note { color: var(--dc-muted); font-size: 11px; }
      .dc-savebar-actions { margin-left: auto; display: flex; gap: 8px; }

      /* ── 浮层 / toast ── */
      .dc-toast { position: fixed; z-index: 40; left: 50%; bottom: 24px; transform: translateX(-50%); border-radius: var(--dc-radius-ctl); padding: 9px 14px; background: var(--dc-toast-bg); color: var(--dc-toast-ink); font-size: 12px; box-shadow: var(--dc-shadow-2); max-width: min(560px, 92vw); }
      .dc-toast.error { background: var(--dc-toast-error-bg); color: var(--dc-toast-error-ink); }
      .dc-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, .58); display: grid; place-items: center; padding: 18px; }
      .dc-modal { width: min(520px, 100%); max-height: 86vh; overflow: auto; border: 1px solid var(--dc-line); border-radius: var(--dc-radius-card); background: var(--dc-float); box-shadow: var(--dc-edge), var(--dc-shadow-2); padding: 18px; }
      .dc-modal h3 { margin: 0 0 4px; font-size: 15px; font-weight: 650; }
      .dc-modal p { margin: 0 0 14px; color: var(--dc-muted); font-size: 11.5px; line-height: 1.55; }
      .dc-checks { display: grid; gap: 5px; margin: 10px 0 14px; }
      .dc-check { display: flex; align-items: flex-start; gap: 7px; font-size: 11.5px; }
      .dc-check .ok, .dc-check.ok { color: var(--dc-green); } .dc-check .bad, .dc-check.bad { color: var(--dc-red); } .dc-check .warn, .dc-check.warn { color: var(--dc-amber); }
      .dc-check small { display: block; color: var(--dc-muted); font-size: 10.5px; overflow-wrap: anywhere; }
      .dc-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .dc-loading { display: grid; place-items: center; min-height: 240px; color: var(--dc-muted); font-size: 12px; }

      /* ── 窄屏：按容器宽度收，不按窗口宽度（会话区可被侧栏挤压） ── */
      @container dc (max-width: 1080px) {
        .dc-engine-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @container dc (max-width: 880px) {
        .dc-card.span-4, .dc-card.span-5, .dc-card.span-6, .dc-card.span-7, .dc-card.span-8 { grid-column: span 12; }
        .dc-hero { flex-direction: column; align-items: stretch; }
        .dc-metrics { justify-content: flex-start; }
      }
      @container dc (max-width: 640px) {
        /* 单列时每行都自成一行，第二行起要有分隔线 */
        .dc-grid-2 > .dc-row:nth-child(2) { border-top: 1px solid var(--dc-line-soft); }
        .dc-engine-grid { grid-template-columns: 1fr; }
        .dc-grid-2 { grid-template-columns: 1fr; }
        .dc-kv { grid-template-columns: 96px 1fr; }
        .dc-metrics { flex-wrap: wrap; }
        .dc-savebar { flex-wrap: wrap; }
        .dc-savebar-actions { margin-left: 0; width: 100%; }
      }
      /* ── 透明度降级：模糊不可用或用户要求减少透明时回到实底 ── */
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .dc-root:not([data-theme="light"]) { --dc-panel: rgba(11, 20, 37, .94); --dc-card: rgba(20, 37, 61, .96); --dc-card-2: rgba(15, 28, 47, .94); }
        .dc-root::before { background: none; }
      }
      @media (prefers-reduced-transparency: reduce) {
        .dc-root:not([data-theme="light"]) { --dc-panel: rgba(11, 20, 37, .94); --dc-card: rgba(20, 37, 61, .96); --dc-card-2: rgba(15, 28, 47, .94); }
        .dc-root::before { background: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
        .dc-savebar { background: var(--dc-card); backdrop-filter: none; -webkit-backdrop-filter: none; }
      }
      @media (max-width: 760px) {
        .dc-root:not([data-theme="light"]) { --dc-panel: rgba(11, 20, 37, .84); }
      }
      @media (forced-colors: active) {
        .dc-root { --dc-panel: Canvas; --dc-card: Canvas; --dc-card-2: Canvas; --dc-field: Canvas; --dc-ctl: Canvas; --dc-float: Canvas; --dc-line: CanvasText; --dc-line-soft: CanvasText; --dc-text: CanvasText; --dc-muted: CanvasText; --dc-faint: CanvasText; }
        .dc-root::before { display: none; }
      }
      @supports not (container-type: inline-size) {
        @media (max-width: 880px) {
          .dc-engine-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dc-card.span-4, .dc-card.span-5, .dc-card.span-6, .dc-card.span-7, .dc-card.span-8 { grid-column: span 12; }
        }
        @media (max-width: 640px) {
          .dc-engine-grid { grid-template-columns: 1fr; }
          .dc-grid-2 { grid-template-columns: 1fr; }
        }
      }
    `

    function ensureStyle() {
      // 重装 bundle 后旧的 <style> 会留在 head 里，导致「改了 CSS 页面没变」；先清再插。
      const stale = document.querySelectorAll('style[data-plugin-css="dsh-download-nexus"]')
      if (stale.length === 1 && stale[0].textContent === CSS) return
      stale.forEach((node) => node.remove())
      const style = document.createElement('style')
      style.dataset.pluginCss = 'dsh-download-nexus'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    const THEME_KEY = 'dsh-download-nexus:theme'
    function themeStorage() {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage
      } catch (error) {
        return null
      }
    }
    function readTheme(storage) {
      const store = storage === undefined ? themeStorage() : storage
      try {
        const saved = store?.getItem?.(THEME_KEY)
        return saved === 'light' || saved === 'dark' ? saved : 'dark'
      } catch (error) {
        return 'dark'
      }
    }
    function persistTheme(theme, storage) {
      const store = storage === undefined ? themeStorage() : storage
      try {
        store?.setItem?.(THEME_KEY, theme)
      } catch (error) {
        /* 隐私模式或配额已满：主题退回会话内，不阻塞界面 */
      }
    }

    const BYTES_PER_GB = 1024 * 1024 * 1024

    // 输入框 -> 配置值的唯一换算口。
    // 返回 undefined 的语义是「这一格没给出有效值，保持原配置」：
    // 空串/非法/<=0 都不能落成 0，否则 maxBytes=0 等于禁止一切下载。
    function coerceNumber(raw) {
      const text = String(raw == null ? '' : raw).trim()
      if (text === '') return undefined
      const value = Number(text)
      if (!Number.isFinite(value) || value <= 0) return undefined
      return value
    }

    const FIELD_COERCERS = {
      maxBytes: (raw) => {
        const gb = coerceNumber(raw)
        return gb === undefined ? undefined : Math.round(gb * BYTES_PER_GB)
      },
      requestTimeoutMs: (raw) => {
        const seconds = coerceNumber(raw)
        return seconds === undefined ? undefined : Math.round(seconds * 1000)
      },
      connections: coerceNumber,
      pollMs: coerceNumber,
      maxWaitSeconds: coerceNumber,
    }

    function coerceField(key, raw) {
      const fn = FIELD_COERCERS[key]
      if (!fn) return undefined
      return fn(raw)
    }

    // 代理端口：用户会从文档里粘「7890；31181」「7890 31181」，只认逗号会把整串丢掉。
    // 这里按任意分隔符切，非法段与越界端口直接忽略，保持输入顺序、去重。
    function parseProxyList(raw) {
      const text = Array.isArray(raw) ? raw.join(',') : String(raw == null ? '' : raw)
      const seen = new Set()
      const ports = []
      for (const piece of text.split(/[,;，；、\s]+/)) {
        if (!piece) continue
        const port = Number(piece)
        if (!Number.isInteger(port) || port <= 0 || port > 65535) continue
        if (seen.has(port)) continue
        seen.add(port)
        ports.push(port)
      }
      return ports
    }

    function formatProxyList(list) {
      return (Array.isArray(list) ? list : []).join(', ')
    }

    function formatBytes(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) return '—'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let i = 0
      let v = n
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1 }
      return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
    }

    function formatTime(iso) {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }

    function cloneValue(v) {
      if (Array.isArray(v)) return v.map(cloneValue)
      if (v && typeof v === 'object') {
        const out = {}
        for (const [k, val] of Object.entries(v)) out[k] = cloneValue(val)
        return out
      }
      return v
    }

    // 根容器只有这一个构造函数：四个 return 分支都必须带上 surface ref，
    // useConversationSurface 靠它给 [data-conversation-scroll] 打标记并隐藏 composer。
    // 浮层（toast / modal / 冲突条）必须留在 .dc-shell 外面：shell 上有 container-type，
    // 会成为 fixed 后代的包含块，浮层就会跟着面板盒定位而不是视口。
    function dcRoot(theme, ref, ...children) {
      const shell = []
      const overlays = []
      for (const child of children) {
        if (child && child.props && child.props['data-dc-overlay']) overlays.push(child)
        else shell.push(child)
      }
      return h('div', { className: 'dc-root', 'data-theme': theme, ref },
        h('div', { className: 'dc-shell' }, ...shell),
        ...overlays,
      )
    }

    function sameValue(a, b) {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    // 哪个页签负责哪些可编辑字段。安全页没有可编辑项（全是只读边界），
    // 所以它的徽章恒为 0 —— 旧实现把全站脏字段数挂在每个页签上。
    const TAB_FIELDS = {
      download: ['defaultSaveDir', 'allowedRoots', 'connections', 'maxBytes', 'requestTimeoutMs', 'pollMs', 'maxWaitSeconds'],
      policy: ['proxyCandidates', 'hfMirror', 'useHfMirror', 'githubMirrorBase', 'githubMirrorDefault'],
      engines: ['ytdlpPath', 'hfPath'],
      security: [],
    }

    function badgeCount(dirtyKeys, tab) {
      const fields = TAB_FIELDS[tab]
      if (!fields || !fields.length) return 0
      const dirty = new Set(Array.isArray(dirtyKeys) ? dirtyKeys : [])
      return fields.filter((field) => dirty.has(field)).length
    }

    // 保存的 op 列表只在这里生成：先按 dirtyKeys 走，再把被 Host 规范化改过的
    // 目录字段补进去；同一路径只出现一次，Host 侧不做重复 set 的幂等兜底。
    function collectOps(dirtyKeys, baseline, draft) {
      const seen = new Set()
      const ops = []
      const push = (key) => {
        if (seen.has(key)) return
        seen.add(key)
        ops.push({ op: 'set', path: [key], value: cloneValue(draft[key]) })
      }
      for (const key of Array.isArray(dirtyKeys) ? dirtyKeys : []) push(key)
      if (!sameValue(draft.allowedRoots, baseline.allowedRoots)) push('allowedRoots')
      if (!sameValue(draft.defaultSaveDir, baseline.defaultSaveDir)) push('defaultSaveDir')
      return ops
    }

    // 取值校验：只覆盖「输错了会静默变坏」的字段。首条错误决定跳哪个页签，
    // 所以键序与 FIELD_RULES 声明顺序一致（对象字面量插入序）。
    const MIRROR_RE = /^https:\/\/[^\s/?#@]+(\/[^\s?#]*)?$/i
    const URL_RE = /^https?:\/\/[^\s]+$/i
    const FIELD_RULES = {
      connections: [1, 16, '连接数需在 1–16 之间'],
      maxBytes: [1024 * 1024, 64 * BYTES_PER_GB, '单文件上限需在 1 MiB–64 GiB 之间'],
      requestTimeoutMs: [1000, 600000, '请求超时需在 1–600 秒之间'],
      pollMs: [100, 60000, '轮询间隔需在 100–60000 ms 之间'],
      maxWaitSeconds: [30, 86400, '最长等待需在 30–86400 秒之间'],
    }

    function validateDraft(draft) {
      const errors = {}
      for (const key of Object.keys(FIELD_RULES)) {
        const [min, max, message] = FIELD_RULES[key]
        const value = Number(draft?.[key])
        if (!Number.isFinite(value)) {
          errors[key] = '需要一个数字'
          continue
        }
        if (value < min || value > max) errors[key] = message
      }
      const mirrorBase = String(draft?.githubMirrorBase || '').trim()
      if (mirrorBase && !MIRROR_RE.test(mirrorBase)) {
        errors.githubMirrorBase = '需要 https:// 开头，且不含凭据、查询串或片段'
      }
      const hfMirror = String(draft?.hfMirror || '').trim()
      if (hfMirror && !URL_RE.test(hfMirror)) errors.hfMirror = '需要 http(s):// 开头的地址'
      if (!String(draft?.defaultSaveDir || '').trim()) errors.defaultSaveDir = '默认保存目录不能为空'
      return errors
    }

    const STATE_META = {
      ready: { key: 'ready', label: '已就绪', cls: 'dc-state-ready' },
      'not-running': { key: 'not-running', label: '未运行', cls: 'dc-state-warn' },
      'not-installed': { key: 'not-installed', label: '未安装', cls: 'dc-state-idle' },
      failed: { key: 'failed', label: '检测失败', cls: 'dc-state-bad' },
      unchecked: { key: 'unchecked', label: '未检测', cls: 'dc-state-idle' },
    }

    function stateOf(row) {
      if (!row) return STATE_META.unchecked
      if (row.state && STATE_META[row.state]) return STATE_META[row.state]
      if (row.available) return STATE_META.ready
      // Do not re-derive a state from detail strings. The Host is the only
      // source of the reason mapping; a row without `state` is unknown.
      return STATE_META.failed
    }

    function api(op, params = {}) {
      const q = new URLSearchParams({ op, ...params })
      return fetch(`${API}?${q.toString()}`, { credentials: 'same-origin' }).then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok || !body || body.ok !== true) {
          throw new Error(body?.error?.message || `HTTP ${res.status}`)
        }
        return body.data
      })
    }

    function Field(props) {
      return h('div', { className: 'dc-field' },
        h('label', { htmlFor: props.id }, props.label),
        props.unit ? h('div', { className: 'dc-input-unit' }, props.children, h('span', { className: 'dc-unit' }, props.unit)) : props.children,
        props.error ? h('div', { className: 'dc-field-error', role: 'alert' }, props.error) : null,
        props.hint && !props.error ? h('div', { className: 'dc-hint' }, props.hint) : null,
      )
    }

    // 代理端口输入框的缓冲判定：缓冲解析后与外部值等价时不要回写，
    // 否则用户正打到一半的「7890,」「7890 」会被格式化冲掉。
    function proxyResyncNeeded(text, value) {
      const buffered = parseProxyList(text)
      const external = Array.isArray(value) ? value : []
      if (buffered.length !== external.length) return true
      return buffered.some((port, index) => port !== Number(external[index]))
    }

    function TextInput(props) {
      return h('input', {
        id: props.id,
        className: `dc-input${props.mono ? ' mono' : ''}`,
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder,
        onChange: (e) => props.onChange(e.target.value),
        disabled: props.disabled,
        spellCheck: false,
      })
    }

    function NumberInput(props) {
      const display = (next) => (next == null ? '' : String(next))
      const [text, setText] = useState(() => display(props.value))
      // 外部值变了（放弃修改、Host 规范化回写）才覆盖缓冲；
      // 用户正在输入的值与外部值等价时保持原样。
      useEffect(() => {
        setText((prev) => (Number(prev) === Number(props.value) ? prev : display(props.value)))
      }, [props.value])
      return h('input', {
        id: props.id,
        className: 'dc-input',
        type: 'number',
        min: props.min,
        max: props.max,
        value: text,
        onChange: (e) => {
          const next = e.target.value
          setText(next)
          // 空串/非法值只留在缓冲里，不回写草稿
          if (String(next).trim() !== '' && Number(next) > 0) props.onChange(next)
        },
        disabled: props.disabled,
      })
    }

    // 代理端口输入框：编辑期用本地文本，失焦时按统一解析器回写。
    function ProxyListInput(props) {
      const [text, setText] = useState(() => formatProxyList(props.value))
      useEffect(() => {
        setText((prev) => (proxyResyncNeeded(prev, props.value) ? formatProxyList(props.value) : prev))
      }, [props.value])
      return h('input', {
        id: props.id,
        className: 'dc-input mono',
        value: text,
        placeholder: props.placeholder,
        spellCheck: false,
        disabled: props.disabled,
        onChange: (e) => {
          const next = e.target.value
          setText(next)
          props.onChange(parseProxyList(next))
        },
      })
    }

    function Toggle(props) {
      return h('label', { className: 'dc-toggle' },
        h('input', {
          type: 'checkbox',
          checked: Boolean(props.checked),
          onChange: (e) => props.onChange(e.target.checked),
          disabled: props.disabled,
        }),
        h('span', { className: 'dc-switch', 'aria-hidden': 'true' }),
        h('span', null, props.label || (props.checked ? '已开启' : '已关闭')),
      )
    }

    // 长 detail 折成可展开的一行：不美化原文，只负责不把卡片撑爆。
    function renderDetail(row) {
      if (!row) return h('div', { className: 'dc-engine-detail' }, '尚未检测')
      const text = row.detail || (row.available ? '可用' : '不可用')
      if (String(text).length <= 44) return h('div', { className: 'dc-engine-detail', title: String(text) }, text)
      return h('details', { className: 'dc-engine-detail adv' },
        h('summary', null, String(text).slice(0, 44) + '…'),
        h('div', { className: 'dc-mono' }, String(text)),
      )
    }

    function EngineCard(props) {
      const meta = ENGINE_META[props.id] || { name: props.id, note: '', icon: '?' }
      const row = props.row
      const state = stateOf(row)
      return h('div', { className: 'dc-engine' },
        h('div', { className: 'dc-engine-top' },
          h('span', { className: 'dc-engine-icon' }, meta.icon),
          h('div', null,
            h('div', { className: 'dc-engine-name' }, meta.name),
            h('div', { className: 'dc-engine-note' }, meta.note),
          ),
          h('span', { className: `dc-engine-state ${state.cls}` },
            h('span', { className: 'dc-dot' }), state.label),
        ),
        renderDetail(row),
        h('div', { className: 'dc-engine-foot' },
          h('span', null, row?.at ? `检测于 ${formatTime(row.at)}` : '—'),
          h('button', {
            type: 'button',
            className: 'dc-btn sm',
            onClick: () => props.onProbe(props.id),
            disabled: props.busy,
          }, props.busy ? '检测中…' : '重新检测'),
        ),
      )
    }

    function TabButton(props) {
      return h('button', {
        type: 'button',
        className: 'dc-tab',
        role: 'tab',
        'aria-selected': props.active ? 'true' : 'false',
        onClick: props.onClick,
      },
        h('span', { 'aria-hidden': 'true' }, props.icon),
        h('span', null, props.label),
        props.badge ? h('span', { className: 'dc-tab-badge' }, String(props.badge)) : null,
      )
    }

    function Page(props) {
      const [theme, setTheme] = useState(readTheme)
      const rootRef = useRef(null)
      useConversationSurface(rootRef)
      const [tab, setTab] = useState('overview')
      const [status, setStatus] = useState(null)
      const [statusError, setStatusError] = useState('')
      const [snap, setSnap] = useState(null)
      const [draft, setDraft] = useState({})
      const [baseline, setBaseline] = useState({})
      const [engines, setEngines] = useState({})
      const [engineBusy, setEngineBusy] = useState(false)
      const [busy, setBusy] = useState(false)
      const [toast, setToast] = useState(null)
      const [modal, setModal] = useState(null)
      const [conflict, setConflict] = useState(null)
      const [normalizePrompt, setNormalizePrompt] = useState(null)
      const [confirmRemove, setConfirmRemove] = useState(null)
      const initialized = useRef(false)
      const controllerRef = useRef(null)
      const toastTimer = useRef(null)

      const controller = props.configForms && typeof props.configForms.get === 'function'
        ? props.configForms.get(NS)
        : null

      useEffect(() => {
        ensureStyle()
        persistTheme(theme)
      }, [theme])

      useEffect(() => {
        if (!controller) return undefined
        controllerRef.current = controller
        // getSnapshot 抛错时绝不能让异常冒泡：effect 里抛出会拆掉整棵 Page，
        // 表现就是「插件整块消失」（0.5.2 白屏同款）。降级成空快照 + 顶部提示。
        const update = () => {
          try {
            setSnap(controller.getSnapshot())
          } catch (error) {
            setSnap(null)
            setStatusError(error?.message || '配置快照读取失败')
          }
        }
        update()
        return controller.subscribe(update)
      }, [controller])

      const refreshStatus = useCallback(async () => {
        try {
          const data = await api('snapshot')
          setStatus(data)
          setStatusError('')
          return data
        } catch (error) {
          setStatusError(error?.message || '状态接口不可用')
          return null
        }
      }, [])

      useEffect(() => {
        refreshStatus()
        probeEngines(['all'], false).catch(() => {})
      }, [refreshStatus])

      useEffect(() => {
        if (!status || !snap || snap.status !== 'ready') return
        const merged = { ...DEFAULTS, ...(status.config || {}), ...(snap.value || {}) }
        if (!initialized.current) {
          initialized.current = true
          setDraft(merged)
          setBaseline(merged)
          return
        }
        const dirty = EDITABLE.some((key) => !sameValue(draft[key], baseline[key]))
        if (!dirty) {
          setDraft(merged)
          setBaseline(merged)
        }
      }, [status, snap?.status, snap?.revision])

      const showToast = useCallback((message, tone = 'ok') => {
        setToast({ message, tone })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 3200)
      }, [])

      const dirtyKeys = useMemo(
        () => EDITABLE.filter((key) => !sameValue(draft[key], baseline[key])),
        [draft, baseline],
      )
      const isDirty = dirtyKeys.length > 0
      const fieldErrors = useMemo(() => validateDraft(draft), [draft])
      const errorKeys = Object.keys(fieldErrors)

      const setField = useCallback((key, value) => {
        setDraft((prev) => ({ ...prev, [key]: value }))
      }, [])

      // 数字输入：coerceField 返回 undefined 表示这一格现在没有有效值，
      // 保持草稿原样，不把空串写成 0。
      const applyNumber = useCallback((key, raw) => {
        const value = coerceField(key, raw)
        if (value === undefined) return
        setField(key, value)
      }, [setField])

      async function probeEngines(ids, force) {
        setEngineBusy(true)
        try {
          const data = await api('probe', { ids: ids.join(','), force: force ? '1' : '0' })
          setEngines((prev) => ({ ...prev, ...(data.engines || {}) }))
        } catch (error) {
          showToast(`检测失败：${error?.message || error}`, 'error')
        } finally {
          setEngineBusy(false)
        }
      }

      async function validateSavePaths() {
        const def = String(draft.defaultSaveDir || '').trim()
        const roots = Array.isArray(draft.allowedRoots) ? [...draft.allowedRoots] : []
        if (def && !roots.some((root) => sameValue(String(root).toLowerCase(), def.toLowerCase()))) roots.push(def)
        const normalized = []
        const changes = []
        for (const root of roots) {
          try {
            const result = await api('validateRoot', { path: root })
            if (!result.ok) {
              showToast(`保存失败：目录未通过 Host 校验：${root}`, 'error')
              return null
            }
            const value = result.normalized || root
            normalized.push(value)
            if (!sameValue(String(value).toLowerCase(), String(root).toLowerCase())) {
              changes.push({ from: root, to: value })
            }
          } catch (error) {
            showToast(`保存失败：无法校验目录 ${root}：${error?.message || error}`, 'error')
            return null
          }
        }
        const normalizedDefault = changes.find((row) => row.from === def)?.to || def
        const next = { ...draft, defaultSaveDir: normalizedDefault, allowedRoots: normalized }
        if (changes.length) {
          setNormalizePrompt({ next, changes })
          return null
        }
        return { next, changes }
      }

      async function commitSave(next) {
        const ops = collectOps(dirtyKeys, baseline, next)
        const ok = await controller.mutate(ops, snap?.revision)
        if (!ok) {
          setConflict({
            message: '配置可能已被其他窗口修改，当前草稿未写入。请重新加载后再保存。',
          })
          return
        }
        setDraft(cloneValue(next))
        setBaseline(cloneValue(next))
        showToast('已保存到 cordis.patch.yml；重启 DSH 后生效。')
        await refreshStatus()
      }

      async function save() {
        if (!controller || !isDirty || busy) return
        if (errorKeys.length) {
          const target = Object.keys(TAB_FIELDS).find((key) => TAB_FIELDS[key].includes(errorKeys[0]))
          if (target) setTab(target)
          showToast(`${errorKeys.length} 处取值不合法：${fieldErrors[errorKeys[0]]}`, 'error')
          return
        }
        setBusy(true)
        try {
          const result = await validateSavePaths()
          if (!result) return
          await commitSave(result.next)
        } catch (error) {
          showToast(`保存失败：${error?.message || error}`, 'error')
        } finally {
          setBusy(false)
        }
      }

      async function reloadAfterConflict() {
        try {
          const data = await refreshStatus()
          const current = controllerRef.current?.getSnapshot()
          if (current) setSnap(current)
          const merged = { ...DEFAULTS, ...(data?.config || {}), ...(current?.value || {}) }
          setDraft(cloneValue(merged))
          setBaseline(cloneValue(merged))
          setConflict(null)
          showToast('已重新加载当前配置。')
        } catch (error) {
          showToast(`重新加载失败：${error?.message || error}`, 'error')
        }
      }

      function discard() {
        setDraft(cloneValue(baseline))
        showToast('已放弃未保存的修改。')
      }

      function openRootModal(mode) {
        setModal({
          mode,
          path: mode === 'default' ? String(draft.defaultSaveDir || '') : '',
          checks: [],
          busy: false,
          error: '',
          validated: false,
        })
      }

      async function validateRoot() {
        const path = modal?.path?.trim()
        if (!path) return
        setModal((prev) => ({ ...prev, busy: true, error: '' }))
        try {
          const data = await api('validateRoot', { path })
          setModal((prev) => ({ ...prev, busy: false, checks: data.checks || [], validated: Boolean(data.ok), normalized: data.normalized }))
        } catch (error) {
          setModal((prev) => ({ ...prev, busy: false, checks: [], validated: false, error: error?.message || String(error) }))
        }
      }

      function confirmRoot() {
        if (!modal?.validated) return
        const value = modal.normalized || modal.path.trim()
        if (modal.mode === 'default') {
          setField('defaultSaveDir', value)
          setDraft((prev) => {
            const roots = Array.isArray(prev.allowedRoots) ? [...prev.allowedRoots] : []
            if (!roots.some((root) => sameValue(String(root).toLowerCase(), value.toLowerCase()))) roots.push(value)
            return { ...prev, allowedRoots: roots }
          })
        } else {
          setDraft((prev) => {
            const roots = Array.isArray(prev.allowedRoots) ? [...prev.allowedRoots] : []
            if (!roots.some((root) => sameValue(String(root).toLowerCase(), value.toLowerCase()))) roots.push(value)
            return { ...prev, allowedRoots: roots }
          })
        }
        setModal(null)
      }

      function removeRoot(root) {
        const def = String(draft.defaultSaveDir || '')
        if (String(root).toLowerCase() === def.toLowerCase()) {
          showToast('默认保存目录始终包含在允许目录中，不能删除。', 'error')
          return
        }
        setConfirmRemove(root)
      }

      function doRemoveRoot() {
        const root = confirmRemove
        if (!root) return
        setField('allowedRoots', (draft.allowedRoots || []).filter((item) => item !== root))
        setConfirmRemove(null)
      }

      const cfgView = {
        ...(status?.config || {}),
        motrix: status?.motrix || null,
      }
      const readyCount = Object.values(engines).filter((row) => row?.available).length
      const issueCount = Object.values(engines).filter((row) => row && !row.available).length
      const uncheckedCount = Math.max(0, 4 - Object.keys(engines).length)
      const tabBadge = (key) => badgeCount(dirtyKeys, key)

      if (!controller) {
        return dcRoot(theme, rootRef,
          h('div', { className: 'dc-card' },
            h('div', { className: 'dc-card-title' }, '配置服务未就绪'),
            h('div', { className: 'dc-note warn' }, 'configForms 服务不可用。请确认 @deepseek-ai/dsh-client-ui-settings 已加载，然后重新打开此页面。'),
          ),
        )
      }

      if (snap && snap.status === 'unavailable') {
        return dcRoot(theme, rootRef,
          h('div', { className: 'dc-card' },
            h('div', { className: 'dc-card-title' }, '这个插件没有可配置项'),
            h('div', { className: 'dc-note warn' }, 'Host 未注册 static Config，或插件未启用。'),
          ),
        )
      }

      if (!snap || snap.status === 'loading') {
        return dcRoot(theme, rootRef,
          h('div', { className: 'dc-loading' }, '正在读取配置…'),
        )
      }

      return dcRoot(theme, rootRef,
        h('header', { className: 'dc-header' },
          h('div', { className: 'dc-logo', 'aria-hidden': 'true' }, h('img', { src: BRAND_ICON, alt: '' })),
          h('div', null,
            h('div', { className: 'dc-title' }, '统一下载入口'),
            h('div', { className: 'dc-sub' }, 'Motrix · 直连 · yt-dlp · Hugging Face'),
          ),
          h('div', { className: 'dc-header-right' },
            h('span', { className: `dc-chip ${statusError ? 'warn' : 'ok'}` },
              h('span', { className: 'dc-dot', style: { background: statusError ? 'var(--dc-amber)' : 'var(--dc-green)' } }),
              status?.plugin?.version ? `v${status.plugin.version}` : '版本未知',
            ),
            h('span', { className: 'dc-chip' }, `${readyCount} / 4 可用`),
            isDirty ? h('span', { className: 'dc-chip wait' }, `${dirtyKeys.length} 项待保存`) : null,
            isDirty ? h('button', {
              type: 'button',
              className: 'dc-btn dc-head-discard',
              onClick: discard,
              disabled: busy,
            }, '放弃') : null,
            h('button', {
              type: 'button',
              className: 'dc-btn primary dc-head-save',
              onClick: save,
              disabled: !isDirty || busy,
              title: errorKeys.length ? `${errorKeys.length} 处取值不合法，先修正再保存` : '保存到 cordis.patch.yml',
            }, busy ? '保存中…' : '保存'),
            h('button', {
              type: 'button',
              className: 'dc-icon-btn',
              title: theme === 'dark' ? '切换到浅色' : '切换到深色',
              onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
            }, theme === 'dark' ? '☀' : '☾'),
          ),
        ),
        statusError ? h('div', { className: 'dc-banner', role: 'status' },
          `Host 状态接口不可用：${statusError}。配置表单仍可用，但引擎检测与只读信息可能缺失。`,
        ) : null,
        h('nav', { className: 'dc-tabs', role: 'tablist' },
          h(TabButton, { icon: '▦', label: '总览', active: tab === 'overview', onClick: () => setTab('overview') }),
          h(TabButton, { icon: '↓', label: '下载', active: tab === 'download', onClick: () => setTab('download'), badge: tabBadge('download') }),
          h(TabButton, { icon: '≡', label: '策略', active: tab === 'policy', onClick: () => setTab('policy'), badge: tabBadge('policy') }),
          h(TabButton, { icon: '▤', label: '引擎', active: tab === 'engines', onClick: () => setTab('engines'), badge: tabBadge('engines') }),
          h(TabButton, { icon: '◇', label: '安全', active: tab === 'security', onClick: () => setTab('security'), badge: tabBadge('security') }),
        ),
        h('main', { className: 'dc-main' }, renderTab()),
        isDirty ? h('div', { className: 'dc-savebar', role: 'region', 'aria-label': '未保存改动' },
          h('div', { className: 'dc-savebar-text' }, h('b', null, `${dirtyKeys.length} 项`), ' 未保存'),
          h('div', { className: 'dc-savebar-note' }, errorKeys.length
            ? `${errorKeys.length} 处取值不合法：${fieldErrors[errorKeys[0]]}`
            : '保存后写入 cordis.patch.yml，重启 DSH 生效'),
          h('div', { className: 'dc-savebar-actions' },
            h('button', { type: 'button', className: 'dc-btn dc-head-discard', onClick: discard, disabled: busy }, '放弃'),
            h('button', { type: 'button', className: 'dc-btn primary dc-head-save', onClick: save, disabled: busy }, busy ? '保存中…' : '保存'),
          ),
        ) : null,
        toast ? h('div', { 'data-dc-overlay': true, className: `dc-toast${toast.tone === 'error' ? ' error' : ''}`, role: 'status' }, toast.message) : null,
        modal ? h('div', { 'data-dc-overlay': true }, renderModal()) : null,
        conflict ? h('div', { 'data-dc-overlay': true }, renderConflict()) : null,
        normalizePrompt ? h('div', { 'data-dc-overlay': true }, renderNormalizePrompt()) : null,
        confirmRemove ? h('div', { 'data-dc-overlay': true }, renderConfirmRemove()) : null,
      )

      function renderTab() {
        if (tab === 'download') return renderDownload()
        if (tab === 'policy') return renderPolicy()
        if (tab === 'engines') return renderEngines()
        if (tab === 'security') return renderSecurity()
        return renderOverview()
      }

      function renderOverview() {
        return h(React.Fragment, null,
          h('section', { className: 'dc-hero' },
            h('div', { className: 'dc-hero-body' },
              h('p', { className: 'dc-hero-sub' }, '四条通路统一入口。保存写入 cordis.patch.yml，重启生效。'),
              h('div', { className: 'dc-hero-tags' },
                h('span', { className: `dc-chip ${statusError ? 'warn' : 'ok'}` }, h('span', { className: 'dc-dot' }), statusError ? '状态接口不可用' : '服务运行中'),
                isDirty ? h('span', { className: 'dc-chip wait' }, `${dirtyKeys.length} 项待保存`) : h('span', { className: 'dc-chip' }, '配置已同步'),
              ),
            ),
            h('div', { className: 'dc-metrics' },
              h('div', { className: 'dc-metric good' }, h('b', null, String(readyCount)), h('span', null, '已就绪')),
              h('div', { className: `dc-metric${issueCount ? ' warn' : ''}` }, h('b', null, String(issueCount)), h('span', null, '需处理')),
              h('div', { className: 'dc-metric idle' }, h('b', null, String(uncheckedCount)), h('span', null, '未检测')),
            ),
          ),
          h('div', { className: 'dc-grid' },
            h('section', { className: 'dc-card span-12' },
              h('div', { className: 'dc-card-head' },
                h('div', null, h('div', { className: 'dc-card-title' }, '引擎状态'), h('div', { className: 'dc-card-note' }, '检测只读，不自动启动、不修改配置。')),
                h('div', { className: 'dc-right' }, h('button', { type: 'button', className: 'dc-btn sm', onClick: () => probeEngines(['all'], true), disabled: engineBusy }, engineBusy ? '检测中…' : '全部检测')),
              ),
              h('div', { className: 'dc-engine-grid' },
                Object.keys(ENGINE_META).map((id) => h(EngineCard, { key: id, id, row: engines[id], busy: engineBusy, onProbe: (one) => probeEngines([one], true) })),
              ),
            ),
            h('section', { className: 'dc-card span-6' },
              h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '当前策略'), h('div', { className: 'dc-card-note' }, '启动时读取的生效值'))),
              routeRows(),
            ),
            h('section', { className: 'dc-card span-6' },
              h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '加速'), h('div', { className: 'dc-card-note' }, '只读探测，不修改系统代理'))),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, '本地代理'), h('div', { className: 'dc-row-desc' }, cfgView.proxyCandidates?.length ? `候选端口 ${cfgView.proxyCandidates.join(' / ')}` : '未配置候选端口')), h('span', { className: 'dc-tag' }, '自动')),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, 'GitHub 镜像'), h('div', { className: 'dc-row-desc' }, draft.githubMirrorDefault ? draft.githubMirrorBase : '默认关闭；显式开启时改写文件直链')), h('span', { className: 'dc-tag' }, draft.githubMirrorDefault ? '默认开' : '默认关')),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, 'HF 镜像'), h('div', { className: 'dc-row-desc' }, draft.useHfMirror ? draft.hfMirror : '未启用；开启时使用 HF_ENDPOINT 并剥离 token')), h('span', { className: 'dc-tag' }, draft.useHfMirror ? '开' : '关')),
              h('div', { className: 'dc-note info', style: { marginTop: 10 } }, '回退只对通用 URL 生效。视频与 HF 不会因为 Motrix 不可用就切到别的引擎；显式指定 engine 时也不回退。'),
            ),
            h('section', { className: 'dc-card span-12' },
              h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '安全边界'), h('div', { className: 'dc-card-note' }, '强制保护，不可通过配置关闭'))),
              h('div', { className: 'dc-grid-2' },
                securityLine('SSRF 拦截', '回环 / 私网 / 链路本地 / 元数据地址在引擎前拒绝'),
                securityLine('目录白名单', '默认目录 + 允许目录；写入前 realpath 与边界校验'),
                securityLine('Session 隔离', 'task ref 只在签发它的会话可见；跨会话返回 E_NOT_FOUND'),
                securityLine('Guard 默认 deny', 'curl -o / wget / iwr -OutFile / aria2c / yt-dlp 写盘命令被拦截'),
              ),
            ),
          ),
        )
      }

      function routeRows() {
        const rows = [
          ['P', '通用 URL', 'Motrix 可用时优先；不可用回退 Direct', 'auto'],
          ['⇅', 'Magnet / torrent', '只交给 Motrix；不自动拉起客户端', 'motrix'],
          ['▷', '视频页面', '只交给 yt-dlp；不做跨引擎回退', 'ytdlp'],
          ['H', 'HF 仓库', '只交给 hf；支持 include / revision', 'hf'],
        ]
        return rows.map(([icon, title, desc, tag]) => h('div', { className: 'dc-row', key: title },
          h('span', { className: 'dc-engine-icon' }, icon),
          h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, title), h('div', { className: 'dc-row-desc' }, desc)),
          h('span', { className: 'dc-tag' }, tag),
        ))
      }

      function securityLine(title, desc) {
        return h('div', { className: 'dc-row' },
          h('span', { className: 'dc-check ok' }, '✓'),
          h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, title), h('div', { className: 'dc-row-desc' }, desc)),
        )
      }

      function renderDownload() {
        return h('div', { className: 'dc-grid' },
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '保存位置'), h('div', { className: 'dc-card-note' }, '默认目录与允许写入的根目录'))),
            h(Field, { label: '默认保存目录', error: fieldErrors.defaultSaveDir, hint: '修改后会加入允许目录；保存前会经过 Host 路径校验与二次确认。' },
              h('div', { className: 'dc-input-row' },
                h(TextInput, { value: draft.defaultSaveDir, mono: true, onChange: (v) => setField('defaultSaveDir', v) }),
                h('button', { type: 'button', className: 'dc-btn', onClick: () => openRootModal('default') }, '选择…'),
              ),
            ),
            h(Field, { label: '允许目录', hint: '只有这些目录下的文件会被写入；默认目录始终包含且不可删除。' },
              h('div', { className: 'dc-chips' }, (draft.allowedRoots || []).length
                ? draft.allowedRoots.map((root) => h('span', { className: `dc-root-chip${String(root).toLowerCase() === String(draft.defaultSaveDir || '').toLowerCase() ? ' default' : ''}`, key: root, title: root },
                  h('code', { title: root }, root),
                  String(root).toLowerCase() === String(draft.defaultSaveDir || '').toLowerCase()
                    ? h('span', { className: 'dc-tag' }, '默认')
                    : h('button', { type: 'button', title: '移除此目录', onClick: () => removeRoot(root) }, '×'),
                ))
                : h('div', { className: 'dc-empty' }, '还没有允许目录。先添加一个。'),
              ),
              h('div', { style: { marginTop: 8 } }, h('button', { type: 'button', className: 'dc-btn', onClick: () => openRootModal('add') }, '+ 添加目录')),
            ),
          ),
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '传输参数'), h('div', { className: 'dc-card-note' }, '只影响新任务；已运行任务不变。'))),
            h('div', { className: 'dc-group-label' }, '传输'),
            h('div', { className: 'dc-grid-2' },
              h(Field, { label: '连接数', error: fieldErrors.connections, hint: '1–16；Motrix 直连使用。' }, h(NumberInput, { min: 1, max: 16, value: draft.connections, onChange: (v) => applyNumber('connections', v) })),
              h(Field, { label: '单文件上限', unit: 'GB', error: fieldErrors.maxBytes, hint: '1 MiB–64 GiB；部分引擎做硬上限。' }, h(NumberInput, { min: 0, value: Math.round(Number(draft.maxBytes) / BYTES_PER_GB), onChange: (v) => applyNumber('maxBytes', v) })),
            ),
            h('details', { className: 'dc-adv' },
              h('summary', null, '超时与轮询'),
              h('div', { className: 'dc-grid-2' },
                h(Field, { label: '请求超时', unit: '秒', error: fieldErrors.requestTimeoutMs }, h(NumberInput, { min: 1, value: Math.round(Number(draft.requestTimeoutMs) / 1000), onChange: (v) => applyNumber('requestTimeoutMs', v) })),
                h(Field, { label: '轮询间隔', unit: '毫秒', error: fieldErrors.pollMs }, h(NumberInput, { min: 100, value: draft.pollMs, onChange: (v) => applyNumber('pollMs', v) })),
                h(Field, { label: '最长等待', unit: '秒', error: fieldErrors.maxWaitSeconds }, h(NumberInput, { min: 30, value: draft.maxWaitSeconds, onChange: (v) => applyNumber('maxWaitSeconds', v) })),
              ),
            ),
            h('div', { className: 'dc-note info', style: { marginTop: 4 } }, '保存后写入 cordis.patch.yml，重启 DSH 生效。'),
          ),
        )
      }

      function renderPolicy() {
        return h('div', { className: 'dc-grid' },
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '路由优先级'), h('div', { className: 'dc-card-note' }, '只读；与 0.1.6 实际路由一致')), h('span', { className: 'dc-tag readonly' }, '只读')),
            routeRows(),
            h('div', { className: 'dc-note warn', style: { marginTop: 10 } }, '回退只对通用 URL 生效。视频和 HF 不会因为 Motrix 不可用就切到别的引擎；显式指定 engine 时也不回退。'),
          ),
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' },
              h('div', null, h('div', { className: 'dc-card-title' }, 'GitHub 镜像'), h('div', { className: 'dc-card-note' }, '显式 opt-in，默认关闭')),
              h('div', { className: 'dc-right' }, h(Toggle, { checked: draft.githubMirrorDefault, onChange: (v) => setField('githubMirrorDefault', v), label: draft.githubMirrorDefault ? '默认启用' : '未启用' })),
            ),
            h(Field, { label: '镜像 base URL', error: fieldErrors.githubMirrorBase, hint: '必须 https，无凭据、查询串或片段。只改写 github.com / raw.githubusercontent.com / codeload.github.com 的文件直链。' },
              h(TextInput, { value: draft.githubMirrorBase, mono: true, onChange: (v) => setField('githubMirrorBase', v), disabled: !draft.githubMirrorDefault }),
            ),
            draft.githubMirrorDefault ? null : h('div', { className: 'dc-note', style: { marginTop: 8 } }, '当前未启用：上面的地址只保存，不参与任何下载改写。'),
            h('details', { className: 'dc-adv' },
              h('summary', null, '开启后会发生什么'),
              h('div', { className: 'dc-note warn' }, 'Authorization / Cookie / Referer 会在发给镜像前剥离；签名 CDN 与 gist 不改写。'),
            ),
          ),
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' },
              h('div', null, h('div', { className: 'dc-card-title' }, 'HF 镜像'), h('div', { className: 'dc-card-note' }, '只影响 hf 子进程')),
              h('div', { className: 'dc-right' }, h(Toggle, { checked: draft.useHfMirror, onChange: (v) => setField('useHfMirror', v), label: draft.useHfMirror ? '已启用' : '未启用' })),
            ),
            h(Field, { label: 'HF_ENDPOINT', error: fieldErrors.hfMirror }, h(TextInput, { value: draft.hfMirror, mono: true, onChange: (v) => setField('hfMirror', v), disabled: !draft.useHfMirror })),
            draft.useHfMirror ? null : h('div', { className: 'dc-note', style: { marginTop: 8 } }, '当前未启用：HF_ENDPOINT 不注入子进程。'),
            h('div', { className: 'dc-note info', style: { marginTop: 10 } }, '默认 https://hf-mirror.com；启用时剥离 HF_TOKEN。'),
          ),
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '本地代理'), h('div', { className: 'dc-card-note' }, '只读探测，不修改系统代理'))),
            h(Field, { label: '候选端口', hint: '按顺序探测；只允许本机回环代理。' },
              h(ProxyListInput, { value: draft.proxyCandidates, onChange: (list) => setField('proxyCandidates', list) }),
            ),
            h('div', { className: 'dc-note info' }, '探测 7890 / 31181；不接管浏览器或系统代理。'),
            h('details', { className: 'dc-adv', style: { marginTop: 12 } },
              h('summary', null, '包管理器诊断（只读）'),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, 'pip'), h('div', { className: 'dc-row-desc' }, '只读；不修改 pip.ini')), h('span', { className: 'dc-tag' }, '只读')),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, 'npm'), h('div', { className: 'dc-row-desc' }, '只读；不修改 .npmrc')), h('span', { className: 'dc-tag' }, '只读')),
              h('div', { className: 'dc-row' }, h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, 'cargo'), h('div', { className: 'dc-row-desc' }, '只读；不修改 config.toml')), h('span', { className: 'dc-tag' }, '只读')),
            ),
          ),
        )
      }

      function renderEngines() {
        return h('div', { className: 'dc-grid' },
          h('section', { className: 'dc-card span-12' },
            h('div', { className: 'dc-card-head' },
              h('div', null, h('div', { className: 'dc-card-title' }, '引擎状态'), h('div', { className: 'dc-card-note' }, '检测结果缓存 5 秒；强制刷新会重新探测。detail 原样展示，不做美化。')),
              h('div', { className: 'dc-right' },
                h('button', { type: 'button', className: 'dc-btn sm', onClick: () => probeEngines(['all'], false), disabled: engineBusy }, '检测全部'),
              ),
            ),
            h('div', { className: 'dc-engine-grid' },
              Object.keys(ENGINE_META).map((id) => h(EngineCard, { key: id, id, row: engines[id], busy: engineBusy, onProbe: (one) => probeEngines([one], true) })),
            ),
            h('div', { className: 'dc-note', style: { marginTop: 12 } }, '状态位直接取 Host 的 state 字段（Host 负责把 available 与 reason 归成五态），本页不按 detail 文本二次归类。失败时另起一行展示“上次可用”，主状态位不保留旧的成功态。'),
          ),
          h('section', { className: 'dc-card span-12' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '执行路径'), h('div', { className: 'dc-card-note' }, '留空即用 PATH 里的默认命令；只影响新启动的进程。'))),
            h('div', { className: 'dc-grid-2' },
              h(Field, { label: 'yt-dlp 路径', hint: '可执行文件或 PATH 中的命令名；空则用默认 yt-dlp。' }, h(TextInput, { value: draft.ytdlpPath, mono: true, onChange: (v) => setField('ytdlpPath', v) })),
              h(Field, { label: 'hf CLI 路径', hint: '可执行文件或 PATH 中的命令名；空则用默认 hf。' }, h(TextInput, { value: draft.hfPath, mono: true, onChange: (v) => setField('hfPath', v) })),
            ),
          ),
          h('section', { className: 'dc-card span-12' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '诊断'), h('div', { className: 'dc-card-note' }, '只读；不会修改代理、配置文件或引擎状态'))),
            h('div', { className: 'dc-grid-2' },
              h('div', { className: 'dc-note' }, 'Motrix 桥：', cfgView.motrix?.connected ? '已连接' : '未连接（' + (cfgView.motrix?.error || '未运行') + '）'),
              h('div', { className: 'dc-note' }, '允许目录：', (cfgView.allowedRoots || []).length + ' 个'),
              h('div', { className: 'dc-note' }, 'GitHub 镜像：', cfgView.githubMirrorDefault ? '默认启用' : '默认关闭'),
              h('div', { className: 'dc-note' }, '浏览器 cookies：', cfgView.allowBrowserCookies ? '已开启' : '默认关闭'),
            ),
          ),
        )
      }

      function renderSecurity() {
        return h('div', { className: 'dc-grid' },
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '强制边界'), h('div', { className: 'dc-card-note' }, '不可通过配置关闭')), h('span', { className: 'dc-tag readonly' }, '强制')),
            securityLine('SSRF 拦截', '回环 / 私网 / 链路本地 / 元数据地址在引擎前拒绝；代理 fake-ip 例外只限本机代理。'),
            securityLine('目录白名单', '写入前 realpath + 边界校验；默认目录自动加入允许目录。'),
            securityLine('Session 隔离', 'task ref 只在签发它的会话可见；跨会话返回 E_NOT_FOUND。'),
            securityLine('Guard 默认 deny', 'curl -o / wget / iwr -OutFile / aria2c / yt-dlp 写盘命令被拦截。'),
            h('div', { className: 'dc-note warn', style: { marginTop: 10 } }, '这些保护由 Host 代码强制执行，配置页不提供关闭开关。'),
          ),
          h('section', { className: 'dc-card span-6' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '只读开关'), h('div', { className: 'dc-card-note' }, '安全四件套 P0 只读；环境变量可强制开启'))),
            readonlySwitch('allowShell', '允许 shell 下载', `逃生舱：环境变量 DSH_DOWNLOAD_ALLOW_SHELL=1；${cfgView.allowShell ? '当前已由环境变量开启。' : '当前环境未开启。'}`, cfgView.allowShell),
            readonlySwitch('allowExecutable', '允许可执行文件', `允许下载可执行扩展名；${cfgView.allowExecutable ? '当前已由环境变量开启。' : '当前不开启。'}`, cfgView.allowExecutable),
            readonlySwitch('allowBrowserCookies', '浏览器 cookies', `仅视频站；环境变量 DSH_DOWNLOAD_ALLOW_BROWSER_COOKIES=1；${cfgView.allowBrowserCookies ? '当前已开启。' : '当前未开启。'}`, cfgView.allowBrowserCookies),
            readonlySwitch('guardFailClosed', '失败即拒绝', 'guardFailClosed：评估异常时拒绝可疑下载命令。', cfgView.guardFailClosed),
            h('div', { className: 'dc-row' },
              h('span', { className: 'dc-lock', 'aria-hidden': 'true' }, '🔒'),
              h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, '自动拉起 Motrix'), h('div', { className: 'dc-row-desc' }, 'autoStartMotrix：代码强制 false；不提供自动拉起。')),
              h('span', { className: 'dc-chip' }, '关闭'),
              h('span', { className: 'dc-tag readonly' }, '只读'),
            ),
          ),
          h('section', { className: 'dc-card span-12' },
            h('div', { className: 'dc-card-head' }, h('div', null, h('div', { className: 'dc-card-title' }, '开发者信息'), h('div', { className: 'dc-card-note' }, '内部标识；改错会影响工具名与提示词顺序'))),
            h('details', { className: 'dc-adv' },
              h('summary', null, '查看内部标识'),
              h('dl', { className: 'dc-kv' },
              h('dt', null, 'toolPrefix'), h('dd', { className: 'dc-mono' }, draft.toolPrefix || '(空)'),
              h('dt', null, 'promptName / promptOrder'), h('dd', { className: 'dc-mono' }, `${draft.promptName || '—'} · ${draft.promptOrder ?? '—'}`),
                h('dt', null, 'motrixStateDir'), h('dd', { className: 'dc-mono' }, draft.motrixStateDir || '(未使用)'),
              ),
            ),
          ),
        )
      }

      function readonlySwitch(key, title, desc, enabled) {
        return h('div', { className: 'dc-row' },
          h('span', { className: 'dc-lock', 'aria-hidden': 'true' }, '🔒'),
          h('div', { className: 'dc-row-main' }, h('div', { className: 'dc-row-title' }, title), h('div', { className: 'dc-row-desc' }, desc)),
          h('span', { className: `dc-chip ${enabled ? 'ok' : ''}` }, enabled ? '开' : '关'),
          h('span', { className: 'dc-tag readonly' }, '只读'),
        )
      }

      function renderConflict() {
        return h('div', { className: 'dc-modal-backdrop', role: 'presentation' },
          h('div', { className: 'dc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dc-conflict-title' },
            h('h3', { id: 'dc-conflict-title' }, '配置已被修改'),
            h('p', null, conflict.message),
            h('div', { className: 'dc-note warn' }, '你的草稿仍然保留；重新加载会丢弃未保存的修改。'),
            h('div', { className: 'dc-modal-actions' },
              h('button', { type: 'button', className: 'dc-btn', onClick: () => setConflict(null) }, '继续编辑'),
              h('button', { type: 'button', className: 'dc-btn primary', onClick: reloadAfterConflict }, '重新加载当前配置'),
            ),
          ),
        )
      }

      function renderNormalizePrompt() {
        return h('div', { className: 'dc-modal-backdrop', role: 'presentation' },
          h('div', { className: 'dc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dc-normalize-title' },
            h('h3', { id: 'dc-normalize-title' }, '路径会被规范化'),
            h('p', null, 'Host 会把以下路径规范化后再保存。请确认这是你要写入的位置。'),
            h('div', { className: 'dc-checks' },
              normalizePrompt.changes.map((row, i) => h('div', { className: 'dc-check', key: `${row.from}-${i}` },
                h('span', { className: 'warn' }, '!'),
                h('div', null, h('code', null, row.from), h('small', null, `→ ${row.to}`)),
              )),
            ),
            h('div', { className: 'dc-modal-actions' },
              h('button', { type: 'button', className: 'dc-btn', onClick: () => setNormalizePrompt(null) }, '返回修改'),
              h('button', { type: 'button', className: 'dc-btn primary', onClick: async () => {
                const pending = normalizePrompt
                setNormalizePrompt(null)
                try {
                  setBusy(true)
                  await commitSave(pending.next)
                } catch (error) {
                  showToast(`保存失败：${error?.message || error}`, 'error')
                } finally {
                  setBusy(false)
                }
              } }, '使用规范化路径保存'),
            ),
          ),
        )
      }

      function renderConfirmRemove() {
        return h('div', { className: 'dc-modal-backdrop', role: 'presentation' },
          h('div', { className: 'dc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dc-remove-title' },
            h('h3', { id: 'dc-remove-title' }, '删除允许目录？'),
            h('p', null, '删除后，新任务不能再写入这个目录。已存在的文件不会被删除。'),
            h('div', { className: 'dc-note warn' }, h('code', null, confirmRemove)),
            h('div', { className: 'dc-modal-actions' },
              h('button', { type: 'button', className: 'dc-btn', onClick: () => setConfirmRemove(null) }, '取消'),
              h('button', { type: 'button', className: 'dc-btn primary', onClick: doRemoveRoot }, '删除目录'),
            ),
          ),
        )
      }

      function renderModal() {
        return h('div', { className: 'dc-modal-backdrop', role: 'presentation', onMouseDown: (e) => { if (e.target === e.currentTarget && !modal.busy) setModal(null) } },
          h('div', { className: 'dc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dc-modal-title' },
            h('h3', { id: 'dc-modal-title' }, modal.mode === 'default' ? '设置默认保存目录' : '添加允许目录'),
            h('p', null, 'Host 会先做路径规范化、目录/权限检查与边界校验；通过后确认，才会写入草稿。默认目录始终会加入允许目录。'),
            h(Field, { label: '目录路径' },
              h(TextInput, { value: modal.path, onChange: (v) => setModal((prev) => ({ ...prev, path: v, checks: [], validated: false, error: '' })), placeholder: '例如 下载目录\\models' }),
            ),
            modal.error ? h('div', { className: 'dc-note warn' }, modal.error) : null,
            modal.checks.length ? h('div', { className: 'dc-checks' },
              modal.checks.map((check, i) => h('div', { className: 'dc-check', key: `${check.id}-${i}` },
                h('span', { className: check.status === 'pass' ? 'ok' : check.status === 'warn' ? 'warn' : 'bad' }, check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '×'),
                h('div', null, check.label, check.detail ? h('small', null, check.detail) : null),
              )),
            ) : null,
            h('div', { className: 'dc-modal-actions' },
              h('button', { type: 'button', className: 'dc-btn', onClick: () => setModal(null), disabled: modal.busy }, '取消'),
              h('button', { type: 'button', className: 'dc-btn', onClick: validateRoot, disabled: modal.busy || !modal.path.trim() }, modal.busy ? '校验中…' : '校验路径'),
              h('button', { type: 'button', className: 'dc-btn primary', onClick: confirmRoot, disabled: modal.busy || !modal.validated }, '确认使用'),
            ),
          ),
        )
      }
    }

    function apply(ctx) {
      ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PKG,
        inject: () => ({ configForms: ctx.configForms }),
      }, Page)), 'dsh-download-nexus: config page')

      ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'download-nexus',
        order: 40,
        locale: PKG,
        label: () => '下载',
        inject: () => ({ configForms: ctx.configForms }),
      }, Page)), 'dsh-download-nexus: top tab')
    }

    return { apply, inject: ['slots', 'configForms'], __test: { readTheme, persistTheme, validateDraft, coerceField, parseProxyList, formatProxyList, collectOps, badgeCount, TAB_FIELDS, STATE_META, stateOf, dcRoot, proxyResyncNeeded, EDITABLE, stylesheet: () => CSS } }
  },
})
