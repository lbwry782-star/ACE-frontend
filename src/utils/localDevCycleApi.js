import {
  isLocalDevBackendUrl,
  isPublicRenderBackendUrl,
  normalizeBackendUrl
} from '../services/backendUrl.js'
import { sanitizePreviewFingerprint } from './localDevCancelPreview.js'
import { sanitizeOperationId } from './localDevCancelProgress.js'

export const DEV_CYCLE_STATUS_PATH = '/api/local-dev/dev-cycle/status'
export const DEV_CYCLE_START_PATH = '/api/local-dev/dev-cycle/start'
export const CANCEL_DEV_EXECUTE_PATH = '/api/local-dev/cancel-development/execute'

export const CONFIRM_START_TOKEN = 'START'
export const CONFIRM_EXECUTE_TOKEN = 'CANCEL'

export const BACKEND_UNAVAILABLE_MESSAGE =
  'לא ניתן להתחבר לשרת המקומי. ודאו שה-Backend רץ ב-127.0.0.1:5000 ונסו שוב.'
export const INVALID_CYCLE_API_MESSAGE = 'התשובה מהשרת המקומי אינה תקינה.'
export const LOCAL_BACKEND_REQUIRED_MESSAGE =
  'ניהול מחזור הפיתוח זמין רק מול Backend מקומי. לא מתבצע מעבר לשרת ציבורי.'
export const START_SUCCESS_MESSAGE = 'מחזור פיתוח חדש נפתח.'
export const CANCEL_SUCCESS_MESSAGE = 'הפיתוח הקודם בוטל בהצלחה.'
export const AUTO_START_SUCCESS_MESSAGE = 'מחזור פיתוח חדש נפתח.'
export const AUTO_START_FAILED_MESSAGE = 'פתיחת המחזור החדש לא הושלמה.'
export const CONNECTION_LOST_MESSAGE =
  'הקשר עם השרת נותק. לא ידוע אם הביטול הושלם. בדקו את מצב המחזור לפני פעולה נוספת.'
export const EXECUTE_LONG_WAIT_MESSAGE = 'הפעולה עשויה להימשך מספר דקות.'
export const CANCEL_PARTIAL_MESSAGE =
  'הביטול הושלם חלקית. אין לשלוח שוב אוטומטית. בדקו את מדריך השחזור.'
export const AWAITING_NEW_CYCLE_MESSAGE = 'הביטול הושלם. פתיחת מחזור חדש עדיין לא הושלמה.'
export const EXPECTED_CANCEL_STEPS = [
  'בדיקת תנאים',
  'יצירת גיבוי',
  'שחזור קבצים והגדרות',
  'אימות התוצאה',
  'פתיחת מחזור חדש'
]
export const EXECUTE_UNAVAILABLE_MESSAGE = 'השרת אינו מאשר ביטול בפועל כרגע.'
export const INVALID_CYCLE_MESSAGE = 'מצב המחזור אינו תקין. פעולות מסוכנות נחסמו.'
export const OPEN_CYCLE_MESSAGE = 'מחזור פיתוח פעיל.'
export const CAN_START_CYCLE_MESSAGE = 'אפשר להתחיל פיתוח חדש.'
export const START_BLOCKED_OPEN_MESSAGE = 'כבר קיים מחזור פיתוח פעיל. לא ניתן לפתוח מחזור נוסף.'
export const STALE_PREVIEW_MESSAGE = 'תצוגת הביטול אינה עדכנית. יש לרענן ולבדוק שוב.'
export const EXECUTE_IN_PROGRESS_MESSAGE = 'ביטול כבר מתבצע. אין לשלוח שוב.'
export const EXECUTE_BLOCKED_MESSAGE = 'הביטול נחסם. יש לטפל בחסימות ולרענן את הבדיקה.'
export const ALREADY_CANCELLED_MESSAGE = 'המחזור כבר בוטל. אפשר להתחיל פיתוח חדש.'
export const FINGERPRINT_REQUIRED_MESSAGE = 'חסר אימות עדכני של בדיקת הביטול.'

