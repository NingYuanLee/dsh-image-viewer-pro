# Changelog

## Unreleased

## 0.1.4

- 底栏中间按钮改为在页码和右侧操作之间居中。原先左右列等宽，中间组对齐弹窗中线，但右侧下载/复制比左侧页码更宽，看起来整组偏右。

- 内存：预解码只保留当前图和前后各一张，关闭弹窗时清掉位图；元数据缓存最多 48 条，且不把 `data:` 整段内容当键留住。复制非 PNG 时主动释放 ImageBitmap，长边超过 4096 的图先缩小再转码，避免整张大画布把页面卡死。

- 本地图片的右上角「打开」改为分体按钮：主按钮用系统默认应用图标打开，下拉列出 `session.workspacePathApplications` 返回的关联应用（默认项标注「默认」），底部是「显示文件位置」。打开仍走 `session.openWorkspacePath`。远程图仍是新标签。

- 底栏分三组：缩放、适应窗口/1:1、旋转，组与组之间用竖线分开。

- 旋转按钮分左右：左侧逆时针、右侧顺时针，当前角度（0° / 90° / 180° / 270°）在中间居中。`R` 顺时针，`Shift+R` 逆时针。逆时针往负角度转，动画不会倒着跳；换图时回到 0°。

- 动效：图片旋转改为约 340ms 缓动，适应窗口的图会连同缩放一起转到新的朝向。从 270° 再转时继续向前到 360°，不再倒转回 0°；转完再折成 0°，下一圈方向不变。弹窗打开用 Apple 表单曲线（缩放 0.94、下移 18px、淡入，约 420ms），关闭反向收起（约 280ms）后再卸载。系统开启「减少动态效果」时仍立即完成。

- 缩放手感：倍率仍限制在 5%–4000%。滚轮一格从约 25% 改为约 12%，鼠标滚轮的这一步在几帧内滑到目标，触控板小步进仍当帧生效。按住放大/缩小不再每 110ms 跳 12%，改为按住后每帧连续变化（大约 0.7 秒放大一倍）。点按 +/- 与滚轮一格同为 12%；键盘 +/- 仍是 25%。

- 交互性能：弹层 DOM 只建一次，之后开关只做挂载/卸载；图集扫描改到首帧之后，打开不再被整段聊天里的图片测量挡住。标题栏拖动、滚轮缩放、图片平移都收成每帧一次合成层更新，拖动过程中不再读布局。窗口拖动用 `translate3d`，松手才提交位置。大图改为绝对定位，避免撑开对话框布局。翻页按钮和提示去掉 `backdrop-filter`，缩放和平移不再每帧重采样模糊。切图先解码再换图，并预取相邻图片，避免先闪到错误比例。滚轮改为按位移连续缩放（约 100px 仍是原来的 1.25 倍），触控板不再一格一跳。

- 顶栏信息行（尺寸旁）新增「格式 | 文件大小」：只显示值，不显示字段名；格式统一大写（JPG、PNG、SVG、BMP、WEBP、AVIF、ICO、TIFF、HEIC 等，优先取响应 content-type，回退到 URL 扩展名），大小按 <1K 用 B、<1M 用 KB、其余用 MB，KB/MB 保留 1 位小数。元数据按源缓存；对本地文件只读到响应头就中止请求，不重复下载整图。

- 遮罩覆盖窗口内容区（含应用自己的顶部工具条），但避开桌面壳的原生标题栏/菜单栏：Windows 下按 `--dsh-frame-chrome-top`（= 标题栏高度）决定遮罩起点，原生菜单栏不会被压暗，弹窗也拖不进该区域；全屏时该值归零，遮罩恢复整屏。点遮罩或按 Esc 关闭。
- 弹窗支持按住标题栏拖动（标题栏按钮仍是点击，不会误触发拖拽），位置夹紧在遮罩范围内（桌面端不进入原生标题栏区域）；窗口 resize 时已拖动的弹窗自动收回边界内。
- 新增 `clampPanelPosition` 纯函数并在冒烟测试里覆盖「自由移动 / 左上越界 / 右下越界 / 遮罩小于弹窗」四种情况。

- README 新增「让智能体真的发图：提示词建议」：把 `AGENTS.md` 里「图片一律内联」「界面验证以截图收尾」这类提示词整理成中英双语、可直接粘贴的片段，并补充 DSH 鉴权文件路由（`/api/file?path=`）、绝对路径要求与桌面端限制，说明为什么默认智能体不会发图、插件在什么条件下才被触发。中英两份 README 同步。
- 对齐官方插件基线：`dsh.manifestVersion: 1`；`engines.dsh` 保持 `>=0.2.1-rc.2 <0.3.0-0`，新增 `engines.node: >=22.19.0`；补 `publishConfig`，并在 `files` 中纳入 README、LICENSE、CHANGELOG、SECURITY。
- README 语言规范修正：英文为 `README.md`、中文为 `README.zh.md`，切换链接与冒烟测试列表同步更新；两份 README 的规范对齐表补 `manifestVersion`、DSH 与 Node engines 行。
- 新增 `SECURITY.md`：报告渠道、支持版本、权限边界与第三方数据说明。
- GitHub Actions Node 矩阵改为 22.19.0 / 24。

## 0.1.3

