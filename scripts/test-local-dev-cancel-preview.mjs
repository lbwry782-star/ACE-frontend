/**
 * Local cancel-development preview UI (no paid APIs, no Execute).
 * Run: node scripts/test-local-dev-cancel-preview.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKEND_UNAVAILABLE_MESSAGE,
  CANCEL_DEV_PREVIEW_PATH,
  LOCAL_BACKEND_REQUIRED_MESSAGE,
  NO_ACTIVE_CYCLE_MESSAGE,
  NO_WORK_TO_CANCEL_MESSAGE,
  buildCancelDevPreviewUrl,
  canConfirmCancelExecute,
  explainBlocker,
  fetchCancelDevPreview,
  summarizeCancelDevPreview
} from '../src/utils/localDevCancelPreview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

assert.equal(CANCEL_DEV_PREVIEW_PATH, '/api/local-dev/cancel-development/preview')
assert.equal(
  buildCancelDevPreviewUrl('http://127.0.0.1:5000').url,
  'http://127.0.0.1:5000/api/local-dev/cancel-development/preview'
)
assert.equal(buildCancelDevPreviewUrl('https://ace-backend-k1p6.onrender.com').ok, false)
assert.equal(buildCancelDevPreviewUrl('https://ace-backend-k1p6.onrender.com').message, LOCAL_BACKEND_REQUIRED_MESSAGE)

const nonePayload = {
  ok: true,
  executeEndpointAvailable: true,
  activeCycle: {
    sessionId: null,
    status: 'NONE',
    hasWorkToCancel: false,
    canExecuteInEngine: true,
    executeAvailableInApi: true
  },
  blockers: [],
  commitsToCancel: { backend: [], frontend: [] },
  pathsToRevert: { backend: [], frontend: [] }
}
const noneSummary = summarizeCancelDevPreview(nonePayload)
assert.equal(noneSummary.cycleActive, false)
assert.equal(noneSummary.hasWork, false)
assert.equal(noneSummary.noActiveCycleMessage, NO_ACTIVE_CYCLE_MESSAGE)
assert.equal(noneSummary.noWorkMessage, NO_WORK_TO_CANCEL_MESSAGE)
assert.equal(noneSummary.executeEndpointAvailable, false)
assert.equal(noneSummary.activeCycle.executeAvailableInApi, false)
assert.equal(canConfirmCancelExecute(noneSummary), false)

const frontendUnrelated = explainBlocker('FRONTEND_UNRELATED')
assert.equal(frontendUnrelated.explanation, 'קיימים שינויים בממשק שאינם משויכים למחזור הפיתוח.')
assert.equal(frontendUnrelated.technical, 'FRONTEND_UNRELATED')

const infraMismatch = explainBlocker('REGISTRY_INFRA_HEAD_MISMATCH')
assert.equal(infraMismatch.explanation, 'גרסת תשתית הפיתוח אינה תואמת לרישום המאומת.')
assert.equal(infraMismatch.technical, 'REGISTRY_INFRA_HEAD_MISMATCH')

const longWindowsBlocker = explainBlocker(
  'FRONTEND_UNRELATED: D:\\אס2\\ACE\\ACE-Frontend\\src\\components\\DevLocalControl\\CancelDevelopmentPreviewDialog.jsx'
)
assert.match(longWindowsBlocker.explanation, /קיימים שינויים בממשק/)
assert.match(longWindowsBlocker.technical, /CancelDevelopmentPreviewDialog\.jsx/)

const longSha = explainBlocker('deadbeefcafebabe0123456789abcdef01234567')
assert.equal(longSha.explanation, 'קיימת חסימה שמונעת ביטול כרגע.')
assert.match(longSha.technical, /deadbeefcafebabe/)

const workPayload = {
  ok: true,
  activeCycle: { sessionId: 'ori-20261023-010342-2d952e88', status: 'OPEN', hasWorkToCancel: true, canExecuteInEngine: true },
  blockers: ['PLAN_BLOCKED'],
  registryInfraDrift: ['registry-drift'],
  commitsToCancel: {
    backend: [{ shortSha: 'abc1234', subject: 'wip-only', classification: 'sessionWip', branches: ['ori/builder1-wip'] }],
    frontend: []
  },
  pathsToRevert: { backend: ['product-temp.txt'], frontend: [] },
  infraPreserved: {
    commits: { backend: [{ shortSha: '5ffe7b9', subject: 'infra' }], frontend: [{ shortSha: '62e0951', subject: 'infra fe' }] },
    paths: { backend: ['infra-permanent.txt'], frontend: [] }
  },
  envChanges: {
    backend: {
      addedKeys: ['SESSION_ADDED'],
      changedKeys: ['SESSION_TEMP'],
      preservedKeys: ['PORT'],
      SESSION_ADDED: 'must-not-leak-value',
      DestDpapiPath: 'C:\\secret\\x.dpapi'
    },
    frontend: { addedKeys: [] }
  },
  preBaselineWarnings: [{ repo: 'BACKEND', shortSha: 'deadbeef', subject: 'legacy', requiresExplicitScope: true }],
  backupExpectations: { note: 'Preview only', recoveryGuideFile: 'RECOVERY.md' },
  infraTargets: { backendCommit: '5ffe7b9', frontendCommit: '62e0951' }
}
const work = summarizeCancelDevPreview(workPayload)
assert.equal(work.cycleActive, true)
assert.equal(work.hasWork, true)
assert.deepEqual(work.envChanges.backend.addedKeys, ['SESSION_ADDED'])
assert.equal(work.envChanges.backend.SESSION_ADDED, undefined)
assert.equal(work.envChanges.backend.DestDpapiPath, undefined)
const dumped = JSON.stringify(work)
assert.doesNotMatch(dumped, /must-not-leak-value/)
assert.doesNotMatch(dumped, /DestDpapiPath/)
assert.doesNotMatch(dumped, /secret\\\\x/)
assert.ok(work.blockers.includes('PLAN_BLOCKED'))
assert.equal(work.preBaselineWarnings[0].shortSha, 'deadbeef')
assert.deepEqual(work.wipBranches, ['ori/builder1-wip'])
assert.equal(canConfirmCancelExecute(work), false)

const executablePreview = summarizeCancelDevPreview({
  ok: true,
  previewFingerprint: 'a'.repeat(64),
  executeEndpointAvailable: true,
  activeCycle: {
    sessionId: 'ori-20261023-010342-2d952e88',
    status: 'OPEN',
    hasWorkToCancel: true,
    canExecuteInEngine: true,
    executeAvailableInApi: true
  },
  blockers: [],
  commitsToCancel: { backend: [], frontend: [] },
  pathsToRevert: { backend: [], frontend: [] }
})
assert.equal(executablePreview.previewFingerprint, 'a'.repeat(64))
assert.equal(executablePreview.executeEndpointAvailable, true)
assert.equal(canConfirmCancelExecute(executablePreview), true)
assert.equal(canConfirmCancelExecute({ ...executablePreview, previewFingerprint: 'short' }), false)

let fetchMethod = null
const unavailable = await fetchCancelDevPreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    fetchMethod = options.method
    assert.match(url, /127\.0\.0\.1:5000\/api\/local-dev\/cancel-development\/preview$/)
    assert.equal(options.method, 'GET')
    throw new Error('ECONNREFUSED')
  }
})
assert.equal(fetchMethod, 'GET')
assert.equal(unavailable.ok, false)
assert.equal(unavailable.message, BACKEND_UNAVAILABLE_MESSAGE)

const invalid = await fetchCancelDevPreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async () => ({
    ok: true,
    json: async () => 'not-json-object'
  })
})
assert.equal(invalid.ok, false)

const blocked = await fetchCancelDevPreview({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async () => ({
    ok: true,
    json: async () => ({ ok: false, error: 'ace_cancel_preview_blocked', message: 'blocked', blockers: ['PLAN_BLOCKED'] })
  })
})
assert.equal(blocked.ok, false)
assert.deepEqual(blocked.blockers, ['PLAN_BLOCKED'])

const renderBlocked = await fetchCancelDevPreview({
  backendBase: 'https://ace-backend-k1p6.onrender.com'
})
assert.equal(renderBlocked.ok, false)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /בטל את הפיתוח/)
assert.match(panel, /עדכן את אורי/)
assert.match(panel, /disabled/)
assert.match(panel, /fetchCancelDevPreview/)
assert.match(panel, /startDevCycle/)
assert.match(panel, /executeCancelDevelopment/)
assert.doesNotMatch(panel, /method:\s*['"]POST['"]/)
assert.doesNotMatch(panel, /sessionId:/)

const dialog = readFileSync(
  join(root, 'src/components/DevLocalControl/CancelDevelopmentPreviewDialog.jsx'),
  'utf8'
)
assert.match(dialog, /בדיקת ביטול הפיתוח/)
assert.match(dialog, /סגור/)
assert.match(dialog, /isNoneCycle/)
assert.match(dialog, /activeCycle\?\.status === 'NONE'/)
assert.match(dialog, /NO_ACTIVE_CYCLE_MESSAGE/)
assert.match(dialog, /explainBlocker/)
assert.match(dialog, /unicodeBidi: 'isolate'/)
assert.match(dialog, /direction: 'ltr'/)
assert.match(dialog, /overflowX: 'hidden'/)
assert.match(dialog, /wordBreak: 'normal'/)
assert.match(dialog, /overflowWrap: 'break-word'/)
assert.match(dialog, /maxWidth: 'calc\(100vw - 24px\)'/)
assert.match(dialog, /maxHeight: 'calc\(100vh - 24px\)'/)
assert.match(dialog, /maxHeight: 'min\(220px, 32vh\)'/)
assert.doesNotMatch(dialog, /wordBreak:\s*'break-all'/)
assert.match(dialog, /אשר ביטול/)
assert.match(dialog, /canConfirmCancelExecute/)
assert.doesNotMatch(dialog, /sessionId/)
assert.doesNotMatch(dialog, /cancel-development\/execute/)
assert.doesNotMatch(dialog, />\s*Execute\s*</)

const util = readFileSync(join(root, 'src/utils/localDevCancelPreview.js'), 'utf8')
assert.match(util, /method: 'GET'/)
assert.doesNotMatch(util, /method: 'POST'/)
assert.doesNotMatch(util, /cancel-development\/execute/)

const builder1 = readFileSync(join(root, 'src/services/builder1Api.js'), 'utf8')
const builder2 = readFileSync(join(root, 'src/services/api.js'), 'utf8')
assert.doesNotMatch(builder1, /cancel-development/)
assert.doesNotMatch(builder2, /cancel-development/)

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.match(app, /import\.meta\.env\.DEV \? <DevLocalControl/)

console.log('test-local-dev-cancel-preview: passed')
