// The loader keys bundles by the package name the Host puts on the boot graph
// row (`window.__DSH_BOOT__.entries[].id`), so this id must stay identical to
// `package.json` `name` — a scope-prefixed leftover silently fails registration.
window.__ModuleLoader__.load({
  id: 'dsh-image-viewer-pro',
  factory() {
    'use strict'

    const LANG = String(document.documentElement?.lang || navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'

    const T = {
      zh: {
        title: '图片查看',
        close: '关闭',
        zoomIn: '放大',
        zoomOut: '缩小',
        fit: '适应窗口',
        actual: '原始大小',
        rotateCw: '顺时针旋转 90°',
        rotateCcw: '逆时针旋转 90°',
        rotation: '当前角度',
        download: '下载原图',
        downloading: '下载中',
        downloaded: '已下载',
        downloadFailed: '下载失败',
        downloadFallback: '已在新标签打开，请在浏览器中保存',
        copied: '已复制图片',
        copyFailed: '复制失败',
        copyLink: '已复制图片链接',
        copy: '复制图片',
        openTab: '新标签打开',
        openLocal: '用默认应用打开',
        reveal: '显示文件位置',
        defaultMark: '（默认）',
        openAppsFailed: '无法读取可打开此文件的应用',
        openFailed: '无法用默认应用打开',
        openUnavailable: '当前环境不支持打开本地文件（请在桌面端使用）',
        zoomInput: '缩放比例，可输入百分比后回车',
        prev: '上一张',
        next: '下一张',
        of: '张',
        image: '图片',
      },
      en: {
        title: 'Image viewer',
        close: 'Close',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        fit: 'Fit to window',
        actual: 'Actual size',
        rotateCw: 'Rotate 90° clockwise',
        rotateCcw: 'Rotate 90° counterclockwise',
        rotation: 'Current rotation',
        download: 'Download original',
        downloading: 'Downloading',
        downloaded: 'Downloaded',
        downloadFailed: 'Download failed',
        downloadFallback: 'Opened in a new tab — save it from there',
        copied: 'Image copied',
        copyFailed: 'Copy failed',
        copyLink: 'Image link copied',
        copy: 'Copy image',
        openTab: 'Open in new tab',
        openLocal: 'Open with default app',
        reveal: 'Show file location',
        defaultMark: ' (default)',
        openAppsFailed: 'Could not list apps for this file',
        openFailed: 'Could not open with the default app',
        openUnavailable: 'Opening local files is unavailable here',
        zoomInput: 'Zoom percentage — type a value and press Enter',
        prev: 'Previous',
        next: 'Next',
        of: 'of',
        image: 'image',
      },
    }[LANG]

    const MIN_SCALE = 0.05
    const MAX_SCALE = 40
    const FIT_PADDING = 32
    const ROOT_CLASS = 'dsh-iv'
    const STYLE_ID = 'dsh-image-viewer-pro'

    /**
     * Pointer and wheel events arrive faster than the display. Applying each
     * one forces style work the compositor then throws away, so gestures share
     * one update per frame.
     */
    const frame = {
      id: 0,
      jobs: [],
      schedule(job) {
        this.jobs.push(job)
        if (this.id !== 0) return
        this.id = requestAnimationFrame(() => {
          this.id = 0
          const batch = this.jobs.splice(0, this.jobs.length)
          for (const job of batch) job()
        })
      },
      cancel() {
        if (this.id !== 0) cancelAnimationFrame(this.id)
        this.id = 0
        this.jobs.length = 0
      },
    }

    /**
     * One mouse notch (~100px) changes the scale by 12%. The old 25% step read
     * as a pop. Trackpad ticks are much smaller and stay continuous.
     * Scale itself is clamped to {@link MIN_SCALE}–{@link MAX_SCALE} (5%–4000%).
     */
    const ZOOM_PER_PX = Math.log(1.12) / 100
    /** A +/- tap matches one wheel notch. Keyboard +/- keeps the larger step. */
    const CLICK_STEP = 1.12
    /** Held +/- doubles the scale about every 0.7s, advanced one frame at a time. */
    const HOLD_RATE = Math.log(2) / 0.7
    const HOLD_DELAY = 220
    /** At least this much wheel travel in one event is a mouse notch, not a trackpad tick. */
    const WHEEL_NOTCH = 60

    /** Smallest/largest bound clamp. */
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value))
    }

    /**
     * Scale that fits one natural image size inside a stage box without enlarging
     * small images past 1:1.
     */
    function fitScale(naturalWidth, naturalHeight, boxWidth, boxHeight) {
      if (!naturalWidth || !naturalHeight || !boxWidth || !boxHeight) return 1
      return Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight, 1)
    }

    /** File name for an image source: `?path=` targets keep their basename. */
    function fileNameOf(src) {
      const text = String(src || '')
      // Blob and data URLs carry no readable name; callers fall back to alt text.
      if (text === '' || text.startsWith('blob:') || text.startsWith('data:')) return T.image
      try {
        const url = new URL(text, window.location.href)
        const target = url.searchParams.get('path')
        const candidate = target !== null && target !== '' ? target : url.pathname
        const base = candidate.split(/[\\/]/).filter(Boolean).pop() || T.image
        try {
          return decodeURIComponent(base) || T.image
        } catch {
          return base
        }
      } catch {
        const base = text.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).pop()
        return base === undefined ? T.image : base
      }
    }

    /** Human zoom percentage for the info line. */
    function percentOf(scale) {
      return `${Math.round(scale * 100)}%`
    }

    /** Content-type spellings whose subtype is not the user-facing format name. */
    const CONTENT_TYPE_FORMATS = {
      'image/jpeg': 'JPG',
      'image/jpg': 'JPG',
      'image/pjpeg': 'JPG',
      'image/svg+xml': 'SVG',
      'image/x-icon': 'ICO',
      'image/vnd.microsoft.icon': 'ICO',
      'image/x-ms-bmp': 'BMP',
      'image/x-bmp': 'BMP',
    }

    /** URL extensions mapped to the same uppercase labels. */
    const EXTENSION_FORMATS = {
      jpg: 'JPG',
      jpeg: 'JPG',
      jfif: 'JPG',
      png: 'PNG',
      apng: 'APNG',
      gif: 'GIF',
      webp: 'WEBP',
      svg: 'SVG',
      bmp: 'BMP',
      avif: 'AVIF',
      ico: 'ICO',
      tif: 'TIFF',
      tiff: 'TIFF',
      heic: 'HEIC',
      heif: 'HEIF',
    }

    /**
     * File size label: bytes below 1K stay whole bytes, below 1M become KB with
     * one decimal, anything larger becomes MB with one decimal.
     * @param bytes - decoded byte length; unusable input yields an empty label.
     */
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return ''
      if (bytes < 1024) return `${Math.round(bytes)} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    /**
     * Uppercase format label for one source. The declared content type wins over
     * the URL, so `/api/file?path=…` and blob:/data: sources are labelled
     * correctly; a recognised URL extension is the fallback when no type exists.
     * @returns the label, or '' when neither source names a format.
     */
    function formatOf(src, contentType) {
      const type = String(contentType || '').split(';')[0].trim().toLowerCase()
      if (type.startsWith('image/')) {
        if (CONTENT_TYPE_FORMATS[type] !== undefined) return CONTENT_TYPE_FORMATS[type]
        const subtype = type.slice('image/'.length).split('+')[0].trim()
        if (subtype !== '') return subtype.toUpperCase()
      }
      const text = String(src || '')
      // data: URLs carry their own media type even when nothing was fetched.
      const data = /^data:image\/([a-z0-9.+-]+)[;,]/i.exec(text)
      if (data !== null) {
        const subtype = data[1].toLowerCase().split('+')[0]
        if (subtype !== '') return subtype.toUpperCase()
      }
      try {
        const url = new URL(text, 'http://localhost/')
        const target = url.searchParams.get('path') ?? url.pathname
        const base = target.split(/[\\/]/).filter(Boolean).pop() ?? ''
        const dot = base.lastIndexOf('.')
        const extension = dot === -1 ? '' : base.slice(dot + 1).toLowerCase()
        if (EXTENSION_FORMATS[extension] !== undefined) return EXTENSION_FORMATS[extension]
      } catch {
        // A malformed source simply has no extension to read.
      }
      return ''
    }

    /** Metadata is stable per source, so re-opening an image skips the request. */
    const metaCache = new Map()
    const META_CACHE_LIMIT = 48
    /** Neighbours kept decoded: the current picture plus the previous and next. */
    const DECODED_LIMIT = 3
    /** Clipboard re-encode stops at this long edge so a huge photo cannot pin a giant canvas. */
    const MAX_COPY_EDGE = 4096

    /**
     * Remember one metadata record. data: URLs are not stored: the key would be
     * the whole base64 payload and would keep it alive after the message is gone.
     */
    function rememberMeta(src, result) {
      if (String(src).startsWith('data:')) return
      if (metaCache.has(src)) metaCache.delete(src)
      metaCache.set(src, result)
      while (metaCache.size > META_CACHE_LIMIT) metaCache.delete(metaCache.keys().next().value)
    }

    /** Drop a probe image so its decoded bitmap can be collected. */
    function releaseImage(node) {
      node.onload = null
      node.onerror = null
      node.removeAttribute('src')
    }

    function releaseDecoded() {
      for (const node of decoded.values()) releaseImage(node)
      decoded.clear()
    }

    /**
     * Read one source's format and byte size. The body is not needed when the
     * response advertises its length (the usual case for local files), so that
     * request is aborted right after the headers; blob:/data: sources fall back
     * to the decoded blob size. A source the browser refuses to fetch keeps the
     * URL-derived format and omits the size.
     * @returns `{ format, bytes }`, where `bytes` may be `undefined`.
     */
    async function metaOf(src, signal) {
      const cached = metaCache.get(src)
      if (cached !== undefined) return cached
      const fallback = { format: formatOf(src), bytes: undefined }
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      try {
        const response = await fetchImage(src, controller.signal)
        const type = String(response.headers.get('content-type') || '')
        const declared = Number(response.headers.get('content-length'))
        let result
        if (Number.isFinite(declared) && declared > 0) {
          result = { format: formatOf(src, type), bytes: declared }
          controller.abort()
        } else {
          const blob = await response.blob()
          result = { format: formatOf(src, type || blob.type), bytes: blob.size }
        }
        // A dialog closed mid-flight must not seed the cache with a guess.
        if (signal?.aborted !== true) rememberMeta(src, result)
        return result
      } catch (error) {
        if (error?.name !== 'AbortError' && signal?.aborted !== true) {
          console.warn('image-viewer-pro: image metadata unavailable', error)
        }
        return fallback
      } finally {
        signal?.removeEventListener('abort', abort)
      }
    }

    /**
     * Height of the desktop frame's own top chrome — the Windows caption row that
     * carries the native menu and window buttons. Modals must not paint over it,
     * so the mask (and therefore the dialog's drag area) starts below it. The
     * official modal CSS uses the same `--dsh-frame-chrome-top` variable; plain
     * browser documents publish nothing and get 0, which keeps the whole page
     * masked there.
     * @returns pixels to inset the viewer from the top of the viewport.
     */
    let chromeTopCache
    function frameChromeTop() {
      if (chromeTopCache !== undefined) return chromeTopCache
      const style = getComputedStyle(document.documentElement)
      const declared = Number.parseFloat(style.getPropertyValue('--dsh-frame-chrome-top'))
      if (Number.isFinite(declared)) {
        chromeTopCache = Math.max(0, Math.round(declared))
        return chromeTopCache
      }
      // Older shells published only the caption height next to the Windows marker.
      const caption = Number.parseFloat(style.getPropertyValue('--dsh-windows-titlebar-height'))
      chromeTopCache = Number.isFinite(caption) ? Math.max(0, Math.round(caption)) : 0
      return chromeTopCache
    }

    /**
     * Clamp a dialog's top-left corner so the whole box stays inside the mask.
     * The overlay is also the drag area, so the dialog may reach any edge of it
     * but never leave it (and never slide out of the visible window).
     * @returns the bounded `left`/`top` offsets relative to the mask.
     */
    function clampPanelPosition(left, top, width, height, boxWidth, boxHeight) {
      return {
        left: clamp(left, 0, Math.max(0, boxWidth - width)),
        top: clamp(top, 0, Math.max(0, boxHeight - height)),
      }
    }

    const CSS = `
      .${ROOT_CLASS}{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14,13px/20px system-ui,-apple-system,"Segoe UI",sans-serif);user-select:none;isolation:isolate}
      .${ROOT_CLASS}-backdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,#0000003d);backdrop-filter:var(--dsw-mask-blur,none);transform:translateZ(0);animation:${ROOT_CLASS}-fade .32s cubic-bezier(0.32, 0.72, 0, 1) backwards}
      @keyframes ${ROOT_CLASS}-fade{from{opacity:0}to{opacity:1}}
      .${ROOT_CLASS}-panel{position:relative;display:flex;flex-direction:column;width:min(1200px,94vw);height:min(860px,86vh);overflow:hidden;border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #00000029,0 3px 8px #00000008);contain:layout;transform:translateZ(0);transform-origin:center center;animation:${ROOT_CLASS}-pop .42s cubic-bezier(0.32, 0.72, 0, 1) backwards}
      @keyframes ${ROOT_CLASS}-pop{from{opacity:0;transform:translate3d(0,18px,0) scale(.94)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}
      .${ROOT_CLASS}[data-state=closing]{pointer-events:none}
      .${ROOT_CLASS}[data-state=closing] .${ROOT_CLASS}-backdrop{animation:${ROOT_CLASS}-fade-out .22s cubic-bezier(0.4, 0, 1, 1) forwards}
      .${ROOT_CLASS}[data-state=closing] .${ROOT_CLASS}-panel{animation:${ROOT_CLASS}-pop-out .28s cubic-bezier(0.4, 0, 1, 1) forwards}
      @keyframes ${ROOT_CLASS}-fade-out{from{opacity:1}to{opacity:0}}
      @keyframes ${ROOT_CLASS}-pop-out{from{opacity:1;transform:translate3d(0,0,0) scale(1)}to{opacity:0;transform:translate3d(0,10px,0) scale(.96)}}
      .${ROOT_CLASS}-header{display:flex;align-items:center;gap:10px;flex:none;padding:12px 10px 10px 16px;cursor:grab;touch-action:none}
      .${ROOT_CLASS}-panel[data-dragging] .${ROOT_CLASS}-header{cursor:grabbing}
      .${ROOT_CLASS}-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
      .${ROOT_CLASS}-meta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .${ROOT_CLASS}-meta-row{display:flex;align-items:center;gap:6px;flex:none}
      .${ROOT_CLASS}-meta-sep{opacity:.45}
      .${ROOT_CLASS}-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:grab;touch-action:none;background:var(--dsw-alias-bg-document-preview,#f2f3f5);contain:layout paint}
      .${ROOT_CLASS}-stage[data-panning]{cursor:grabbing}
      /* Out of flow so a multi-megapixel bitmap cannot stretch the dialog's layout.
         Hit-testing the transformed bitmap is skipped; the stage handles the gestures. */
      .${ROOT_CLASS}-img{position:absolute;left:50%;top:50%;z-index:2;width:max-content;height:max-content;max-width:none;max-height:none;margin:0;will-change:transform,opacity;border-radius:4px;box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #00000029,0 3px 8px #00000008);background:var(--dsw-alias-bg-base,#fff);transform-origin:center center;transform:translate3d(0,0,0) translate(-50%,-50%);-webkit-user-drag:none;pointer-events:none;backface-visibility:hidden}
      .${ROOT_CLASS}-page{position:absolute;inset:0;z-index:1;pointer-events:none;will-change:transform,opacity}
      .${ROOT_CLASS}-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;flex:none;padding:8px 10px;border-top:.5px solid var(--dsw-alias-border-l3,#0000001f);background:var(--dsw-alias-bg-base,#fff)}
      .${ROOT_CLASS}-left{display:flex;align-items:center;gap:6px}
      .${ROOT_CLASS}-center{display:flex;align-items:center;gap:6px;justify-self:center}
      .${ROOT_CLASS}-right{display:flex;align-items:center;gap:6px;justify-self:end}
      .${ROOT_CLASS}-readout{display:flex;align-items:center;gap:8px;padding:0 8px 0 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
      .${ROOT_CLASS}-zoom{width:44px;height:22px;padding:0;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:center;outline:none}
      .${ROOT_CLASS}-zoom:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-zoom:focus{background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-elevation-soft,0 0 0 .5px var(--dsw-alias-border-l3,#0000001f));color:var(--dsw-alias-label-primary)}
      .${ROOT_CLASS}-degbox{display:inline-flex;align-items:center}
      .${ROOT_CLASS}-deg{width:40px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:center}
      .${ROOT_CLASS}-spacer{flex:1}
      .${ROOT_CLASS}-divider{width:.5px;height:18px;background:var(--dsw-alias-border-l3,#0000001f);flex:none}
      .${ROOT_CLASS}-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
      .${ROOT_CLASS}-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:-2px}
      .${ROOT_CLASS}-btn:disabled{opacity:.45;cursor:default}
      .${ROOT_CLASS}-btn[hidden]{display:none}
      .${ROOT_CLASS}-btn[data-primary]{background:var(--dsw-alias-state-business-primary,#4176e6);color:#fff}
      .${ROOT_CLASS}-btn[data-primary]:hover{filter:brightness(1.05)}
      .${ROOT_CLASS}-open{position:relative;display:inline-flex;align-items:stretch;height:24px;border-radius:9px;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2,#00000029);overflow:hidden;flex:none}
      .${ROOT_CLASS}-open[hidden]{display:none}
      .${ROOT_CLASS}-open-main,.${ROOT_CLASS}-open-more{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit;padding:0;cursor:pointer}
      .${ROOT_CLASS}-open-main{width:28px}
      .${ROOT_CLASS}-open-more{width:22px;box-shadow:-.5px 0 0 var(--dsw-alias-border-l3,#0000001f)}
      .${ROOT_CLASS}-open-main:hover,.${ROOT_CLASS}-open-more:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-open-more[hidden]{display:none}
      .${ROOT_CLASS}-open-icon{width:16px;height:16px;object-fit:contain;display:block}
      .${ROOT_CLASS}-open-icon[hidden],.${ROOT_CLASS}-open-fallback[hidden],.${ROOT_CLASS}-open-skeleton[hidden]{display:none}
      .${ROOT_CLASS}-open-skeleton{width:16px;height:16px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,#00000014)}
      .${ROOT_CLASS}-open.is-loading .${ROOT_CLASS}-open-skeleton{display:block}
      .${ROOT_CLASS}-open.is-loading .${ROOT_CLASS}-open-icon,.${ROOT_CLASS}-open.is-loading .${ROOT_CLASS}-open-fallback{display:none}
      .${ROOT_CLASS}-open-menu{position:absolute;z-index:3;min-width:196px;max-width:280px;max-height:280px;overflow:auto;padding:4px;border-radius:12px;background:var(--dsw-specific-menu,#fff);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary)}
      .${ROOT_CLASS}-open-menu[hidden]{display:none}
      .${ROOT_CLASS}-open-item{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;border:0;border-radius:8px;background:transparent;padding:4px 8px;color:inherit;font:inherit;text-align:left;cursor:pointer}
      .${ROOT_CLASS}-open-item:hover,.${ROOT_CLASS}-open-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-open-item-icon{width:16px;height:16px;object-fit:contain;flex:none}
      .${ROOT_CLASS}-open-item-icon[hidden]{display:none}
      .${ROOT_CLASS}-open-sep{height:.5px;margin:4px 6px;background:var(--dsw-alias-border-l3,#0000001f)}
      .${ROOT_CLASS}-open-note{padding:6px 8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .${ROOT_CLASS}-icon{display:block}
      /* Side paging arrows sit on top of the moving image. A backdrop blur here
         would be resampled on every pan/zoom frame, so the fill stays opaque. */
      .${ROOT_CLASS}-nav{position:absolute;top:50%;z-index:3;transform:translateY(-50%);width:36px;height:36px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;corner-shape:round;background:var(--dsw-specific-menu,#f8f9fa);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);cursor:pointer;opacity:.8;transition:opacity .08s ease,background-color .08s ease}
      .${ROOT_CLASS}-nav:hover,.${ROOT_CLASS}-nav:focus-visible{opacity:1;background:var(--dsw-alias-bg-base,#fff)}
      .${ROOT_CLASS}-nav:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:1px}
      .${ROOT_CLASS}-nav[data-side=left]{left:12px}
      .${ROOT_CLASS}-nav[data-side=right]{right:12px}
      .${ROOT_CLASS}-nav[hidden]{display:none}
      .${ROOT_CLASS}-toast{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);padding:7px 14px;border-radius:var(--dsw-radius-md,12px);background:var(--dsw-specific-menu,#f8f9fa);box-shadow:var(--dsw-elevation-panel);border:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;opacity:0;pointer-events:none;transition:opacity .08s ease}
      .${ROOT_CLASS}-toast[data-visible]{opacity:1}
      @media (prefers-reduced-motion: reduce){
        .${ROOT_CLASS}-panel,.${ROOT_CLASS}-backdrop,
        .${ROOT_CLASS}[data-state=closing] .${ROOT_CLASS}-panel,
        .${ROOT_CLASS}[data-state=closing] .${ROOT_CLASS}-backdrop{animation:none}
        .${ROOT_CLASS}-nav,.${ROOT_CLASS}-toast,.${ROOT_CLASS}-img,.${ROOT_CLASS}-page{transition:none}
      }
    `

    /** One 16px stroked icon; every toolbar control is icon-only. */
    const ICON_PATHS = {
      minus: ['M3 8h10'],
      plus: ['M8 3v10', 'M3 8h10'],
      fit: ['M2 6V2h4', 'M14 6V2h-4', 'M2 10v4h4', 'M14 10v4h-4'],
      // "1:1" drawn as strokes so it carries the same weight as every other
      // icon instead of looking like a smaller, thinner text label.
      actual: ['M4.1 4.7v6.6', 'M3.2 6.3 4.1 4.7', 'M8 6.5h.01', 'M8 9.5h.01', 'M11.9 4.7v6.6', 'M11 6.3 11.9 4.7'],
      // Conventional circular rotate: a 270° arc with an arrowhead bracket at
      // the open end, matching the other 16px stroke icons.
      rotate: ['M13.5 8a5.5 5.5 0 1 1-1.7-4.05', 'M11.8 1.6v2.6h-2.6'],
      rotateCcw: ['M2.5 8a5.5 5.5 0 1 0 1.7-4.05', 'M4.2 1.6v2.6h2.6'],
      download: ['M8 2.5v8', 'M4.5 7.5 8 11l3.5-3.5', 'M2.5 13.5h11'],
      copy: ['M5.5 2.5h8v8', 'M2.5 5.5h8v8h-8z'],
      open: ['M6.5 3H3v10h10V9.5', 'M9.5 2.5H14V7', 'M14 2.5 8 8.5'],
      app: ['M3.2 3.2h9.6v9.6H3.2z', 'M3.2 6h9.6'],
      chevron: ['M4.5 6.2 8 9.8l3.5-3.6'],
      close: ['M4 4l8 8', 'M12 4l-8 8'],
    }

    /** Numeric sub-labels that sit inside a stroked icon. */
    const ICON_TEXT = {}

    /**
     * Build one stroked icon element.
     * @param name - key in {@link ICON_PATHS}.
     * @returns the svg node.
     */
    function icon(name) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 16 16')
      svg.setAttribute('width', '16')
      svg.setAttribute('height', '16')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')
      svg.setAttribute('class', `${ROOT_CLASS}-icon`)
      for (const d of ICON_PATHS[name] ?? ICON_PATHS.close) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        node.setAttribute('d', d)
        node.setAttribute('fill', 'none')
        node.setAttribute('stroke', 'currentColor')
        node.setAttribute('stroke-width', '1.6')
        node.setAttribute('stroke-linecap', 'round')
        node.setAttribute('stroke-linejoin', 'round')
        svg.appendChild(node)
      }
      const label = ICON_TEXT[name]
      if (label !== undefined) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        node.setAttribute('x', label.x)
        node.setAttribute('y', label.y)
        node.setAttribute('text-anchor', 'middle')
        node.setAttribute('dominant-baseline', 'central')
        node.setAttribute('font-size', label.size)
        node.setAttribute('font-weight', label.weight)
        node.setAttribute('letter-spacing', '-0.2')
        node.setAttribute('fill', 'currentColor')
        node.textContent = label.text
        svg.appendChild(node)
      }
      return svg
    }

    /** Inline chevron so the glyph is geometrically centred in its circle. */
    function chevron(side) {
      const path = side === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 16 16')
      svg.setAttribute('width', '16')
      svg.setAttribute('height', '16')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')
      svg.setAttribute('class', `${ROOT_CLASS}-icon`)
      const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathNode.setAttribute('d', path)
      pathNode.setAttribute('fill', 'none')
      pathNode.setAttribute('stroke', 'currentColor')
      pathNode.setAttribute('stroke-width', '1.6')
      pathNode.setAttribute('stroke-linecap', 'round')
      pathNode.setAttribute('stroke-linejoin', 'round')
      svg.appendChild(pathNode)
      return svg
    }

    /** Is this `<img>` something the viewer should take over? */
    function isCandidate(img) {
      if (!(img instanceof HTMLImageElement)) return false
      if (img.closest(`.${ROOT_CLASS}`) !== null) return false
      const src = img.currentSrc || img.src || ''
      // Only an empty source is unusable: DSH renders message attachments
      // (including read_image results) as blob: URLs, and inline data: images
      // are content too, so both stay eligible here.
      if (src === '') return false
      // Icons and avatars stay native: only content images are worth a viewer.
      // Judge by the long edge so thin banner-style content still qualifies.
      const width = img.naturalWidth || img.width || 0
      const height = img.naturalHeight || img.height || 0
      if (Math.max(width, height) < 48) return false
      const rendered = img.getBoundingClientRect()
      return rendered.width >= 48 || rendered.height >= 48
    }

    /** Every viewer-eligible image around the clicked one, for ←/→ browsing. */
    function galleryOf(img) {
      // Stay inside the conversation scrollport: falling back to document.body
      // would drag sidebar and settings images into the gallery. Nodes are kept
      // by identity (not by src) so two renders of one image still map back.
      // Cheap rejects happen before the single layout pass below.
      const scope = img.closest('[data-conversation-scroll]')
      if (scope === null) return [img]
      const pending = []
      for (const node of scope.querySelectorAll('img')) {
        if (!(node instanceof HTMLImageElement)) continue
        if (node.closest(`.${ROOT_CLASS}`) !== null) continue
        const src = node.currentSrc || node.src || ''
        if (src === '') continue
        const width = node.naturalWidth || node.width || 0
        const height = node.naturalHeight || node.height || 0
        if (Math.max(width, height) < 48) continue
        pending.push(node)
      }
      const gallery = []
      for (const node of pending) {
        const rendered = node.getBoundingClientRect()
        if (rendered.width >= 48 || rendered.height >= 48) gallery.push(node)
      }
      if (gallery.length === 0) gallery.push(img)
      return gallery
    }

    /** Inline style helpers keep the overlay self-contained (no theme coupling). */
    function el(tag, attrs = {}) {
      const node = document.createElement(tag)
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'style') Object.assign(node.style, value)
        else if (key === 'text') node.textContent = value
        else node.setAttribute(key, value)
      }
      return node
    }

    let viewer = null
    /** Client context carrying the remote services, set only when the Host provides them. */
    let remoteCtx = null
    /** Dialog nodes built once and reattached. Rebuilding them dominated open/close. */
    let shell = null
    /** Stage geometry cached for the life of a gesture; invalidated when it moves. */
    let stageMetrics = null
    /** Decoded gallery neighbours, oldest first, capped so bitmaps do not pile up. */
    const decoded = new Map()
    let imageDrag = null
    let panelDrag = null
    let wheelDY = 0
    let wheelPoint = null
    let wheelJob = false
    let wheelNotch = false
    /** Large wheel steps glide toward this scale instead of popping in one frame. */
    let zoomGlide = null
    let glideQueued = false
    let panJob = false
    let panelJob = false
    let resizeQueued = false
    let metaQueued = false

    /**
     * Flash a status on the shared toast node. The hide timer lives on the node,
     * not the viewer record: the dialog DOM is reused across opens, and tearing
     * one viewer down must not cancel a toast a newer viewer already armed.
     * Close and reopen both dismiss a leftover message. Otherwise `data-visible`
     * survives the cancelled timer and the next open shows it forever.
     */
    function toast(message) {
      if (viewer === null) return
      const node = viewer.toast
      const token = (node._toastToken = (node._toastToken ?? 0) + 1)
      node.textContent = message
      node.setAttribute('data-visible', '')
      clearTimeout(node._toastTimer)
      node._toastTimer = setTimeout(() => {
        if (node._toastToken !== token) return
        node.removeAttribute('data-visible')
      }, 1600)
    }

    /** Drop a toast immediately, including one left visible by a cancelled timer. */
    function dismissToast(node) {
      if (node == null) return
      node._toastToken = (node._toastToken ?? 0) + 1
      clearTimeout(node._toastTimer)
      node._toastTimer = undefined
      node.textContent = ''
      node.removeAttribute('data-visible')
    }

    /** Whether one source is this Host's own file route (not a remote URL). */
    function isLocalFileSource(src) {
      try {
        const url = new URL(src, window.location.href)
        return url.origin === window.location.origin && url.pathname.endsWith('/api/file')
      } catch {
        return false
      }
    }

    /** The filesystem path behind a `/api/file?path=` source, when there is one. */
    function filePathOf(src) {
      try {
        const url = new URL(src, window.location.href)
        const path = url.searchParams.get('path')
        return path === null || path === '' ? undefined : path
      } catch {
        return undefined
      }
    }

    /** Same-origin sources can carry the session cookie; cross-origin ones reject credentialed CORS. */
    function isSameOrigin(src) {
      try {
        return new URL(src, window.location.href).origin === window.location.origin
      } catch {
        return false
      }
    }

    /** Extension for a downloaded blob, so blob: attachments save under a useful name. */
    function extensionForType(type) {
      const known = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
        'image/avif': '.avif',
        'image/bmp': '.bmp',
        'image/x-icon': '.ico',
      }
      return known[String(type || '').toLowerCase()] ?? ''
    }

    /** Clean a display name into a safe download name, adding an extension when missing. */
    function safeFileName(name, type) {
      const base = String(name || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .trim()
      const usable = base === '' || base === T.image ? T.image : base
      return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(usable) ? usable : usable + extensionForType(type)
    }

    /** Fetch one image blob with cookie credentials only where CORS allows them. */
    async function fetchImage(src, signal) {
      return await fetch(src, { credentials: isSameOrigin(src) ? 'include' : 'omit', signal })
    }

    /**
     * Open the current image outside the viewer.
     *
     * A local file cannot be handed to a browser (the URL needs this session's
     * cookie), so it goes through the Host's path opener — the OS default
     * application. Remote http(s) images open in the default browser: the
     * desktop shell routes `window.open` for https to `shell.openExternal`.
     */
    async function openExternally(src) {
      if (src === '') return
      if (!isLocalFileSource(src)) {
        window.open(src, '_blank', 'noopener,noreferrer')
        return
      }
      const path = filePathOf(src)
      let session
      try {
        session = remoteCtx?.remote?.session
      } catch (error) {
        console.warn('image-viewer-pro: remote session unavailable', error)
      }
      if (path !== undefined && typeof session?.openWorkspacePath === 'function') {
        try {
          const available = await session.canOpenWorkspacePath?.()
          if (available?.ok === true && available.value === false) {
            toast(T.openUnavailable)
            return
          }
          // The open variant carries no action; only reveal does.
          const result = await session.openWorkspacePath({ path })
          if (result?.ok === true) return
          console.warn('image-viewer-pro: host refused to open path', {
            path,
            reason: result?.error?.code ?? result?.error?.message,
          })
        } catch (error) {
          console.warn('image-viewer-pro: openWorkspacePath failed', error)
        }
        toast(T.openFailed)
        return
      }
      // Last resort outside the desktop shell: a plain tab.
      window.open(src, '_blank', 'noopener,noreferrer')
    }

    function hostSession() {
      try {
        return remoteCtx?.remote?.session
      } catch (error) {
        console.warn('image-viewer-pro: remote session unavailable', error)
        return undefined
      }
    }

    /** Open or reveal a local file through the Host. `application` is a catalog id. */
    async function openWorkspace(path, extra) {
      const session = hostSession()
      if (path === undefined || typeof session?.openWorkspacePath !== 'function') return false
      try {
        const available = await session.canOpenWorkspacePath?.()
        if (available?.ok === true && available.value === false) {
          toast(T.openUnavailable)
          return false
        }
        const result = await session.openWorkspacePath({ path, ...extra })
        if (result?.ok === true) return true
        console.warn('image-viewer-pro: host refused to open path', {
          path,
          reason: result?.error?.code ?? result?.error?.message,
        })
      } catch (error) {
        console.warn('image-viewer-pro: openWorkspacePath failed', error)
      }
      toast(T.openFailed)
      return false
    }

    function closeOpenMenu() {
      if (viewer === null) return
      viewer.openMenu.hidden = true
      viewer.openMore.setAttribute('aria-expanded', 'false')
    }

    function placeOpenMenu() {
      const box = viewer.openSplit.getBoundingClientRect()
      const rootBox = viewer.root.getBoundingClientRect()
      viewer.openMenu.style.top = `${box.bottom - rootBox.top + 6}px`
      viewer.openMenu.style.right = `${rootBox.right - box.right}px`
    }

    function preferredApp(apps) {
      return apps.find((app) => app.default === true) ?? apps[0]
    }

    function setOpenFace(icon, loading) {
      viewer.openSplit.classList.toggle('is-loading', loading)
      const usable = !loading && typeof icon === 'string' && icon.startsWith('data:')
      viewer.openIcon.hidden = !usable
      viewer.openFallback.hidden = usable || loading
      viewer.openSkeleton.hidden = !loading
      if (usable) viewer.openIcon.src = icon
      else viewer.openIcon.removeAttribute('src')
    }

    function appItem(app) {
      const item = el('button', { type: 'button', class: `${ROOT_CLASS}-open-item`, role: 'menuitem' })
      const icon = el('img', { class: `${ROOT_CLASS}-open-item-icon`, alt: '' })
      if (typeof app.icon === 'string' && app.icon.startsWith('data:')) icon.src = app.icon
      else icon.hidden = true
      const name = app.default === true ? app.name + T.defaultMark : app.name
      item.append(icon, el('span', { text: name }))
      item.addEventListener('click', (event) => {
        event.stopPropagation()
        closeOpenMenu()
        const path = filePathOf(viewer?.currentShownSrc || '')
        void openWorkspace(path, { application: app.id })
      })
      return item
    }

    function fillOpenMenu() {
      const menu = viewer.openMenu
      const state = viewer.openState
      menu.replaceChildren()
      if (state?.failed === true && state.apps.length === 0) {
        menu.append(el('div', { class: `${ROOT_CLASS}-open-note`, text: T.openAppsFailed }))
      }
      for (const app of state?.apps ?? []) menu.append(appItem(app))
      if ((state?.apps.length ?? 0) > 0) menu.append(el('div', { class: `${ROOT_CLASS}-open-sep` }))
      const reveal = el('button', {
        type: 'button',
        class: `${ROOT_CLASS}-open-item`,
        role: 'menuitem',
        text: T.reveal,
      })
      reveal.addEventListener('click', (event) => {
        event.stopPropagation()
        closeOpenMenu()
        const path = filePathOf(viewer?.currentShownSrc || '')
        void openWorkspace(path, { action: 'reveal' })
      })
      menu.append(reveal)
    }

    function toggleOpenMenu() {
      if (viewer.openMenu.hidden === false) {
        closeOpenMenu()
        return
      }
      fillOpenMenu()
      viewer.openMenu.hidden = false
      viewer.openMore.setAttribute('aria-expanded', 'true')
      placeOpenMenu()
    }

    async function activateOpenMain() {
      const src = viewer.currentShownSrc || viewer.img.src
      const state = viewer.openState
      if (!isLocalFileSource(src) || state?.mode === 'legacy') {
        await openExternally(src)
        return
      }
      const path = filePathOf(src)
      if (state?.preferred) await openWorkspace(path, { application: state.preferred.id })
      else await openWorkspace(path, { action: 'reveal' })
    }

    /**
     * Local files use the Host application list. The main face is the default
     * app icon; the menu lists every handler plus "show file location".
     * Remote images keep the plain new-tab button.
     */
    function syncOpenTarget(src) {
      closeOpenMenu()
      if (viewer !== null) viewer.currentShownSrc = src
      const local = isLocalFileSource(src)
      const blocked = src.startsWith('blob:') || src.startsWith('data:')
      viewer.openSplit.hidden = !local
      viewer.openBtn.hidden = local || blocked
      if (!local) {
        const label = T.openTab
        viewer.openBtn.title = label
        viewer.openBtn.setAttribute('aria-label', label)
        return
      }
      const token = (viewer.openToken = (viewer.openToken ?? 0) + 1)
      viewer.openState = { apps: [], preferred: undefined, failed: false, mode: 'loading' }
      viewer.openMore.hidden = true
      viewer.openMain.title = T.openLocal
      viewer.openMain.setAttribute('aria-label', T.openLocal)
      setOpenFace(undefined, true)
      const path = filePathOf(src)
      const session = hostSession()
      if (path === undefined || typeof session?.workspacePathApplications !== 'function') {
        viewer.openState = { apps: [], preferred: undefined, failed: false, mode: 'legacy' }
        viewer.openMore.hidden = true
        setOpenFace(undefined, false)
        return
      }
      void session.workspacePathApplications({ path }).then((result) => {
        if (viewer === null || viewer.openToken !== token) return
        const apps = result?.ok === true && Array.isArray(result.value)
          ? result.value.filter((app) => app && typeof app.id === 'string' && typeof app.name === 'string')
          : []
        const failed = result?.ok !== true
        const preferred = preferredApp(apps)
        viewer.openState = { apps, preferred, failed, mode: 'ready' }
        const label = preferred ? preferred.name : T.reveal
        viewer.openMain.title = label
        viewer.openMain.setAttribute('aria-label', label)
        viewer.openMore.hidden = apps.length === 0 && failed !== true
        if (apps.length === 0 && failed === true) viewer.openMore.hidden = false
        setOpenFace(preferred?.icon, false)
      }).catch((error) => {
        if (viewer === null || viewer.openToken !== token) return
        console.warn('image-viewer-pro: workspacePathApplications failed', error)
        viewer.openState = { apps: [], preferred: undefined, failed: true, mode: 'ready' }
        viewer.openMain.title = T.reveal
        viewer.openMain.setAttribute('aria-label', T.reveal)
        viewer.openMore.hidden = false
        setOpenFace(undefined, false)
      })
    }

    function applyTransform(updateReadout = true) {
      if (viewer === null) return
      const { state, img } = viewer
      // translate3d keeps the bitmap on the compositor. translate() is 2D and
      // can fall back to a repaint when the image is large.
      img.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) translate(-50%, -50%) scale(${state.scale}) rotate(${state.rotation}deg)`
      // Never fight the user while they are typing a percentage. Skip the write
      // when the rounded label did not change — a trackpad zoom fires every frame.
      if (!updateReadout || document.activeElement === viewer.zoomInput) return
      const next = percentOf(state.scale)
      if (viewer.zoomInput.value !== next) viewer.zoomInput.value = next
    }

    /** Jump to one typed percentage, centred on the stage. */
    function setZoomPercent(text) {
      const parsed = Number.parseFloat(String(text).replace('%', '').trim())
      if (!Number.isFinite(parsed) || parsed <= 0) {
        viewer.zoomInput.value = percentOf(viewer.state.scale)
        return
      }
      cutTransformMotion()
      viewer.state.scale = clamp(parsed / 100, MIN_SCALE, MAX_SCALE)
      viewer.state.tx = 0
      viewer.state.ty = 0
      applyTransform()
    }

    function rememberStage(box) {
      stageMetrics = { left: box.left, top: box.top, width: box.width, height: box.height }
      return stageMetrics
    }

    /** Stage box for zoom-at-point. Read once per gesture, not once per event. */
    function stageBox() {
      if (stageMetrics === null) rememberStage(viewer.stage.getBoundingClientRect())
      return stageMetrics
    }

    function cancelZoomGlide() {
      zoomGlide = null
    }

    function fitBox(naturalWidth, naturalHeight) {
      cancelZoomGlide()
      const { state, stage } = viewer
      const box = rememberStage(stage.getBoundingClientRect())
      const turned = Math.abs(state.rotation % 180) === 90
      state.scale = fitScale(
        turned ? naturalHeight : naturalWidth,
        turned ? naturalWidth : naturalHeight,
        box.width - FIT_PADDING * 2,
        box.height - FIT_PADDING * 2,
      )
      state.tx = 0
      state.ty = 0
      state.fitScale = state.scale
      applyTransform()
    }

    function fit() {
      if (viewer === null) return
      fitBox(viewer.img.naturalWidth, viewer.img.naturalHeight)
    }

    function prefersReducedMotion() {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    }

    function cutTransformMotion() {
      if (viewer === null) return
      if (viewer.motionTimer !== undefined) clearTimeout(viewer.motionTimer)
      viewer.motionTimer = undefined
      viewer.img.style.transition = ''
      dropPageLayer()
    }

    /** Drop a gallery slide that is still moving, and show the live picture at rest. */
    function dropPageLayer() {
      if (viewer === null) return
      if (viewer.pageTimer !== undefined) clearTimeout(viewer.pageTimer)
      viewer.pageTimer = undefined
      viewer.pageLayer?.remove()
      viewer.pageLayer = null
      viewer.img.style.opacity = ''
    }

    /**
     * Which way a gallery step travels. +1 is the next picture (in from the
     * right); −1 is the previous one. Callers pass an unwrapped index, so a
     * step off either end still points the way the arrow does.
     */
    function pageDirection(from, requested, count) {
      if (count < 2) return 0
      const to = (requested % count + count) % count
      if (!Number.isFinite(to) || to === from) return 0
      const raw = requested - from
      if (raw === 1 || raw === 1 - count) return 1
      if (raw === -1 || raw === count - 1) return -1
      const forward = (to - from + count) % count
      return forward * 2 <= count ? 1 : -1
    }

    /** Keep the picture that is on screen, so the next one can slide in over it. */
    function liftOutgoing() {
      dropPageLayer()
      const layer = document.createElement('div')
      layer.className = `${ROOT_CLASS}-page`
      const ghost = viewer.img.cloneNode(true)
      ghost.alt = ''
      layer.append(ghost)
      viewer.stage.insertBefore(layer, viewer.stage.firstChild)
      viewer.pageLayer = layer
      return layer
    }

    /**
     * Push the new picture in from `direction` and the previous one out the
     * other way. They stay opaque and travel most of the stage, so the change
     * reads as a slide instead of two pictures dissolving on top of each other.
     * The curve matches the dialog open.
     */
    function startPageSlide(direction, layer) {
      const box = stageBox()
      const travel = Math.round(box.width * 0.72) * direction
      const { state, img } = viewer
      img.style.transition = 'none'
      img.style.opacity = '1'
      img.style.transform = `translate3d(${state.tx + travel}px, ${state.ty}px, 0) translate(-50%, -50%) scale(${state.scale}) rotate(${state.rotation}deg)`
      if (layer !== null) {
        layer.style.transition = 'none'
        layer.style.opacity = '1'
        layer.style.transform = 'translate3d(0,0,0)'
      }
      // The offset has to be painted before the transition, or the slide is skipped.
      void img.offsetWidth
      const curve = 'cubic-bezier(0.32, 0.72, 0, 1)'
      img.style.transition = `transform .42s ${curve}`
      applyTransform()
      if (layer !== null) {
        layer.style.transition = `transform .42s ${curve}`
        layer.style.transform = `translate3d(${-travel}px,0,0)`
      }
      const token = viewer.loadToken
      viewer.pageTimer = setTimeout(() => {
        if (viewer === null || viewer.loadToken !== token) return
        viewer.img.style.transition = ''
        if (viewer.pageLayer === layer) {
          layer?.remove()
          viewer.pageLayer = null
        }
        viewer.pageTimer = undefined
      }, 460)
    }

    function actualSize() {
      cancelZoomGlide()
      cutTransformMotion()
      viewer.state.scale = 1
      viewer.state.tx = 0
      viewer.state.ty = 0
      applyTransform()
    }

    /** Zoom keeping one stage-relative point fixed under the cursor. */
    function zoomAt(nextScale, point) {
      if (viewer === null) return
      cutTransformMotion()
      const { state } = viewer
      const target = clamp(nextScale, MIN_SCALE, MAX_SCALE)
      if (target === state.scale) return
      let px = 0
      let py = 0
      if (point !== undefined) {
        const box = stageBox()
        px = point.x - box.left - box.width / 2
        py = point.y - box.top - box.height / 2
      }
      const ratio = target / state.scale
      state.tx = px - (px - state.tx) * ratio
      state.ty = py - (py - state.ty) * ratio
      state.scale = target
      applyTransform()
    }

    function step(dir, point, factor = 1.25) {
      cancelZoomGlide()
      const amount = dir > 0 ? factor : 1 / factor
      zoomAt(viewer.state.scale * amount, point)
    }

    /** Ease a mouse-notch zoom across a few frames. Trackpad ticks do not use this. */
    function kickGlide() {
      if (glideQueued) return
      glideQueued = true
      frame.schedule(() => {
        glideQueued = false
        const glide = zoomGlide
        if (viewer === null || glide === null) return
        const ratio = glide.target / viewer.state.scale
        if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.0015) {
          zoomAt(glide.target, glide.point)
          if (zoomGlide === glide) zoomGlide = null
          return
        }
        zoomAt(viewer.state.scale * Math.pow(ratio, 0.42), glide.point)
        kickGlide()
      })
    }

    function rotate(direction = 1) {
      if (viewer === null || viewer.closing) return
      cancelZoomGlide()
      // A page slide owns the picture's transform. Drop it before a quarter-turn,
      // or the two transitions fight over the same element.
      dropPageLayer()
      const { state, img } = viewer
      const box = rememberStage(viewer.stage.getBoundingClientRect())
      const turned = Math.abs(state.rotation % 180) === 90
      const currentFit = fitScale(
        turned ? img.naturalHeight : img.naturalWidth,
        turned ? img.naturalWidth : img.naturalHeight,
        box.width - FIT_PADDING * 2,
        box.height - FIT_PADDING * 2,
      )
      const wasFit = Math.abs(state.scale - currentFit) < 0.001
      // Keep climbing (270 → 360, not 270 → 0). A wrap would make the CSS
      // transition play the quarter-turn backwards.
      state.rotation += direction < 0 ? -90 : 90
      // Fitted images also ease their scale: a quarter-turn swaps the box.
      if (!prefersReducedMotion()) img.style.transition = 'transform .34s cubic-bezier(0.22, 1, 0.36, 1)'
      if (wasFit) fit()
      else applyTransform()
      syncRotationLabel()
      if (viewer.motionTimer !== undefined) clearTimeout(viewer.motionTimer)
      viewer.motionTimer = setTimeout(() => {
        if (viewer === null) return
        viewer.img.style.transition = ''
        // 360° is the same picture as 0°. Fold it after the spin so the next
        // turn still starts from a small angle and keeps going forward.
        viewer.state.rotation = ((viewer.state.rotation % 360) + 360) % 360
        applyTransform()
        syncRotationLabel()
        viewer.motionTimer = undefined
      }, 400)
    }

    /** Render the `dimensions | format | size` line, hiding absent values. */
    /** 0/90/180/270 beside the rotate button. 360° reads as 0° while the spin finishes. */
    function syncRotationLabel() {
      if (viewer === null || viewer.degreeLabel == null) return
      const normal = ((viewer.state.rotation % 360) + 360) % 360
      const text = normal + '\u00b0'
      if (viewer.degreeLabel.textContent !== text) viewer.degreeLabel.textContent = text
      viewer.degreeLabel.setAttribute('aria-label', T.rotation + ': ' + text)
    }

    function renderMeta() {
      if (viewer === null) return
      const meta = viewer.meta
      const format = viewer.format
      meta.format.textContent = format
      meta.format.hidden = format === ''
      meta.formatSep.hidden = format === ''
      const bytes = viewer.bytes === undefined ? '' : formatBytes(viewer.bytes)
      meta.bytes.textContent = bytes
      meta.bytes.hidden = bytes === ''
      meta.bytesSep.hidden = bytes === ''
    }

    /**
     * Read the current source's format and size and show it. Each call owns an
     * abort controller so a fast gallery switch cannot let an older source
     * overwrite the newer labels.
     */
    async function loadMeta(src) {
      const current = viewer
      if (current === null) return
      const token = (current.metaToken = (current.metaToken ?? 0) + 1)
      current.metaAbort?.abort()
      const controller = new AbortController()
      current.metaAbort = controller
      const abort = () => controller.abort()
      current.abort.signal.addEventListener('abort', abort, { once: true })
      const meta = await metaOf(src, controller.signal)
      current.abort.signal.removeEventListener('abort', abort)
      if (viewer !== current || current.metaToken !== token) return
      current.format = meta.format
      current.bytes = meta.bytes
      renderMeta()
    }

    function queueMeta(src) {
      viewer.currentShownSrc = src
      if (metaQueued) return
      metaQueued = true
      // Let the bitmap decode before the metadata request competes with it.
      frame.schedule(() => {
        metaQueued = false
        if (viewer === null) return
        void loadMeta(viewer.currentShownSrc)
      })
    }

    function syncPaging() {
      if (viewer === null) return
      const many = viewer.gallery.length > 1
      viewer.counter.textContent = many ? `${viewer.index + 1} / ${viewer.gallery.length}` : ''
      viewer.counter.hidden = !many
      viewer.prev.hidden = !many
      viewer.next.hidden = !many
    }

    /** A decoded Image for src, reused so the next/prev bitmap is already hot. */
    function probeImage(src) {
      let node = decoded.get(src)
      if (node !== undefined) {
        decoded.delete(src)
        decoded.set(src, node)
        return node
      }
      node = new Image()
      node.decoding = 'async'
      node.draggable = false
      node.src = src
      decoded.set(src, node)
      while (decoded.size > DECODED_LIMIT) {
        const oldest = decoded.keys().next().value
        const stale = decoded.get(oldest)
        decoded.delete(oldest)
        if (stale !== undefined) releaseImage(stale)
      }
      return node
    }

    function preloadAround() {
      if (viewer === null || viewer.gallery.length < 2) return
      const { gallery, index } = viewer
      const neighbors = [
        gallery[(index + 1) % gallery.length],
        gallery[(index - 1 + gallery.length) % gallery.length],
      ]
      for (const node of neighbors) {
        const src = node?.currentSrc || node?.src
        if (!src) continue
        const probe = probeImage(src)
        if (typeof probe.decode === 'function' && probe.complete !== true) probe.decode().catch(() => {})
      }
    }

    function sameSrc(img, src) {
      try {
        return img.src === new URL(src, window.location.href).href
      } catch {
        return img.src === src
      }
    }

    /**
     * Put a decoded bitmap on screen already fitted. The previous picture stays
     * until this runs, so a gallery step never flashes an empty or 100% frame.
     */
    function revealDecoded(src, probe, token) {
      if (viewer === null || viewer.loadToken !== token) return
      const width = probe.naturalWidth
      const height = probe.naturalHeight
      const direction = viewer.pageDirection || 0
      viewer.pageDirection = 0
      if (!width || !height) {
        if (!sameSrc(viewer.img, src)) viewer.img.src = src
        viewer.img.style.visibility = ''
        return
      }
      // A second click settles the slide that is already playing, then snapshots
      // that resting picture. The new one is fitted while invisible, so the
      // slide never shows it at the wrong size.
      cutTransformMotion()
      const animate = direction !== 0
        && prefersReducedMotion() !== true
        && viewer.root.isConnected
        && viewer.img.getAttribute('src')
        && sameSrc(viewer.img, src) !== true
      const layer = animate ? liftOutgoing() : null
      viewer.size.textContent = `${width} × ${height}`
      viewer.state.rotation = 0
      syncRotationLabel()
      if (!viewer.root.isConnected) {
        layer?.remove()
        if (viewer.pageLayer === layer) viewer.pageLayer = null
        if (!sameSrc(viewer.img, src)) viewer.img.src = src
        viewer.img.style.visibility = 'hidden'
        viewer.deferFit = { width, height }
        return
      }
      if (animate) {
        viewer.img.style.transition = 'none'
        viewer.img.style.opacity = '0'
      }
      fitBox(width, height)
      if (!sameSrc(viewer.img, src)) viewer.img.src = src
      viewer.img.style.visibility = ''
      if (animate) startPageSlide(direction, layer)
      preloadAround()
    }

    function showAt(index) {
      const gallery = viewer.gallery
      if (gallery.length === 0) return
      viewer.pageDirection = pageDirection(viewer.index, index, gallery.length)
      viewer.index = (index + gallery.length) % gallery.length
      const source = gallery[viewer.index]
      const src = source.currentSrc || source.src
      viewer.img.alt = source.alt || ''
      // Attachment images (blob:) carry no filename in the URL; the official alt
      // text does, so prefer it over the generic fallback.
      const alt = String(source.alt || '').trim()
      viewer.name = alt !== '' && alt !== T.image ? alt : fileNameOf(src)
      // Local files open through the Host in their default app; remote URLs go
      // to the default browser. data: URLs cannot be navigated to as a document.
      // Local files use the Host app list. Remote URLs stay a plain new-tab
      // button. blob: and data: URLs cannot be opened as documents.
      syncOpenTarget(src)
      viewer.nameLabel.textContent = viewer.name
      viewer.format = ''
      viewer.bytes = undefined
      renderMeta()
      queueMeta(src)
      viewer.root.setAttribute('aria-label', viewer.name === T.image ? T.title : `${T.title}: ${viewer.name}`)
      syncPaging()
      const token = (viewer.loadToken = (viewer.loadToken ?? 0) + 1)
      const probe = probeImage(src)
      if (probe.complete) {
        revealDecoded(src, probe, token)
        return
      }
      // Keep the current bitmap until the next one has dimensions.
      if (!viewer.root.isConnected) viewer.img.style.visibility = 'hidden'
      // One handler per probe. Rapid gallery steps must not stack listeners.
      const finish = () => {
        probe.onload = null
        probe.onerror = null
        revealDecoded(src, probe, token)
      }
      probe.onload = finish
      probe.onerror = finish
    }

    /** Fill paging controls after the dialog has painted, so open is not blocked. */
    function adoptGallery(opened) {
      if (viewer === null) return
      const gallery = galleryOf(opened)
      const current = viewer.gallery[viewer.index]
      viewer.gallery = gallery
      const found = current === undefined ? -1 : gallery.indexOf(current)
      viewer.index = found === -1 ? Math.max(0, gallery.indexOf(opened)) : found
      syncPaging()
      preloadAround()
    }

    function resetGestures() {
      frame.cancel()
      wheelJob = false
      wheelDY = 0
      wheelPoint = null
      wheelNotch = false
      zoomGlide = null
      glideQueued = false
      panJob = false
      panelJob = false
      resizeQueued = false
      metaQueued = false
      imageDrag = null
      panelDrag = null
      stageMetrics = null
    }

    function teardown(closing) {
      if (closing.tornDown) return
      closing.tornDown = true
      // A newer present() may already own this dialog. Only the viewer that is
      // actually going away may clear the shared toast.
      const ownsDialog = viewer === closing
      if (ownsDialog) viewer = null
      clearTimeout(closing.closeTimer)
      clearTimeout(closing.pageTimer)
      document.removeEventListener('keydown', closing.onKey, true)
      window.removeEventListener('resize', closing.onResize)
      closing.abort?.abort()
      delete closing.root.dataset.state
      closing.img.style.transition = ''
      closing.img.style.opacity = ''
      closing.pageLayer?.remove()
      closing.pageLayer = null
      // Drop decoded bitmaps once the dialog is gone. The chat thumbnails keep
      // their own copies; this viewer must not pin extra full-size images.
      releaseImage(closing.img)
      releaseDecoded()
      // Detach only. The node tree stays on shell and is reattached next open.
      closing.root.remove()
      document.documentElement.style.overflow = closing.previousOverflow
      if (ownsDialog) dismissToast(closing.toast)
      closing.previousFocus?.focus?.({ preventScroll: true })
    }

    function close() {
      if (viewer === null || viewer.closing) return
      const closing = viewer
      cutTransformMotion()
      resetGestures()
      closing.stopRepeatables?.()
      if (prefersReducedMotion()) {
        teardown(closing)
        return
      }
      // Play the dismiss, then detach. The dialog stays mounted so a second
      // click cannot rebuild it under the animation.
      closing.closing = true
      closing.root.dataset.state = 'closing'
      const panel = closing.panel || closing.root.querySelector('.' + ROOT_CLASS + '-panel')
      const finish = (event) => {
        if (event && event.target !== panel) return
        panel.removeEventListener('animationend', finish)
        teardown(closing)
      }
      panel.addEventListener('animationend', finish)
      closing.closeTimer = setTimeout(() => teardown(closing), 420)
    }

    async function downloadOriginal() {
      if (viewer === null) return
      const button = viewer.download
      const src = viewer.img.src
      const signal = viewer.abort.signal
      // Snapshot the name: the gallery may move on while the bytes stream in.
      const name = viewer.name
      if (button.disabled) return
      button.disabled = true
      let lastToast = 0
      try {
        const response = await fetchImage(src, signal)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const total = Number(response.headers.get('content-length') || 0)
        const reader = response.body?.getReader?.()
        const chunks = []
        let loaded = 0
        if (reader !== undefined) {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            loaded += value.byteLength
            // The button is icon-only now, so progress rides the toast; throttle
            // it so a fast download does not rewrite the live region per chunk.
            const now = Date.now()
            if (now - lastToast >= 100) {
              lastToast = now
              toast(total > 0
                ? `${T.downloading} ${Math.round((loaded / total) * 100)}%`
                : `${T.downloading} ${Math.round(loaded / 1024)}K`)
            }
          }
        }
        const blob = reader === undefined
          ? await response.blob()
          : new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = safeFileName(name, blob.type)
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        toast(T.downloaded)
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.warn('image-viewer-pro: download failed', error)
        // A cross-origin image may refuse fetch (CORS) while the browser can still
        // display it; open the original in a tab so it can be saved from there.
        if (!src.startsWith('blob:') && !src.startsWith('data:') && !isSameOrigin(src)) {
          window.open(src, '_blank', 'noopener,noreferrer')
          toast(T.downloadFallback)
        } else {
          toast(T.downloadFailed)
        }
      } finally {
        if (viewer !== null) button.disabled = false
      }
    }

    async function copyImage() {
      if (viewer === null) return
      const src = viewer.img.src
      const signal = viewer.abort.signal
      try {
        const blob = await (await fetchImage(src, signal)).blob()
        const png = blob.type === 'image/png' ? blob : await toPng(blob)
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        toast(T.copied)
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.warn('image-viewer-pro: copy failed', error)
        // A cross-origin image may refuse fetch; copy its URL instead.
        try {
          await navigator.clipboard.writeText(src)
          toast(T.copyLink)
        } catch {
          toast(T.copyFailed)
        }
      }
    }

    /**
     * Re-encode a non-PNG blob so the clipboard accepts it.
     * ImageBitmap is closed explicitly: leaving it for GC holds the pixels.
     * A very large photo is scaled down so the canvas allocation cannot stall the tab.
     */
    async function toPng(blob) {
      const bitmap = await createImageBitmap(blob)
      try {
        const scale = Math.min(1, MAX_COPY_EDGE / Math.max(bitmap.width, bitmap.height, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext('2d')
        if (context === null) return blob
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const png = await new Promise(resolve => canvas.toBlob(result => resolve(result ?? blob), 'image/png'))
        canvas.width = 0
        canvas.height = 0
        return png
      } finally {
        bitmap.close()
      }
    }

    function resetPanelPosition(panel) {
      panel.style.position = ''
      panel.style.margin = ''
      panel.style.left = ''
      panel.style.top = ''
      panel.style.transform = ''
      panel.removeAttribute('data-dragging')
    }

    /** Reattach the dialog built on the first open. Skipping the DOM rebuild is the open/close win. */
    function present(image) {
      const ui = shell
      // The shell keeps its last toast. A copy that was closed before the hide
      // timer fired would otherwise come back and stay.
      dismissToast(ui.toast)
      const previousOverflow = document.documentElement.style.overflow
      const previousFocus = document.activeElement
      resetPanelPosition(ui.panel)
      delete ui.root.dataset.state
      ui.img.style.transition = ''
      ui.img.style.opacity = ''
      ui.stage.querySelectorAll(`.${ROOT_CLASS}-page`).forEach((node) => node.remove())
      ui.stage.removeAttribute('data-panning')
      ui.download.disabled = false
      ui.img.style.visibility = 'hidden'
      chromeTopCache = undefined
      stageMetrics = null
      const chromeTop = frameChromeTop()
      ui.root.style.top = chromeTop > 0 ? `${chromeTop}px` : ''
      viewer = {
        root: ui.root, stage: ui.stage, panel: ui.panel, img: ui.img,
        nameLabel: ui.nameLabel, size: ui.size, zoomInput: ui.zoomInput,
        counter: ui.counter, toast: ui.toast, prev: ui.prev, next: ui.next,
        openBtn: ui.openBtn, openSplit: ui.openSplit, openMain: ui.openMain, openMore: ui.openMore,
        openIcon: ui.openIcon, openFallback: ui.openFallback, openSkeleton: ui.openSkeleton, openMenu: ui.openMenu,
        download: ui.download, degreeLabel: ui.degreeLabel, meta: ui.meta,
        format: '', bytes: undefined, metaToken: 0, metaAbort: undefined,
        gallery: [image], index: 0, name: '',
        state: { scale: 1, tx: 0, ty: 0, rotation: 0, fitScale: 1 },
        onKey: ui.onKey, onResize: ui.onResize,
        loadToken: 0, previousOverflow, previousFocus,
        abort: new AbortController(), zoomCancelled: false,
        openToken: 0, openState: null,
        stopRepeatables: ui.stopRepeatables,
        currentShownSrc: '', deferFit: null,
      }
      document.documentElement.style.overflow = 'hidden'
      if (!ui.root.isConnected) document.body.appendChild(ui.root)
      document.addEventListener('keydown', viewer.onKey, true)
      window.addEventListener('resize', viewer.onResize)
      showAt(0)
      if (viewer !== null && viewer.deferFit !== null && viewer.img.naturalWidth > 0) {
        fitBox(viewer.deferFit.width, viewer.deferFit.height)
        viewer.deferFit = null
        viewer.img.style.visibility = ''
        preloadAround()
      }
      ui.closeBtn.focus({ preventScroll: true })
      const opened = image
      frame.schedule(() => {
        if (viewer === null) return
        adoptGallery(opened)
        if (viewer.img.naturalWidth > 0 && Math.abs(viewer.state.scale - viewer.state.fitScale) < 0.001) fit()
      })
    }

    function mount(image) {
      if (shell !== null) {
        if (viewer !== null) close()
        present(image)
        return
      }
      close()
      const previousOverflow = document.documentElement.style.overflow
      const previousFocus = document.activeElement
      // Paging is filled in after the first paint. Scanning every chat image
      // here would delay the dialog.
      const gallery = [image]
      const index = 0

      const style = document.getElementById(STYLE_ID)
      if (style === null) {
        const tag = document.createElement('style')
        tag.id = STYLE_ID
        // The client module loader drops owned styles by this attribute on unload.
        tag.dataset.plugin = 'dsh-image-viewer-pro'
        tag.dataset.pluginCss = STYLE_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
      }

      const root = el('div', { class: ROOT_CLASS, role: 'dialog', 'aria-modal': 'true', 'aria-label': T.title })
      // Keep the desktop frame's caption row (native menu + window buttons)
      // uncovered: the mask, and so the dialog's drag area, starts below it. The
      // app's own top toolbar inside the content area is still dimmed.
      const chromeTop = frameChromeTop()
      if (chromeTop > 0) root.style.top = `${chromeTop}px`
      const backdrop = el('div', { class: `${ROOT_CLASS}-backdrop` })
      const panel = el('div', { class: `${ROOT_CLASS}-panel`, role: 'document' })
      const stage = el('div', { class: `${ROOT_CLASS}-stage` })
      const img = el('img', { class: `${ROOT_CLASS}-img`, alt: '', draggable: 'false', decoding: 'async' })
      const toolbar = el('div', { class: `${ROOT_CLASS}-toolbar` })
      const readout = el('div', { class: `${ROOT_CLASS}-readout` })
      const nameLabel = el('span', { class: `${ROOT_CLASS}-title` })
      const size = el('span', { class: `${ROOT_CLASS}-meta` })
      // The meta line carries values only: dimensions | format | file size.
      const formatSep = el('span', { class: `${ROOT_CLASS}-meta ${ROOT_CLASS}-meta-sep`, text: '|' })
      const formatLabel = el('span', { class: `${ROOT_CLASS}-meta` })
      const bytesSep = el('span', { class: `${ROOT_CLASS}-meta ${ROOT_CLASS}-meta-sep`, text: '|' })
      const bytesLabel = el('span', { class: `${ROOT_CLASS}-meta` })
      formatSep.hidden = true
      formatLabel.hidden = true
      bytesSep.hidden = true
      bytesLabel.hidden = true
      const zoomInput = el('input', {
        type: 'text',
        inputmode: 'decimal',
        class: `${ROOT_CLASS}-zoom`,
        'aria-label': T.zoomInput,
        title: T.zoomInput,
        spellcheck: 'false',
        autocomplete: 'off',
      })
      const counter = el('span', { 'aria-live': 'polite' })
      const toastNode = el('div', { class: `${ROOT_CLASS}-toast`, role: 'status' })

      // Icon-only controls: the label lives in title/aria, the face is a glyph.
      const button = (iconName, label, onClick, primary) => {
        const node = el('button', { type: 'button', class: `${ROOT_CLASS}-btn`, title: label, 'aria-label': label })
        if (primary) node.setAttribute('data-primary', '')
        node.append(icon(iconName))
        node.addEventListener('click', event => {
          event.stopPropagation()
          onClick()
        })
        return node
      }

      /** Timers of the press-and-hold controls, cleared when the dialog closes. */
      const repeatStops = []

      /**
       * Press-and-hold zoom. A tap is one small step; holding eases the scale
       * every frame instead of jumping 12% on a timer.
       * @param direction - +1 zoom in, -1 zoom out.
       */
      const repeatable = (node, onPress, direction) => {
        let delay = null
        let raf = 0
        let last = 0
        let holding = false
        const stop = () => {
          holding = false
          if (delay !== null) clearTimeout(delay)
          if (raf !== 0) cancelAnimationFrame(raf)
          delay = null
          raf = 0
        }
        const tick = (now) => {
          if (!holding || viewer === null) {
            raf = 0
            return
          }
          const dt = Math.min(32, now - last) / 1000
          last = now
          zoomAt(viewer.state.scale * Math.exp(direction * HOLD_RATE * dt))
          raf = requestAnimationFrame(tick)
        }
        repeatStops.push(stop)
        node.addEventListener('pointerdown', event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          onPress()
          holding = true
          delay = setTimeout(() => {
            delay = null
            if (!holding || viewer === null) return
            last = performance.now()
            raf = requestAnimationFrame(tick)
          }, HOLD_DELAY)
        })
        for (const type of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(type, stop)
        node.addEventListener('blur', stop)
        node.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onPress()
        })
        return node
      }

      const out = button('minus', T.zoomOut, () => {})
      repeatable(out, () => step(-1, undefined, CLICK_STEP), -1)
      const zoom = button('plus', T.zoomIn, () => {})
      repeatable(zoom, () => step(1, undefined, CLICK_STEP), 1)
      const fitBtn = button('fit', T.fit, () => fit())
      const actualBtn = button('actual', T.actual, () => actualSize())
      const rotateCcwBtn = button('rotateCcw', T.rotateCcw, () => rotate(-1))
      const rotateBtn = button('rotate', T.rotateCw, () => rotate(1))
      const degreeLabel = el('span', { class: `${ROOT_CLASS}-deg`, text: '0\u00b0', 'aria-live': 'polite', 'aria-label': T.rotation + ': 0\u00b0' })
      const rotateGroup = el('div', { class: `${ROOT_CLASS}-degbox` })
      rotateGroup.append(rotateCcwBtn, degreeLabel, rotateBtn)
      const downloadBtn = button('download', T.download, () => { void downloadOriginal() }, true)
      const copyBtn = button('copy', T.copy, () => { void copyImage() })
      const openBtn = button('open', T.openTab, () => { void openExternally(img.src) })
      const openSplit = el('div', { class: `${ROOT_CLASS}-open` })
      const openMain = el('button', { type: 'button', class: `${ROOT_CLASS}-open-main`, title: T.openLocal, 'aria-label': T.openLocal })
      const openIcon = el('img', { class: `${ROOT_CLASS}-open-icon`, alt: '' })
      const openFallback = el('span', { class: `${ROOT_CLASS}-open-fallback` })
      openFallback.append(icon('app'))
      const openSkeleton = el('span', { class: `${ROOT_CLASS}-open-skeleton` })
      openSkeleton.hidden = true
      openIcon.hidden = true
      openMain.append(openIcon, openFallback, openSkeleton)
      const openMore = el('button', { type: 'button', class: `${ROOT_CLASS}-open-more`, 'aria-label': T.openLocal, 'aria-haspopup': 'menu', 'aria-expanded': 'false' })
      openMore.append(icon('chevron'))
      openMore.hidden = true
      openSplit.append(openMain, openMore)
      openSplit.hidden = true
      const openMenu = el('div', { class: `${ROOT_CLASS}-open-menu`, role: 'menu', hidden: 'hidden' })
      openMain.addEventListener('click', (event) => { event.stopPropagation(); void activateOpenMain() })
      openMore.addEventListener('click', (event) => { event.stopPropagation(); toggleOpenMenu() })
      const closeBtn = button('close', T.close, () => close())

      // Editable zoom: Enter/blur applies; Escape is handled by the document
      // capture handler, which flags the blur as a cancel before it happens.
      zoomInput.addEventListener('focus', () => zoomInput.select())
      zoomInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        setZoomPercent(zoomInput.value)
        zoomInput.blur()
      })
      zoomInput.addEventListener('blur', () => {
        if (viewer === null) return
        if (viewer.zoomCancelled) {
          viewer.zoomCancelled = false
          zoomInput.value = percentOf(viewer.state.scale)
          return
        }
        setZoomPercent(zoomInput.value)
      })

      // Dialog chrome: a title row (file name, dimensions, and the window-level
      // actions: open externally and close) above the image, plus one
      // action row below it — native modal anatomy.
      const header = el('div', { class: `${ROOT_CLASS}-header` })
      const metaRow = el('div', { class: `${ROOT_CLASS}-meta-row` })
      metaRow.append(size, formatSep, formatLabel, bytesSep, bytesLabel)
      header.append(nameLabel, metaRow, el('div', { class: `${ROOT_CLASS}-spacer` }), openSplit, openBtn, closeBtn)
      // Side columns hug their content. The tool cluster is centered in the
      // gap between them, so a wider download pair does not leave it looking
      // shifted toward that side.
      readout.append(counter)
      const leftGroup = el('div', { class: `${ROOT_CLASS}-left` })
      const centerGroup = el('div', { class: `${ROOT_CLASS}-center` })
      const rightGroup = el('div', { class: `${ROOT_CLASS}-right` })
      leftGroup.append(readout)
      centerGroup.append(out, zoomInput, zoom, el('div', { class: `${ROOT_CLASS}-divider` }), fitBtn, actualBtn, el('div', { class: `${ROOT_CLASS}-divider` }), rotateGroup)
      rightGroup.append(downloadBtn, copyBtn)
      toolbar.append(leftGroup, centerGroup, rightGroup)
      stage.append(img)
      const prev = el('button', { type: 'button', class: `${ROOT_CLASS}-nav`, 'data-side': 'left', 'aria-label': T.prev })
      const next = el('button', { type: 'button', class: `${ROOT_CLASS}-nav`, 'data-side': 'right', 'aria-label': T.next })
      prev.append(chevron('left'))
      next.append(chevron('right'))
      prev.hidden = true
      next.hidden = true
      stage.append(prev, next)
      panel.append(header, stage, toolbar)
      root.append(backdrop, panel, openMenu, toastNode)
      root.addEventListener('pointerdown', (event) => {
        if (viewer === null || viewer.openMenu.hidden !== false) return
        const target = event.target
        if (target instanceof Node && (viewer.openSplit.contains(target) || viewer.openMenu.contains(target))) return
        closeOpenMenu()
      })

      viewer = {
        root, stage, img, nameLabel, size, zoomInput, counter, toast: toastNode,
        prev, next, openBtn, openSplit, openMain, openMore, openIcon, openFallback, openSkeleton, openMenu, degreeLabel,
        download: downloadBtn,
        meta: { format: formatLabel, formatSep, bytes: bytesLabel, bytesSep },
        format: '', bytes: undefined, metaToken: 0, metaAbort: undefined,
        gallery, index, name: '',
        state: { scale: 1, tx: 0, ty: 0, rotation: 0, fitScale: 1 },
        onKey: undefined, onResize: undefined,
        loadToken: 0, previousOverflow, previousFocus,
        abort: new AbortController(), zoomCancelled: false,
        openToken: 0, openState: null,
        stopRepeatables: () => { for (const stop of repeatStops) stop() },
      }

      // The header is the dialog's title bar: pointer-drag moves the window, and
      // the position is clamped to the mask so it can never leave the overlay.
      const dragPanelTo = (left, top) => {
        panel.style.position = 'absolute'
        panel.style.margin = '0'
        panel.style.left = `${left}px`
        panel.style.top = `${top}px`
        panel.style.transform = ''
      }
      // Measure once on pointerdown. Later moves only write a compositor transform
      // so the dialog does not reflow under the cursor.
      const flushPanelDrag = () => {
        if (panelDrag === null || panelDrag.cx === undefined) return
        const next = clampPanelPosition(
          panelDrag.cx - panelDrag.offsetX - panelDrag.maskLeft,
          panelDrag.cy - panelDrag.offsetY - panelDrag.maskTop,
          panelDrag.width,
          panelDrag.height,
          panelDrag.maskWidth,
          panelDrag.maskHeight,
        )
        const dx = Math.round(next.left - panelDrag.originLeft)
        const dy = Math.round(next.top - panelDrag.originTop)
        panel.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
        panelDrag.left = panelDrag.originLeft + dx
        panelDrag.top = panelDrag.originTop + dy
      }
      const endPanelDrag = () => {
        if (panelDrag === null) return
        flushPanelDrag()
        const drag = panelDrag
        panelDrag = null
        panelJob = false
        panel.removeAttribute('data-dragging')
        if (drag.left !== undefined) dragPanelTo(drag.left, drag.top)
        else panel.style.transform = ''
        stageMetrics = null
        try { header.releasePointerCapture(drag.pointerId) } catch {}
      }
      header.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        // Title-bar controls stay clickable instead of starting a drag.
        if (event.target instanceof Element && event.target.closest('button, input, a') !== null) return
        const box = panel.getBoundingClientRect()
        const mask = root.getBoundingClientRect()
        const originLeft = box.left - mask.left
        const originTop = box.top - mask.top
        dragPanelTo(originLeft, originTop)
        panelDrag = {
          pointerId: event.pointerId,
          offsetX: event.clientX - box.left,
          offsetY: event.clientY - box.top,
          originLeft,
          originTop,
          width: box.width,
          height: box.height,
          maskLeft: mask.left,
          maskTop: mask.top,
          maskWidth: mask.width,
          maskHeight: mask.height,
        }
        panel.setAttribute('data-dragging', '')
        try { header.setPointerCapture(event.pointerId) } catch {}
        event.preventDefault()
      })
      header.addEventListener('pointermove', event => {
        if (panelDrag === null || event.pointerId !== panelDrag.pointerId) return
        panelDrag.cx = event.clientX
        panelDrag.cy = event.clientY
        if (panelJob) return
        panelJob = true
        frame.schedule(() => {
          panelJob = false
          flushPanelDrag()
        })
      }, { passive: true })
      header.addEventListener('pointerup', endPanelDrag)
      header.addEventListener('pointercancel', endPanelDrag)
      header.addEventListener('lostpointercapture', endPanelDrag)

      backdrop.addEventListener('click', () => close())
      prev.addEventListener('click', event => { event.stopPropagation(); showAt(viewer.index - 1) })
      next.addEventListener('click', event => { event.stopPropagation(); showAt(viewer.index + 1) })

      const flushWheel = () => {
        wheelJob = false
        const dy = wheelDY
        const point = wheelPoint
        const notch = wheelNotch
        wheelDY = 0
        wheelNotch = false
        if (viewer === null || dy === 0 || point === null) return
        // Trackpad ticks are already tiny; apply them directly. A mouse notch
        // glides so the 12% step does not pop.
        if (!notch) {
          cancelZoomGlide()
          zoomAt(viewer.state.scale * Math.exp(-dy * ZOOM_PER_PX), point)
          return
        }
        const base = zoomGlide?.target ?? viewer.state.scale
        zoomGlide = {
          target: clamp(base * Math.exp(-dy * ZOOM_PER_PX), MIN_SCALE, MAX_SCALE),
          point,
        }
        kickGlide()
      }
      // Wheel zooms around the pointer; ctrl/meta+wheel stays browser zoom.
      // Deltas are summed and applied once per frame so a trackpad does not
      // force a layout read on every tick.
      stage.addEventListener('wheel', event => {
        if (viewer === null || event.ctrlKey || event.metaKey || event.deltaY === 0) return
        event.preventDefault()
        let dy = event.deltaY
        if (event.deltaMode === 1) dy *= 32
        else if (event.deltaMode === 2) dy *= 800
        if (Math.abs(dy) >= WHEEL_NOTCH) wheelNotch = true
        wheelDY += dy
        wheelPoint = { x: event.clientX, y: event.clientY }
        if (wheelJob) return
        wheelJob = true
        frame.schedule(flushWheel)
      }, { passive: false })

      const flushImageDrag = () => {
        if (imageDrag === null || viewer === null) return
        viewer.state.tx = imageDrag.tx + (imageDrag.cx - imageDrag.x)
        viewer.state.ty = imageDrag.ty + (imageDrag.cy - imageDrag.y)
        applyTransform(false)
      }
      const endDrag = event => {
        if (imageDrag === null) return
        flushImageDrag()
        const drag = imageDrag
        imageDrag = null
        panJob = false
        stage.removeAttribute('data-panning')
        try { stage.releasePointerCapture?.(event?.pointerId ?? drag.pointerId) } catch {}
      }
      // Drag to pan, with a grab cursor and no accidental image drag.
      stage.addEventListener('pointerdown', event => {
        if (viewer === null || event.button !== 0) return
        // Paging arrows live inside the stage; capturing the pointer here would
        // retarget the trailing click to the stage and swallow the button.
        if (event.target instanceof Element && event.target.closest('button') !== null) return
        cutTransformMotion()
        imageDrag = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          cx: event.clientX,
          cy: event.clientY,
          tx: viewer.state.tx,
          ty: viewer.state.ty,
        }
        stage.setAttribute('data-panning', '')
        try { stage.setPointerCapture?.(event.pointerId) } catch {}
      })
      stage.addEventListener('pointermove', event => {
        if (imageDrag === null || event.pointerId !== imageDrag.pointerId) return
        imageDrag.cx = event.clientX
        imageDrag.cy = event.clientY
        if (panJob) return
        panJob = true
        frame.schedule(() => {
          panJob = false
          flushImageDrag()
        })
      }, { passive: true })
      stage.addEventListener('pointerup', endDrag)
      stage.addEventListener('pointercancel', endDrag)
      stage.addEventListener('lostpointercapture', endDrag)
      stage.addEventListener('dblclick', event => {
        if (event.target instanceof Element && event.target.closest('button') !== null) return
        event.preventDefault()
        const box = stage.getBoundingClientRect()
        const currentFit = fitScale(img.naturalWidth, img.naturalHeight, box.width - FIT_PADDING * 2, box.height - FIT_PADDING * 2)
        if (Math.abs(viewer.state.scale - currentFit) < 0.001) actualSize()
        else fit()
      })

      viewer.onKey = event => {
        // Keep keyboard focus inside the modal: Tab cycles its own controls.
        if (event.key === 'Tab') {
          const nodes = [...viewer.root.querySelectorAll('button:not([hidden]):not(:disabled), input:not([hidden])')]
          if (nodes.length > 0) {
            const first = nodes[0]
            const last = nodes[nodes.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            } else if (!viewer.root.contains(document.activeElement)) {
              event.preventDefault()
              first.focus()
            }
          }
          return
        }
        // Typing inside the percentage field owns its keys.
        if (event.target === zoomInput) {
          if (event.key === 'Escape') {
            event.preventDefault()
            viewer.zoomCancelled = true
            zoomInput.blur()
          }
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          if (viewer.openMenu.hidden !== true) { closeOpenMenu(); return }
          close()
          return
        }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); step(1); return }
        if (event.key === '-') { event.preventDefault(); step(-1); return }
        if (event.key === '0') { event.preventDefault(); fit(); return }
        if (event.key === '1') { event.preventDefault(); actualSize(); return }
        if (event.key === 'r' || event.key === 'R') { event.preventDefault(); rotate(event.shiftKey ? -1 : 1); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); showAt(viewer.index - 1); return }
        if (event.key === 'ArrowRight') { event.preventDefault(); showAt(viewer.index + 1) }
      }
      viewer.onResize = () => {
        if (viewer === null || resizeQueued) return
        resizeQueued = true
        frame.schedule(() => {
          resizeQueued = false
          if (viewer === null) return
          // The caption row can appear or disappear (e.g. entering fullscreen).
          chromeTopCache = undefined
          stageMetrics = null
          const nextChromeTop = frameChromeTop()
          root.style.top = nextChromeTop > 0 ? `${nextChromeTop}px` : ''
          // A dragged dialog keeps its place but is pulled back inside the mask
          // when the viewport shrinks; an untouched dialog stays centred.
          if (panel.style.position === 'absolute') {
            const mask = root.getBoundingClientRect()
            const next = clampPanelPosition(
              Number.parseFloat(panel.style.left) || 0,
              Number.parseFloat(panel.style.top) || 0,
              panel.offsetWidth,
              panel.offsetHeight,
              mask.width,
              mask.height,
            )
            dragPanelTo(next.left, next.top)
          }
          // Re-fit only a fitted image; a user-chosen zoom survives a resize.
          if (Math.abs(viewer.state.scale - viewer.state.fitScale) < 0.001) fit()
        })
      }

      document.documentElement.style.overflow = 'hidden'
      document.body.appendChild(root)
      document.addEventListener('keydown', viewer.onKey, true)
      window.addEventListener('resize', viewer.onResize)
      showAt(index)
      // Focus lands inside the dialog; close() hands it back to the invoking control.
      closeBtn.focus({ preventScroll: true })
      shell = {
        root, stage, panel, img, nameLabel, size, zoomInput, counter,
        toast: toastNode, prev, next, openBtn, openSplit, openMain, openMore, openIcon, openFallback, openSkeleton, openMenu, download: downloadBtn, closeBtn, degreeLabel,
        meta: viewer.meta,
        stopRepeatables: viewer.stopRepeatables,
        onKey: viewer.onKey,
        onResize: viewer.onResize,
      }
      // Correct the fit after layout settles, and only then walk the gallery.
      const opened = image
      frame.schedule(() => {
        if (viewer === null) return
        adoptGallery(opened)
        if (viewer.img.naturalWidth > 0 && Math.abs(viewer.state.scale - viewer.state.fitScale) < 0.001) fit()
      })
    }

    /** Capture-phase click interception: the official dialog never sees it. */
    function onClick(event) {
      if (viewer !== null) return
      if (event.defaultPrevented || event.button !== 0) return
      // Modified and secondary clicks keep their native meaning.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      const img = target instanceof Element ? target.closest('img') : null
      if (img === null || !isCandidate(img)) return
      // A Markdown link may wrap an image; navigation should win there.
      if (img.closest('a[href]') !== null) return
      event.preventDefault()
      event.stopPropagation()
      mount(img)
    }

    let installed = false

    function install() {
      if (installed) return
      document.addEventListener('click', onClick, true)
      installed = true
    }

    function uninstall() {
      if (!installed) return
      document.removeEventListener('click', onClick, true)
      installed = false
      close()
      shell = null
      releaseDecoded()
      metaCache.clear()
      chromeTopCache = undefined
    }

    return {
      apply(ctx) {
        install()
        // Only "open with the default app" needs the Host; request the remote
        // services lazily so a Host without them still gets the viewer instead
        // of an inactive plugin.
        if (typeof ctx?.inject === 'function') {
          ctx.inject(['remote', 'remote.session'], (scoped) => {
            remoteCtx = scoped
            return () => {
              if (remoteCtx === scoped) remoteCtx = null
            }
          })
        }
        if (typeof ctx?.effect === 'function') {
          ctx.effect(() => () => {
            remoteCtx = null
            uninstall()
          })
        }
      },
      __test: { clamp, clampPanelPosition, fitScale, fileNameOf, percentOf, formatBytes, formatOf, pageDirection },
    }
  },
})
