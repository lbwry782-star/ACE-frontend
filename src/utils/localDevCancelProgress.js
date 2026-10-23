import {
  isLocalDevBackendUrl,
  isPublicRenderBackendUrl,
  normalizeBackendUrl
} from '../services/backendUrl.js'

const SESSION_ID_PATTERN = /^ori-\d{8}-\d{6}-[0-9a-f]{8}$/i

function sanitizeSessionId(value) {
  const text = String(value ?? '').trim()
  return SESSION_ID_PATTERN.test(text) ? text : ''
}

export const CANCEL_DEV_PROGRESS_PATH = '/api/local-dev/cancel-development/progress'
export const CANCEL_PROGRESS_STORAGE_KEY = 'ace.localDev.cancelProgress.v1'
export const CANCEL_PROGRESS_POLL_MS = 2000

export const CANCEL_PROGRESS_STEPS = [
  { id: 'pre_checks', label: 'בדיקת תנאים' },
  { id: 'backup_creation', label: 'יצירת גיבוי' },
  { id: 'backend_restore', label: 'שחזור Backend' },
  { id: 'frontend_restore', label: 'שחזור Frontend' },
  { id: 'env_restore', label: 'שחזור הגדרות' },
  { id: 'final_verify', label: 'אימות התוצאה' },
  { id: 'close_cancel_cycle', label: 'סגירת מחזור הפיתוח' },
  { id: 'post_cancel_auto_start', label: 'פתיחת מחזור פיתוח חדש' }
]

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'PARTIAL'])
const STEP_STATUSES = new Set(['IN_PROGRESS', 'SUCCESS', 'FAILED'])

export function createCancelOperationId(randomUUID = () => crypto.randomUUID()) {
  const raw = String(randomUUID() || '')
  return raw.replace(/-/g, '').toLowerCase()
}

export function sanitizeOperationId(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (text.length !== 32 || !/^[0-9a-f]{32}$/.test(text)) return ''
  return text
}

export function buildCancelProgressUrl(backendBase, operationId, sessionId) {
  const base = normalizeBackendUrl(backendBase)
  if (!base || isPublicRenderBackendUrl(base) || !isLocalDevBackendUrl(base)) {
    return { ok: false, error: 'local_backend_required' }
  }
  const op = sanitizeOperationId(operationId)
  if (!op) return { ok: false, error: 'ace_cancel_progress_operation_id_invalid' }
  const params = new URLSearchParams({ operationId: op })
  const sid = sanitizeSessionId(sessionId)
  if (sid) params.set('sessionId', sid)
  return { ok: true, url: `${base}${CANCEL_DEV_PROGRESS_PATH}?${params.toString()}` }
}

function memoryStorage() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(String(key), String(value))
    },
    removeItem(key) {
      data.delete(key)
    }
  }
}

let fallbackStorage = memoryStorage()

export function getCancelProgressStorage() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage
  } catch (_) {
    /* private mode */
  }
  return fallbackStorage
}

export function resetCancelProgressStorageForTests(storage) {
  fallbackStorage = storage || memoryStorage()
}

export function saveCancelProgressHandle({ operationId, sessionId }, storage = getCancelProgressStorage()) {
  const op = sanitizeOperationId(operationId)
  const sid = sanitizeSessionId(sessionId)
  if (!op || !sid) return false
  storage.setItem(CANCEL_PROGRESS_STORAGE_KEY, JSON.stringify({ operationId: op, sessionId: sid }))
  return true
}

