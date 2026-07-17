/**
 * Canonical Builder1 campaign ad-count storage (Preview1 → Builder1).
 */

/** Primary storage key for selected campaign size (2–4 ads). */
export const BUILDER1_CAMPAIGN_AD_COUNT_KEY = 'ace_builder1_campaign_ad_count'

/** Legacy key — read for backward compatibility only. */
export const BUILDER1_LEGACY_MAX_ADS_KEY = 'ace_builder1_max_ads'

/** Preview1 payment tier asset keys → planned ad count. */
export const PREVIEW1_TIER_AD_COUNTS = Object.freeze({
  '1': 2,
  '2': 3,
  '5': 4
})

/**
 * @param {unknown} value
 * @returns {number} Integer 2–4, or 2 when invalid.
 */
export function normalizeBuilder1AdCount(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 4) {
    return 2
  }
  return parsed
}

/**
 * @param {unknown} tierKey Preview1 asset key ('1' | '2' | '5').
 * @returns {number|null}
 */
export function preview1TierKeyToAdCount(tierKey) {
  const key = String(tierKey ?? '').trim()
  if (Object.prototype.hasOwnProperty.call(PREVIEW1_TIER_AD_COUNTS, key)) {
    return PREVIEW1_TIER_AD_COUNTS[key]
  }
  return null
}

/**
 * Persist selected campaign ad count (numeric 2–4).
 * @param {unknown} count
 */
export function saveBuilder1CampaignAdCount(count) {
  const normalized = normalizeBuilder1AdCount(count)
  try {
    sessionStorage.setItem(BUILDER1_CAMPAIGN_AD_COUNT_KEY, String(normalized))
    sessionStorage.setItem(BUILDER1_LEGACY_MAX_ADS_KEY, String(normalized))
  } catch (_) {
    /* ignore quota / privacy mode */
  }
  logBuilder1AdCount('BUILDER1_SELECTED_AD_COUNT', normalized)
  return normalized
}

/**
 * Read stored campaign ad count; falls back to legacy key then default 2.
 * @returns {number}
 */
export function readBuilder1CampaignAdCount() {
  let raw = null
  try {
    raw =
      sessionStorage.getItem(BUILDER1_CAMPAIGN_AD_COUNT_KEY) ??
      sessionStorage.getItem(BUILDER1_LEGACY_MAX_ADS_KEY)
  } catch (_) {
    raw = null
  }
  const normalized = normalizeBuilder1AdCount(raw ?? 2)
  logBuilder1AdCount('BUILDER1_SELECTED_AD_COUNT', normalized)
  return normalized
}

/**
 * @param {string} label
 * @param {number} count
 */
export function logBuilder1AdCount(label, count) {
  if (typeof console !== 'undefined' && console.info) {
    console.info(`${label}=${count}`)
  }
}

/**
 * Log outgoing API adCount immediately before request.
 * @param {number} count
 */
export function logBuilder1RequestAdCount(count) {
  logBuilder1AdCount('BUILDER1_REQUEST_AD_COUNT', normalizeBuilder1AdCount(count))
}
