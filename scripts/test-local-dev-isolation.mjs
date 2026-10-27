/**
 * Local-dev backend isolation (no network, no paid APIs).
 * Run: node scripts/test-local-dev-isolation.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOCAL_BACKEND_URL,
  PRODUCTION_BACKEND_FALLBACK,
  isLocalDevBackendUrl,
  isPublicRenderBackendUrl,
  resolveBackendUrl
} from '../src/services/backendUrl.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

assert.equal(LOCAL_BACKEND_URL, 'http://127.0.0.1:5000')
assert.equal(PRODUCTION_BACKEND_FALLBACK, 'https://ace-backend-k1p6.onrender.com')
assert.equal(isLocalDevBackendUrl('http://127.0.0.1:5000'), true)
assert.equal(isLocalDevBackendUrl('http://localhost:5000/'), true)
assert.equal(isLocalDevBackendUrl(PRODUCTION_BACKEND_FALLBACK), false)
assert.equal(isPublicRenderBackendUrl(PRODUCTION_BACKEND_FALLBACK), true)
assert.equal(isPublicRenderBackendUrl(LOCAL_BACKEND_URL), false)

assert.equal(
  resolveBackendUrl({ isDev: true, envUrl: '' }),
  LOCAL_BACKEND_URL
)
assert.equal(
  resolveBackendUrl({ isDev: true, envUrl: PRODUCTION_BACKEND_FALLBACK }),
  LOCAL_BACKEND_URL
)
assert.equal(
  resolveBackendUrl({ isDev: true, envUrl: 'https://ace-backend-k1p6.onrender.com' }),
  LOCAL_BACKEND_URL
)
assert.equal(
  resolveBackendUrl({ isDev: true, envUrl: 'http://localhost:5000' }),
  'http://localhost:5000'
)
assert.equal(
  resolveBackendUrl({ isDev: true, envUrl: 'http://127.0.0.1:5000/' }),
  'http://127.0.0.1:5000'
)
assert.doesNotMatch(
  resolveBackendUrl({ isDev: true, envUrl: PRODUCTION_BACKEND_FALLBACK }),
  /onrender\.com/i
)

assert.equal(
  resolveBackendUrl({ isDev: false, envUrl: '' }),
  PRODUCTION_BACKEND_FALLBACK
)
assert.equal(
  resolveBackendUrl({ isDev: false, envUrl: 'http://127.0.0.1:5000' }),
  PRODUCTION_BACKEND_FALLBACK
)
assert.equal(
  resolveBackendUrl({ isDev: false, envUrl: PRODUCTION_BACKEND_FALLBACK }),
  PRODUCTION_BACKEND_FALLBACK
)

const gitignore = readFileSync(join(root, '.gitignore'), 'utf8')
assert.match(gitignore, /\.env\.\*\.local/)

const envDevLocalPath = join(root, '.env.development.local')
assert.equal(existsSync(envDevLocalPath), true)
const envDevLocal = readFileSync(envDevLocalPath, 'utf8')
assert.match(envDevLocal, /VITE_BACKEND_URL=http:\/\/127\.0\.0\.1:5000/)

const apiSource = readFileSync(join(root, 'src/services/api.js'), 'utf8')
assert.match(apiSource, /from '\.\/backendUrl\.js'/)
assert.match(apiSource, /getBackendUrl/)
assert.doesNotMatch(apiSource, /return 'https:\/\/ace-backend-k1p6\.onrender\.com'/)

const appSource = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.doesNotMatch(appSource, /<DevLocalControl/)
assert.match(appSource, /import\.meta\.env\.DEV && locationHash.includes\('\/local-undo'\)/)
assert.match(appSource, /\/local-undo/)
assert.match(appSource, /LocalUndoPage/)
assert.doesNotMatch(appSource, /LocalDevInteractionGate/)
assert.doesNotMatch(apiSource, /localDevActionGate/)
assert.doesNotMatch(apiSource, /quit-confirmation/)

const localUndoPage = readFileSync(join(root, 'src/pages/LocalUndo/LocalUndoPage.jsx'), 'utf8')
assert.match(localUndoPage, /DevLocalControl/)

const builderPage = readFileSync(join(root, 'src/pages/Builder/BuilderPage.jsx'), 'utf8')
const builder2Page = readFileSync(join(root, 'src/pages/Builder2/Builder2Page.jsx'), 'utf8')
assert.doesNotMatch(builderPage, /DevLocalControl/)
assert.doesNotMatch(builder2Page, /DevLocalControl/)

const panelSource = readFileSync(
  join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'),
  'utf8'
)
assert.match(panelSource, /isLocalDevFrontend\(\)/)
assert.doesNotMatch(panelSource, /modeStyle/)
assert.doesNotMatch(panelSource, /lampStyle/)
assert.doesNotMatch(panelSource, />מקומי</)
assert.match(panelSource, /PUBLISH/)
assert.match(panelSource, /'CANCEL'/)
assert.match(panelSource, /'NEW'/)
assert.match(panelSource, /disabled/)
assert.match(panelSource, /fetchRegisteredPublishCandidatePreview/)
assert.doesNotMatch(panelSource, /github|render|deploy|git push/i)
assert.doesNotMatch(panelSource, /publish-uri\/execute/)

const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
assert.match(viteSource, /target:\s*'http:\/\/127\.0\.0\.1:5000'/)
assert.match(viteSource, /undo-shell\/\.restore/)
assert.doesNotMatch(viteSource, /ignored:\s*\['\*\*\/src\/\*\*'\]/)

const startPs1 = readFileSync(join(root, 'scripts/Start-AceFrontendLocal.ps1'), 'utf8')
const startCmd = readFileSync(join(root, 'scripts/Start-AceFrontendLocal.cmd'), 'utf8')
assert.match(startPs1, /VITE_BACKEND_URL/)
assert.match(startPs1, /127\.0\.0\.1:5000/)
assert.match(startPs1, /Find-RunningAceFrontendPort/)
assert.match(startPs1, /onrender/)
assert.doesNotMatch(startPs1, /gh-pages|workflow_dispatch|git push|npm run deploy/i)
assert.match(startCmd, /Start-AceFrontendLocal\.ps1/)
assert.match(startCmd, /cd \/d "%~dp0\.\."/)

const builder1Api = readFileSync(join(root, 'src/services/builder1Api.js'), 'utf8')
const builder2Api = apiSource
assert.doesNotMatch(builder1Api, /localDevActionGate/)
assert.doesNotMatch(builder1Api, /quit-confirmation/)
assert.match(builder1Api, /API_BASE_URL/)
assert.match(builder2Api, /API_BASE_URL/)
assert.match(builder1Api, /builder1-generate/)
assert.match(builder2Api, /generate-video/)

const prevFetch = globalThis.fetch
const oriFetchLog = []
globalThis.fetch = async (url, init = {}) => {
  const href = String(url)
  oriFetchLog.push(href)
  assert.doesNotMatch(href, /quit-confirmation/)
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true }),
    blob: async () => new Uint8Array([1]),
    text: async () => ''
  }
}
try {
  const { generate } = await import('../src/services/api.js')
  await generate({ previewId: 'ori-dev', adIndex: 0 })
  assert.ok(oriFetchLog.some((href) => href.includes('/api/generate')))
} finally {
  globalThis.fetch = prevFetch
}

console.log('test-local-dev-isolation: passed')