const CYCLE_ERROR_MESSAGES = {
  ace_dev_cycle_open_exists: START_BLOCKED_OPEN_MESSAGE,
  ace_active_dev_cycle_invalid: INVALID_CYCLE_MESSAGE,
  ace_dev_cycle_start_confirm_required: 'נדרש אישור מפורש לפתיחת מחזור.',
  ace_dev_cycle_start_failed: 'פתיחת מחזור הפיתוח נכשלה.',
  ace_dev_cycle_baseline_validate_failed: 'בדיקת נקודת הבסיס נכשלה. לא נפתח מחזור חדש.',
  ace_dev_cycle_baseline_failed: 'יצירת נקודת הבסיס נכשלה. לא נפתח מחזור חדש.',
  ace_dev_cycle_baseline_not_ready: 'נקודת הבסיס אינה מוכנה. לא נפתח מחזור חדש.',
  ace_cancel_preview_fingerprint_stale: STALE_PREVIEW_MESSAGE,
  ace_cancel_preview_fingerprint_invalid: FINGERPRINT_REQUIRED_MESSAGE,
  ace_cancel_execute_blocked: EXECUTE_BLOCKED_MESSAGE,
  ace_cancel_execute_not_allowed: EXECUTE_UNAVAILABLE_MESSAGE,
  ace_cancel_execute_confirm_required: 'נדרש אישור מפורש לביטול.',
  ace_local_dev_execute_in_progress: EXECUTE_IN_PROGRESS_MESSAGE,
  ace_dev_cycle_already_cancelled: ALREADY_CANCELLED_MESSAGE,
  ace_dev_cycle_none: 'אין מחזור פיתוח פעיל לביטול.',
  ace_dev_cycle_not_open: 'אין מחזור פיתוח פעיל לביטול.',
  ace_cancel_execute_failed: CANCEL_PARTIAL_MESSAGE,
  local_backend_required: LOCAL_BACKEND_REQUIRED_MESSAGE,
  backend_unavailable: BACKEND_UNAVAILABLE_MESSAGE
}

export function cycleErrorMessage(code, fallback) {
  const key = String(code || '').trim()
  if (CYCLE_ERROR_MESSAGES[key]) return CYCLE_ERROR_MESSAGES[key]
  if (key.startsWith('ace_cancel_execute_blockers')) return EXECUTE_BLOCKED_MESSAGE
  return fallback || INVALID_CYCLE_API_MESSAGE
}

const SESSION_ID_PATTERN = /^ori-\d{8}-\d{6}-[0-9a-f]{8}$/i

export function sanitizeSessionId(value) {
  const text = String(value ?? '').trim()
  return SESSION_ID_PATTERN.test(text) ? text : ''
}

export function cycleStatusLabel(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'OPEN') return OPEN_CYCLE_MESSAGE
  if (value === 'INVALID') return INVALID_CYCLE_MESSAGE
  if (value === 'CANCELLED_AWAITING_NEW_CYCLE') return AWAITING_NEW_CYCLE_MESSAGE
  if (value === 'CANCELLED') return 'המחזור הקודם בוטל.'
  return CAN_START_CYCLE_MESSAGE
}

export function formatElapsed(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const seconds = String(safe % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function createInFlightLock() {
  let locked = false
  return {
    tryBegin() {
      if (locked) return false
      locked = true
      return true
    },
    isLocked() {
      return locked
    },
    end() {
      locked = false
    }
  }
}

export function sanitizePostCancelAutoStart(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, phase: '', newSessionId: '', error: '', message: '' }
  }
  const phase = String(raw.phase || '').toUpperCase()
  const newSessionId = sanitizeSessionId(raw.newSessionId)
  const ok = raw.ok === true && phase === 'COMPLETED' && Boolean(newSessionId)
  return {
    ok,
    phase,
    newSessionId: ok ? newSessionId : newSessionId,
    error: raw.error ? String(raw.error) : '',
    message: raw.message ? String(raw.message) : ''
  }
}

