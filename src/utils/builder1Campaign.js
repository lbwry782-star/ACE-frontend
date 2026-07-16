/**
 * Builder1 campaign-series helpers (pure, testable).
 */

export const BUILDER1_SUPPORTED_FORMATS = new Set(['portrait', 'landscape', 'square'])
export const BUILDER1_SUPPORTED_LANGUAGES = new Set(['he', 'en'])

const STAGE_PROGRESS = {
  planning: 8,
  repairing_plan: 18,
  building_prompts: 28,
  assembling_campaign: 95,
  done: 100
}

const PLACEMENT_KEYWORDS = {
  'bottom-left': 'bottom_left',
  bottomleft: 'bottom_left',
  'bottom_left': 'bottom_left',
  'bottom-right': 'bottom_right',
  bottomright: 'bottom_right',
  'top-left': 'top_left',
  center: 'center',
  'top-center': 'top_center'
}

/** @param {unknown} value */
export function normalizeBuilder1AdCount(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 4) {
    return 2
  }
  return parsed
}

/** @param {unknown} raw */
export function normalizeBuilder1FormatForApi(raw) {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x')
  if (!key) return ''

  const map = {
    '1080x1536': 'portrait',
    '1536x1080': 'landscape',
    '1080x1080': 'square',
    vertical: 'portrait',
    horizontal: 'landscape',
    wide: 'landscape',
    portrait: 'portrait',
    landscape: 'landscape',
    square: 'square',
    '1024x1536': 'portrait',
    '1536x1024': 'landscape',
    '1024x1024': 'square'
  }
  if (map[key] != null) return map[key]

  const m = key.match(/^(\d+)x(\d+)$/)
  if (m) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (w > 0 && h > 0) {
      if (w === h) return 'square'
      if (w < h) return 'portrait'
      return 'landscape'
    }
  }
  return ''
}

/** @param {unknown} value */
export function toBuilder1ImageSrc(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }
  const normalized = value.trim()
  if (normalized.startsWith('data:image/')) {
    return normalized
  }
  return `data:image/png;base64,${normalized}`
}

/** @param {string} format */
export function getFormatRatioCss(format) {
  const f = String(format || '').trim().toLowerCase()
  if (f === 'portrait') return '1024 / 1536'
  if (f === 'square') return '1 / 1'
  if (f === 'landscape') return '1536 / 1024'
  return '1024 / 1536'
}

/** @param {unknown} raw */
export function sanitizeHexColor(raw) {
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
    return null
  }
  const lower = v.toLowerCase()
  if (
    lower.includes('url(') ||
    lower.includes('expression(') ||
    lower.includes('var(') ||
    lower.includes(';')
  ) {
    return null
  }
  return v
}

/** @param {unknown} raw */
function normalizePlacement(raw) {
  if (raw == null) return null
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '-')
  return PLACEMENT_KEYWORDS[key] || null
}

/**
 * @param {object} campaign
 * @param {object} composition
 */
export function buildCampaignPresentation(campaign, composition) {
  const formatRaw =
    campaign?.format ?? composition?.format ?? 'portrait'
  const format = normalizeBuilder1FormatForApi(formatRaw) || 'portrait'

  const langRaw = String(campaign?.detectedLanguage ?? 'he').trim().toLowerCase()
  const language = BUILDER1_SUPPORTED_LANGUAGES.has(langRaw) ? langRaw : 'he'
  const direction = language === 'he' ? 'rtl' : 'ltr'

  const brandName = String(
    campaign?.productNameResolved ?? campaign?.productName ?? ''
  ).trim()
  const brandSlogan = String(
    composition?.brandSlogan ?? campaign?.brandSlogan ?? ''
  ).trim()

  const gg = composition?.graphicGenerator && typeof composition.graphicGenerator === 'object'
    ? composition.graphicGenerator
    : {}

  const cssVariables = {}
  const palette = gg.palette && typeof gg.palette === 'object' ? gg.palette : {}
  for (const [key, val] of Object.entries(palette)) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '')
    if (!safeKey) continue
    const color = sanitizeHexColor(val)
    if (color) cssVariables[`--campaign-${safeKey}`] = color
  }

  const accent = sanitizeHexColor(gg.accentColor ?? gg.accent ?? palette.primary)
  if (accent) cssVariables['--campaign-accent'] = accent

  const brandPlacement =
    normalizePlacement(gg.brandPlacement ?? gg.brand_placement) || 'bottom_left'
  const sloganPlacement =
    normalizePlacement(gg.sloganPlacement ?? gg.slogan_placement) || brandPlacement

  return {
    format,
    language,
    direction,
    brandName,
    brandSlogan,
    formatRatioCss: getFormatRatioCss(format),
    safeMarginCss: 'clamp(16px, 3vw, 32px)',
    layoutClass: 'ad-card-layout-campaign_default',
    brandPlacementClass: `ad-card-brand-placement-${brandPlacement}`,
    sloganPlacementClass: `ad-card-slogan-placement-${sloganPlacement}`,
    cssVariables
  }
}

