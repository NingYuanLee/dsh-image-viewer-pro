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
        rotate: '旋转 90°',
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
        rotate: 'Rotate 90°',
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

    /**
     * Height of the host window's top chrome that must stay uncovered: the app
     * header is a window-drag region carrying the real window/utility buttons,
     * so an overlay that starts at y=0 covers them (they can't be clicked).
     * Measure the widest drag header, and honour the frame's own inset token
     * when the desktop shell publishes one.
     * @returns pixels to inset the viewer from the top of the viewport.
     */
    function topInset() {
      let bottom = 0
      const wide = window.innerWidth * 0.5
      for (const node of document.querySelectorAll('[data-window-drag]')) {
        const rect = node.getBoundingClientRect()
        // Skip tall drag panes (a whole pane, not a header strip).
        if (rect.width < wide || rect.height === 0 || rect.height > 120) continue
        bottom = Math.max(bottom, rect.bottom)
      }
      const declared = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-overlay-top'))
      if (Number.isFinite(declared)) bottom = Math.max(bottom, declared)
      return Math.max(0, Math.round(bottom))
    }

    const CSS = `
      .${ROOT_CLASS}{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14,13px/20px system-ui,-apple-system,"Segoe UI",sans-serif);user-select:none}
      .${ROOT_CLASS}-backdrop{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,#0000003d);backdrop-filter:var(--dsw-mask-blur,none);animation:${ROOT_CLASS}-fade .16s var(--ds-ease-in-out,ease-out)}
      @keyframes ${ROOT_CLASS}-fade{from{opacity:0}to{opacity:1}}
      .${ROOT_CLASS}-panel{position:relative;display:flex;flex-direction:column;width:min(1200px,94vw);height:min(860px,86vh);overflow:hidden;border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #00000029,0 3px 8px #00000008);animation:${ROOT_CLASS}-pop .16s var(--ds-ease-in-out,ease-out)}
      @keyframes ${ROOT_CLASS}-pop{from{opacity:0}to{opacity:1}}
      .${ROOT_CLASS}-header{display:flex;align-items:center;gap:10px;flex:none;padding:12px 10px 10px 16px}
      .${ROOT_CLASS}-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
      .${ROOT_CLASS}-meta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .${ROOT_CLASS}-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:grab;touch-action:none;background:var(--dsw-alias-bg-document-preview,#f2f3f5)}
      .${ROOT_CLASS}-stage[data-panning]{cursor:grabbing}
      .${ROOT_CLASS}-img{max-width:none;max-height:none;will-change:transform;border-radius:4px;box-shadow:var(--dsw-elevation-panel,0 0 0 .5px #00000029,0 3px 8px #00000008);background:var(--dsw-alias-bg-base,#fff);transform-origin:center center;-webkit-user-drag:none}
      .${ROOT_CLASS}-toolbar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;flex:none;padding:8px 10px;border-top:.5px solid var(--dsw-alias-border-l3,#0000001f);background:var(--dsw-alias-bg-base,#fff)}
      .${ROOT_CLASS}-left{display:flex;align-items:center;gap:6px;min-width:0}
      .${ROOT_CLASS}-center{display:flex;align-items:center;gap:6px;justify-self:center}
      .${ROOT_CLASS}-right{display:flex;align-items:center;gap:6px;justify-self:end}
      .${ROOT_CLASS}-readout{display:flex;align-items:center;gap:8px;padding:0 8px 0 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
      .${ROOT_CLASS}-zoom{width:44px;height:22px;padding:0;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:center;outline:none}
      .${ROOT_CLASS}-zoom:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-zoom:focus{background:var(--dsw-alias-bg-base,#fff);box-shadow:var(--dsw-elevation-soft,0 0 0 .5px var(--dsw-alias-border-l3,#0000001f));color:var(--dsw-alias-label-primary)}
      .${ROOT_CLASS}-spacer{flex:1}
      .${ROOT_CLASS}-divider{width:.5px;height:18px;background:var(--dsw-alias-border-l3,#0000001f);flex:none}
      .${ROOT_CLASS}-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
      .${ROOT_CLASS}-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
      .${ROOT_CLASS}-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:-2px}
      .${ROOT_CLASS}-btn:disabled{opacity:.45;cursor:default}
      .${ROOT_CLASS}-btn[hidden]{display:none}
      .${ROOT_CLASS}-btn[data-primary]{background:var(--dsw-alias-state-business-primary,#4176e6);color:#fff}
      .${ROOT_CLASS}-btn[data-primary]:hover{filter:brightness(1.05)}
      .${ROOT_CLASS}-icon{display:block}
      /* Side paging arrows: circular chrome around a geometrically centred glyph,
         dim by default (they sit on top of the image) and solid on hover. */
      .${ROOT_CLASS}-nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:50%;corner-shape:round;background:var(--dsw-specific-menu,#f8f9fa);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);cursor:pointer;opacity:.35;transition:opacity .16s ease,background-color .16s ease}
      .${ROOT_CLASS}-nav:hover,.${ROOT_CLASS}-nav:focus-visible{opacity:1;background:var(--dsw-alias-bg-base,#fff)}
      .${ROOT_CLASS}-nav:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:1px}
      .${ROOT_CLASS}-nav[data-side=left]{left:12px}
      .${ROOT_CLASS}-nav[data-side=right]{right:12px}
      .${ROOT_CLASS}-nav[hidden]{display:none}
      .${ROOT_CLASS}-toast{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);padding:7px 14px;border-radius:var(--dsw-radius-md,12px);background:var(--dsw-specific-menu,#f8f9fa);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));box-shadow:var(--dsw-elevation-panel);border:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;opacity:0;transition:opacity .16s ease}
      .${ROOT_CLASS}-toast[data-visible]{opacity:1}
      @media (prefers-reduced-motion: reduce){
        .${ROOT_CLASS}-panel,.${ROOT_CLASS}-backdrop{animation:none}
        .${ROOT_CLASS}-nav,.${ROOT_CLASS}-toast{transition:none}
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
      download: ['M8 2.5v8', 'M4.5 7.5 8 11l3.5-3.5', 'M2.5 13.5h11'],
      copy: ['M5.5 2.5h8v8', 'M2.5 5.5h8v8h-8z'],
      open: ['M6.5 3H3v10h10V9.5', 'M9.5 2.5H14V7', 'M14 2.5 8 8.5'],
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
      const scope = img.closest('[data-conversation-scroll]')
      if (scope === null) return [img]
      const gallery = []
      for (const node of scope.querySelectorAll('img')) {
        if (isCandidate(node)) gallery.push(node)
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

    function toast(message) {
      if (viewer === null) return
      const node = viewer.toast
      node.textContent = message
      node.setAttribute('data-visible', '')
      clearTimeout(viewer.toastTimer)
      viewer.toastTimer = setTimeout(() => node.removeAttribute('data-visible'), 1600)
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
    function applyTransform() {
      const { state, img } = viewer
      img.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale}) rotate(${state.rotation}deg)`
      // Never fight the user while they are typing a percentage.
      if (document.activeElement !== viewer.zoomInput) viewer.zoomInput.value = percentOf(state.scale)
    }

    /** Jump to one typed percentage, centred on the stage. */
    function setZoomPercent(text) {
      const parsed = Number.parseFloat(String(text).replace('%', '').trim())
      if (!Number.isFinite(parsed) || parsed <= 0) {
        viewer.zoomInput.value = percentOf(viewer.state.scale)
        return
      }
      viewer.state.scale = clamp(parsed / 100, MIN_SCALE, MAX_SCALE)
      viewer.state.tx = 0
      viewer.state.ty = 0
      applyTransform()
    }

    function fit() {
      const { state, img, stage } = viewer
      const box = stage.getBoundingClientRect()
      state.scale = fitScale(
        img.naturalWidth,
        img.naturalHeight,
        box.width - FIT_PADDING * 2,
        box.height - FIT_PADDING * 2,
      )
      state.tx = 0
      state.ty = 0
      state.fitScale = state.scale
      applyTransform()
    }

    function actualSize() {
      viewer.state.scale = 1
      viewer.state.tx = 0
      viewer.state.ty = 0
      applyTransform()
    }

    /** Zoom keeping one stage-relative point fixed under the cursor. */
    function zoomAt(nextScale, point) {
      const { state, stage } = viewer
      const target = clamp(nextScale, MIN_SCALE, MAX_SCALE)
      const box = stage.getBoundingClientRect()
      const px = point === undefined ? 0 : point.x - box.left - box.width / 2
      const py = point === undefined ? 0 : point.y - box.top - box.height / 2
      const ratio = target / state.scale
      state.tx = px - (px - state.tx) * ratio
      state.ty = py - (py - state.ty) * ratio
      state.scale = target
      applyTransform()
    }

    function step(dir, point) {
      zoomAt(viewer.state.scale * (dir > 0 ? 1.25 : 1 / 1.25), point)
    }

    function rotate() {
      const { state, img, stage } = viewer
      const box = stage.getBoundingClientRect()
      const currentFit = fitScale(img.naturalWidth, img.naturalHeight, box.width - FIT_PADDING * 2, box.height - FIT_PADDING * 2)
      const wasFit = Math.abs(state.scale - currentFit) < 0.001
      state.rotation = (state.rotation + 90) % 360
      // A fitted image must be refitted: rotating swaps its bounding box.
      if (wasFit) fit()
      else applyTransform()
    }

    function showAt(index) {
      const gallery = viewer.gallery
      if (gallery.length === 0) return
      viewer.index = (index + gallery.length) % gallery.length
      const source = gallery[viewer.index]
      const src = source.currentSrc || source.src
      viewer.img.src = src
      viewer.img.alt = source.alt || ''
      // Attachment images (blob:) carry no filename in the URL; the official alt
      // text does, so prefer it over the generic fallback.
      const alt = String(source.alt || '').trim()
      viewer.name = alt !== '' && alt !== T.image ? alt : fileNameOf(src)
      // Local files open through the Host in their default app; remote URLs go
      // to the default browser. data: URLs cannot be navigated to as a document.
      const openLabel = isLocalFileSource(src) ? T.openLocal : T.openTab
      viewer.openBtn.title = openLabel
      viewer.openBtn.setAttribute('aria-label', openLabel)
      // Blob URLs are denied by the desktop shell's window-open policy and data:
      // URLs cannot be top-level documents; download/copy cover those sources.
      viewer.openBtn.hidden = src.startsWith('blob:') || src.startsWith('data:')
      viewer.counter.textContent = gallery.length > 1 ? `${viewer.index + 1} / ${gallery.length}` : ''
      viewer.counter.hidden = gallery.length <= 1
      viewer.nameLabel.textContent = viewer.name
      viewer.root.setAttribute('aria-label', viewer.name === T.image ? T.title : `${T.title}: ${viewer.name}`)
      viewer.prev.hidden = gallery.length <= 1
      viewer.next.hidden = gallery.length <= 1
      viewer.state.scale = 1
      viewer.state.tx = 0
      viewer.state.ty = 0
      viewer.state.rotation = 0
      const token = (viewer.loadToken = (viewer.loadToken ?? 0) + 1)
      const ready = () => {
        // A gallery switch may finish loading the previous source after the next
        // one is already on screen; only the current load may size the dialog.
        if (viewer === null || viewer.loadToken !== token) return
        viewer.size.textContent = `${viewer.img.naturalWidth} × ${viewer.img.naturalHeight}`
        fit()
      }
      if (viewer.img.complete && viewer.img.naturalWidth > 0) ready()
      else viewer.img.addEventListener('load', ready, { once: true })
    }

    function close() {
      if (viewer === null) return
      const closing = viewer
      viewer = null
      document.removeEventListener('keydown', closing.onKey, true)
      window.removeEventListener('resize', closing.onResize)
      closing.stopRepeatables?.()
      closing.abort?.abort()
      closing.root.remove()
      document.documentElement.style.overflow = closing.previousOverflow
      if (closing.toastTimer) clearTimeout(closing.toastTimer)
      // Hand keyboard focus back to whatever opened the viewer.
      closing.previousFocus?.focus?.({ preventScroll: true })
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

    /** Re-encode a non-PNG blob so the clipboard accepts it. */
    async function toPng(blob) {
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      return await new Promise(resolve => canvas.toBlob(result => resolve(result ?? blob), 'image/png'))
    }

    function mount(image) {
      close()
      const previousOverflow = document.documentElement.style.overflow
      const previousFocus = document.activeElement
      const gallery = galleryOf(image)
      const index = Math.max(0, gallery.indexOf(image))

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
      const inset = topInset()
      // Keep the host's top chrome uncovered: those are the window/utility
      // buttons the overlay used to swallow.
      if (inset > 0) root.style.top = `${inset}px`
      const backdrop = el('div', { class: `${ROOT_CLASS}-backdrop` })
      const panel = el('div', { class: `${ROOT_CLASS}-panel`, role: 'document' })
      const stage = el('div', { class: `${ROOT_CLASS}-stage` })
      const img = el('img', { class: `${ROOT_CLASS}-img`, alt: '', draggable: 'false' })
      const toolbar = el('div', { class: `${ROOT_CLASS}-toolbar` })
      const readout = el('div', { class: `${ROOT_CLASS}-readout` })
      const nameLabel = el('span', { class: `${ROOT_CLASS}-title` })
      const size = el('span', { class: `${ROOT_CLASS}-meta` })
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

      /** Press-and-hold repeat: one full step now, gentler steps while held. */
      const repeatable = (node, onPress, onRepeat) => {
        let delay = null
        let timer = null
        const stop = () => {
          if (delay !== null) clearTimeout(delay)
          if (timer !== null) clearInterval(timer)
          delay = null
          timer = null
        }
        repeatStops.push(stop)
        node.addEventListener('pointerdown', event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          onPress()
          delay = setTimeout(() => { timer = setInterval(onRepeat, 110) }, 400)
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
      repeatable(out, () => step(-1), () => zoomAt(viewer.state.scale / 1.12))
      const zoom = button('plus', T.zoomIn, () => {})
      repeatable(zoom, () => step(1), () => zoomAt(viewer.state.scale * 1.12))
      const fitBtn = button('fit', T.fit, () => fit())
      const actualBtn = button('actual', T.actual, () => actualSize())
      const rotateBtn = button('rotate', T.rotate, () => rotate())
      const downloadBtn = button('download', T.download, () => { void downloadOriginal() }, true)
      const copyBtn = button('copy', T.copy, () => { void copyImage() })
      const openBtn = button('open', T.openTab, () => { void openExternally(img.src) })
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
      header.append(nameLabel, size, el('div', { class: `${ROOT_CLASS}-spacer` }), openBtn, closeBtn)
      // Three columns so the zoom + fit group is optically centred in the row
      // no matter how wide the side groups get.
      readout.append(counter)
      const leftGroup = el('div', { class: `${ROOT_CLASS}-left` })
      const centerGroup = el('div', { class: `${ROOT_CLASS}-center` })
      const rightGroup = el('div', { class: `${ROOT_CLASS}-right` })
      leftGroup.append(readout)
      centerGroup.append(out, zoomInput, zoom, el('div', { class: `${ROOT_CLASS}-divider` }), fitBtn, actualBtn, rotateBtn)
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
      root.append(backdrop, panel, toastNode)

      viewer = {
        root, stage, img, nameLabel, size, zoomInput, counter, toast: toastNode,
        prev, next, openBtn,
        download: downloadBtn,
        gallery, index, name: '',
        state: { scale: 1, tx: 0, ty: 0, rotation: 0, fitScale: 1 },
        onKey: undefined, onResize: undefined, toastTimer: undefined,
        loadToken: 0, previousOverflow, previousFocus,
        abort: new AbortController(), zoomCancelled: false,
        stopRepeatables: () => { for (const stop of repeatStops) stop() },
      }

      backdrop.addEventListener('click', () => close())
      prev.addEventListener('click', event => { event.stopPropagation(); showAt(viewer.index - 1) })
      next.addEventListener('click', event => { event.stopPropagation(); showAt(viewer.index + 1) })

      // Wheel zooms around the pointer; ctrl/meta+wheel stays browser zoom.
      stage.addEventListener('wheel', event => {
        if (event.ctrlKey || event.metaKey || event.deltaY === 0) return
        event.preventDefault()
        step(event.deltaY < 0 ? 1 : -1, { x: event.clientX, y: event.clientY })
      }, { passive: false })

      // Drag to pan, with a grab cursor and no accidental image drag.
      let drag = null
      stage.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        // Paging arrows live inside the stage; capturing the pointer here would
        // retarget the trailing click to the stage and swallow the button.
        if (event.target instanceof Element && event.target.closest('button') !== null) return
        drag = { x: event.clientX, y: event.clientY, tx: viewer.state.tx, ty: viewer.state.ty, moved: false }
        stage.setAttribute('data-panning', '')
        stage.setPointerCapture?.(event.pointerId)
      })
      stage.addEventListener('pointermove', event => {
        if (drag === null) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true
        viewer.state.tx = drag.tx + dx
        viewer.state.ty = drag.ty + dy
        applyTransform()
      })
      const endDrag = event => {
        if (drag === null) return
        stage.removeAttribute('data-panning')
        stage.releasePointerCapture?.(event.pointerId)
        drag = null
      }
      stage.addEventListener('pointerup', endDrag)
      stage.addEventListener('pointercancel', endDrag)
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
        if (event.key === 'Escape') { event.preventDefault(); close(); return }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); step(1); return }
        if (event.key === '-') { event.preventDefault(); step(-1); return }
        if (event.key === '0') { event.preventDefault(); fit(); return }
        if (event.key === '1') { event.preventDefault(); actualSize(); return }
        if (event.key === 'r' || event.key === 'R') { event.preventDefault(); rotate(); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); showAt(viewer.index - 1); return }
        if (event.key === 'ArrowRight') { event.preventDefault(); showAt(viewer.index + 1) }
      }
      viewer.onResize = () => {
        if (viewer === null) return
        // Re-fit only a fitted image; a user-chosen zoom survives a resize.
        if (Math.abs(viewer.state.scale - viewer.state.fitScale) < 0.001) fit()
      }

      document.documentElement.style.overflow = 'hidden'
      document.body.appendChild(root)
      document.addEventListener('keydown', viewer.onKey, true)
      window.addEventListener('resize', viewer.onResize)
      showAt(index)
      // Focus lands inside the dialog; close() hands it back to the invoking control.
      closeBtn.focus({ preventScroll: true })
      // Re-fit once the dialog has its settled layout: the first fit may run
      // while the panel is still being laid out, and a wrong box would leave
      // the image under-sized.
      requestAnimationFrame(() => {
        if (viewer === null || viewer.img.naturalWidth === 0) return
        fit()
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
      __test: { clamp, fitScale, fileNameOf, percentOf },
    }
  },
})