export function buildLocalDevApiUrl(backendBase, path) {
  const base = normalizeBackendUrl(backendBase)
  if (!base || isPublicRenderBackendUrl(base) || !isLocalDevBackendUrl(base)) {
    return { ok: false, error: 'local_backend_required', message: LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return { ok: true, url: `${base}${path}` }
}

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export function sanitizeDevCycleStatus(payload) {
  if (!payload || typeof payload !== 'object') return null
  const cycle = payload.activeCycle && typeof payload.activeCycle === 'object' ? payload.activeCycle : {}
  const status = String(cycle.status || 'NONE').toUpperCase()
  const blockers = asStringArray(payload.blockers)
  const invalid = status === 'INVALID' || blockers.includes('MULTIPLE_OPEN_CYCLES')
  const canStartNewCycle = payload.canStartNewCycle === true
    && !invalid
    && status !== 'OPEN'
    && status !== 'CANCELLED_AWAITING_NEW_CYCLE'
  return {
    ok: payload.ok !== false,
    invalid,
    error: payload.error ? String(payload.error) : invalid ? 'ace_active_dev_cycle_invalid' : null,
    message: invalid ? INVALID_CYCLE_MESSAGE : cycleStatusLabel(status),
    canStartNewCycle,
    canCancelCycle: status === 'OPEN' && !invalid,
    activeCycle: {
      status,
      sessionId: sanitizeSessionId(cycle.sessionId),
      baselineReady: cycle.baselineReady === true
    },
    blockers
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json()
  } catch (_) {
    return null
  }
}

async function localDevFetch(built, options, fetchImpl) {
  if (!built.ok) return { ok: false, error: built.error, message: built.message, status: 0 }
  let response
  try {
    response = await fetchImpl(built.url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      ...options
    })
  } catch (_) {
    return {
      ok: false,
      error: 'connection_lost',
      message: CONNECTION_LOST_MESSAGE,
      uncertain: true,
      status: 0
    }
  }
  const payload = await readJsonResponse(response)
  return { response, payload }
}

export async function fetchDevCycleStatus({ backendBase, fetchImpl = fetch } = {}) {
  const built = buildLocalDevApiUrl(backendBase, DEV_CYCLE_STATUS_PATH)
  const result = await localDevFetch(
    built,
    { method: 'GET', headers: { Accept: 'application/json' } },
    fetchImpl
  )
  if (!result.response) return result
  if (!result.payload || typeof result.payload !== 'object') {
    return { ok: false, error: 'invalid_cycle_status', message: INVALID_CYCLE_API_MESSAGE, status: result.response.status }
  }
  const sanitized = sanitizeDevCycleStatus(result.payload)
  if (!sanitized) {
    return { ok: false, error: 'invalid_cycle_status', message: INVALID_CYCLE_API_MESSAGE, status: result.response.status }
  }
  if (!result.response.ok || sanitized.ok === false) {
    return {
      ...sanitized,
      ok: false,
      error: sanitized.error || `http_${result.response.status}`,
      message: cycleErrorMessage(sanitized.error, INVALID_CYCLE_API_MESSAGE),
      status: result.response.status
    }
  }
  return { ...sanitized, status: result.response.status }
}

export function buildStartDevCycleBody() {
  return { confirmStart: CONFIRM_START_TOKEN }
}

export async function startDevCycle({ backendBase, fetchImpl = fetch } = {}) {
  const built = buildLocalDevApiUrl(backendBase, DEV_CYCLE_START_PATH)
  const result = await localDevFetch(
    built,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(buildStartDevCycleBody())
    },
    fetchImpl
  )
  if (!result.response) return result
  const payload = result.payload && typeof result.payload === 'object' ? result.payload : {}
  if (result.response.status === 409 || payload.error === 'ace_dev_cycle_open_exists') {
    return {
      ok: false,
      error: String(payload.error || 'ace_dev_cycle_open_exists'),
      message: cycleErrorMessage(payload.error, START_BLOCKED_OPEN_MESSAGE),
      status: result.response.status
    }
  }
  if (!result.response.ok || payload.ok === false) {
    const error = String(payload.error || `http_${result.response.status}`)
    return {
      ok: false,
      error,
      message: cycleErrorMessage(error, payload.message || INVALID_CYCLE_API_MESSAGE),
      status: result.response.status
    }
  }
  return {
    ok: true,
    message: START_SUCCESS_MESSAGE,
    status: result.response.status
  }
}

export function buildCancelExecuteBody(previewFingerprint, operationId) {
  const body = {
    confirmExecute: CONFIRM_EXECUTE_TOKEN,
    previewFingerprint: sanitizePreviewFingerprint(previewFingerprint)
  }
  const op = sanitizeOperationId(operationId)
  if (op) body.operationId = op
  return body
}

export function canSendCancelExecute(preview, operationId) {
  const body = buildCancelExecuteBody(preview?.previewFingerprint, operationId)
  return Boolean(body.previewFingerprint)
    && body.confirmExecute === CONFIRM_EXECUTE_TOKEN
    && Boolean(body.operationId)
}

