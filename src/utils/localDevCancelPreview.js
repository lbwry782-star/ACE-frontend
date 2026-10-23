import {
  isLocalDevBackendUrl,
  isPublicRenderBackendUrl,
  normalizeBackendUrl
} from '../services/backendUrl.js'

export const CANCEL_DEV_PREVIEW_PATH = '/api/local-dev/cancel-development/preview'

export const NO_ACTIVE_CYCLE_MESSAGE = 'לא נמצא מחזור פיתוח פעיל.'
export const NO_WORK_TO_CANCEL_MESSAGE = 'אין כרגע פיתוח זמני לביטול.'
export const CANCEL_CONFIRM_QUESTION = 'האם לבטל את השינויים ולחזור למצב הקודם?'
export const CANCEL_CONFIRM_YES_LABEL = 'כן, בטל שינויים'
export const CANCEL_BACK_LABEL = 'חזור'
export const CANCEL_CLOSE_LABEL = 'סגור'
export const CANCEL_SIMPLE_SUCCESS_MESSAGE = 'השינויים בוטלו בהצלחה.'
export const CANCEL_SIMPLE_MIXED_MESSAGE =
  'השינויים בוטלו, אך פתיחת מחזור חדש לא הושלמה.'
export const CANCEL_BUSY_MESSAGE = 'מבטל את השינויים…'
export const CANCEL_PROGRESS_TITLE = 'מבטל את השינויים...'
export const CANCEL_STATUS_CHECKING = 'בודק את מצב השינויים...'
export const CANCEL_STATUS_PREPARING = 'מכין את השחזור...'
export const CANCEL_STATUS_RESTORING = 'משחזר את המצב הקודם...'
export const CANCEL_STATUS_VERIFYING = 'מוודא שהשחזור הושלם...'
export const CANCEL_PRE_BASELINE_MESSAGE =
  'קיימים שינויים ישנים שדורשים בדיקה מיוחדת לפני ביטול.'
export const CANCEL_BLOCKED_MESSAGE = 'לא ניתן לבטל כרגע.'
export const BACKEND_UNAVAILABLE_MESSAGE =
  'לא ניתן להתחבר לשרת המקומי. ודאו שה-Backend רץ ב-127.0.0.1:5000 ונסו שוב.'
export const INVALID_PREVIEW_MESSAGE = 'התשובה מהשרת המקומי אינה תקינה.'
export const LOCAL_BACKEND_REQUIRED_MESSAGE =
  'בדיקת הביטול זמינה רק מול Backend מקומי. לא מתבצע מעבר לשרת ציבורי.'

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
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
      preservedInWipRef: item.preservedInWipRef === true,
      preservedInBackup: item.preservedInBackup === true
    }))
}

export function sanitizePreviewFingerprint(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (text.length !== 64 || !/^[0-9a-f]{64}$/.test(text)) return ''
  return text
}

function envKeysOnly(side) {
  const block = side && typeof side === 'object' ? side : {}
  return {
    addedKeys: asStringArray(block.addedKeys),
    removedKeys: asStringArray(block.removedKeys),
    changedKeys: asStringArray(block.changedKeys),
    preservedKeys: asStringArray(block.preservedKeys),
    canApply: block.canApply !== false
  }
}

export function buildCancelDevPreviewUrl(backendBase) {
  const base = normalizeBackendUrl(backendBase)
  if (!base || isPublicRenderBackendUrl(base) || !isLocalDevBackendUrl(base)) {
    return { ok: false, error: 'local_backend_required', message: LOCAL_BACKEND_REQUIRED_MESSAGE }
  }
  return { ok: true, url: `${base}${CANCEL_DEV_PREVIEW_PATH}` }
}

export function sanitizeCancelDevPreviewPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const cycle = payload.activeCycle && typeof payload.activeCycle === 'object' ? payload.activeCycle : {}
  const cycleStatus = String(cycle.status || 'UNKNOWN')
  const commits = payload.commitsToCancel && typeof payload.commitsToCancel === 'object'
    ? payload.commitsToCancel
    : {}
  const paths = payload.pathsToRevert && typeof payload.pathsToRevert === 'object'
    ? payload.pathsToRevert
    : {}
  const infra = payload.infraPreserved && typeof payload.infraPreserved === 'object'
    ? payload.infraPreserved
    : {}
  const infraCommits = infra.commits && typeof infra.commits === 'object' ? infra.commits : {}
  const infraPaths = infra.paths && typeof infra.paths === 'object' ? infra.paths : {}
  const env = payload.envChanges && typeof payload.envChanges === 'object' ? payload.envChanges : {}
  const backup =
    payload.backupExpectations && typeof payload.backupExpectations === 'object'
      ? payload.backupExpectations
      : {}
  const infraTargets =
    payload.infraTargets && typeof payload.infraTargets === 'object' ? payload.infraTargets : {}

  return {
    ok: payload.ok !== false,
    error: payload.error ? String(payload.error) : null,
    message: payload.message ? String(payload.message) : null,
    previewMode: 'READ_ONLY',
    previewFingerprint: sanitizePreviewFingerprint(payload.previewFingerprint),
    executeEndpointAvailable: payload.executeEndpointAvailable === true && cycleStatus === 'OPEN',
    activeCycle: {
      sessionId: cycle.sessionId ? String(cycle.sessionId) : null,
      status: cycleStatus,
      hasWorkToCancel: cycle.hasWorkToCancel === true,
      canExecuteInEngine: cycle.canExecuteInEngine === true,
      executeAvailableInApi: cycle.executeAvailableInApi === true && cycleStatus === 'OPEN',
      message: cycle.message ? String(cycle.message) : null
    },
    blockers: asStringArray(payload.blockers),
    registryInfraDrift: asStringArray(payload.registryInfraDrift),
    commitsToCancel: {
      backend: asCommitRows(commits.backend),
      frontend: asCommitRows(commits.frontend)
    },
    pathsToRevert: {
      backend: asStringArray(paths.backend),
      frontend: asStringArray(paths.frontend)
    },
    infraPreserved: {
      commits: {
        backend: asCommitRows(infraCommits.backend),
        frontend: asCommitRows(infraCommits.frontend)
      },
      paths: {
        backend: asStringArray(infraPaths.backend),
        frontend: asStringArray(infraPaths.frontend)
      }
    },
    envChanges: {
      backend: envKeysOnly(env.backend),
      frontend: envKeysOnly(env.frontend)
    },
    preBaselineWarnings: Array.isArray(payload.preBaselineWarnings)
      ? payload.preBaselineWarnings
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            repo: String(item.repo ?? '').trim(),
            shortSha: String(item.shortSha ?? '').trim(),
            subject: String(item.subject ?? '').trim(),
            requiresExplicitScope: item.requiresExplicitScope !== false
          }))
      : [],
    backupExpectations: {
      fullRepoBackupBeforeReset: backup.fullRepoBackupBeforeReset === true,
      includesAllRefsBundle: backup.includesAllRefsBundle === true,
      includesEnvDpapiBackup: backup.includesEnvDpapiBackup === true,
      includesWorkingTreeMirror: backup.includesWorkingTreeMirror === true,
      recoveryGuideFile: String(backup.recoveryGuideFile || 'RECOVERY.md'),
      note: String(backup.note || '')
    },
    infraTargets: {
      backendCommit: infraTargets.backendCommit ? String(infraTargets.backendCommit) : '',
      frontendCommit: infraTargets.frontendCommit ? String(infraTargets.frontendCommit) : ''
    }
  }
}

const BLOCKER_EXPLANATIONS = {
  FRONTEND_UNRELATED: 'קיימים שינויים בממשק שאינם משויכים למחזור הפיתוח.',
  BACKEND_UNRELATED: 'קיימים שינויים בשרת שאינם משויכים למחזור הפיתוח.',
  REGISTRY_INFRA_HEAD_MISMATCH: 'גרסת תשתית הפיתוח אינה תואמת לרישום המאומת.',
  PLAN_BLOCKED: 'תוכנית הביטול נחסמה. יש לטפל בחסימות לפני ביטול.',
  SESSION_JSON_MISSING: 'קובץ מחזור הפיתוח חסר או לא נמצא.',
  SESSION_NOT_READY: 'מחזור הפיתוח אינו במצב מוכן לביטול.',
  ACE_ORI_DEV_SESSION_ID: 'מזהה מחזור הפיתוח אינו תקין.'
}