export function loadCancelProgressHandle(storage = getCancelProgressStorage()) {
  try {
    const raw = storage.getItem(CANCEL_PROGRESS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const operationId = sanitizeOperationId(parsed?.operationId)
    const sessionId = sanitizeSessionId(parsed?.sessionId)
    if (!operationId || !sessionId) return null
    return { operationId, sessionId }
  } catch (_) {
    return null
  }
}

export function clearCancelProgressHandle(storage = getCancelProgressStorage()) {
  storage.removeItem(CANCEL_PROGRESS_STORAGE_KEY)
}

function sanitizeStep(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  const status = String(raw.status || '').toUpperCase()
  if (!id || !STEP_STATUSES.has(status)) return null
  return {
    id,
    status,
    startedAt: raw.startedAt ? String(raw.startedAt) : '',
    finishedAt: raw.finishedAt ? String(raw.finishedAt) : ''
  }
}

export function sanitizeCancelProgress(payload) {
  if (!payload || typeof payload !== 'object') return null
  const operationId = sanitizeOperationId(payload.operationId)
  const sessionId = sanitizeSessionId(payload.sessionId)
  const operationStatus = String(payload.operationStatus || '').toUpperCase()
  const cancelStatus = String(payload.cancelStatus || '').toUpperCase()
  const autoRaw = payload.postCancelAutoStart && typeof payload.postCancelAutoStart === 'object'
    ? payload.postCancelAutoStart
    : {}
  const completed = Array.isArray(payload.completedSteps)
    ? payload.completedSteps.map(sanitizeStep).filter(Boolean)
    : []
  return {
    ok: payload.ok !== false,
    operationId,
    sessionId,
    operationStatus,
    cancelStatus,
    phase: String(payload.phase || ''),
    currentStep: sanitizeStep(payload.currentStep),
    completedSteps: completed,
    postCancelAutoStart: {
      phase: String(autoRaw.phase || '').toUpperCase(),
      newSessionId: sanitizeSessionId(autoRaw.newSessionId),
      lastError: autoRaw.lastError ? String(autoRaw.lastError) : ''
    },
    error: payload.error ? String(payload.error) : ''
  }
}

export function isTerminalProgress(progress) {
  if (!progress) return false
  return TERMINAL_STATUSES.has(String(progress.operationStatus || '').toUpperCase())
}

export function mapProgressSteps(progress) {
  const completed = Array.isArray(progress?.completedSteps) ? progress.completedSteps : []
  const current = progress?.currentStep
  return CANCEL_PROGRESS_STEPS.map((def) => {
    const done = completed.find((item) => item.id === def.id)
    const active = current?.id === def.id && current.status === 'IN_PROGRESS'
    let state = 'pending'
    if (done?.status === 'SUCCESS') state = 'success'
    else if (done?.status === 'FAILED') state = 'failed'
    else if (active) state = 'active'
    return { id: def.id, label: def.label, state }
  })
}

export function stepStateLabel(state) {
  if (state === 'success') return 'הושלם'
  if (state === 'failed') return 'נכשל'
  if (state === 'active') return 'בתהליך'
  return 'ממתין לדיווח מהשרת'
}

export function buildProgressOutcome(progress) {
  const cancelStatus = String(progress?.cancelStatus || '').toUpperCase()
  const operationStatus = String(progress?.operationStatus || '').toUpperCase()
  const auto = progress?.postCancelAutoStart || {}
  const autoCompleted = auto.phase === 'COMPLETED' && Boolean(auto.newSessionId)

  if (cancelStatus === 'FAILED' || cancelStatus === 'PARTIAL') {
    return {
      kind: 'error',
      cancelSucceeded: false,
      autoStartSucceeded: false,
      lines: [progress?.error || 'הביטול נכשל.'],
      sessionId: ''
    }
  }

  if (cancelStatus !== 'COMPLETED') {
    return null
  }

  if (operationStatus === 'COMPLETED' && autoCompleted) {
    return {
      kind: 'success',
      cancelSucceeded: true,
      autoStartSucceeded: true,
      lines: ['הפיתוח הקודם בוטל בהצלחה.', 'מחזור פיתוח חדש נפתח.'],
      sessionId: auto.newSessionId
    }
  }

  if (operationStatus === 'FAILED' || auto.phase === 'FAILED' || (isTerminalProgress(progress) && !autoCompleted)) {
    return {
      kind: 'mixed',
      cancelSucceeded: true,
      autoStartSucceeded: false,
      lines: ['הפיתוח הקודם בוטל בהצלחה.', 'פתיחת המחזור החדש לא הושלמה.'],
      sessionId: ''
    }
  }

  return null
}

export async function fetchCancelProgress({
  backendBase,
  operationId,
  sessionId,
  fetchImpl = fetch
} = {}) {
  const built = buildCancelProgressUrl(backendBase, operationId, sessionId)
  if (!built.ok) {
    return { ok: false, error: built.error, status: 0 }
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

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }

  if (response.status === 404) {
    return { ok: false, notFound: true, error: 'ace_cancel_progress_not_found', status: 404 }
  }
  if (!response.ok || !payload || typeof payload !== 'object') {
    return {
      ok: false,
      uncertain: true,
      error: String(payload?.error || `http_${response.status}`),
      status: response.status
    }
  }
  const sanitized = sanitizeCancelProgress(payload)
  if (!sanitized) {
    return { ok: false, uncertain: true, error: 'invalid_progress', status: response.status }
  }
  return { ...sanitized, status: response.status }
}

export function createCancelProgressPoller({
  backendBase,
  operationId,
  sessionId,
  intervalMs = CANCEL_PROGRESS_POLL_MS,
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
      const result = await fetchCancelProgress({
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
      if (isTerminalProgress(result)) {
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
    },
    get inFlight() {
      return inFlight
    }
  }
}
