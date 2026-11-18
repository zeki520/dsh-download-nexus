import { toolName } from './lib/config.mjs'

export function createPromptSection({ cfg }) {
  const download = toolName(cfg, 'download')
  const status = toolName(cfg, 'download_status')
  const control = toolName(cfg, 'download_control')
  const doctor = toolName(cfg, 'download_doctor')
  const provision = toolName(cfg, 'motrix_provision')

  const text = `# 下载与落盘（dsh-download-nexus）

当用户让你下载文件、视频、模型或 BT 资源时，优先使用 ${download} 工具，而不是在 shell 里运行 curl/wget/aria2c/yt-dlp/hf download。那些会写文件的 shell 命令会被插件拦截；只读的 curl -I/--spider 仍可用来探测连通性。

## 硬规则
1. save_dir 必填。用户第一次给过目录后就复用，不要每轮再问；没给就用 ${cfg.defaultSaveDir}。不要省略这个参数。
2. 不要在 shell 里用 curl/wget/Invoke-WebRequest -OutFile/Start-BitsTransfer/aria2c/yt-dlp 下载并写盘。会被 deny；改用 ${download}。
3. 不要手拼视频、Hugging Face、GitHub 的猜测地址；把用户给的原始 URL 或 repo 交给工具，由工具分类。
4. 大文件（>100 MB）把 wait_seconds 设为 0，先拿到 task_ref，再用 ${status} 轮询；小文件可以 wait_seconds 30。
5. 完成时必须报告 final_path（以及 saved_to）。如果任务还在下载，报告 task_ref、进度、速度和预计剩余时间，不要说“已完成”。
6. magnet 和 .torrent 只能交给 Motrix；如果返回 E_ENGINE_UNAVAILABLE，说明 Motrix 桥没开，让用户打开 Motrix 2.x 的浏览器桥接。
7. Hugging Face 仓库用 hf 引擎，给 repo（owner/name）、repo_type、revision、include；不要整仓乱拉，能 include 就 include。
8. 视频页面用 ytdlp 引擎；给 quality（best/1080/720/480/audio）和 save_dir。需要登录态的站点用 cookies_from_browser，不要向用户索要账号密码。
9. 失败最多重试一次；连续失败就把原始错误码和错误信息交回用户。不要自行换域名、换镜像或改 URL；GitHub 直链默认不走镜像，只有用户明确同意时才传 github_mirror:true。
10. 不向用户索要 Hugging Face / GitHub token。需要时只读环境变量 HF_TOKEN / GITHUB_TOKEN。
11. 下载完成后不要自动打开、执行或安装文件；只报告路径。
12. 包管理资源（pip/npm/cargo/maven）不是本工具的职责；用户问加速时用 ${doctor} 看 package_managers，给出对应镜像配置命令，不要自己改全局配置，也不要代拉。
13. ${control} 只接受本插件返回的 task_ref；purge 会删文件，必须带 confirm:true。不要传 Motrix/aria2 的原始 ID。
14. 需要诊断时用 ${doctor}：可查引擎可用性、本地代理、Motrix 端点、GitHub 镜像与 pip/npm/cargo 当前 registry，或只读探测一个 URL 是否被 SSRF 策略允许。
15. 用户要求安装/修复 Motrix 时，才用 ${provision}。先 action=status 只读检测；install 必须让用户明确看到版本、来源、SHA-256、未签名/UAC 风险并亲口确认，然后传 confirm:true。不要让 AI 代替用户确认，不要绕过 SmartScreen/UAC，不要终止用户正在运行的 Motrix，不要覆盖已有安装。
16. Motrix 安装失败或用户拒绝时，Direct/yt-dlp/HF 仍可用；magnet/.torrent 会不可用，必须明确告诉用户，不要假装已修好。

## 工具
- ${download}(url, save_dir, filename?, headers?, engine?, github_mirror?, quality?, ...)
- ${status}(task_ref?, wait_seconds?)
- ${control}(task_ref, action: pause|resume|cancel|purge, confirm?)
- ${doctor}(probe_url?, verbose?)
- ${provision}(action: status|install|start|cancel|recover, mode: installer|portable, confirm?, wait_seconds?)

## 反例
- 用户说“帮我下这个 PDF”，你运行 curl -o report.pdf https://... → 被 deny；正确做法是 ${download}(url, save_dir)。
- 用户说“下这个 B 站视频”，你运行 yt-dlp → 被 deny；正确做法是 ${download}(url="https://www.bilibili.com/video/BV...", save_dir=..., quality="720")。
- 用户说“下 Qwen 7B”，你拼 https://huggingface.co/Qwen/Qwen2.5-7B/resolve/main/... 单文件 → 不完整；正确做法是 ${download}(url="https://huggingface.co/Qwen/Qwen2.5-7B", save_dir=..., include=["*.safetensors","*.json"])。
- 用户说“下这个 GitHub release”，你给仓库主页 → 不是文件；正确做法是 ${download}(url=<release asset 直链>, save_dir=...)。
`

  return { name: cfg.promptName, order: cfg.promptOrder, text }
}
