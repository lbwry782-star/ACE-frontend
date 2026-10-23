import { buildLocalDevApiUrl } from './localDevCycleApi.js'

export const PUBLISH_URI_PREVIEW_PATH = '/api/local-dev/publish-uri/preview'

export const PUBLISH_BACKEND_UNAVAILABLE_MESSAGE =
  'לא ניתן להתחבר לשרת המקומי. ודאו שה-Backend רץ ב-127.0.0.1:5000 ונסו שוב.'
export const PUBLISH_INVALID_PREVIEW_MESSAGE = 'התשובה מהשרת המקומי אינה תקינה.'
export const PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE =
  'בדיקת הפרסום זמינה רק מול Backend מקומי. לא מתבצע מעבר לשרת ציבורי.'
export const PUBLISH_BLOCKED_LIVE_MESSAGE = 'לא ניתן לפרסם את הגרסה הנוכחית.'
export const PUBLISH_CANDIDATE_NOTE = 'שינוי מועמד לפרסום בלבד. לא אושר לפרסום חי.'
export const PUBLISH_LIVE_APPROVED_NOTE = 'השרת מדווח שהגרסה בטוחה לייצור. אין ביצוע פרסום בממשק זה.'

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function asCommitRows(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      shortSha: String(item.shortSha ?? '').trim(),
      subject: String(item.subject ?? '').trim(),
      classification: String(item.classification ?? '').trim(),
      branches: asStringArray(item.branches),
      paths: asStringArray(item.paths),
      securityFlags: asStringArray(item.securityFlags)
    }))
}

function asFiles(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') return String(item.path || item.file || '').trim()
      return ''
    })
    .filter(Boolean)
}

function asProposedSide(raw) {
  const side = raw && typeof raw === 'object' ? raw : {}
  return {
    deployTargetBranch: String(side.deployTargetBranch || ''),
    sourceRef: String(side.sourceRef || ''),
    proposedHeadSha: String(side.proposedHeadSha || ''),
    commits: asCommitRows(side.commits),
    files: asFiles(side.files)
  }
}

