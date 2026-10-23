import { buildLocalDevApiUrl } from './localDevCycleApi.js'
import {
  PUBLISH_BACKEND_UNAVAILABLE_MESSAGE,
  PUBLISH_INVALID_PREVIEW_MESSAGE,
  PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE,
  sanitizePublishUriPreviewPayload
} from './localDevPublishUriPreview.js'

export const PUBLISH_URI_CANDIDATE_REGISTERED_PATH =
  '/api/local-dev/publish-uri/candidate/registered'
export const PUBLISH_URI_CANDIDATE_PREVIEW_PATH =
  '/api/local-dev/publish-uri/candidate/preview'
export const PUBLISH_URI_CANDIDATE_DRY_RUN_PATH =
  '/api/local-dev/publish-uri/candidate/dry-run'

export const PUBLISH_CANDIDATE_NONE_MESSAGE =
  'אין מועמד פרסום רשום. יש לרשום מועמד במנגנון המקומי לפני בדיקת פרסום.'
export const PUBLISH_CANDIDATE_STALE_MESSAGE =
  'מועמד הפרסום הרשום אינו עדכני. יש לרענן את הרישום לפני בדיקת פרסום.'
export const PUBLISH_CANDIDATE_NO_CYCLE_MESSAGE =
  'אין מחזור פיתוח פעיל. לא ניתן לבדוק פרסום.'
export const PUBLISH_CANDIDATE_UNAVAILABLE_MESSAGE =
  'מצב המחזור אינו תקין. לא ניתן לגלות מועמד פרסום.'
export const PUBLISH_CANDIDATE_DISCOVERY_FAILED_MESSAGE =
  'לא ניתן לקרוא את מועמד הפרסום הרשום מהשרת המקומי.'
export const PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE =
  'מועמד הפרסום הרשום אינו תקין. אין לבחור SHA באופן אוטומטי.'
export const PUBLISH_CANDIDATE_FINGERPRINT_STALE_MESSAGE =
  'בדיקת הפרסום אינה עדכנית. סגרו את החלון ולחצו שוב על PUBLISH כדי לרענן את התצוגה.'
export const PUBLISH_CANDIDATE_DRY_RUN_SUCCESS_MESSAGE =
  'בדיקת הפרסום הצליחה. לא בוצע פרסום.'
export const PUBLISH_CANDIDATE_DRY_RUN_BUSY_MESSAGE =
  'בדיקה אחרת כבר מתבצעת. נסו שוב בעוד רגע.'
export const PUBLISH_CANDIDATE_DRY_RUN_FAILED_MESSAGE =
  'בדיקת הפרסום נכשלה.'
export const PUBLISH_CANDIDATE_ELIGIBLE_MESSAGE = 'המועמד כשיר לפרסום לפי בדיקות הבטיחות.'
export const PUBLISH_CANDIDATE_NOT_ELIGIBLE_MESSAGE = 'המועמד אינו כשיר לפרסום כרגע.'

const SHA1_PATTERN = /^[0-9a-f]{40}$/
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export function sanitizeCandidateBackendSha(value) {
  const sha = String(value ?? '').trim().toLowerCase()
  return SHA1_PATTERN.test(sha) ? sha : ''
}

export function sanitizePublishUriPreviewFingerprint(value) {
  const text = String(value ?? '').trim().toLowerCase()
  return FINGERPRINT_PATTERN.test(text) ? text : ''
}

export function registeredCandidateDiscoveryMessage(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'NONE') return PUBLISH_CANDIDATE_NONE_MESSAGE
  if (value === 'STALE') return PUBLISH_CANDIDATE_STALE_MESSAGE
  if (value === 'NO_ACTIVE_CYCLE') return PUBLISH_CANDIDATE_NO_CYCLE_MESSAGE
  if (value === 'UNAVAILABLE') return PUBLISH_CANDIDATE_UNAVAILABLE_MESSAGE
  return PUBLISH_CANDIDATE_NONE_MESSAGE
}

