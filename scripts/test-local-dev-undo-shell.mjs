/**
 * Local UNDO shell route and WebView2 host constraints (no live publish).
 * Run: node scripts/test-local-dev-undo-shell.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOCAL_UNDO_HASH_PATH,
  isLocalUndoShell
} from '../src/utils/localDevUndoShell.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

assert.equal(LOCAL_UNDO_HASH_PATH, '/local-undo')
assert.equal(isLocalUndoShell(), false)

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.match(app, /import\.meta\.env\.DEV && String\(window\.location\.hash/)
assert.match(app, /\/local-undo/)
assert.match(app, /LocalUndoPage/)
assert.match(app, /import\.meta\.env\.DEV \? <DevLocalControl/)
assert.doesNotMatch(app, /Start-AceLocal/)

const page = readFileSync(join(root, 'src/pages/LocalUndo/LocalUndoPage.jsx'), 'utf8')
assert.match(page, /DevLocalControl/)
assert.doesNotMatch(page, /Header|Footer|BuilderPage|Builder2Page/)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /<h1 style=\{titleStyle\}>UNDO<\/h1>/)
assert.match(panel, /Local Development Control/)
assert.match(panel, />LOCAL</)
assert.match(panel, /PlusCircleIcon/)
assert.match(panel, /RotateCcwIcon/)
assert.match(panel, /UploadCloudIcon/)
assert.match(panel, /startDevCycle/)
assert.match(panel, /executeCancelDevelopment/)
assert.match(panel, /fetchPublishUriPreview/)
assert.doesNotMatch(panel, /publish-uri\/execute/)

const icons = readFileSync(join(root, 'src/components/DevLocalControl/UndoActionIcons.jsx'), 'utf8')
assert.match(icons, /data-icon="plus-circle"/)
assert.match(icons, /data-icon="rotate-ccw"/)
assert.match(icons, /data-icon="upload-cloud"/)
assert.match(icons, /<svg /)
assert.doesNotMatch(icons, /➕|⟳|☁/)

const host = readFileSync(join(root, 'undo-shell/Program.cs'), 'utf8')
assert.match(host, /Local\\ACE-UNDO-SHELL/)
assert.match(host, /WM_NCLBUTTONDBLCLK/)
assert.match(host, /FormWindowState\.Minimized/)
assert.match(host, /CoreWebView2\.Resume/)
assert.match(host, /CoreWebView2\.Reload/)
assert.match(host, /MaximizeBox = false/)
assert.match(host, /TopMost = true/)
assert.match(host, /e\.Cancel = true/)
assert.match(host, /UNDO refuses non-loopback URLs/)
assert.match(host, /#\/local-undo/)
assert.doesNotMatch(host, /onrender\.com/)

const startUndo = readFileSync(join(root, 'scripts/Start-AceUndoLocal.ps1'), 'utf8')
assert.match(startUndo, /AceUndo\.exe/)
assert.match(startUndo, /#\/local-undo/)
assert.doesNotMatch(startUndo, /Start-AceLocal\.ps1/)
assert.doesNotMatch(startUndo, /Start-AceBackendLocal/)
assert.doesNotMatch(startUndo, /Start-AceWorkerLocal/)

const startLocal = readFileSync(join(root, '..', 'ACE-Backend', 'scripts', 'Start-AceLocal.ps1'), 'utf8')
assert.doesNotMatch(startLocal, /Start-AceUndoLocal/)

const builder1 = readFileSync(join(root, 'src/services/builder1Api.js'), 'utf8')
const builder2 = readFileSync(join(root, 'src/services/api.js'), 'utf8')
assert.doesNotMatch(builder1, /local-undo|AceUndo/)
assert.doesNotMatch(builder2, /local-undo|AceUndo/)

const distJsDir = join(root, 'dist', 'assets')
if (existsSync(distJsDir)) {
  const jsFiles = readdirSync(distJsDir).filter((name) => name.endsWith('.js'))
  const bundled = jsFiles.map((name) => readFileSync(join(distJsDir, name), 'utf8')).join('\n')
  assert.doesNotMatch(bundled, /local-undo/)
  assert.doesNotMatch(bundled, /Local Development Control/)
  assert.doesNotMatch(bundled, /data-icon="plus-circle"/)
}

console.log('test-local-dev-undo-shell: passed')