export function buildPublishUriPreviewUrl(backendBase) {
  const built = buildLocalDevApiUrl(backendBase, PUBLISH_URI_PREVIEW_PATH)
  if (!built.ok) {
    return { ...built, message: PUBLISH_LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return built
}

export function sanitizePublishUriPreviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const production = payload.production && typeof payload.production === 'object' ? payload.production : {}
  const proposed = payload.proposedChanges && typeof payload.proposedChanges === 'object'
    ? payload.proposedChanges
    : {}
  const worker = payload.workerImpact && typeof payload.workerImpact === 'object' ? payload.workerImpact : {}
  const commits = payload.commits && typeof payload.commits === 'object' ? payload.commits : {}
  const candidate = commits.productCandidate && typeof commits.productCandidate === 'object'
    ? commits.productCandidate
    : {}
  const excluded = commits.excludedLocal && typeof commits.excludedLocal === 'object'
    ? commits.excludedLocal
    : {}
  const readiness = payload.readiness && typeof payload.readiness === 'object' ? payload.readiness : {}
  const cycle = payload.activeCycle && typeof payload.activeCycle === 'object' ? payload.activeCycle : {}
  const verifiedSafe = readiness.verifiedSafeForLiveProduction === true

  return {
    ok: payload.ok !== false,
    error: payload.error ? String(payload.error) : '',
    message: payload.message ? String(payload.message) : '',
    previewMode: 'READ_ONLY',
    publishUriPreviewFingerprint: String(payload.publishUriPreviewFingerprint || ''),
    executePublishEndpointAvailable: false,
    sessionId: String(payload.sessionId || ''),
    production: {
      backendWeb: String(production.backendWeb || ''),
      backendWorker: String(production.backendWorker || ''),
      backendBranch: String(production.backendBranch || ''),
      frontend: String(production.frontend || ''),
      frontendBranch: String(production.frontendBranch || '')
    },
    proposedChanges: {
      backend: asProposedSide(proposed.backend),
      frontend: asProposedSide(proposed.frontend)
    },
    workerImpact: {
      deployWithBackendWeb: worker.deployWithBackendWeb === true,
      proposedCommitSha: String(worker.proposedCommitSha || ''),
      note: String(worker.note || '')
    },
    commits: {
      productCandidate: {
        backend: asCommitRows(candidate.backend),
        frontend: asCommitRows(candidate.frontend)
      },
      excludedLocal: {
        backend: asCommitRows(excluded.backend),
        frontend: asCommitRows(excluded.frontend)
      },
      mixedOrBlocked: asCommitRows(commits.mixedOrBlocked)
    },
    blockers: asStringArray(payload.blockers),
    registryInfraDrift: asStringArray(payload.registryInfraDrift),
    registryWipDrift: asStringArray(payload.registryWipDrift),
    readiness: {
      hasProductChanges: readiness.hasProductChanges === true,
      canPrepareLocalPublish: readiness.canPrepareLocalPublish === true,
      verifiedSafeForLiveProduction: verifiedSafe,
      notes: asStringArray(readiness.notes)
    },
    activeCycle: {
      status: String(cycle.status || 'UNKNOWN'),
      message: cycle.message ? String(cycle.message) : ''
    },
    note: String(payload.note || '')
  }
}

const PUBLISH_BLOCKER_EXPLANATIONS = {
  BACKEND_PUBLISH_SECURITY: 'חסימת אבטחה בשינוי Backend המועמד לפרסום.',
  FRONTEND_PUBLISH_SECURITY: 'חסימת אבטחה בשינוי Frontend המועמד לפרסום.',
  ACE_SECURITY_WEAKENED: 'השינוי מחליש את מערכת האבטחה.',
  ACE_LOCAL_DEV_ENABLED_IN_DIFF: 'השינוי מפעיל מצב פיתוח מקומי שאינו מיועד לייצור.',
  BUILDER1_PRODUCTION_MODE_DISABLED: 'השינוי משבית מצב ייצור של Builder1.',
  PAYMENT_BYPASS_HINT: 'השינוי עלול לעקוף את מנגנון התשלום.',
  BACKEND_PUBLISH_MIXED_COMMIT: 'Commit ב-Backend מערב שינוי מוצר עם קוד מקומי.',
  FRONTEND_PUBLISH_MIXED_COMMIT: 'Commit ב-Frontend מערב שינוי מוצר עם קוד מקומי.',
  BACKEND_PUBLISH_UNCLEAR_PATHS: 'נתיבים ב-Backend אינם מסווגים לפרסום.',
  FRONTEND_PUBLISH_UNCLEAR_PATHS: 'נתיבים ב-Frontend אינם מסווגים לפרסום.',
  BACKEND_PUBLISH_FORBIDDEN_ON_WIP: 'שינוי מקומי אסור נמצא על ענף העבודה הזמני ב-Backend.',
  FRONTEND_PUBLISH_FORBIDDEN_ON_WIP: 'שינוי מקומי אסור נמצא על ענף העבודה הזמני ב-Frontend.',
  REGISTRY_INFRA_HEAD_MISMATCH: 'גרסת תשתית הפיתוח אינה תואמת לרישום המאומת.',
  FRONTEND_UNRELATED: 'קיימים שינויים בממשק שאינם משויכים למחזור הפיתוח.',
  BACKEND_UNRELATED: 'קיימים שינויים בשרת שאינם משויכים למחזור הפיתוח.'
}

export function isPublishSecurityBlocker(raw) {
  const text = String(raw ?? '').toUpperCase()
  return text.includes('PUBLISH_SECURITY') || text.includes('ACE_SECURITY') || text.includes('PAYMENT_BYPASS')
}

export function explainPublishBlocker(raw) {
  const original = String(raw ?? '').trim()
  const tokens = original.match(/[A-Z][A-Z0-9_]{3,}/g) || []
  const matched = tokens.find((token) => PUBLISH_BLOCKER_EXPLANATIONS[token])
  const explanation = (matched && PUBLISH_BLOCKER_EXPLANATIONS[matched])
    || 'קיימת חסימה שמונעת פרסום חי כרגע.'
  return {
    explanation,
    technical: original && original !== explanation ? original : '',
    code: matched || '',
    security: isPublishSecurityBlocker(original)
  }
}

export function canExecutePublishUri() {
  return false
}

export function isPublishBlockedForLive(preview) {
  if (!preview) return true
  if (preview.readiness?.verifiedSafeForLiveProduction !== true) return true
  if ((preview.blockers || []).length) return true
  return false
}

export async function fetchPublishUriPreview({ backendBase, fetchImpl = fetch } = {}) {
  const built = buildPublishUriPreviewUrl(backendBase)
  if (!built.ok) {
    return built
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
    return { ok: false, error: 'backend_unavailable', message: PUBLISH_BACKEND_UNAVAILABLE_MESSAGE }
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    return { ok: false, error: 'invalid_preview', message: PUBLISH_INVALID_PREVIEW_MESSAGE }
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid_preview', message: PUBLISH_INVALID_PREVIEW_MESSAGE }
  }

  const sanitized = sanitizePublishUriPreviewPayload(payload)
  if (!sanitized) {
    return { ok: false, error: 'invalid_preview', message: PUBLISH_INVALID_PREVIEW_MESSAGE }
  }

  if (payload.ok === false || !response.ok) {
    return {
      ...sanitized,
      ok: false,
      error: String(payload.error || sanitized.error || `http_${response.status}`),
      message: String(payload.message || PUBLISH_INVALID_PREVIEW_MESSAGE)
    }
  }

  return sanitized
}
