/**
 * Local cancel-development progress polling (mocked fetch only; no real Execute).
 * Run: node scripts/test-local-dev-cancel-progress.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANCEL_DEV_PROGRESS_PATH,
  CANCEL_PROGRESS_POLL_MS,
  CANCEL_PROGRESS_STEPS,
  buildCancelProgressUrl,
  buildProgressOutcome,
  clearCancelProgressHandle,
  createCancelOperationId,
  createCancelProgressPoller,
  fetchCancelProgress,
  isTerminalProgress,
  loadCancelProgressHandle,
  cancelProgressStatusMessage,
  mapProgressSteps,
  resetCancelProgressStorageForTests,
  saveCancelProgressHandle,
  sanitizeCancelProgress,
  sanitizeOperationId
} from '../src/utils/localDevCancelProgress.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sid = 'ori-20261023-010342-2d952e88'
const op = createCancelOperationId(() => '123e4567-e89b-12d3-a456-426614174000')
assert.equal(op, '123e4567e89b12d3a456426614174000')
assert.equal(sanitizeOperationId(op), op)
assert.equal(sanitizeOperationId('ABCD'.repeat(8)), 'abcd'.repeat(8))
assert.equal(sanitizeOperationId('short'), '')
assert.equal(CANCEL_PROGRESS_POLL_MS, 2000)
assert.equal(CANCEL_DEV_PROGRESS_PATH, '/api/local-dev/cancel-development/progress')
assert.deepEqual(CANCEL_PROGRESS_STEPS.map((s) => s.id), [
  'pre_checks',
  'backup_creation',
  'backend_restore',
  'frontend_restore',
  'env_restore',
  'final_verify',
  'close_cancel_cycle',
  'post_cancel_auto_start'
])

const built = buildCancelProgressUrl('http://127.0.0.1:5000', op, sid)
assert.match(built.url, /operationId=123e4567e89b12d3a456426614174000/)
assert.match(built.url, /sessionId=ori-20261023-010342-2d952e88/)
assert.equal(buildCancelProgressUrl('https://ace-backend-k1p6.onrender.com', op, sid).ok, false)

const store = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null },
  setItem(key, value) { this.data.set(key, String(value)) },
  removeItem(key) { this.data.delete(key) }
}
resetCancelProgressStorageForTests(store)
assert.equal(saveCancelProgressHandle({ operationId: op, sessionId: sid }), true)
assert.deepEqual(loadCancelProgressHandle(), { operationId: op, sessionId: sid })
clearCancelProgressHandle()
assert.equal(loadCancelProgressHandle(), null)
assert.equal(saveCancelProgressHandle({ operationId: op, sessionId: 'bad' }), false)

const mapped = mapProgressSteps({
  currentStep: { id: 'backend_restore', status: 'IN_PROGRESS' },
  completedSteps: [
    { id: 'pre_checks', status: 'SUCCESS' },
    { id: 'backup_creation', status: 'SUCCESS' }
  ]
})
assert.equal(mapped.find((s) => s.id === 'pre_checks').state, 'success')
assert.equal(mapped.find((s) => s.id === 'backup_creation').state, 'success')
assert.equal(mapped.find((s) => s.id === 'backend_restore').state, 'active')
assert.equal(mapped.find((s) => s.id === 'frontend_restore').state, 'pending')

const failedMid = mapProgressSteps({
  currentStep: null,
  completedSteps: [
    { id: 'pre_checks', status: 'SUCCESS' },
    { id: 'backup_creation', status: 'SUCCESS' },
    { id: 'backend_restore', status: 'FAILED' }
  ]
})
assert.equal(failedMid.find((s) => s.id === 'backend_restore').state, 'failed')
assert.equal(failedMid.find((s) => s.id === 'frontend_restore').state, 'pending')

assert.equal(
  cancelProgressStatusMessage({ currentStep: { id: 'pre_checks', status: 'IN_PROGRESS' } }),
  'בודק את מצב השינויים...'
)
assert.equal(
  cancelProgressStatusMessage({ currentStep: { id: 'backup_creation', status: 'IN_PROGRESS' } }),
  'מכין את השחזור...'
)
assert.equal(
  cancelProgressStatusMessage({ currentStep: { id: 'backend_restore', status: 'IN_PROGRESS' } }),
  'משחזר את המצב הקודם...'
)
assert.equal(
  cancelProgressStatusMessage({ currentStep: { id: 'final_verify', status: 'IN_PROGRESS' } }),
  'מוודא שהשחזור הושלם...'
)
assert.equal(
  cancelProgressStatusMessage({
    currentStep: { id: 'future_step', status: 'IN_PROGRESS' },
    completedSteps: [{ id: 'backup_creation', status: 'SUCCESS' }]
  }),
  'מכין את השחזור...'
)

const full = sanitizeCancelProgress({
  ok: true,
  operationId: op,
  sessionId: sid,
  operationStatus: 'COMPLETED',
  cancelStatus: 'COMPLETED',
  currentStep: null,
  completedSteps: CANCEL_PROGRESS_STEPS.map((s) => ({ id: s.id, status: 'SUCCESS' })),
  postCancelAutoStart: { phase: 'COMPLETED', newSessionId: 'ori-20261024-120000-aabbccdd' }
})
assert.equal(isTerminalProgress(full), true)
const successOutcome = buildProgressOutcome(full)
assert.equal(successOutcome.kind, 'success')
assert.equal(successOutcome.sessionId, 'ori-20261024-120000-aabbccdd')

const mixed = buildProgressOutcome({
  cancelStatus: 'COMPLETED',
  operationStatus: 'FAILED',
  postCancelAutoStart: { phase: 'FAILED', newSessionId: '' }
})
assert.equal(mixed.kind, 'mixed')
assert.equal(mixed.cancelSucceeded, true)
assert.equal(mixed.autoStartSucceeded, false)

const failedCancel = buildProgressOutcome({
  cancelStatus: 'FAILED',
  operationStatus: 'FAILED',
  error: 'restore failed'
})
assert.equal(failedCancel.kind, 'error')
assert.equal(failedCancel.cancelSucceeded, false)

assert.equal(buildProgressOutcome({
  cancelStatus: 'COMPLETED',
  operationStatus: 'IN_PROGRESS',
  postCancelAutoStart: { phase: 'IN_PROGRESS' }
}), null)

let overlap = 0
let maxOverlap = 0
let tick = 0
const terminals = []
const notFounds = []
const tracked = createCancelProgressPoller({
  backendBase: 'http://127.0.0.1:5000',
  operationId: op,
  sessionId: sid,
  intervalMs: 15,
  fetchImpl: async (url, options) => {
    assert.equal(options.method, 'GET')
    assert.match(url, /\/api\/local-dev\/cancel-development\/progress/)
    overlap += 1
    maxOverlap = Math.max(maxOverlap, overlap)
    await new Promise((resolve) => setTimeout(resolve, 30))
    overlap -= 1
    tick += 1
    if (tick === 1) {
      return { ok: false, status: 404, json: async () => ({ ok: false, error: 'ace_cancel_progress_not_found' }) }
    }
    if (tick === 2) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          operationId: op,
          sessionId: sid,
          operationStatus: 'IN_PROGRESS',
          cancelStatus: 'IN_PROGRESS',
          currentStep: { id: 'pre_checks', status: 'IN_PROGRESS' },
          completedSteps: [],
          postCancelAutoStart: { phase: 'PENDING' }
        })
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        operationId: op,
        sessionId: sid,
        operationStatus: 'COMPLETED',
        cancelStatus: 'COMPLETED',
        currentStep: null,
        completedSteps: [{ id: 'pre_checks', status: 'SUCCESS' }, { id: 'post_cancel_auto_start', status: 'SUCCESS' }],
        postCancelAutoStart: { phase: 'COMPLETED', newSessionId: 'ori-20261024-120000-aabbccdd' }
      })
    }
  },
  onNotFound: (result, meta) => { notFounds.push({ seen: meta.seenProgress }) },
  onTerminal: (result) => { terminals.push(result) },
  onUpdate: () => {}
})
tracked.start()
await new Promise((resolve) => setTimeout(resolve, 160))
assert.ok(notFounds.length >= 1)
assert.equal(notFounds[0].seen, false)
assert.ok(terminals.length >= 1)
assert.equal(terminals[0].cancelStatus, 'COMPLETED')
assert.equal(maxOverlap, 1)
assert.equal(tracked.stopped, true)

const disconnects = []
let progressCalls = 0
const flaky = createCancelProgressPoller({
  backendBase: 'http://127.0.0.1:5000',
  operationId: op,
  sessionId: sid,
  intervalMs: 12,
  fetchImpl: async () => {
    progressCalls += 1
    if (progressCalls === 1) throw new Error('offline')
    if (progressCalls === 2) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          operationId: op,
          sessionId: sid,
          operationStatus: 'IN_PROGRESS',
          cancelStatus: 'IN_PROGRESS',
          currentStep: { id: 'backup_creation', status: 'IN_PROGRESS' },
          completedSteps: [{ id: 'pre_checks', status: 'SUCCESS' }],
          postCancelAutoStart: { phase: 'PENDING' }
        })
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        operationId: op,
        sessionId: sid,
        operationStatus: 'FAILED',
        cancelStatus: 'COMPLETED',
        currentStep: null,
        completedSteps: [
          { id: 'pre_checks', status: 'SUCCESS' },
          { id: 'post_cancel_auto_start', status: 'FAILED' }
        ],
        postCancelAutoStart: { phase: 'FAILED', newSessionId: null }
      })
    }
  },
  onDisconnect: () => disconnects.push(true),
  onTerminal: (result) => terminals.push(result)
})
flaky.start()
await new Promise((resolve) => setTimeout(resolve, 80))
assert.ok(disconnects.length >= 1)
assert.equal(flaky.stopped, true)
const last = terminals[terminals.length - 1]
assert.equal(buildProgressOutcome(last).kind, 'mixed')

let afterStop = 0
const stoppable = createCancelProgressPoller({
  backendBase: 'http://127.0.0.1:5000',
  operationId: op,
  sessionId: sid,
  intervalMs: 10,
  fetchImpl: async () => {
    afterStop += 1
    return { ok: true, status: 200, json: async () => ({ ok: true, operationStatus: 'IN_PROGRESS', cancelStatus: 'IN_PROGRESS', operationId: op, sessionId: sid, completedSteps: [] }) }
  }
})
stoppable.start()
stoppable.stop()
const callsWhenStopped = afterStop
await new Promise((resolve) => setTimeout(resolve, 40))
assert.equal(afterStop, callsWhenStopped)
assert.equal(stoppable.stopped, true)

const missing = await fetchCancelProgress({
  backendBase: 'http://127.0.0.1:5000',
  operationId: op,
  sessionId: sid,
  fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: 'ace_cancel_progress_not_found' }) })
})
assert.equal(missing.notFound, true)
assert.equal(missing.ok, false)

const panel = readFileSync(join(root, 'src/components/DevLocalControl/DevLocalControl.jsx'), 'utf8')
assert.match(panel, /loadCancelProgressHandle/)
assert.match(panel, /saveCancelProgressHandle/)
assert.match(panel, /createCancelProgressPoller/)
assert.doesNotMatch(panel, /executeCancelDevelopment\(\{[\s\S]*loadCancelProgressHandle/)
assert.match(panel, /operationId/)

const progressSrc = readFileSync(join(root, 'src/utils/localDevCancelProgress.js'), 'utf8')
assert.doesNotMatch(progressSrc, /dev-cycle\/status/)
assert.doesNotMatch(progressSrc, /method: 'POST'/)
assert.match(progressSrc, /method: 'GET'/)

console.log('test-local-dev-cancel-progress: passed')
