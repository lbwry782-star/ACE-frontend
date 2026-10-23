import { buildLocalDevApiUrl } from './localDevCycleApi.js'
import { sanitizeOperationId } from './localDevCancelProgress.js'
import {
  PUBLISH_BACKEND_UNAVAILABLE_MESSAGE,
  PUBLISH_INVALID_PREVIEW_MESSAGE,
  PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE
} from './localDevPublishUriPreview.js'
import { sanitizePublishUriPreviewFingerprint } from './localDevPublishUriCandidate.js'
import { observedProgressRatio, statusFromStepMap } from './localDevOperationProgress.js'

export const PUBLISH_PREPARE_SIMULATE_PATH =
  '/api/local-dev/publish-uri/candidate/prepare-simulate'
export const PUBLISH_PREPARE_PROGRESS_PATH =
  '/api/local-dev/publish-uri/candidate/prepare-progress'
export const PUBLISH_PREPARE_POLL_MS = 2000

export const PUBLISH_PREPARE_CHECKING_MESSAGE = 'בודק את השינויים לפרסום...'
export const PUBLISH_PREPARE_SUCCESS_MESSAGE = 'בדיקת הפרסום הצליחה. לא בוצע פרסום.'
export const PUBLISH_PREPARE_FAILED_MESSAGE = 'בדיקת הפרסום נכשלה.'
export const PUBLISH_PREPARE_BUSY_MESSAGE = 'בדיקה אחרת כבר מתבצעת. נסו שוב בעוד רגע.'
export const PUBLISH_PREPARE_CONNECTION_MESSAGE =
  'הקשר עם השרת נותק. לא ידוע אם הבדיקה הושלמה.'

const PUBLISH_STATUS_BY_STEP = {
  registered_candidate: 'בודק את מועמד הפרסום...',
  fresh_preview: 'בודק את השינויים לפרסום...',
  fingerprint_match: 'מאמת שהבדיקה עדכנית...',
  product_scope: 'בודק את היקף השינויים...',
  worker_coupling: 'בודק התאמה בין הרכיבים...',
  execution_plan: 'מכין את תוכנית הבדיקה...',
  simulate_git_push_backend: 'בודק את שלב השרת...',
  simulate_render_deploy: 'בודק את שלב הפריסה...',
  simulate_git_push_frontend: 'בודק את שלב הממשק...',
  simulate_github_pages: 'בודק את שלב האתר...',
  simulate_production_registry_update: 'בודק את שלב הרישום...'
}

const SESSION_ID_PATTERN = /^ori-\d{8}-\d{6}-[0-9a-f]{8}$/i
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])
const STEP_STATUSES = new Set(['IN_PROGRESS', 'SUCCESS', 'FAILED', 'SIMULATED'])

const PREPARE_ERROR_MESSAGES = {
  ace_publish_uri_candidate_fingerprint_stale:
    'בדיקת הפרסום אינה עדכנית. סגרו את החלון ולחצו שוב על PUBLISH.',
  ace_publish_uri_candidate_fingerprint_invalid: 'בדיקת הפרסום אינה עדכנית. נסו שוב.',
  ace_local_dev_execute_in_progress: PUBLISH_PREPARE_BUSY_MESSAGE,
  ace_publish_prepare_blocked: 'בדיקות הבטיחות נכשלו. לא ניתן לבדוק פרסום.',
  ace_publish_candidate_not_verified_safe: 'בדיקות הבטיחות נכשלו. לא ניתן לבדוק פרסום.',
  ace_publish_prepare_not_ready: 'המועמד אינו מוכן לבדיקת פרסום.',
  ace_publish_prepare_worker_blocked: 'יש חסימה שמונעת בדיקת פרסום.',
  ace_publish_prepare_candidate_mismatch: 'מועמד הפרסום אינו תקין. לא ניתן לבדוק פרסום.',
  ace_publish_uri_candidate_preview_failed: 'לא ניתן לבדוק את השינויים לפרסום.',
  ace_publish_prepare_simulate_failed: PUBLISH_PREPARE_FAILED_MESSAGE,
  ace_publish_prepare_operation_id_invalid: PUBLISH_PREPARE_FAILED_MESSAGE,
  ace_publish_prepare_operation_id_already_used: PUBLISH_PREPARE_BUSY_MESSAGE,
  backend_unavailable: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE,
  local_backend_required: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE,
  connection_lost: PUBLISH_PREPARE_CONNECTION_MESSAGE
}