export function buildPublishUriCandidateRegisteredUrl(backendBase) {
  const built = buildLocalDevApiUrl(backendBase, PUBLISH_URI_CANDIDATE_REGISTERED_PATH)
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return built
}

export function buildPublishUriCandidatePreviewUrl(backendBase, candidateBackendSha) {
  const sha = sanitizeCandidateBackendSha(candidateBackendSha)
  if (!sha) {
    return { ok: false, error: 'ace_publish_uri_candidate_sha_invalid', message: PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE }
  }
  const built = buildLocalDevApiUrl(
    backendBase,
    `${PUBLISH_URI_CANDIDATE_PREVIEW_PATH}?candidateBackendSha=${encodeURIComponent(sha)}`
  )
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return { ...built, candidateBackendSha: sha }
}

export function buildPublishUriCandidateDryRunUrl(backendBase) {
  const built = buildLocalDevApiUrl(backendBase, PUBLISH_URI_CANDIDATE_DRY_RUN_PATH)
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return built
}

export function sanitizeRegisteredPublishCandidate(payload) {
  if (!payload || typeof payload !== 'object') return null
  const status = String(payload.status || '').toUpperCase()
  const sha = sanitizeCandidateBackendSha(payload.candidateBackendSha)
  const hasRegisteredCandidate = payload.hasRegisteredCandidate === true && status === 'ACTIVE' && Boolean(sha)
  let message = hasRegisteredCandidate
    ? String(payload.message || '')
    : registeredCandidateDiscoveryMessage(status || 'NONE')
  if (!hasRegisteredCandidate && status === 'ACTIVE') {
    message = PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE
  }
  return {
    ok: payload.ok !== false,
    hasRegisteredCandidate,
    status: status || 'NONE',
    candidateBackendSha: hasRegisteredCandidate ? sha : '',
    sessionId: String(payload.sessionId || ''),
    error: payload.error ? String(payload.error) : '',
    message,
    executePublishEndpointAvailable: false
  }
}

export function discoveryFailurePreview(discovered) {
  const status = String(discovered?.status || 'NONE').toUpperCase()
  return {
    ok: false,
    previewKind: 'CANDIDATE_BACKEND',
    discoveryStatus: status,
    hasRegisteredCandidate: false,
    candidateBackendSha: '',
    publishUriPreviewFingerprint: '',
    executePublishEndpointAvailable: false,
    candidateDryRunAvailable: false,
    error: discovered?.error || 'no_registered_candidate',
    message: discovered?.message || registeredCandidateDiscoveryMessage(status),
    blockers: [],
    candidateBlockers: [],
    warnings: [],
    readiness: {
      hasProductChanges: false,
      canPrepareLocalPublish: false,
      verifiedSafeForLiveProduction: false,
      candidateVerifiedSafeForPublish: false,
      notes: []
    }
  }
}

export function sanitizePublishUriCandidatePreviewPayload(payload) {
  const base = sanitizePublishUriPreviewPayload(payload)
  if (!base) return null
  const readiness = payload.readiness && typeof payload.readiness === 'object' ? payload.readiness : {}
  const sha = sanitizeCandidateBackendSha(payload.candidateBackendSha)
  const fingerprint = sanitizePublishUriPreviewFingerprint(payload.publishUriPreviewFingerprint)
  return {
    ...base,
    previewKind: 'CANDIDATE_BACKEND',
    candidateBackendSha: sha,
    candidateFrontendSha: sanitizeCandidateBackendSha(payload.candidateFrontendSha),
    publishUriPreviewFingerprint: fingerprint,
    executePublishEndpointAvailable: false,
    candidateDryRunAvailable: payload.candidateDryRunAvailable !== false && Boolean(sha) && Boolean(fingerprint),
    candidateBlockers: asStringArray(payload.candidateBlockers),
    warnings: asStringArray(payload.warnings),
    readiness: {
      ...base.readiness,
      hasBackendProductChanges: readiness.hasBackendProductChanges === true,
      hasFrontendProductChanges: readiness.hasFrontendProductChanges === true,
      candidateVerifiedSafeForPublish: readiness.candidateVerifiedSafeForPublish === true,
      candidateDryRunAvailable: readiness.candidateDryRunAvailable !== false
    }
  }
}

