import {
  isLocalDevBackendUrl,
  isPublicRenderBackendUrl,
  normalizeBackendUrl
} from '../services/backendUrl.js'
import { sanitizePreviewFingerprint } from './localDevCancelPreview.js'

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
export const CANCEL_SUCCESS_MESSAGE = 'הפיתוח הזמני בוטל.'
export const CANCEL_PARTIAL_MESSAGE =
  'הביטול הושלם חלקית. אין לשלוח שוב אוטומטית. בדקו את מדריך השחזור.'
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

export function cycleStatusLabel(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'OPEN') return OPEN_CYCLE_MESSAGE
  if (value === 'INVALID') return INVALID_CYCLE_MESSAGE
  if (value === 'CANCELLED') return ALREADY_CANCELLED_MESSAGE
  return CAN_START_CYCLE_MESSAGE
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
  const canStartNewCycle = payload.canStartNewCycle === true && !invalid && status !== 'OPEN'
  return {
    ok: payload.ok !== false,
    invalid,
    error: payload.error ? String(payload.error) : invalid ? 'ace_active_dev_cycle_invalid' : null,
    message: invalid ? INVALID_CYCLE_MESSAGE : cycleStatusLabel(status),
    canStartNewCycle,
    canCancelCycle: status === 'OPEN' && !invalid,
    activeCycle: {
      status,
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
    return { ok: false, error: 'backend_unavailable', message: BACKEND_UNAVAILABLE_MESSAGE, status: 0 }
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

export function buildCancelExecuteBody(previewFingerprint) {
  return {
    confirmExecute: CONFIRM_EXECUTE_TOKEN,
    previewFingerprint: sanitizePreviewFingerprint(previewFingerprint)
  }
}

export function canSendCancelExecute(preview) {
  const body = buildCancelExecuteBody(preview?.previewFingerprint)
  return Boolean(body.previewFingerprint) && body.confirmExecute === CONFIRM_EXECUTE_TOKEN
}

export async function executeCancelDevelopment({ backendBase, previewFingerprint, fetchImpl = fetch } = {}) {
  const fingerprint = sanitizePreviewFingerprint(previewFingerprint)
  if (!fingerprint) {
    return { ok: false, error: 'ace_cancel_preview_fingerprint_invalid', message: FINGERPRINT_REQUIRED_MESSAGE, status: 0 }
  }
  const built = buildLocalDevApiUrl(backendBase, CANCEL_DEV_EXECUTE_PATH)
  const body = buildCancelExecuteBody(fingerprint)
  const result = await localDevFetch(
    built,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    fetchImpl
  )
  if (!result.response) return result
  const payload = result.payload && typeof result.payload === 'object' ? result.payload : {}
  const error = String(payload.error || '')
  const execStatus = payload.executeResult && typeof payload.executeResult === 'object'
    ? String(payload.executeResult.status || '')
    : ''

  if (result.response.status === 409) {
    return {
      ok: false,
      error: error || 'ace_cancel_execute_conflict',
      message: cycleErrorMessage(error, STALE_PREVIEW_MESSAGE),
      blockers: asStringArray(payload.blockers),
      status: 409
    }
  }

  if (!result.response.ok || payload.ok === false || execStatus === 'PARTIAL') {
    const mapped = cycleErrorMessage(error, payload.message || CANCEL_PARTIAL_MESSAGE)
    return {
      ok: false,
      partial: execStatus === 'PARTIAL' || error === 'ace_cancel_execute_failed',
      error: error || `http_${result.response.status}`,
      message: mapped,
      blockers: asStringArray(payload.blockers),
      recoveryGuideFile: payload.recovery?.recoveryGuideFile ? String(payload.recovery.recoveryGuideFile) : '',
      status: result.response.status
    }
  }

  return {
    ok: true,
    message: CANCEL_SUCCESS_MESSAGE,
    status: result.response.status
  }
}