function sanitizeSessionId(value) {
  const text = String(value ?? '').trim()
  return SESSION_ID_PATTERN.test(text) ? text : ''
}

export function createPublishPrepareOperationId(randomUUID = () => crypto.randomUUID()) {
  const raw = String(randomUUID() || '')
  return raw.replace(/-/g, '').toLowerCase()
}

export function publishPrepareErrorMessage(code, fallback) {
  const key = String(code || '').trim()
  if (PREPARE_ERROR_MESSAGES[key]) return PREPARE_ERROR_MESSAGES[key]
  const text = String(fallback || '').trim()
  if (/[\u0590-\u05FF]/.test(text)) return text
  return PUBLISH_PREPARE_FAILED_MESSAGE
}

function sanitizeStep(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  const status = String(raw.status || '').toUpperCase()
  if (!id || !STEP_STATUSES.has(status)) return null
  return { id, status }
}

export function sanitizePublishPrepareProgress(payload) {
  if (!payload || typeof payload !== 'object') return null
  const operationStatus = String(payload.operationStatus || '').toUpperCase()
  const prepareStatus = String(payload.prepareStatus || '').toUpperCase()
  const completed = Array.isArray(payload.completedSteps)
    ? payload.completedSteps.map(sanitizeStep).filter(Boolean)
    : []
  return {
    ok: payload.ok !== false,
    operationStatus,
    prepareStatus,
    currentStep: sanitizeStep(payload.currentStep),
    completedSteps: completed,
    error: payload.error ? String(payload.error) : '',
    simulationOnly: payload.simulationOnly !== false,
    realExecuteBlocked: payload.realExecuteBlocked !== false
  }
}

export function isPublishPrepareTerminal(progress) {
  if (!progress) return false
  return TERMINAL_STATUSES.has(String(progress.operationStatus || '').toUpperCase())
}

export function isPublishPrepareVerifiedSuccess(progress) {
  if (!progress || progress.ok === false) return false
  return progress.operationStatus === 'COMPLETED' && progress.prepareStatus === 'COMPLETED'
}

export function publishPrepareBarRatio(progress) {
  if (isPublishPrepareVerifiedSuccess(progress)) return 1
  return observedProgressRatio(progress)
}

export function publishPrepareStatusMessage(progress) {
  return statusFromStepMap(progress, PUBLISH_STATUS_BY_STEP, PUBLISH_PREPARE_CHECKING_MESSAGE)
}

export function buildPublishPrepareSimulateUrl(backendBase) {
  const built = buildLocalDevApiUrl(backendBase, PUBLISH_PREPARE_SIMULATE_PATH)
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return built
}

export function buildPublishPrepareProgressUrl(backendBase, operationId, sessionId) {
  const op = sanitizeOperationId(operationId)
  if (!op) {
    return { ok: false, error: 'ace_publish_prepare_operation_id_invalid', message: PUBLISH_PREPARE_FAILED_MESSAGE }
  }
  const built = buildLocalDevApiUrl(backendBase, PUBLISH_PREPARE_PROGRESS_PATH)
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  const params = new URLSearchParams({ operationId: op })
  const sid = sanitizeSessionId(sessionId)
  if (sid) params.set('sessionId', sid)
  return { ok: true, url: `${built.url}?${params.toString()}` }
}

async function readJson(response) {
  try {
    return await response.json()
  } catch (_) {
    return null
  }
}

