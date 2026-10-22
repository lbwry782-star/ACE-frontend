/**
 * Examples page source wiring.
 * Run: node scripts/test-examples-page.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXAMPLES, SHOW_EXAMPLES_DESIGN_NOTE } from '../src/pages/Examples/examplesData.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const appSource = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const pageSource = readFileSync(join(root, 'src/pages/Examples/ExamplesPage.jsx'), 'utf8')
const cssSource = readFileSync(join(root, 'src/pages/Examples/ExamplesPage.css'), 'utf8')
const homeSource = readFileSync(join(root, 'src/pages/UnderConstruction/UnderConstructionPage.jsx'), 'utf8')
const logoPath = join(root, 'public', 'assets', 'EXAMPLES_LOGO.png')

assert.equal(existsSync(logoPath), true, 'EXAMPLES_LOGO.png must exist')
assert.match(appSource, /path="\/examples"/)
assert.match(appSource, /ExamplesPage/)
assert.match(pageSource, /encodeURIComponent\('EXAMPLES_LOGO\.png'\)/)
assert.doesNotMatch(pageSource, /לוגו\.png/)
assert.match(pageSource, /to=\{HOME_PATH\}/)
assert.match(pageSource, /דלג/)
assert.match(pageSource, /כניסה לאורי/)
assert.match(pageSource, /דוגמאות של סרטוני וידאו/)
assert.match(pageSource, /ומודעות של 'אורי'/)
assert.doesNotMatch(pageSource, /examples-title-accent/)
assert.match(cssSource, /text-align:\s*center/)
assert.match(cssSource, /color:\s*#000000/)
assert.match(pageSource, /dir="rtl"/)
assert.doesNotMatch(pageSource, /setTimeout|setInterval/)
assert.doesNotMatch(homeSource, /\/examples/)
assert.match(cssSource, /#f7f6f2/i)
assert.match(cssSource, /#c44c33/i)
assert.match(cssSource, /app--examples-page > \.header/)
assert.match(cssSource, /app--examples-page > \.footer/)

const videos = EXAMPLES.filter((item) => item.type === 'video')
const images = EXAMPLES.filter((item) => item.type === 'image')
assert.equal(videos.length, 2)
assert.equal(images.length, 2)
for (const item of EXAMPLES) {
  assert.equal(item.src, null)
}
assert.equal(SHOW_EXAMPLES_DESIGN_NOTE, true)
assert.equal(videos[0].placeholderBackground, '#292C2A')
assert.equal(videos[1].placeholderBackground, '#DCD7CE')
assert.equal(images[0].placeholderBackground, '#E7E8DF')
assert.equal(images[1].placeholderBackground, '#EEE2D6')

console.log('test-examples-page: passed')
