# dsh-image-viewer-pro

给 DeepSeek Harness 换一个**真正能用的图片查看器**。

官方点击图片后只有一个「关闭」按钮 —— 看不清、不能放大、不能下载。本插件接管聊天里所有内容图片（Markdown 图、附件图、`read_image` 结果），换成带缩放、平移、旋转、下载、复制和图集浏览的弹窗。

## 功能

- **缩放**：滚轮以指针为中心缩放；底部 `− [百分比] +`，百分比可直接输入（回车生效，Esc 取消）；长按 ± 连续调整。
- **平移**：拖动图片平移；双击在「适应窗口 / 原始大小」之间切换。
- **旋转**：每次 90°，用于看竖拍/横拍。
- **下载原图**：带进度提示，完成后保存到系统下载目录。
- **复制图片**：写入剪贴板（自动转 PNG）。
- **图集浏览**：同一会话里的多张图可用左右圆形按钮或 `←` / `→` 切换，显示 `当前 / 总数`。
- **用默认应用打开**：本站图片交给系统默认应用打开（图片查看器），远程 `http(s)` 图片交给默认浏览器。
- **原生观感**：遮罩用 DSH 的主题令牌，弹窗跟随亮/暗主题；顶部让出窗口功能按钮，不会被挡。

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

### 方式一：DSH 插件页

1. 打开 **插件 → 添加插件**
2. 填入包名或地址：

```text
github:NingYuanLee/dsh-image-viewer-pro
```

3. 按提示刷新或重启 DSH。

### 方式二：命令行

```sh
dsh plugin --profile desktop add github:NingYuanLee/dsh-image-viewer-pro
```

> 桌面端修改 profile 后需要重启 DSH 才能加载新插件。

## 卸载

```sh
dsh plugin --profile desktop remove dsh-image-viewer-pro
```

或在插件页停用 / 移除。卸载后恢复 DSH 官方预览，不会删除任何会话或图片。

## 兼容性

- 已在 DSH `0.2.1-rc.2`（Web GUI / 桌面端）实机验证。
- 实现方式是**捕获阶段接管 `<img>` 点击 + 纯 DOM 弹层**，不依赖官方 slot 契约，因此对图片位调整不敏感。
- 需要 `remote` / `remote.session` 服务（用于「用默认应用打开」）；服务不可用时该按钮退化为提示。

## 开发

```sh
git clone https://github.com/NingYuanLee/dsh-image-viewer-pro.git
cd dsh-image-viewer-pro
npm test
```

本地联调：把本目录以 `link:` 依赖装进 profile，改完刷新页面即可（首次加载新插件需重启一次）。

目录说明：

| 文件 | 作用 |
| --- | --- |
| `client.js` | 浏览器侧全部逻辑（图标、弹窗、手势、下载、复制） |
| `index.js` | Host 侧占位入口，让包成为可被 Loader 扫描的 bundle |
| `cordis.patch.yml` | 向 profile 插入 Loader 条目 |
| `test/smoke.test.cjs` | 纯函数冒烟测试（缩放边界、适配比例、文件名、注入声明） |

## 隐私

- 不发起任何第三方网络请求，不读取模型凭据。
- 下载 / 复制只操作当前图片；「用默认应用打开」通过 DSH Host 的本地能力完成。

## 已知限制

- 图标为 16px 内联 SVG，`1:1` 数字在小尺寸下略密。
- 仅适配 DSH Web GUI 与桌面端（同为 Web 渲染层）。

## License

MIT © 2026 [NingYuanLee](https://github.com/NingYuanLee)
