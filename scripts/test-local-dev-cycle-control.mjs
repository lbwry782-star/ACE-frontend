/**
 * Local start/status/cancel-execute UI (mocked fetch only; no real Execute).
 * Run: node scripts/test-local-dev-cycle-control.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTO_START_FAILED_MESSAGE,
  AUTO_START_SUCCESS_MESSAGE,
  AWAITING_NEW_CYCLE_MESSAGE,
  CANCEL_DEV_EXECUTE_PATH,
  CANCEL_SUCCESS_MESSAGE,
  CONFIRM_EXECUTE_TOKEN,
  CONFIRM_START_TOKEN,
  CONNECTION_LOST_MESSAGE,
  DEV_CYCLE_START_PATH,
  DEV_CYCLE_STATUS_PATH,
  OPEN_CYCLE_MESSAGE,
  START_BLOCKED_OPEN_MESSAGE,
  STALE_PREVIEW_MESSAGE,
  buildCancelExecuteBody,
  buildPostCancelOutcome,
  buildStartDevCycleBody,
  createInFlightLock,
  executeCancelDevelopment,
  fetchDevCycleStatus,
  formatElapsed,
  sanitizeDevCycleStatus,
  sanitizePostCancelAutoStart,
  startDevCycle,
  summarizeCancelExecuteResult
} from '../src/utils/localDevCycleApi.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const fp = 'ab'.repeat(32)
const op = 'a'.repeat(32)

assert.equal(DEV_CYCLE_STATUS_PATH, '/api/local-dev/dev-cycle/status')
assert.equal(DEV_CYCLE_START_PATH, '/api/local-dev/dev-cycle/start')
assert.equal(CANCEL_DEV_EXECUTE_PATH, '/api/local-dev/cancel-development/execute')
assert.deepEqual(buildStartDevCycleBody(), { confirmStart: CONFIRM_START_TOKEN })
assert.deepEqual(buildCancelExecuteBody(fp, op), {
  confirmExecute: CONFIRM_EXECUTE_TOKEN,
  previewFingerprint: fp,
  operationId: op
})
assert.equal(JSON.stringify(buildCancelExecuteBody(fp, op)).includes('sessionId'), false)
assert.deepEqual(Object.keys(buildCancelExecuteBody(fp, op)).sort(), [
  'confirmExecute',
  'operationId',
  'previewFingerprint'
])
assert.equal(buildCancelExecuteBody('short').previewFingerprint, '')
assert.equal(Object.prototype.hasOwnProperty.call(buildCancelExecuteBody(fp, 'bad'), 'operationId'), false)

const openStatus = sanitizeDevCycleStatus({
  ok: true,
  activeCycle: { status: 'OPEN', sessionId: 'ori-20261023-010342-2d952e88', baselineReady: true },
  canStartNewCycle: false,
  blockers: []
})
assert.equal(openStatus.canStartNewCycle, false)
assert.equal(openStatus.canCancelCycle, true)
assert.equal(openStatus.message, OPEN_CYCLE_MESSAGE)
assert.equal(openStatus.activeCycle.sessionId, 'ori-20261023-010342-2d952e88')

const noneStatus = sanitizeDevCycleStatus({
  ok: true,
  activeCycle: { status: 'NONE', sessionId: null },
  canStartNewCycle: true
})
assert.equal(noneStatus.canStartNewCycle, true)
assert.equal(noneStatus.canCancelCycle, false)

const cancelledStatus = sanitizeDevCycleStatus({
  ok: true,
  activeCycle: { status: 'CANCELLED' },
  canStartNewCycle: true
})
assert.equal(cancelledStatus.canStartNewCycle, true)
assert.equal(cancelledStatus.canCancelCycle, false)
assert.equal(cancelledStatus.message, 'המחזור הקודם בוטל.')

const awaitingStatus = sanitizeDevCycleStatus({
  ok: true,
  activeCycle: { status: 'CANCELLED_AWAITING_NEW_CYCLE' },
  canStartNewCycle: false
})
assert.equal(awaitingStatus.canStartNewCycle, false)
assert.equal(awaitingStatus.canCancelCycle, false)
assert.equal(awaitingStatus.message, AWAITING_NEW_CYCLE_MESSAGE)
assert.equal(formatElapsed(125), '02:05')
assert.equal(formatElapsed(3), '00:03')

const invalidStatus = sanitizeDevCycleStatus({
  ok: true,
  activeCycle: { status: 'INVALID' },
  canStartNewCycle: true,
  blockers: ['POINTER_INVALID']
})
assert.equal(invalidStatus.invalid, true)
assert.equal(invalidStatus.canStartNewCycle, false)
assert.equal(invalidStatus.canCancelCycle, false)

const statusCalls = []
const statusResult = await fetchDevCycleStatus({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    statusCalls.push({ url, method: options.method, body: options.body })
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        activeCycle: { status: 'OPEN', sessionId: 'hidden-id' },
        canStartNewCycle: false
      })
    }
  }
})
assert.equal(statusCalls[0].method, 'GET')
assert.match(statusCalls[0].url, /\/api\/local-dev\/dev-cycle\/status$/)
assert.equal(statusCalls[0].body, undefined)
assert.equal(statusResult.canCancelCycle, true)
assert.equal(statusResult.canStartNewCycle, false)

const renderStatus = await fetchDevCycleStatus({
  backendBase: 'https://ace-backend-k1p6.onrender.com'
})
assert.equal(renderStatus.ok, false)

const startBlocked = await startDevCycle({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'POST')
    assert.match(url, /\/api\/local-dev\/dev-cycle\/start$/)
    const body = JSON.parse(options.body)
    assert.deepEqual(body, { confirmStart: 'START' })
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'sessionId'), false)
    return {
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: 'ace_dev_cycle_open_exists' })
    }
  }
})
assert.equal(startBlocked.ok, false)
assert.equal(startBlocked.message, START_BLOCKED_OPEN_MESSAGE)

const startOk = await startDevCycle({
  backendBase: 'http://127.0.0.1:5000',
  fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body)
    assert.deepEqual(body, { confirmStart: 'START' })
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, sessionId: 'ori-should-not-be-required-by-ui' })
    }
  }
})
assert.equal(startOk.ok, true)

let executeCalled = 0
const stale = await executeCancelDevelopment({
  backendBase: 'http://127.0.0.1:5000',
  previewFingerprint: fp,
  operationId: op,
  fetchImpl: async (url, options) => {
    executeCalled += 1
    assert.equal(options.method, 'POST')
    assert.match(url, /\/api\/local-dev\/cancel-development\/execute$/)
    const body = JSON.parse(options.body)
    assert.deepEqual(body, { confirmExecute: 'CANCEL', previewFingerprint: fp, operationId: op })
    assert.equal(JSON.stringify(body).includes('sessionId'), false)
    return {
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: 'ace_cancel_preview_fingerprint_stale' })
    }
  }
})
assert.equal(executeCalled, 1)
assert.equal(stale.ok, false)
assert.equal(stale.message, STALE_PREVIEW_MESSAGE)

const skipped = await executeCancelDevelopment({
  backendBase: 'http://127.0.0.1:5000',
  previewFingerprint: 'bad',
  fetchImpl: async () => {
    throw new Error('must-not-call-execute')
  }
})
assert.equal(skipped.ok, false)
assert.equal(skipped.status, 0)

const unavailable = await executeCancelDevelopment({
  backendBase: 'http://127.0.0.1:5000',
  previewFingerprint: fp,
  operationId: op,
  fetchImpl: async () => {
    throw new Error('ECONNREFUSED')
  }
})
assert.equal(unavailable.ok, false)
assert.equal(unavailable.uncertain, true)
assert.equal(unavailable.error, 'connection_lost')
assert.equal(unavailable.message, CONNECTION_LOST_MESSAGE)
assert.equal(unavailable.cancelSucceeded, false)

const failedExecute = summarizeCancelExecuteResult(
  { ok: false, error: 'ace_cancel_execute_failed', message: 'boom' },
  503
)
assert.equal(failedExecute.cancelSucceeded, false)
assert.equal(failedExecute.ok, false)

const autoOk = sanitizePostCancelAutoStart({
  ok: true,
  phase: 'COMPLETED',
  newSessionId: 'ori-20261024-120000-aabbccdd'
})
assert.equal(autoOk.ok, true)
const autoFail = sanitizePostCancelAutoStart({
  ok: false,
  phase: 'FAILED',
  newSessionId: null,
  error: 'ace_post_cancel_auto_start_failed',
  message: 'baseline failed'
})
assert.equal(autoFail.ok, false)

const successBoth = summarizeCancelExecuteResult({
  ok: true,
  executeResult: { status: 'SUCCESS' },
  postCancelAutoStart: autoOk,
  activeCycle: { status: 'OPEN', sessionId: autoOk.newSessionId }
}, 200)
assert.equal(successBoth.cancelSucceeded, true)
assert.equal(successBoth.autoStart.ok, true)

const successCancelOnly = summarizeCancelExecuteResult({
  ok: true,
  executeResult: { status: 'SUCCESS' },
  postCancelAutoStart: autoFail
}, 200)
assert.equal(successCancelOnly.cancelSucceeded, true)
assert.equal(successCancelOnly.autoStart.ok, false)

const fullSuccessOutcome = buildPostCancelOutcome(successBoth, {
  ok: true,
  activeCycle: { status: 'OPEN', sessionId: autoOk.newSessionId }
})
assert.equal(fullSuccessOutcome.kind, 'success')
assert.ok(fullSuccessOutcome.lines.includes(CANCEL_SUCCESS_MESSAGE))
assert.ok(fullSuccessOutcome.lines.includes(AUTO_START_SUCCESS_MESSAGE))
assert.equal(fullSuccessOutcome.sessionId, autoOk.newSessionId)

const cancelOnlyOutcome = buildPostCancelOutcome(successCancelOnly, {
  ok: true,
  activeCycle: { status: 'CANCELLED_AWAITING_NEW_CYCLE' },
  canStartNewCycle: false
})
assert.equal(cancelOnlyOutcome.kind, 'mixed')
assert.ok(cancelOnlyOutcome.lines.includes(CANCEL_SUCCESS_MESSAGE))
assert.ok(cancelOnlyOutcome.lines.includes(AUTO_START_FAILED_MESSAGE))
assert.equal(cancelOnlyOutcome.sessionId, '')

const failOutcome = buildPostCancelOutcome(failedExecute, { ok: true, activeCycle: { status: 'OPEN' } })
assert.equal(failOutcome.kind, 'error')
assert.equal(failOutcome.lines.includes(CANCEL_SUCCESS_MESSAGE), false)

const lostOutcome = buildPostCancelOutcome(
  { uncertain: true, cancelSucceeded: false, message: CONNECTION_LOST_MESSAGE },
  { ok: true, activeCycle: { status: 'OPEN' } }
)
assert.equal(lostOutcome.kind, 'uncertain')
assert.ok(lostOutcome.lines.includes(CONNECTION_LOST_MESSAGE))

const lock = createInFlightLock()
assert.equal(lock.tryBegin(), true)
assert.equal(lock.tryBegin(), false)
lock.end()
assert.equal(lock.tryBegin(), true)

const longExecute = await executeCancelDevelopment({
  backendBase: 'http://127.0.0.1:5000',
  previewFingerprint: fp,
  operationId: op,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return {
        ok: true,
        executeResult: { status: 'SUCCESS' },
        postCancelAutoStart: {
          ok: true,
          phase: 'COMPLETED',
          newSessionId: 'ori-20261024-120000-aabbccdd'
        }
      }
    }
  })
})
assert.equal(longExecute.cancelSucceeded, true)
assert.equal(longExecute.autoStart.ok, true)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /התחל פיתוח/)
assert.match(panel, /בטל את הפיתוח/)
assert.match(panel, /עדכן את אורי/)
assert.match(panel, /canConfirmCancelExecute/)
assert.match(panel, /previewFingerprint/)
assert.doesNotMatch(panel, /modeStyle/)
assert.doesNotMatch(panel, /lampStyle/)
assert.doesNotMatch(panel, />מקומי</)
assert.doesNotMatch(panel, /ACE_LOCAL_DEV_ALLOW_REAL_EXECUTE/)
assert.match(panel, /createInFlightLock/)
assert.match(panel, /buildProgressOutcome/)
assert.match(panel, /createCancelOperationId/)
assert.match(panel, /createCancelProgressPoller/)
assert.doesNotMatch(panel, /DEV_CYCLE_STATUS_PATH/)

const api = readFileSync(join(root, 'src/utils/localDevCycleApi.js'), 'utf8')
assert.match(api, /confirmExecute: CONFIRM_EXECUTE_TOKEN/)
assert.match(api, /previewFingerprint/)
assert.match(api, /postCancelAutoStart/)
assert.doesNotMatch(api, /retry/)

const dialog = readFileSync(
  join(root, 'src/components/DevLocalControl/CancelDevelopmentPreviewDialog.jsx'),
  'utf8'
)
assert.match(dialog, /אשר ביטול/)
assert.match(dialog, /canConfirmCancelExecute/)
assert.match(dialog, /מבטל את הפיתוח/)
assert.match(dialog, /mapProgressSteps/)
assert.doesNotMatch(dialog, /אחוז|progressPercent|EXPECTED_CANCEL_STEPS/)
assert.doesNotMatch(dialog, /סגור/)
assert.doesNotMatch(dialog, /onClose/)

const builder1 = readFileSync(join(root, 'src/services/builder1Api.js'), 'utf8')
const builder2 = readFileSync(join(root, 'src/services/api.js'), 'utf8')
assert.doesNotMatch(builder1, /dev-cycle\/start|cancel-development\/execute/)
assert.doesNotMatch(builder2, /dev-cycle\/start|cancel-development\/execute/)

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
assert.match(app, /import\.meta\.env\.DEV \? <DevLocalControl/)

console.log('test-local-dev-cycle-control: passed')
