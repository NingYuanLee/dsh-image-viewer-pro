// Offline smoke + conformance test: evaluate the loader bundle with a minimal
// DOM stub, exercise the pure helpers, and re-check the packaging rules the
// DSH loader, the plugin page and the awesome-dsh-plugin listing rely on.
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { pathToFileURL } = require('url')

const root = path.join(__dirname, '..')
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))

let bundle
let registration

globalThis.navigator = { language: 'zh-CN' }
globalThis.window = {
  location: { href: 'http://127.0.0.1:62924/' },
  __ModuleLoader__: {
    load: (next) => {
      registration = next
      bundle = next.factory()
    },
  },
}
globalThis.document = { documentElement: { lang: 'zh-CN' } }

const manifest = require(path.join(root, 'package.json'))
const near = (actual, expected, tolerance = 1e-9) => Math.abs(actual - expected) <= tolerance

let clamp
let clampPanelPosition
let fitScale
let fileNameOf
let percentOf
let formatBytes
let formatOf

let passed = 0
const check = (name, fn) => {
  fn()
  passed += 1
  console.log('ok ' + passed + ' - ' + name)
}

async function main() {
  // Load the ESM bundle through import() so Node 20 (no require(esm)) works too;
  // the bundle registers itself against the stubbed __ModuleLoader__ on load.
  await import(pathToFileURL(path.join(root, 'client.js')).href)
  ;({ clamp, clampPanelPosition, fitScale, fileNameOf, percentOf, formatBytes, formatOf } = bundle.__test)

  // 0. Registration id must be the package name: the boot graph keys every row
  //    by package name (`window.__DSH_BOOT__.entries[].id`), and the loader only
  //    normalizes a trailing `/client` — any other prefix fails to register.
  check('registration id equals package name', () => {
    assert.strictEqual(registration.id, manifest.name)
    assert.strictEqual(typeof registration.factory, 'function')
  })

  // 1. Zoom bounds clamp.
  check('zoom bounds clamp', () => {
    assert.strictEqual(clamp(0.01, 0.05, 40), 0.05)
    assert.strictEqual(clamp(99, 0.05, 40), 40)
    assert.strictEqual(clamp(2, 0.05, 40), 2)
  })

  // 2. Fit scale never enlarges a small image past 1:1.
  check('fit scale', () => {
    assert.strictEqual(fitScale(100, 100, 800, 600), 1)
    assert.ok(near(fitScale(1600, 1200, 800, 600), 0.5))
    assert.ok(near(fitScale(400, 2000, 800, 600), 0.3))
    // Missing natural size falls back to 1:1 instead of dividing by zero.
    assert.strictEqual(fitScale(0, 0, 800, 600), 1)
  })

  // 2b. Dialog drag bounds: the whole dialog box stays inside the mask.
  check('panel drag bounds', () => {
    // Free movement inside the mask is preserved.
    assert.deepStrictEqual(clampPanelPosition(120, 80, 600, 400, 1200, 900), { left: 120, top: 80 })
    // Dragging past the top/left edge stops at the edge.
    assert.deepStrictEqual(clampPanelPosition(-90, -40, 600, 400, 1200, 900), { left: 0, top: 0 })
    // Dragging past the bottom/right edge stops when the far edge reaches it.
    assert.deepStrictEqual(clampPanelPosition(900, 700, 600, 400, 1200, 900), { left: 600, top: 500 })
    // A mask smaller than the dialog pins it to the origin instead of going negative.
    assert.deepStrictEqual(clampPanelPosition(50, 50, 800, 700, 700, 600), { left: 0, top: 0 })
  })

  // 2c. Header meta line: uppercase format labels and B/KB/MB size labels.
  check('image meta labels', () => {
    assert.strictEqual(formatBytes(0), '0 B')
    assert.strictEqual(formatBytes(1023), '1023 B')
    assert.strictEqual(formatBytes(1024), '1.0 KB')
    assert.strictEqual(formatBytes(1536), '1.5 KB')
    assert.strictEqual(formatBytes(1024 * 1024 - 1), '1024.0 KB')
    assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB')
    assert.strictEqual(formatBytes(3.5 * 1024 * 1024), '3.5 MB')
    assert.strictEqual(formatBytes(Number.NaN), '')

    // data:/blob: sources are labelled by their media type.
    assert.strictEqual(formatOf('data:image/svg+xml;charset=utf-8,...'), 'SVG')
    assert.strictEqual(formatOf('blob:http://127.0.0.1/abc', 'image/webp'), 'WEBP')
    // Content type wins over the extension; the extension is the fallback.
    assert.strictEqual(formatOf('/api/file?path=x.bmp', 'application/octet-stream'), 'BMP')
    assert.strictEqual(formatOf('/api/file?path=D%3A%2Fshots%2Fa.PNG'), 'PNG')
    assert.strictEqual(formatOf('https://example.com/pic.jpeg'), 'JPG')
    assert.strictEqual(formatOf('https://example.com/no-extension'), '')
    assert.strictEqual(formatOf('blob:http://127.0.0.1/abc'), '')
  })

  // 3. Zoom percentage label.
  check('zoom percentage label', () => {
    assert.strictEqual(percentOf(1), '100%')
    assert.strictEqual(percentOf(0.333), '33%')
  })

  // 4. File names: DSH's /api/file?path= targets keep their basename.
  check('file names', () => {
    assert.strictEqual(
      fileNameOf('http://127.0.0.1:62924/api/file?path=D%3A%2Fwork%2Fshot.png'),
      'shot.png',
    )
    assert.strictEqual(fileNameOf('/api/file?path=C%3A%5Ctmp%5Ca%20b%2Fpic.webp'), 'pic.webp')
    assert.strictEqual(fileNameOf('https://example.com/a/b/c.jpg?x=1'), 'c.jpg')
    // Empty source keeps a readable placeholder instead of throwing.
    assert.strictEqual(fileNameOf(''), '图片')
    // DSH renders message attachments (and read_image results) as blob: URLs,
    // and inline data: images are content too; neither carries a file name.
    assert.strictEqual(fileNameOf('blob:http://127.0.0.1:62924/7c1b2a3d'), '图片')
    assert.strictEqual(fileNameOf('data:image/png;base64,iVBORw0KGgo='), '图片')
    // A malformed percent escape must not throw out of the label lookup.
    assert.strictEqual(typeof fileNameOf('/api/file?path=%E0%A4%A'), 'string')
  })

  // 5. The bundle requires the `remote` service: the Host path opener (open a
  //    local image in its default app) lives there.
  check('bundle contract', () => {
    // Cordis inject is all-required: declaring remote here would park the whole
    // plugin on a Host without those services. The feature injects lazily instead.
    assert.strictEqual(bundle.inject, undefined)
    assert.strictEqual(typeof bundle.apply, 'function')
  })

  // 6. Bundle manifest: installable with `dsh plugin add`, Web client scanned.
  check('bundle manifest', () => {
    assert.strictEqual(manifest.dsh.bundle.patch, './cordis.patch.yml')
    assert.strictEqual(manifest.dsh.client.platform, 'web')
    assert.strictEqual(manifest.dsh.client.immediately, true)
    // The bundle imports no client module, so it must not order itself behind one.
    assert.strictEqual(manifest.dsh.client.inject, undefined)
    assert.strictEqual(manifest.dsh.manifestVersion, 1)
    assert.strictEqual(manifest.engines.dsh, '>=0.2.1-rc.2 <0.3.0-0')
    assert.strictEqual(manifest.engines.node, '>=22.19.0')
    assert.ok(manifest.keywords.includes('dsh-plugin'))
  })

  // 7. Files shipped to npm cover every entry point the loader resolves.
  check('published files', () => {
    for (const name of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/zh.json', 'locale/en.json']) {
      const expected = name.startsWith('locale/') ? 'locale/*.json' : name
      assert.ok(manifest.files.includes(expected), 'files must include ' + expected)
    }
    for (const name of ['SECURITY.md', 'README*', 'LICENSE', 'CHANGELOG.md']) {
      assert.ok(manifest.files.includes(name), 'files must include ' + name)
    }
    assert.strictEqual(manifest.exports['./package.json'], './package.json')
    assert.ok(manifest.exports['./locale/*.json'])
  })

  // 8. Loader row: one insert whose id/name point at this package.
  check('cordis patch row', () => {
    const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')
    assert.ok(patch.includes('insert:'))
    assert.ok(patch.includes("name: 'dsh-image-viewer-pro'"))
    assert.ok(/id:\s*dsh-image-viewer-pro/.test(patch))
  })

  // 9. Storefront screenshots: 1-8 relative paths that stay inside the repo.
  check('screenshots manifest', () => {
    const shots = readJson('screenshots.json')
    assert.ok(Array.isArray(shots), 'screenshots.json must be an array')
    assert.ok(shots.length >= 1 && shots.length <= 8)
    for (const shot of shots) {
      assert.strictEqual(typeof shot, 'string')
      assert.ok(!shot.startsWith('/'), 'screenshot path must be relative: ' + shot)
      assert.ok(!shot.split('/').includes('..'), 'screenshot path may not escape the repo: ' + shot)
      assert.ok(fs.existsSync(path.join(root, shot)), 'missing screenshot: ' + shot)
    }
  })

  // 10. Locale metadata: the plugin page shows these strings.
  check('locale metadata', () => {
    for (const lang of ['zh', 'en']) {
      const locale = readJson('locale/' + lang + '.json')
      assert.ok(locale.meta.title.length > 0)
      assert.ok(locale.meta.description.length > 0)
    }
  })

  // 11. Both READMEs carry the install command the plugin page hands out.
  check('README install command', () => {
    for (const file of ['README.md', 'README.zh.md']) {
      const text = fs.readFileSync(path.join(root, file), 'utf8')
      assert.ok(text.includes('github:NingYuanLee/dsh-image-viewer-pro'), file)
      assert.ok(text.includes('dsh plugin --profile'), file)
      assert.ok(!text.includes('README.en.md'), file)
    }
    assert.ok(fs.readFileSync(path.join(root, 'README.md'), 'utf8').includes('[中文](README.zh.md)'))
    assert.ok(fs.readFileSync(path.join(root, 'README.zh.md'), 'utf8').includes('[English](README.md)'))
  })

  console.log('ok: ' + passed + ' groups passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
