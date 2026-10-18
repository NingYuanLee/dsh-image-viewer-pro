// Offline smoke test: evaluate the loader bundle with a minimal DOM stub, then
// exercise the pure helpers the viewer is built on.
const path = require('path')
const assert = require('assert')

let bundle

globalThis.navigator = { language: 'zh-CN' }
globalThis.window = {
  location: { href: 'http://127.0.0.1:62924/' },
  __ModuleLoader__: {
    load: ({ factory }) => { bundle = factory() },
  },
}
globalThis.document = { documentElement: { lang: 'zh-CN' } }

require(path.join(__dirname, '..', 'client.js'))

const { clamp, fitScale, fileNameOf, percentOf } = bundle.__test

const near = (actual, expected, tolerance = 1e-9) => Math.abs(actual - expected) <= tolerance

async function main() {
  // 1. Zoom bounds clamp.
  assert.strictEqual(clamp(0.01, 0.05, 40), 0.05)
  assert.strictEqual(clamp(99, 0.05, 40), 40)
  assert.strictEqual(clamp(2, 0.05, 40), 2)

  // 2. Fit scale never enlarges a small image past 1:1.
  assert.strictEqual(fitScale(100, 100, 800, 600), 1)
  assert.ok(near(fitScale(1600, 1200, 800, 600), 0.5))
  assert.ok(near(fitScale(400, 2000, 800, 600), 0.3))
  // Missing natural size falls back to 1:1 instead of dividing by zero.
  assert.strictEqual(fitScale(0, 0, 800, 600), 1)

  // 3. Zoom percentage label.
  assert.strictEqual(percentOf(1), '100%')
  assert.strictEqual(percentOf(0.333), '33%')

  // 4. File names: DSH's /api/file?path= targets keep their basename.
  assert.strictEqual(
    fileNameOf('http://127.0.0.1:62924/api/file?path=D%3A%2Fwork%2Fshot.png'),
    'shot.png',
  )
  assert.strictEqual(fileNameOf('/api/file?path=C%3A%5Ctmp%5Ca%20b%2Fpic.webp'), 'pic.webp')
  assert.strictEqual(fileNameOf('https://example.com/a/b/c.jpg?x=1'), 'c.jpg')
  // Empty source keeps a readable placeholder instead of throwing.
  assert.strictEqual(fileNameOf(''), '图片')

  // 5. The bundle requires the `remote` service: the Host path opener (open a
  //    local image in its default app) lives there.
  assert.deepStrictEqual(bundle.inject, ['remote', 'remote.session'])
  assert.strictEqual(typeof bundle.apply, 'function')

  console.log('ok: 5 assertions passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