- 修正 `client.js` 的模块注册 id：包改名为 `dsh-image-viewer-pro` 后，注册 id 仍是 `@local/dsh-image-viewer-pro`，与 Host boot graph 的行 id（包名）不一致，浏览器加载时报 `loaded without registering "dsh-image-viewer-pro" via __ModuleLoader__.load`，整个插件不生效。现注册 id 与 `package.json` `name` 一致。
- 修正真实会话里图片（尤其是附件图与 `read_image` 结果）不触发查看器的问题：DSH 的 `MessageImage` 通过 `session.readAttachment()` 把附件图渲染成 `blob:` URL（无 `createObjectURL` 时退化成 `data:`），旧版 `isCandidate()` 主动排除了这两种源，导致聊天历史图片仍走官方预览。现已放开，仅排除空源。
- 标题优先使用图片的 `alt`（附件图没有可读文件名，旧版会显示 blob UUID）；`blob:` / `data:` 源的回退标题是「图片」。
- `data:` 源隐藏「新标签打开」按钮（浏览器禁止顶层导航到 data:）；`decodeURIComponent` 失败不再抛错。
- 键盘可访问性：新增焦点陷阱（Tab 只在弹层内循环）、打开时聚焦关闭按钮、关闭后把焦点还给触发控件。
- 关闭弹层时清理长按缩放的定时器、恢复宿主原有的 `documentElement.overflow`；切换图集时用 load token 忽略过期的图片加载回调。
- 冒烟测试扩为 12 组：注册 id、缩放/适配、文件名（含 blob/data/畸形转义）、bundle 契约、`dsh.bundle`/`dsh.client` 清单、发布文件与 exports、`cordis.patch.yml` 行、`screenshots.json`、locale、README 安装命令。
- 真实浏览器回归（headless Chrome + CDP）验证：插件注册成功、blob 附件图与 data: 图均能打开弹层、标题取 alt、Escape 关闭、零控制台错误。
- 跨域图片降级：远程 `http(s)` 图若被 CORS 拒绝，下载改为在新标签打开、复制退化为复制图片链接，不再只报「失败」；同源请求仍带会话 cookie。
- 图集改为按 DOM 节点身份而不是 `src` 去重：同一张图在会话里出现两次时，点第二张不会跳到第一张；会话滚动区不存在时只浏览当前图，不再把侧栏图片算进来。
- `[![alt](img)](url)` 这类链接内图片不再被劫持，链接正常打开；带修饰键（Ctrl/Cmd/Shift/Alt）的点击保持浏览器原生行为。
- `remote` / `remote.session` 从插件级硬依赖改为 `ctx.inject` 懒注入：Host 没有远程服务时查看器仍可用，只有「用默认应用打开」降级。
- 缩放输入框 Esc 现在是「取消」而不是「应用」；Ctrl/Cmd+滚轮交还浏览器缩放，`deltaY === 0` 不再缩放。
- 旋转后按适应比例重新适配；窗口 resize 只在「适应窗口」状态重算，用户手动缩放不再被重置。
- 下载文件名清洗并补扩展名（blob 附件名常为「图片」）；下载/复制加 AbortController，关窗即中止；进度提示节流为每 100ms 一次。
- a11y：弹层 `aria-label` 带文件名，图集计数 `aria-live="polite"`，Tab 焦点陷阱与关闭后焦点归还；移除未使用的提示文案。
- 样式标签补 `data-plugin`，HMR/卸载时随插件移除；卸载时清理长按定时器与滚动锁。
- 冒烟测试改为 `import()` 加载 ESM，Node 20 也能跑；`engines.dsh` 收紧为 `>=0.2.1-rc.2 <0.3.0-0`，排除 0.3.0 预发布。
- 新增 `screenshots.json`（市场截图）、`.github/workflows/test.yml`（Node 20/22/24 跑测试）、Release 预打包 tarball；README 中英双语重写，补 Web/桌面 profile 安装命令、Release tarball 安装、覆盖范围与已知限制。

## 0.1.2

- 修正 cordis.patch.yml 的插件行名：包已改名为 dsh-image-viewer-pro，原先仍写 @local/dsh-image-viewer-pro，从 GitHub 安装后该层无法解析（实测 --dump-config 复现）。

## 0.1.1

对齐 DSH 官方清单与 Web 样式规范：

- `package.json` 增加 `engines.dsh`（`>=0.2.1-rc.2 <0.3.0`）、`main`、`icon`、`exports["./package.json"]`，`files` 带上图标。
- 新增 `icon.svg`，插件卡片/详情可显示图标（需重启后由 Host 读取清单）。
- Web 样式合规：弹窗与侧翻页按钮改为 `border: 0` + `box-shadow: var(--dsw-elevation-panel)`（不再把中性 border 与 elevation 投影配对）；正圆补 `corner-shape: round`；缩放输入框改用 `--dsw-elevation-soft` 聚焦态；12px 文案补行高；新增 `prefers-reduced-motion` 降级。
- locale 描述同步「用默认应用打开」的现行为。

## 0.1.0

首个公开版本。

- 接管聊天中的内容图片（Markdown 图 / 附件图 / `read_image` 结果），替换官方仅有「关闭」的预览。
- 缩放：滚轮以指针为中心、可编辑百分比、长按 ± 连续调整，边界 5%–4000%。
- 平移、双击切换适应/原始、90° 旋转、图集左右切换（按钮 + 方向键）。
- 下载原图（带进度）与复制图片（自动转 PNG）。
- 「用默认应用打开」：本地图走 Host `session/openWorkspacePath`，远程图走默认浏览器。
- 弹窗使用 DSH 主题令牌；遮罩从窗口顶栏下沿开始，不遮挡宿主功能按钮。
- 纯 DOM 接管，不依赖 slot 契约；冒烟测试覆盖缩放边界、适配比例、文件名与注入声明。