export async function postPublishPrepareSimulate({
  backendBase,
  publishUriPreviewFingerprint,
  operationId,
  fetchImpl = fetch
} = {}) {
  const fingerprint = sanitizePublishUriPreviewFingerprint(publishUriPreviewFingerprint)
  const op = sanitizeOperationId(operationId)
  if (!fingerprint) {
    return {
      ok: false,
      error: 'ace_publish_uri_candidate_fingerprint_invalid',
      message: publishPrepareErrorMessage('ace_publish_uri_candidate_fingerprint_invalid')
    }
  }
  if (!op) {
    return {
      ok: false,
      error: 'ace_publish_prepare_operation_id_invalid',
      message: PUBLISH_PREPARE_FAILED_MESSAGE
    }
  }
  const built = buildPublishPrepareSimulateUrl(backendBase)
  if (!built.ok) return built

  let response
  try {
    response = await fetchImpl(built.url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publishUriPreviewFingerprint: fingerprint,
        operationId: op
      })
    })
  } catch (_) {
    return {
      ok: false,
      uncertain: true,
      error: 'backend_unavailable',
      message: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE
    }
  }

  const payload = await readJson(response)
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      error: 'invalid_preview',
      message: PUBLISH_INVALID_PREVIEW_MESSAGE
    }
  }
  const error = payload.error ? String(payload.error) : ''
  if (!response.ok || payload.ok === false) {
    return {
      ok: false,
      error: error || `http_${response.status}`,
      message: publishPrepareErrorMessage(error, payload.message)
    }
  }
  return {
    ok: true,
    simulationOnly: payload.simulationOnly !== false,
    executePublishAvailable: false,
    realExecuteBlocked: true
  }
}

export async function fetchPublishPrepareProgress({
  backendBase,
  operationId,
  sessionId,
  fetchImpl = fetch
} = {}) {
  const built = buildPublishPrepareProgressUrl(backendBase, operationId, sessionId)
  if (!built.ok) {
    return { ok: false, error: built.error, status: 0, message: built.message }
  }
  let response
  try {
    response = await fetchImpl(built.url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
  } catch (_) {
    return { ok: false, uncertain: true, error: 'connection_lost', status: 0 }
  }
  const payload = await readJson(response)
  if (response.status === 404) {
    return { ok: false, notFound: true, error: 'ace_publish_prepare_progress_not_found', status: 404 }
  }
  if (!response.ok || !payload || typeof payload !== 'object') {
    return {
      ok: false,
      uncertain: true,
      error: String(payload?.error || `http_${response.status}`),
      status: response.status
    }
  }
  const sanitized = sanitizePublishPrepareProgress(payload)
  if (!sanitized) {
    return { ok: false, uncertain: true, error: 'invalid_progress', status: response.status }
  }
  return { ...sanitized, status: response.status }
}

export function createPublishPreparePoller({
  backendBase,
  operationId,
  sessionId,
  intervalMs = PUBLISH_PREPARE_POLL_MS,
  fetchImpl = fetch,
  onUpdate,
  onTerminal,
  onNotFound,
  onDisconnect
} = {}) {
  let stopped = false
  let inFlight = false
  let seenProgress = false
  let timer = null

  async function tick() {
    if (stopped || inFlight) return
    inFlight = true
    try {
      const result = await fetchPublishPrepareProgress({
        backendBase,
        operationId,
        sessionId,
        fetchImpl
      })
      if (stopped) return
      if (result.notFound) {
        onNotFound?.(result, { seenProgress })
        return
      }
      if (!result.ok) {
        onDisconnect?.(result, { seenProgress })
        return
      }
      seenProgress = true
      onUpdate?.(result)
      if (isPublishPrepareTerminal(result)) {
        stop()
        onTerminal?.(result)
      }
    } finally {
      inFlight = false
    }
  }

  function start() {
    if (stopped) return
    tick()
    timer = setInterval(() => {
      tick()
    }, intervalMs)
  }

  function stop() {
    stopped = true
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    start,
    stop,
    get seenProgress() {
      return seenProgress
    },
    get stopped() {
      return stopped
    }
  }
}