/**
 * @param {Array<{ index?: unknown }>} ads
 */
export function sortAdsByIndex(ads) {
  return [...ads].sort((a, b) => Number(a.index) - Number(b.index))
}

/**
 * @param {unknown} result
 * @param {number} requestedAdCount
 */
export function validateCampaignResponse(result, requestedAdCount) {
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing result object' }
  }
  if (result.ok !== true) {
    const err = result.error || 'generation_failed'
    return { ok: false, error: err, message: result.message || String(err) }
  }
  if (!result.campaign || typeof result.campaign !== 'object') {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing campaign object' }
  }
  if (!Array.isArray(result.ads)) {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing ads array' }
  }
  if (!result.composition || typeof result.composition !== 'object') {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing composition object' }
  }

  const campaign = result.campaign
  const productNameResolved = String(campaign.productNameResolved ?? '').trim()
  if (!productNameResolved) {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing productNameResolved' }
  }

  const brandSlogan = String(
    campaign.brandSlogan ?? result.composition.brandSlogan ?? ''
  ).trim()
  if (!brandSlogan) {
    return { ok: false, error: 'response_contract_invalid', message: 'Missing brand slogan' }
  }

  const detectedLanguage = String(campaign.detectedLanguage ?? '').trim().toLowerCase()
  if (!BUILDER1_SUPPORTED_LANGUAGES.has(detectedLanguage)) {
    return { ok: false, error: 'response_contract_invalid', message: 'Unsupported detectedLanguage' }
  }

  const format = normalizeBuilder1FormatForApi(campaign.format ?? result.composition.format)
  if (!BUILDER1_SUPPORTED_FORMATS.has(format)) {
    return { ok: false, error: 'response_contract_invalid', message: 'Unsupported format' }
  }

  const adCount = Number(campaign.adCount)
  if (!Number.isInteger(adCount) || adCount < 2 || adCount > 4) {
    return { ok: false, error: 'response_contract_invalid', message: 'Invalid campaign.adCount' }
  }

  if (result.ads.length !== adCount) {
    return { ok: false, error: 'response_contract_invalid', message: 'ads.length !== campaign.adCount' }
  }
  if (result.ads.length !== requestedAdCount) {
    return { ok: false, error: 'response_contract_invalid', message: 'ads.length !== requestedAdCount' }
  }

  const indexes = new Set()
  for (const ad of result.ads) {
    if (!ad || typeof ad !== 'object') {
      return { ok: false, error: 'response_contract_invalid', message: 'Invalid ad entry' }
    }
    const idx = Number(ad.index)
    if (!Number.isInteger(idx) || idx < 1 || idx > adCount) {
      return { ok: false, error: 'response_contract_invalid', message: 'Invalid ad index' }
    }
    if (indexes.has(idx)) {
      return { ok: false, error: 'response_contract_invalid', message: 'Duplicate ad index' }
    }
    indexes.add(idx)

    const img = ad.imageBase64 ?? ad.image_base64
    if (typeof img !== 'string' || !img.trim()) {
      return { ok: false, error: 'response_contract_invalid', message: `Missing imageBase64 for ad ${idx}` }
    }

    if (ad.headline != null && typeof ad.headline !== 'string') {
      return { ok: false, error: 'response_contract_invalid', message: `Invalid headline for ad ${idx}` }
    }

    const mt = ad.marketingText ?? ad.marketing_text
    if (mt != null && typeof mt !== 'string') {
      return { ok: false, error: 'response_contract_invalid', message: `Invalid marketingText for ad ${idx}` }
    }
  }

  for (let i = 1; i <= adCount; i += 1) {
    if (!indexes.has(i)) {
      return { ok: false, error: 'response_contract_invalid', message: `Missing ad index ${i}` }
    }
  }

  const sortedAds = sortAdsByIndex(result.ads).map((ad) => ({
    index: Number(ad.index),
    headline: ad.headline == null ? null : String(ad.headline).trim() || null,
    marketingText: String(ad.marketingText ?? ad.marketing_text ?? ''),
    imageSrc: toBuilder1ImageSrc(ad.imageBase64 ?? ad.image_base64)
  }))

  return {
    ok: true,
    campaign: {
      ...campaign,
      productNameResolved,
      brandSlogan,
      detectedLanguage,
      format,
      adCount
    },
    composition: {
      ...result.composition,
      brandSlogan: String(result.composition.brandSlogan ?? brandSlogan).trim(),
      format: normalizeBuilder1FormatForApi(result.composition.format) || format
    },
    ads: sortedAds
  }
}

