/**
 * Builder1 constant-speed progress (UI estimate only).
 */

/** Initial campaign planning + ad 1 — approximately 4 minutes. */
export const BUILDER1_INITIAL_ESTIMATED_DURATION_MS = 240_000

/** One later GENERATE AGAIN (no re-planning) — approximately 1 minute. */
export const BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS = 60_000

/** Early-success completion animation (300–700 ms). */
export const BUILDER1_PROGRESS_COMPLETION_DURATION_MS = 500

/** @readonly */
export const BUILDER1_PROGRESS_OPERATION = Object.freeze({
  INITIAL_CAMPAIGN: 'initial_campaign',
  NEXT_AD: 'next_ad'
})

/**
 * Select progress operation type before starting the bar.
 * @param {{ campaignId?: string|null, canGenerateNext?: boolean }} ctx
 * @returns {'initial_campaign'|'next_ad'}
 */
export function resolveBuilder1ProgressOperationType(ctx) {
  const campaignId = String(ctx?.campaignId ?? '').trim()
  if (campaignId && ctx?.canGenerateNext) {
    return BUILDER1_PROGRESS_OPERATION.NEXT_AD
  }
  return BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN
}

/**
 * @param {'initial_campaign'|'next_ad'|string} operationType
 * @returns {number}
 */
export function getBuilder1EstimatedDurationForOperation(operationType) {
  if (operationType === BUILDER1_PROGRESS_OPERATION.NEXT_AD) {
    return BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS
  }
  return BUILDER1_INITIAL_ESTIMATED_DURATION_MS
}

/**
 * @param {unknown} progress
 * @returns {number} Safe 0–100 integer for DOM width.
 */
export function normalizeBuilder1ProgressPercent(progress) {
  const n = Number(progress)
  if (!Number.isFinite(n)) {
    return 0
  }
  return Math.min(100, Math.max(0, n))
}

/**
 * Linear progress from elapsed time; caps at 100, never decreases.
 * @param {number} elapsedMs
 * @param {number} estimatedDurationMs
 * @param {number} [previousPercent=0]
 */
export function computeBuilder1LinearProgress(elapsedMs, estimatedDurationMs, previousPercent = 0) {
  const prev = Number.isFinite(previousPercent) ? Math.max(0, Math.min(100, previousPercent)) : 0
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return prev
  }
  if (!Number.isFinite(estimatedDurationMs) || estimatedDurationMs <= 0) {
    return Math.max(prev, 100)
  }
  const linear = (elapsedMs / estimatedDurationMs) * 100
  const next = Math.min(100, Math.max(0, linear))
  return Math.max(prev, next)
}

/**
 * Smooth completion animation from `fromPercent` to 100.
 * @param {number} fromPercent
 * @param {number} elapsedInCompletionMs
 */
export function computeBuilder1CompletionProgress(fromPercent, elapsedInCompletionMs) {
  const start = Math.max(0, Math.min(100, Number(fromPercent) || 0))
  const duration = BUILDER1_PROGRESS_COMPLETION_DURATION_MS
  if (!Number.isFinite(elapsedInCompletionMs) || elapsedInCompletionMs <= 0) {
    return start
  }
  const t = Math.min(1, elapsedInCompletionMs / duration)
  return Math.min(100, start + (100 - start) * t)
}

/**
 * Resolve display progress for one animation frame.
 * @param {object} ctx
 */
export function resolveBuilder1ProgressFrame(ctx) {
  const {
    elapsedMs,
    estimatedDurationMs,
    previousPercent = 0,
    taskSucceeded = false,
    completionFromPercent = null,
    completionElapsedMs = 0
  } = ctx

  if (taskSucceeded && completionFromPercent != null && Number.isFinite(completionElapsedMs)) {
    const from = Number(completionFromPercent)
    const animated = computeBuilder1CompletionProgress(from, completionElapsedMs)
    return Math.max(previousPercent, animated)
  }

  return computeBuilder1LinearProgress(elapsedMs, estimatedDurationMs, previousPercent)
}