export function isCandidateEligibleForPublish(preview) {
  if (!preview || preview.ok === false) return false
  if (preview.previewKind !== 'CANDIDATE_BACKEND') return false
  if (preview.readiness?.candidateVerifiedSafeForPublish !== true) return false
  if ((preview.blockers || []).length) return false
  if ((preview.candidateBlockers || []).length) return false
  return true
}

export function canDryRunPublishCandidate(preview) {
  if (!preview || preview.ok === false) return false
  if (preview.previewKind !== 'CANDIDATE_BACKEND') return false
  if (!sanitizeCandidateBackendSha(preview.candidateBackendSha)) return false
  if (!sanitizePublishUriPreviewFingerprint(preview.publishUriPreviewFingerprint)) return false
  return preview.candidateDryRunAvailable !== false
}

function dryRunErrorMessage(code, fallback) {
  const key = String(code || '').trim()
  if (key === 'ace_publish_uri_candidate_fingerprint_stale') {
    return PUBLISH_CANDIDATE_FINGERPRINT_STALE_MESSAGE
  }
  if (key === 'ace_local_dev_execute_in_progress') {
    return PUBLISH_CANDIDATE_DRY_RUN_BUSY_MESSAGE
  }
  if (key === 'ace_publish_uri_candidate_sha_invalid') {
    return PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE
  }
  if (key === 'backend_unavailable') return PUBLISH_BACKEND_UNAVAILABLE_MESSAGE
  if (key === 'local_backend_required') return PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE
  return fallback || PUBLISH_CANDIDATE_DRY_RUN_FAILED_MESSAGE
}

export function sanitizePublishUriCandidateDryRunPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const preview = payload.preview && typeof payload.preview === 'object'
    ? sanitizePublishUriCandidatePreviewPayload(payload.preview)
    : null
  const error = payload.error ? String(payload.error) : ''
  const ok = payload.ok === true && payload.dryRun === true && error !== 'ace_publish_uri_candidate_fingerprint_stale'
  return {
    ok,
    dryRun: true,
    dryRunMode: String(payload.dryRunMode || 'CANDIDATE_PUBLISH_NO_SIDE_EFFECTS'),
    fingerprintMatched: payload.fingerprintMatched === true,
    candidateBackendSha: sanitizeCandidateBackendSha(payload.candidateBackendSha),
    publishUriPreviewFingerprint: sanitizePublishUriPreviewFingerprint(payload.publishUriPreviewFingerprint),
    preview,
    error,
    note: String(payload.note || ''),
    message: ok
      ? PUBLISH_CANDIDATE_DRY_RUN_SUCCESS_MESSAGE
      : dryRunErrorMessage(error, payload.message ? String(payload.message) : '')
  }
}

async function readJson(response) {
  try {
    return await response.json()
  } catch (_) {
    return null
  }
}

export async function fetchRegisteredPublishCandidate({ backendBase, fetchImpl = fetch } = {}) {
  const built = buildPublishUriCandidateRegisteredUrl(backendBase)
  if (!built.ok) return built

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
    return { ok: false, error: 'backend_unavailable', message: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE }
  }

  const payload = await readJson(response)
  const sanitized = sanitizeRegisteredPublishCandidate(payload)
  if (!sanitized) {
    return {
      ok: false,
      hasRegisteredCandidate: false,
      status: 'NONE',
      error: 'invalid_preview',
      message: PUBLISH_CANDIDATE_DISCOVERY_FAILED_MESSAGE
    }
  }
  if (payload?.ok === false && !response.ok) {
    return {
      ...sanitized,
      ok: false,
      hasRegisteredCandidate: false,
      message: sanitized.message || PUBLISH_INVALID_PREVIEW_MESSAGE
    }
  }
  return sanitized
}

