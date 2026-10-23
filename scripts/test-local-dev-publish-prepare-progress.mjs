/**
 * Publish prepare-simulate progress UI (simulation only; no real publish).
 * Run: node scripts/test-local-dev-publish-prepare-progress.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLISH_PREPARE_CHECKING_MESSAGE,
  PUBLISH_PREPARE_PROGRESS_PATH,
  PUBLISH_PREPARE_SIMULATE_PATH,
  PUBLISH_PREPARE_SUCCESS_MESSAGE,
  createPublishPrepareOperationId,
  createPublishPreparePoller,
  isPublishPrepareTerminal,
  isPublishPrepareVerifiedSuccess,
  postPublishPrepareSimulate,
  publishPrepareBarRatio,
  publishPrepareStatusMessage,
  sanitizePublishPrepareProgress
} from '../src/utils/localDevPublishPrepareProgress.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const FINGERPRINT = 'd'.repeat(64)
const OP_ID = 'a'.repeat(32)

assert.equal(PUBLISH_PREPARE_SIMULATE_PATH, '/api/local-dev/publish-uri/candidate/prepare-simulate')
assert.equal(PUBLISH_PREPARE_PROGRESS_PATH, '/api/local-dev/publish-uri/candidate/prepare-progress')
assert.equal(PUBLISH_PREPARE_CHECKING_MESSAGE, 'בודק את השינויים לפרסום...')
assert.equal(PUBLISH_PREPARE_SUCCESS_MESSAGE, 'בדיקת הפרסום הצליחה. לא בוצע פרסום.')
assert.equal(createPublishPrepareOperationId(() => '123e4567-e89b-12d3-a456-426614174000').length, 32)

const inProgress = sanitizePublishPrepareProgress({
  ok: true,
  operationStatus: 'IN_PROGRESS',
  prepareStatus: 'IN_PROGRESS',
  currentStep: { id: 'fresh_preview', status: 'IN_PROGRESS' },
  completedSteps: [{ id: 'registered_candidate', status: 'SUCCESS' }],
  error: null
})
assert.equal(isPublishPrepareTerminal(inProgress), false)
assert.equal(isPublishPrepareVerifiedSuccess(inProgress), false)
assert.equal(publishPrepareBarRatio(inProgress), 0.5)
assert.equal(publishPrepareStatusMessage(inProgress), 'בודק את השינויים לפרסום...')
assert.equal(
  publishPrepareStatusMessage({
    currentStep: { id: 'simulate_git_push_backend', status: 'IN_PROGRESS' },
    completedSteps: []
  }),
  'בודק את שלב השרת...'
)
assert.doesNotMatch(publishPrepareStatusMessage(inProgress), /פורסם/)

const completedOnlyOp = sanitizePublishPrepareProgress({
  ok: true,
  operationStatus: 'COMPLETED',
  prepareStatus: 'IN_PROGRESS',
  completedSteps: [{ id: 'a', status: 'SUCCESS' }],
  currentStep: null
})
assert.equal(isPublishPrepareVerifiedSuccess(completedOnlyOp), false)

const failed = sanitizePublishPrepareProgress({
  ok: true,
  operationStatus: 'FAILED',
  prepareStatus: 'FAILED',
  completedSteps: [{ id: 'product_scope', status: 'FAILED' }],
  currentStep: null,
  error: 'ace_publish_prepare_blocked'
})
assert.equal(isPublishPrepareTerminal(failed), true)
assert.equal(isPublishPrepareVerifiedSuccess(failed), false)

const done = sanitizePublishPrepareProgress({
  ok: true,
  operationStatus: 'COMPLETED',
  prepareStatus: 'COMPLETED',
  completedSteps: [
    { id: 'registered_candidate', status: 'SUCCESS' },
    { id: 'fresh_preview', status: 'SUCCESS' }
  ],
  currentStep: null
})
assert.equal(isPublishPrepareVerifiedSuccess(done), true)
assert.equal(publishPrepareBarRatio(done), 1)

const posted = await postPublishPrepareSimulate({
  backendBase: 'http://127.0.0.1:5000',
  publishUriPreviewFingerprint: FINGERPRINT,
  operationId: OP_ID,
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.match(url, /\/candidate\/prepare-simulate$/)
    const body = JSON.parse(options.body)
    assert.deepEqual(Object.keys(body).sort(), ['operationId', 'publishUriPreviewFingerprint'])
    assert.equal(body.operationId, OP_ID)
    assert.equal(body.publishUriPreviewFingerprint, FINGERPRINT)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        simulationOnly: true,
        executePublishAvailable: true,
        operationId: OP_ID
      })
    }
  }
})
assert.equal(posted.ok, true)
assert.equal(posted.executePublishAvailable, false)

const renderBlocked = await postPublishPrepareSimulate({
  backendBase: 'https://ace-backend-k1p6.onrender.com',
  publishUriPreviewFingerprint: FINGERPRINT,
  operationId: OP_ID
})
assert.equal(renderBlocked.ok, false)

let terminalCount = 0
const updates = []
const poller = createPublishPreparePoller({
  backendBase: 'http://127.0.0.1:5000',
  operationId: OP_ID,
  sessionId: 'ori-20261024-120000-aabbccdd',
  intervalMs: 20,
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.match(url, /prepare-progress\?operationId=/)
    if (updates.length === 0) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          operationStatus: 'IN_PROGRESS',
          prepareStatus: 'IN_PROGRESS',
          completedSteps: [],
          currentStep: { id: 'registered_candidate', status: 'IN_PROGRESS' }
        })
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        operationStatus: 'COMPLETED',
        prepareStatus: 'COMPLETED',
        completedSteps: [{ id: 'registered_candidate', status: 'SUCCESS' }],
        currentStep: null
      })
    }
  },
  onUpdate: (progress) => {
    updates.push(progress)
  },
  onTerminal: (progress) => {
    terminalCount += 1
    assert.equal(isPublishPrepareVerifiedSuccess(progress), true)
  }
})
poller.start()
await new Promise((resolve) => setTimeout(resolve, 80))
poller.stop()
assert.ok(updates.length >= 1)
assert.equal(isPublishPrepareVerifiedSuccess(updates[0]), false)
assert.equal(terminalCount, 1)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /fetchRegisteredPublishCandidatePreview/)
assert.match(panel, /postPublishPrepareSimulate/)
assert.match(panel, /createPublishPreparePoller/)
assert.match(panel, /isPublishPrepareVerifiedSuccess/)
assert.match(panel, /if \(busy \|\| publishPhase\) return/)
assert.doesNotMatch(panel, /handlePublishDryRun/)
assert.doesNotMatch(panel, /postPublishUriCandidateDryRun/)
assert.doesNotMatch(panel, /publish-uri\/execute/)
assert.doesNotMatch(panel, /method:\s*['"]POST['"]/)
assert.doesNotMatch(panel, /האתר פורסם בהצלחה/)

const dialog = readFileSync(
  join(root, 'src/components/DevLocalControl/PublishUriPreviewDialog.jsx'),
  'utf8'
)
assert.match(dialog, /PUBLISH_PREPARE_CHECKING_MESSAGE/)
assert.match(dialog, /PUBLISH_PREPARE_SUCCESS_MESSAGE/)
assert.match(dialog, /סגור/)
assert.match(dialog, /LocalOperationProgress/)
assert.doesNotMatch(
  readFileSync(join(root, 'src/components/DevLocalControl/LocalOperationProgress.jsx'), 'utf8'),
  /operationId|fingerprint|SHA|JSON/
)
assert.match(dialog, /publishPrepareStatusMessage/)
assert.match(dialog, /isPublishPrepareVerifiedSuccess/)
assert.doesNotMatch(dialog, /בדיקת פרסום/)
assert.doesNotMatch(dialog, /onDryRun/)
assert.doesNotMatch(dialog, /operationId/)
assert.doesNotMatch(dialog, /fingerprint/)
assert.doesNotMatch(dialog, /SHA/)
assert.doesNotMatch(dialog, /JSON/)
assert.doesNotMatch(dialog, /completedSteps/)
assert.doesNotMatch(dialog, /האתר פורסם בהצלחה/)
assert.doesNotMatch(dialog, /publish-uri\/execute/)

const util = readFileSync(join(root, 'src/utils/localDevPublishPrepareProgress.js'), 'utf8')
assert.match(util, /prepare-simulate/)
assert.match(util, /prepare-progress/)
assert.match(util, /method: 'POST'/)
assert.match(util, /method: 'GET'/)
assert.doesNotMatch(util, /publish-uri\/execute/)
assert.doesNotMatch(util, /git push/)
assert.doesNotMatch(util, /CANCEL_PROGRESS_STEPS/)

const cancelDialog = readFileSync(
  join(root, 'src/components/DevLocalControl/CancelDevelopmentPreviewDialog.jsx'),
  'utf8'
)
assert.match(cancelDialog, /CANCEL_CONFIRM_QUESTION/)

console.log('test-local-dev-publish-prepare-progress: passed')
