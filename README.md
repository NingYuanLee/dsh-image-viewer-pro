# dsh-image-viewer-pro

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.1--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)
[![release](https://img.shields.io/github/v/release/NingYuanLee/dsh-image-viewer-pro?sort=semver)](https://github.com/NingYuanLee/dsh-image-viewer-pro/releases)

**给 DeepSeek Harness 聊天里的图片一个真正能用的查看器。** 滚轮缩放、拖动平移、90° 旋转、下载原图、复制、用默认应用打开、跨会话图集浏览 —— 替换官方只有「关闭」按钮的预览弹窗。

[English](README.en.md) | 中文

![查看器预览](docs/preview.png)

## 为什么装它

DSH 0.2.1-rc.2 的图片预览只提供「关闭」：看不清小字、不能放大、不能平移、不能下载、不能旋转，也无法在同一个会话的多张图之间切换。本插件在**捕获阶段接管内容图片的点击**，用自绘弹层替换它 —— 不依赖官方 slot 契约，因此对官方图片位的调整不敏感。

## 功能

- **缩放**：滚轮以指针为中心缩放；底部 `− [百分比] +`，百分比可直接输入（回车生效，Esc 取消）；按住 ± 连续调整。
- **平移**：拖动画布平移；双击在「适应窗口 / 原始大小」之间切换。
- **旋转**：每次 90°，方便看竖拍/横拍。
- **下载原图**：带进度提示，完成后保存到系统下载目录。
- **复制图片**：写入剪贴板（非 PNG 自动转 PNG）。
- **图集浏览**：同一会话里的多张图用左右圆形按钮或 `←` / `→` 切换，显示 `当前 / 总数`。
- **用默认应用打开**：本地文件走 Host 的 `session.openWorkspacePath`（系统默认图片查看器），远程 `http(s)` 图片交给默认浏览器。
- **原生观感**：遮罩与弹层使用 DSH 主题令牌，跟随亮/暗主题；顶部让出窗口功能按钮，不会被遮挡；支持 `prefers-reduced-motion`。

## 覆盖范围

| 图片 | 是否接管 |
| --- | --- |
| 聊天正文的 Markdown 图（`![](...)`，http(s) / 本站文件路由） | ✅ |
| 用户与助手消息里的附件图（DSH 以 `blob:` URL 渲染） | ✅ |
| `read_image` 等工具结果里的图片缩略图/大图（同样经附件通道） | ✅ |
| 小于 48px 的图标、头像、状态图 | ❌ 保持原生 |
| 插件弹层自身的图片（防递归） | ❌ |

接管只作用于点击行为：不修改消息内容、不写会话数据，关闭弹层后页面恢复原样。

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Esc` | 关闭（输入框聚焦时先退出输入） |
| `+` / `=` | 放大 |
| `-` | 缩小 |
| `0` | 适应窗口 |
| `1` | 原始大小（1:1） |
| `R` | 旋转 90° |
| `←` / `→` | 上一张 / 下一张 |
| 双击 | 适应窗口 ↔ 原始大小 |

## 安装

本插件是纯 JavaScript 的 DSH bundle（`package.json` 声明 `dsh.bundle`），**无需构建、无需授权构建脚本**，装完刷新页面即可（首次加载新插件建议重启一次 DSH）。

### 方式一：DSH 插件页

1. 打开 **插件 → 添加插件**
2. 填入包名或地址：

```text
github:NingYuanLee/dsh-image-viewer-pro
```

3. 按提示刷新或重启 DSH。

### 方式二：命令行

Web 端（`dsh web` 使用的 profile）：

```sh
dsh plugin --profile web add github:NingYuanLee/dsh-image-viewer-pro
```

桌面端：

```sh
dsh plugin --profile desktop add github:NingYuanLee/dsh-image-viewer-pro
```

> 把 `--profile` 换成你实际启动的 profile 名即可。GitHub 源安装拉取源码，本插件没有 `prepare` 脚本，因此不会触发 pnpm 的 `allowBuilds` 授权。

### 方式三：Release tarball

不想让包管理器拉源码时，可直接安装预打包产物：

```sh
dsh plugin --profile web add https://github.com/NingYuanLee/dsh-image-viewer-pro/releases/latest/download/dsh-image-viewer-pro.tgz
```

## 卸载

```sh
dsh plugin --profile web remove dsh-image-viewer-pro
```

或在插件页停用 / 移除。卸载后恢复 DSH 官方预览，不会删除任何会话或图片。

## 兼容性

- 已在 **DSH `0.2.1-rc.2`**（Web GUI / 桌面端，同为 Web 渲染层）实机验证。
- 声明 `engines.dsh: >=0.2.1-rc.2 <0.3.0`，安装与启动时会校验。
- 依赖 Host 的 `remote` / `remote.session` 服务（「用默认应用打开」）；服务不可用时按钮退化为提示，不影响其他功能。

## 与 DSH 插件规范的对齐

对照官方《打包与安装插件》文档与社区 awesome-dsh-plugin 收录要求自查：

| 要求 | 状态 |
| --- | --- |
| `package.json` 声明 `dsh.bundle`（可被 `dsh plugin add` 安装） | ✅ `dsh.bundle.patch` |
| 仓库根提供 `cordis.patch.yml`，行名与包名一致 | ✅ `name: dsh-image-viewer-pro` |
| 声明支持的 DSH 版本 | ✅ `engines.dsh` |
| 官方 `@deepseek-ai/*` 包用 `peerDependencies` 声明 | ✅ 不 import 任何官方包，无需 peer |
| 插件元信息（标题/描述/图标） | ✅ `locale/{zh,en}.json` + `icon.svg` |
| 无构建步骤即可安装 | ✅ 纯 JS，已实测 `dsh plugin add github:...` |
| 市场截图声明 | ✅ 根目录 `screenshots.json` |
| 仓库 topic `dsh-plugin` | ✅ |
| 真实可用代码 + 测试 | ✅ `npm test`（离线冒烟 + 清单一致性）、GitHub Actions |
| Web 样式规范（语义 token、elevation 与 border 不配对、正圆 `corner-shape`、减少动效） | ✅ 见 `client.js` 的 `CSS` 常量 |

## 开发

```sh
git clone https://github.com/NingYuanLee/dsh-image-viewer-pro.git
cd dsh-image-viewer-pro
npm test
```

本地联调：把本目录以 `link:` 依赖装进 profile，改完刷新页面即可（首次加载新插件需重启一次）。

| 文件 | 作用 |
| --- | --- |
| `client.js` | 浏览器侧全部逻辑（图标、弹层、手势、下载、复制、图集） |
| `index.js` | Host 侧占位入口，让包成为可被 Loader 扫描的 bundle |
| `cordis.patch.yml` | 向 profile 插入 Loader 条目 |
| `test/smoke.test.cjs` | 离线冒烟测试 + 清单/注册 id/文案一致性校验 |
| `screenshots.json` | 插件市场截图清单（1–8 张，相对路径） |

## 隐私

- 不发起任何第三方网络请求，不读取模型凭据。
- 下载 / 复制只操作当前图片；「用默认应用打开」通过 DSH Host 的本地能力完成。
- 接管只发生在点击事件上，不注入消息内容、不改会话记录。

## 已知限制

- 小于 48px 的图标、头像与状态图保持原生（见上方覆盖范围）。
- 远程跨域图片由浏览器直接显示；若对方服务端未开放 CORS，下载会改为在新标签打开，复制会退化为复制图片链接。
- 图标为 16px 内联 SVG，`1:1` 图标在小尺寸下略密。
- 仅适配 DSH Web GUI 与桌面端（同为 Web 渲染层）。
- 图集按当前会话滚动区里已渲染的图片统计；极端虚拟滚动场景下只能浏览已挂载的图片。

## License

MIT © 2026 [NingYuanLee](https://github.com/NingYuanLee)