/**
 * @param {object} pollPayload
 * @param {number} previousProgress
 */
export function computeStageProgress(pollPayload, previousProgress = 0) {
  const stage = String(pollPayload?.stage ?? '').trim().toLowerCase()
  if (stage === 'done') return 100

  let next = STAGE_PROGRESS[stage]
  if (next == null) {
    next = pollPayload?.status === 'running' ? Math.max(previousProgress, 5) : previousProgress
  }

  if (stage === 'generating_images') {
    const total = Number(pollPayload?.totalAds)
    const completed = Number(pollPayload?.completedAds)
    if (Number.isInteger(total) && total > 0 && Number.isFinite(completed) && completed >= 0) {
      const clampedCompleted = Math.min(completed, total)
      next = 30 + Math.round((clampedCompleted / total) * 60)
    } else {
      next = 30
    }
  }

  if (!Number.isFinite(next)) next = previousProgress
  next = Math.max(0, Math.min(100, next))
  if (previousProgress > 0 && next < previousProgress) {
    return previousProgress
  }
  return next
}

/**
 * @param {object} pollPayload
 * @param {'he'|'en'} language
 */
export function getStageLabel(pollPayload, language = 'he') {
  const stage = String(pollPayload?.stage ?? '').trim().toLowerCase()
  const isHe = language === 'he'
  const total = Number(pollPayload?.totalAds)
  const completed = Number(pollPayload?.completedAds)

  if (stage === 'planning') {
    return isHe ? 'מתכנן את הקמפיין' : 'Planning the campaign'
  }
  if (stage === 'repairing_plan') {
    return isHe ? 'מדייק את הרעיון היצירתי' : 'Refining the campaign idea'
  }
  if (stage === 'building_prompts') {
    return isHe ? 'מכין את סדרת הוויזואל' : 'Preparing the visual series'
  }
  if (stage === 'generating_images') {
    if (Number.isInteger(total) && total > 0 && Number.isFinite(completed) && completed >= 0) {
      const n = Math.min(Math.max(completed, 0), total)
      return isHe ? `יוצר תמונה ${n} מתוך ${total}` : `Generating image ${n} of ${total}`
    }
    return isHe ? 'יוצר את תמונות הקמפיין' : 'Generating campaign images'
  }
  if (stage === 'assembling_campaign') {
    return isHe ? 'מרכיב את הקמפיין' : 'Assembling the campaign'
  }
  if (stage === 'done') {
    return isHe ? 'הקמפיין מוכן' : 'Campaign ready'
  }
  return isHe ? 'יוצר קמפיין…' : 'Generating campaign…'
}

/** @param {string} name */
export function sanitizeCampaignZipFilename(name) {
  const base = String(name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return base ? `${base}-campaign.zip` : 'builder1-campaign.zip'
}

/** Minimal 1×1 PNG for dev mock */
const MOCK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * @param {object} input
 * @param {number} adCount
 */
export function createDevMockCampaign(input, adCount = 2) {
  const count = normalizeBuilder1AdCount(adCount)
  const format = normalizeBuilder1FormatForApi(input?.imageSize) || 'portrait'
  const productName = String(input?.productName ?? '').trim() || 'Demo Product'
  const brandSlogan = 'סלוגן דמו לקמפיין'

  const ads = Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    headline: i === 0 ? 'כותרת דמו' : null,
    marketingText: `Marketing copy for ad ${i + 1} in dev mock campaign.`,
    imageSrc: toBuilder1ImageSrc(MOCK_PNG_BASE64)
  }))

  return {
    campaign: {
      productNameResolved: productName,
      brandSlogan,
      detectedLanguage: 'he',
      format,
      adCount: count
    },
    composition: {
      format,
      brandSlogan,
      graphicGenerator: { brandPlacement: 'bottom-left' }
    },
    ads,
    isDevMock: true
  }
}
