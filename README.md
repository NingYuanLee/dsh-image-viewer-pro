# dsh-image-viewer-pro

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-%E2%89%A50.2.1--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)
[![release](https://img.shields.io/github/v/release/NingYuanLee/dsh-image-viewer-pro?sort=semver)](https://github.com/NingYuanLee/dsh-image-viewer-pro/releases)

**A real image viewer for images inside DeepSeek Harness conversations.** Wheel zoom, drag pan, 90° rotate, download, copy, open in the default app, and gallery browsing — replacing the stock preview that only offers a close button.

English | [中文](README.zh.md)

![Viewer preview](docs/preview.png)

## Why

The stock image preview in DSH 0.2.1-rc.2 only offers **Close**: no zoom, no pan, no rotate, no download, no switching between the images of one conversation. This plugin takes over content-image clicks in the **capture phase** and renders its own dialog — it does not depend on official slot contracts, so it stays working when image slots change.

## Features

- **Zoom** — wheel zooms around the pointer; the footer shows `− [percent] +` and the percentage is editable (Enter applies, Esc reverts); press and hold ± to keep zooming.
- **Pan** — drag the canvas; double-click toggles fit ↔ actual size.
- **Rotate** — 90° per click.
- **Download original** — with progress; saves to the system downloads folder.
- **Copy image** — writes a PNG to the clipboard.
- **Gallery** — browse the other images in the same conversation with the round side arrows or `←` / `→`; shows `current / total`.
- **Open with default app** — local files go through the Host's `session.openWorkspacePath` (OS default viewer); remote `http(s)` images open in the default browser.
- **Native look** — the backdrop and dialog use DSH theme tokens, follow light/dark, keep the host window buttons uncovered, and honour `prefers-reduced-motion`.

## What it takes over

| Image | Viewer |
| --- | --- |
| Markdown images in message text (`![](...)`, http(s) or the Host file route) | ✅ |
| Images attached to user and assistant messages (DSH renders them as `blob:` URLs) | ✅ |
| Tool-result images such as `read_image` (same attachment channel) | ✅ |
| Icons, avatars and status images below 48px | ❌ stay native |
| Images inside the plugin's own dialog (recursion guard) | ❌ |

Only the click behaviour is intercepted: message content is not modified, no session data is written, and the page returns to normal after closing the dialog.

## Shortcuts

| Key | Action |
| --- | --- |
| `Esc` | Close (leaves the percentage field first) |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Fit to window |
| `1` | Actual size (1:1) |
| `R` | Rotate 90° |
| `←` / `→` | Previous / next image |
| Double-click | Fit ↔ actual size |

## Install

This is a plain-JavaScript DSH bundle (`package.json` declares `dsh.bundle`): nothing to build, no build-script approval, and a page refresh is enough (restart DSH once after the first install).

### DSH plugin page

1. Open **Plugins → Add plugin**
2. Paste:

```text
github:NingYuanLee/dsh-image-viewer-pro
```

3. Refresh or restart DSH when prompted.

### CLI

Web profile (the one `dsh web` boots):

```sh
dsh plugin --profile web add github:NingYuanLee/dsh-image-viewer-pro
```

Desktop profile:

```sh
dsh plugin --profile desktop add github:NingYuanLee/dsh-image-viewer-pro
```

> Use whatever profile you actually boot. A GitHub source install pulls the repository; this package has no `prepare` script, so pnpm never asks for `allowBuilds`.

### Prebuilt Release tarball

```sh
dsh plugin --profile web add https://github.com/NingYuanLee/dsh-image-viewer-pro/releases/latest/download/dsh-image-viewer-pro.tgz
```

## Uninstall

```sh
dsh plugin --profile web remove dsh-image-viewer-pro
```

Or disable / remove it from the Plugins page. Uninstalling restores the stock preview and never deletes sessions or images.

## Compatibility

- Verified on **DSH `0.2.1-rc.2`** (Web GUI and desktop, both Web renderers).
- Declares `engines.dsh: >=0.2.1-rc.2 <0.3.0-0` and `engines.node: >=22.19.0`, checked on install and profile boot.
- Uses the Host `remote` / `remote.session` services for "open with default app"; when unavailable that action degrades to a notice and everything else keeps working.

## Conformance with DSH plugin conventions

Checked against the official *Packaging and installing plugins* docs and the awesome-dsh-plugin listing requirements:

| Requirement | Status |
| --- | --- |
| `package.json` declares `dsh.bundle` (installable via `dsh plugin add`) | ✅ `dsh.bundle.patch` |
| `package.json` declares `dsh.manifestVersion: 1` | ✅ `dsh.manifestVersion: 1` |
| Root `cordis.patch.yml` whose row name matches the package | ✅ `name: dsh-image-viewer-pro` |
| Supported DSH version range | ✅ `engines.dsh: >=0.2.1-rc.2 <0.3.0-0` |
| Supported Node version | ✅ `engines.node: >=22.19.0` |
| Official `@deepseek-ai/*` packages as `peerDependencies` | ✅ imports none, so no peers required |
| Presentation metadata (title / description / icon) | ✅ `locale/{zh,en}.json` + `icon.svg` |
| Installable without a build step | ✅ plain JS, verified with `dsh plugin add github:...` |
| Storefront screenshots | ✅ root `screenshots.json` |
| Repository topic `dsh-plugin` | ✅ |
| Real working code + tests | ✅ `npm test` (offline smoke + manifest consistency) and GitHub Actions |
| Web styling rules (semantic tokens, no border+elevation pairing, `corner-shape` on circles, reduced motion) | ✅ see the `CSS` constant in `client.js` |

## Development

```sh
git clone https://github.com/NingYuanLee/dsh-image-viewer-pro.git
cd dsh-image-viewer-pro
npm test
```

For local development, install the directory into a profile as a `link:` dependency; a page refresh reloads the client half (the first registration needs one restart).

| File | Role |
| --- | --- |
| `client.js` | Everything browser-side: icons, dialog, gestures, download, copy, gallery |
| `index.js` | Host placeholder so the package is a Loader-scannable bundle |
| `cordis.patch.yml` | Inserts the Loader row into the profile |
| `test/smoke.test.cjs` | Offline smoke tests plus manifest / registration-id / copy consistency checks |
| `screenshots.json` | Storefront screenshot list (1–8 relative paths) |

## Privacy

- No third-party requests, no access to model credentials.
- Download / copy only touch the current image; "open with default app" goes through DSH's Host-side capability.
- Interception only affects clicks: no message content is injected and no session record is modified.

## Known limitations

- Icons, avatars and status images below 48px stay native (see the coverage table above).
- Remote cross-origin images are displayed by the browser directly; when their server does not allow CORS, download falls back to opening the image in a new tab and copy falls back to copying its URL.
- Icons are inline 16px SVG; the `1:1` glyph is dense at that size.
- Targets the DSH Web GUI and desktop client (same Web renderer).
- The gallery counts images currently rendered in the conversation scrollport; in extreme virtual-scrolling cases only mounted images can be browsed.

## License

MIT © 2026 [NingYuanLee](https://github.com/NingYuanLee)