export async function fetchPublishUriCandidatePreview({
  backendBase,
  candidateBackendSha,
  fetchImpl = fetch
} = {}) {
  const sha = sanitizeCandidateBackendSha(candidateBackendSha)
  if (!sha) {
    return { ok: false, error: 'ace_publish_uri_candidate_sha_invalid', message: PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE }
  }
  const built = buildPublishUriCandidatePreviewUrl(backendBase, sha)
  if (!built.ok) return built

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
    return { ok: false, error: 'backend_unavailable', message: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE }
  }

  const payload = await readJson(response)
  const sanitized = sanitizePublishUriCandidatePreviewPayload(payload)
  if (!sanitized) {
    return { ok: false, error: 'invalid_preview', message: PUBLISH_INVALID_PREVIEW_MESSAGE }
  }

  if (payload.ok === false || !response.ok) {
    return {
      ...sanitized,
      ok: false,
      candidateBackendSha: sha,
      error: String(payload.error || sanitized.error || `http_${response.status}`),
      message: String(payload.message || PUBLISH_INVALID_PREVIEW_MESSAGE)
    }
  }

  return {
    ...sanitized,
    candidateBackendSha: sanitized.candidateBackendSha || sha
  }
}

export async function fetchRegisteredPublishCandidatePreview({ backendBase, fetchImpl = fetch } = {}) {
  const discovered = await fetchRegisteredPublishCandidate({ backendBase, fetchImpl })
  if (discovered.error === 'backend_unavailable' || discovered.error === 'local_backend_required') {
    return discovered
  }
  if (!discovered.hasRegisteredCandidate || !discovered.candidateBackendSha) {
    return discoveryFailurePreview(discovered)
  }
  return fetchPublishUriCandidatePreview({
    backendBase,
    candidateBackendSha: discovered.candidateBackendSha,
    fetchImpl
  })
}

export async function postPublishUriCandidateDryRun({
  backendBase,
  candidateBackendSha,
  publishUriPreviewFingerprint,
  fetchImpl = fetch
} = {}) {
  const sha = sanitizeCandidateBackendSha(candidateBackendSha)
  const fingerprint = sanitizePublishUriPreviewFingerprint(publishUriPreviewFingerprint)
  if (!sha) {
    return {
      ok: false,
      dryRun: true,
      error: 'ace_publish_uri_candidate_sha_invalid',
      message: PUBLISH_CANDIDATE_SHA_INVALID_MESSAGE
    }
  }
  if (!fingerprint) {
    return {
      ok: false,
      dryRun: true,
      error: 'ace_publish_uri_candidate_fingerprint_stale',
      message: PUBLISH_CANDIDATE_FINGERPRINT_STALE_MESSAGE
    }
  }

  const built = buildPublishUriCandidateDryRunUrl(backendBase)
  if (!built.ok) return { ...built, dryRun: true }

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
        candidateBackendSha: sha,
        publishUriPreviewFingerprint: fingerprint
      })
    })
  } catch (_) {
    return {
      ok: false,
      dryRun: true,
      error: 'backend_unavailable',
      message: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE
    }
  }

  const payload = await readJson(response)
  const sanitized = sanitizePublishUriCandidateDryRunPayload(payload)
  if (!sanitized) {
    return {
      ok: false,
      dryRun: true,
      error: 'invalid_preview',
      message: PUBLISH_INVALID_PREVIEW_MESSAGE
    }
  }
  if (!response.ok || payload?.ok === false) {
    const error = String(payload?.error || sanitized.error || `http_${response.status}`)
    return {
      ...sanitized,
      ok: false,
      error,
      message: dryRunErrorMessage(error, payload?.message ? String(payload.message) : sanitized.message)
    }
  }
  return sanitized
}
