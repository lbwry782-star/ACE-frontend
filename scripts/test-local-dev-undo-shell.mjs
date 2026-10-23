/**
 * Local UNDO shell route and native host constraints (no live publish).
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
assert.match(app, /import\.meta\.env\.DEV && locationHash.includes\('\/local-undo'\)/)
assert.match(app, /\/local-undo/)
assert.match(app, /LocalUndoPage/)
assert.match(app, /hashchange/)
assert.doesNotMatch(app, /<DevLocalControl/)
assert.doesNotMatch(app, /Start-AceLocal/)

const page = readFileSync(join(root, 'src/pages/LocalUndo/LocalUndoPage.jsx'), 'utf8')
assert.match(page, /DevLocalControl/)
assert.match(page, /background: 'Canvas'/)
assert.match(page, /colorScheme: 'light dark'/)
assert.doesNotMatch(page, /Header|Footer|BuilderPage|Builder2Page/)
assert.doesNotMatch(page, /#121214|#000000/)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /<h1 style=\{titleStyle\}>UNDO<\/h1>/)
assert.match(panel, />LOCAL</)
assert.match(panel, /shell \? null/)
assert.match(panel, /PlusCircleIcon/)
assert.match(panel, /RotateCcwIcon/)
assert.match(panel, /UploadCloudIcon/)
assert.match(panel, /startDevCycle/)
assert.match(panel, /executeCancelDevelopment/)
assert.match(panel, /fetchPublishUriPreview/)
assert.match(panel, /background: '#163a6b'/)
assert.match(panel, /background: '#7a1f1a'/)
assert.match(panel, /background: '#1e5c3a'/)
assert.match(panel, /padding: 8/)
assert.match(panel, /gap: 8/)
assert.match(panel, /height: 'auto'/)
assert.doesNotMatch(panel, /minHeight: '100vh'/)
assert.doesNotMatch(panel, /Local Development Control/)
assert.doesNotMatch(panel, /מצב מחזור הפיתוח/)
assert.doesNotMatch(panel, /מחזור פיתוח פעיל/)
assert.doesNotMatch(panel, /publish-uri\/execute/)

const icons = readFileSync(join(root, 'src/components/DevLocalControl/UndoActionIcons.jsx'), 'utf8')
assert.match(icons, /data-icon="plus-circle"/)
assert.match(icons, /data-icon="rotate-ccw"/)
assert.match(icons, /data-icon="upload-cloud"/)
assert.match(icons, /<svg /)
assert.doesNotMatch(icons, /➕|⟳|☁/)

const host = readFileSync(join(root, 'undo-shell/Program.cs'), 'utf8')
assert.match(host, /Local\\ACE-UNDO-SHELL/)
assert.match(host, /Text = "LOCAL"/)
assert.match(host, /ShowIcon = false/)
assert.match(host, /FindWindow\(null, "LOCAL"\)/)
assert.match(host, /TopMost = false/)
assert.match(host, /ShowInTaskbar = true/)
assert.doesNotMatch(host, /Text = "UNDO"/)
assert.match(host, /SystemColors\.Window/)
assert.match(host, /MaximizeBox = true/)
assert.match(host, /MinimizeBox = true/)
assert.match(host, /e\.Cancel = true/)
assert.match(host, /UNDO refuses non-loopback URLs/)
assert.match(host, /#\/local-undo/)
assert.doesNotMatch(host, /WM_NCLBUTTONDBLCLK/)
assert.doesNotMatch(host, /TopMost = true/)
assert.doesNotMatch(host, /onrender\.com/)

const mac = readFileSync(join(root, 'undo-shell/macos/main.swift'), 'utf8')
assert.match(mac, /window\.title = "LOCAL"/)
assert.match(mac, /WKWebView/)
assert.match(mac, /NSColor\.windowBackgroundColor|\.windowBackgroundColor/)
assert.match(mac, /ACE-UNDO-SHELL/)
assert.match(mac, /isAllowedLoopback/)
assert.match(mac, /#\/local-undo/)
assert.match(mac, /aceUndo/)
assert.doesNotMatch(mac, /onrender\.com/)

const resize = readFileSync(join(root, 'src/utils/localDevUndoShell.js'), 'utf8')
assert.match(resize, /chrome\?\.webview\?\.postMessage/)
assert.match(resize, /webkit\?\.messageHandlers\?\.aceUndo/)

const startUndo = readFileSync(join(root, 'scripts/Start-AceUndoLocal.ps1'), 'utf8')
assert.match(startUndo, /AceUndo\.exe/)
assert.match(startUndo, /#\/local-undo/)
assert.match(startUndo, /\[int\]\$VitePort/)
assert.match(startUndo, /ContainsKey\("VitePort"\)/)
assert.match(startUndo, /\$VitePortSpecified/)
assert.match(startUndo, /http:\/\/\$\(\$found\.HostName\):\$\(\$found\.Port\)\/#\/local-undo/)
assert.match(startUndo, /Test-AceFrontendVite \$VitePort "localhost"/)
assert.doesNotMatch(startUndo, /Start-AceLocal\.ps1/)
assert.doesNotMatch(startUndo, /Start-AceBackendLocal/)
assert.doesNotMatch(startUndo, /Start-AceWorkerLocal/)
assert.doesNotMatch(startUndo, /npm run dev/)

const startMac = readFileSync(join(root, 'scripts/Start-AceUndoLocal.sh'), 'utf8')
assert.match(startMac, /AceUndo/)
assert.match(startMac, /#\/local-undo/)
assert.match(startMac, /VITE_PORT/)
assert.match(startMac, /localhost:\$\{VITE_PORT\}/)
assert.match(startMac, /seq "\$PREFERRED_PORT" "\$PORT_SCAN_MAX"/)
assert.doesNotMatch(startMac, /Start-AceLocal/)
assert.doesNotMatch(startMac, /npm run dev/)

const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
assert.match(viteSource, /undo-shell\/\.restore/)
assert.match(viteSource, /undo-shell\/bin/)
assert.match(viteSource, /undo-shell\/obj/)
assert.doesNotMatch(viteSource, /ignored:\s*\['\*\*\/undo-shell\/\*\*'\]/)

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
