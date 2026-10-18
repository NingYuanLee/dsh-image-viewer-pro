# Changelog

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