export function summarizeCancelExecuteResult(payload, httpStatus) {
  const body = payload && typeof payload === 'object' ? payload : {}
  const error = String(body.error || '')
  const execStatus = body.executeResult && typeof body.executeResult === 'object'
    ? String(body.executeResult.status || '')
    : ''
  const autoStart = sanitizePostCancelAutoStart(body.postCancelAutoStart)

  if (httpStatus === 409) {
    return {
      ok: false,
      cancelSucceeded: false,
      uncertain: false,
      error: error || 'ace_cancel_execute_conflict',
      message: cycleErrorMessage(error, STALE_PREVIEW_MESSAGE),
      blockers: asStringArray(body.blockers),
      autoStart,
      status: 409
    }
  }

  if (httpStatus < 200 || httpStatus >= 300 || body.ok === false || execStatus === 'PARTIAL') {
    return {
      ok: false,
      cancelSucceeded: false,
      uncertain: false,
      partial: execStatus === 'PARTIAL' || error === 'ace_cancel_execute_failed',
      error: error || `http_${httpStatus}`,
      message: cycleErrorMessage(error, body.message || CANCEL_PARTIAL_MESSAGE),
      blockers: asStringArray(body.blockers),
      recoveryGuideFile: body.recovery?.recoveryGuideFile ? String(body.recovery.recoveryGuideFile) : '',
      autoStart,
      status: httpStatus
    }
  }

  return {
    ok: true,
    cancelSucceeded: true,
    uncertain: false,
    autoStart,
    message: CANCEL_SUCCESS_MESSAGE,
    status: httpStatus
  }
}

export function buildPostCancelOutcome(executeResult, status) {
  if (executeResult?.uncertain) {
    return {
      kind: 'uncertain',
      cancelSucceeded: false,
      autoStartSucceeded: false,
      lines: [CONNECTION_LOST_MESSAGE],
      sessionId: ''
    }
  }
  if (!executeResult?.cancelSucceeded) {
    return {
      kind: 'error',
      cancelSucceeded: false,
      autoStartSucceeded: false,
      lines: [executeResult?.message || CANCEL_PARTIAL_MESSAGE],
      sessionId: ''
    }
  }

  const statusOpen = status?.ok && status.activeCycle?.status === 'OPEN'
  const sessionId = statusOpen
    ? (status.activeCycle.sessionId || executeResult.autoStart?.newSessionId || '')
    : ''
  const autoStartSucceeded = statusOpen === true
  const lines = [CANCEL_SUCCESS_MESSAGE]
  if (autoStartSucceeded) {
    lines.push(AUTO_START_SUCCESS_MESSAGE)
  } else {
    lines.push(AUTO_START_FAILED_MESSAGE)
  }
  return {
    kind: autoStartSucceeded ? 'success' : 'mixed',
    cancelSucceeded: true,
    autoStartSucceeded,
    lines,
    sessionId
  }
}

export async function executeCancelDevelopment({
  backendBase,
  previewFingerprint,
  operationId,
  fetchImpl = fetch
} = {}) {
  const fingerprint = sanitizePreviewFingerprint(previewFingerprint)
  const op = sanitizeOperationId(operationId)
  if (!fingerprint) {
    return { ok: false, cancelSucceeded: false, error: 'ace_cancel_preview_fingerprint_invalid', message: FINGERPRINT_REQUIRED_MESSAGE, status: 0 }
  }
  if (!op) {
    return { ok: false, cancelSucceeded: false, error: 'ace_cancel_progress_operation_id_invalid', message: 'מזהה הפעולה אינו תקין.', status: 0 }
  }
  const built = buildLocalDevApiUrl(backendBase, CANCEL_DEV_EXECUTE_PATH)
  const body = buildCancelExecuteBody(fingerprint, op)
  const result = await localDevFetch(
    built,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    fetchImpl
  )
  if (!result.response) {
    return {
      ...result,
      cancelSucceeded: false,
      uncertain: true,
      error: 'connection_lost',
      message: CONNECTION_LOST_MESSAGE
    }
  }
  const payload = result.payload && typeof result.payload === 'object' ? result.payload : {}
  return summarizeCancelExecuteResult(payload, result.response.status)
}
