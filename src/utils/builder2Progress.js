/**
 * Builder2 video generation progress (UI estimate only).
 */

/** Video generation midpoint ~10 minutes. */
export const BUILDER2_ESTIMATED_DURATION_MS = 600_000

/** Early-success completion animation (300–700 ms). */
export const BUILDER2_PROGRESS_COMPLETION_DURATION_MS = 500

/** Max progress while job is still running (never 100% until completion). */
export const BUILDER2_PROGRESS_MAX_WHILE_RUNNING = 96

export const BUILDER2_PROGRESS_HEADLINE_HE = 'יוצר וידאו איכותי'
export const BUILDER2_PROGRESS_ESTIMATE_HE = 'זמן משוער: 8–12 דקות'
export const BUILDER2_PROGRESS_SEPARATOR = ' · '

/** @type {ReadonlyArray<{ t: number, p: number }>} */
const BUILDER2_PROGRESS_CURVE = Object.freeze([
  { t: 0, p: 0 },
  { t: 120_000, p: 20 },
  { t: 300_000, p: 50 },
  { t: 480_000, p: 75 },
  { t: 600_000, p: 90 }
])

/** Slow crawl from 90% toward 96% after the midpoint estimate. */
const BUILDER2_PROGRESS_POST_ESTIMATE_CRAWL_MS = 600_000

/** @type {Map<string, number>} */
const jobStartTimesById = new Map()

/**
 * @param {unknown} progress
 * @returns {number}
 */
export function normalizeBuilder2ProgressPercent(progress) {
  const n = Number(progress)
  if (!Number.isFinite(n)) {
    return 0
  }
  return Math.min(100, Math.max(0, n))
}

/**
 * @param {number} value
 * @param {number} [min=0]
 * @param {number} [max=100]
 */
function clampPercent(value, min = 0, max = 100) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return min
  }
  return Math.min(max, Math.max(min, n))
}

/**
 * @param {number} ratio 0–1
 */
function easeOutRatio(ratio) {
  const t = Math.min(1, Math.max(0, ratio))
  return 1 - (1 - t) ** 2
}

/**
 * @param {number} elapsedMs
 * @param {number} [previousPercent=0]
 */
export function computeBuilder2Progress(elapsedMs, previousPercent = 0) {
  const prev = clampPercent(previousPercent)
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return prev
  }

  let target = 0
  for (let i = 1; i < BUILDER2_PROGRESS_CURVE.length; i += 1) {
    const segmentStart = BUILDER2_PROGRESS_CURVE[i - 1]
    const segmentEnd = BUILDER2_PROGRESS_CURVE[i]
    if (elapsedMs <= segmentEnd.t) {
      const span = segmentEnd.t - segmentStart.t
      const ratio = span > 0 ? (elapsedMs - segmentStart.t) / span : 1
      target = segmentStart.p + (segmentEnd.p - segmentStart.p) * easeOutRatio(ratio)
      break
    }
  }

  if (elapsedMs > BUILDER2_ESTIMATED_DURATION_MS) {
    const overdueMs = elapsedMs - BUILDER2_ESTIMATED_DURATION_MS
    const crawlRatio = Math.min(1, overdueMs / BUILDER2_PROGRESS_POST_ESTIMATE_CRAWL_MS)
    target = 90 + (BUILDER2_PROGRESS_MAX_WHILE_RUNNING - 90) * easeOutRatio(crawlRatio)
  }

  const capped = Math.min(BUILDER2_PROGRESS_MAX_WHILE_RUNNING, target)
  return Math.max(prev, capped)
}

/**
 * @param {number} fromPercent
 * @param {number} elapsedInCompletionMs
 */
export function computeBuilder2CompletionProgress(fromPercent, elapsedInCompletionMs) {
  const start = clampPercent(fromPercent)
  const duration = BUILDER2_PROGRESS_COMPLETION_DURATION_MS
  if (!Number.isFinite(elapsedInCompletionMs) || elapsedInCompletionMs <= 0) {
    return start
  }
  const t = Math.min(1, elapsedInCompletionMs / duration)
  return Math.min(100, start + (100 - start) * t)
}

/**
 * @param {number} elapsedMs
 */
export function getBuilder2RemainingTimeText(elapsedMs) {
  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0

  if (safeElapsed >= BUILDER2_ESTIMATED_DURATION_MS) {
    return 'הווידאו עדיין בעבודה — מסיימים את הפרטים האחרונים'
  }

  const remainingMs = Math.max(0, BUILDER2_ESTIMATED_DURATION_MS - safeElapsed)
  if (remainingMs < 60_000) {
    return 'נותרה פחות מדקה לפי ההערכה'
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000)
  return `נותרו כ־${remainingMinutes} דקות`
}

/**
 * @param {string} remainingTimeText
 */
export function formatBuilder2ProgressStatusLine(remainingTimeText) {
  const remaining = String(remainingTimeText ?? '').trim()
  if (!remaining) {
    return `${BUILDER2_PROGRESS_HEADLINE_HE}${BUILDER2_PROGRESS_SEPARATOR}${BUILDER2_PROGRESS_ESTIMATE_HE}`
  }
  return `${BUILDER2_PROGRESS_HEADLINE_HE}${BUILDER2_PROGRESS_SEPARATOR}${BUILDER2_PROGRESS_ESTIMATE_HE}${BUILDER2_PROGRESS_SEPARATOR}${remaining}`
}

/**
 * @param {object} ctx
 */
export function resolveBuilder2ProgressFrame(ctx) {
  const {
    elapsedMs,
    previousPercent = 0,
    taskSucceeded = false,
    completionFromPercent = null,
    completionElapsedMs = 0
  } = ctx

  if (taskSucceeded && completionFromPercent != null && Number.isFinite(completionElapsedMs)) {
    const from = Number(completionFromPercent)
    const animated = computeBuilder2CompletionProgress(from, completionElapsedMs)
    return Math.max(previousPercent, animated)
  }

  return computeBuilder2Progress(elapsedMs, previousPercent)
}

/**
 * @param {string} jobId
 * @param {number} fallbackStartMs
 * @returns {number}
 */
export function resolveBuilder2JobStartTime(jobId, fallbackStartMs = Date.now()) {
  const id = String(jobId ?? '').trim()
  const fallback = Number.isFinite(fallbackStartMs) ? fallbackStartMs : Date.now()
  if (!id) {
    return fallback
  }
  if (!jobStartTimesById.has(id)) {
    jobStartTimesById.set(id, fallback)
  }
  return jobStartTimesById.get(id)
}

/** @param {string|null|undefined} jobId */
export function clearBuilder2JobStartTime(jobId) {
  const id = String(jobId ?? '').trim()
  if (!id) return
  jobStartTimesById.delete(id)
}

export function clearAllBuilder2JobStartTimes() {
  jobStartTimesById.clear()
}