export function explainBlocker(raw) {
  const original = String(raw ?? '').trim()
  const codeMatch = original.match(/[A-Z][A-Z0-9_]{3,}/)
  const code = codeMatch ? codeMatch[0] : ''
  const explanation = (code && BLOCKER_EXPLANATIONS[code])
    || 'קיימת חסימה שמונעת ביטול כרגע.'
  const showTechnical = Boolean(original && original !== explanation)
  return { explanation, technical: showTechnical ? original : '', code }
}

export function summarizeCancelDevPreview(payload) {
  const data = sanitizeCancelDevPreviewPayload(payload)
  if (!data) {
    return {
      ok: false,
      error: 'invalid_preview',
      message: INVALID_PREVIEW_MESSAGE
    }
  }
  const cycleActive = data.activeCycle.status === 'OPEN'
  const hasWork = data.activeCycle.hasWorkToCancel === true
  const wipBranches = [...data.commitsToCancel.backend, ...data.commitsToCancel.frontend]
    .flatMap((row) => row.branches)
    .filter((name, index, all) => all.indexOf(name) === index)

  return {
    ...data,
    cycleActive,
    hasWork,
    wipBranches,
    noActiveCycleMessage: cycleActive ? null : NO_ACTIVE_CYCLE_MESSAGE,
    noWorkMessage: hasWork ? null : NO_WORK_TO_CANCEL_MESSAGE
  }
}

export function canConfirmCancelExecute(preview) {
  if (!preview || preview.ok === false) return false
  if (preview.activeCycle?.status !== 'OPEN') return false
  if (preview.executeEndpointAvailable !== true) return false
  if (preview.activeCycle?.canExecuteInEngine !== true) return false
  if (preview.activeCycle?.executeAvailableInApi !== true) return false
  if (!sanitizePreviewFingerprint(preview.previewFingerprint)) return false
  if ((preview.blockers || []).length || (preview.registryInfraDrift || []).length) return false
  return true
}

function hasHebrew(text) {
  return /[\u0590-\u05FF]/.test(String(text || ''))
}

export function cancelSpecialDecisionWarning(preview) {
  const items = Array.isArray(preview?.preBaselineWarnings) ? preview.preBaselineWarnings : []
  if (!items.length) return ''
  return CANCEL_PRE_BASELINE_MESSAGE
}

export function cancelUserFacingMessage(preview) {
  if (!preview) return CANCEL_BLOCKED_MESSAGE
  if (preview.activeCycle?.status === 'NONE') return NO_ACTIVE_CYCLE_MESSAGE
  const blockers = [...(preview.blockers || []), ...(preview.registryInfraDrift || [])]
  if (blockers.length) {
    const explanations = [...new Set(blockers.map((item) => explainBlocker(item).explanation))]
    return explanations.join(' ')
  }
  if (preview.ok === false) {
    const raw = String(preview.message || '').trim()
    return hasHebrew(raw) ? raw : CANCEL_BLOCKED_MESSAGE
  }
  if (!preview.hasWork) return NO_WORK_TO_CANCEL_MESSAGE
  if (!canConfirmCancelExecute(preview)) return CANCEL_BLOCKED_MESSAGE
  return ''
}

export async function fetchCancelDevPreview({ backendBase, fetchImpl = fetch } = {}) {
  const built = buildCancelDevPreviewUrl(backendBase)
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
    return { ok: false, error: 'backend_unavailable', message: BACKEND_UNAVAILABLE_MESSAGE }
  }

  let payload = null
  try {
    payload = await response.json()
  } catch (_) {
    return { ok: false, error: 'invalid_preview', message: INVALID_PREVIEW_MESSAGE }
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid_preview', message: INVALID_PREVIEW_MESSAGE }
  }

  if (payload.ok === false) {
    return {
      ok: false,
      error: String(payload.error || `http_${response.status}`),
      message: String(payload.message || INVALID_PREVIEW_MESSAGE),
      blockers: Array.isArray(payload.blockers) ? payload.blockers.map((item) => String(item)) : []
    }
  }

  if (!response.ok) {
    return { ok: false, error: `http_${response.status}`, message: INVALID_PREVIEW_MESSAGE }
  }

  return summarizeCancelDevPreview(payload)
}
