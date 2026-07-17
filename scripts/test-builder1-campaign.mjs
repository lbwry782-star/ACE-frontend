/**
 * Builder1 production-revision tests.
 * Run: npm run test:builder1
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  preview1TierKeyToAdCount,
  saveBuilder1CampaignAdCount,
  readBuilder1CampaignAdCount,
  getBuilder1GenerateButtonLabel,
  BUILDER1_CAMPAIGN_AD_COUNT_KEY
} from '../src/utils/builder1CampaignCount.js'
import {
  buildInitialGeneratePayload,
  validateInitialCampaignResponse,
  validateNextAdResponse,
  createCampaignSessionFromInitial,
  appendAdToSession,
  getFormatRatioCss,
  toBuilder1ApiImageBase64,
  buildSingleAdZipRequest,
  sanitizeSingleAdZipFilename,
  countMarketingWords,
  parseRateLimitError,
  validateBuilder1ProductName,
  trimBuilder1ProductName,
  getBuilder1ProductNameFieldMessage,
  resolveBuilder1ProductNameFieldError,
  parseBuilder1ApiErrorCode,
  isBuilder1MissingProductNameError,
  BUILDER1_MISSING_PRODUCT_NAME
} from '../src/utils/builder1Campaign.js'
import {
  BUILDER1_INITIAL_ESTIMATED_DURATION_MS,
  BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS,
  BUILDER1_PROGRESS_COMPLETION_DURATION_MS,
  BUILDER1_PROGRESS_OPERATION,
  resolveBuilder1ProgressOperationType,
  getBuilder1EstimatedDurationForOperation,
  computeBuilder1LinearProgress,
  computeBuilder1CompletionProgress,
  resolveBuilder1ProgressFrame,
  normalizeBuilder1ProgressPercent
} from '../src/utils/builder1Progress.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function mockStorages() {
  const local = new Map()
  const session = new Map()
  global.localStorage = {
    getItem: (k) => (local.has(k) ? local.get(k) : null),
    setItem: (k, v) => local.set(k, String(v)),
    removeItem: (k) => local.delete(k),
    clear: () => local.clear()
  }
  global.sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
    clear: () => session.clear()
  }
  return { local, session }
}

function makeInitialResult(adCount = 3) {
  return {
    ok: true,
    campaignId: 'camp-abc',
    campaign: {
      productNameResolved: 'Brand X',
      brandSlogan: 'Slogan here',
      detectedLanguage: 'he',
      format: 'portrait',
      adCount
    },
    ad: {
      index: 1,
      headline: 'Headline one',
      marketingText: 'word '.repeat(50).trim(),
      imageBase64: 'abc123',
      imageContainsFinalCopy: true
    },
    composition: { format: 'portrait', brandSlogan: 'Slogan here' },
    nextAdIndex: 2
  }
}

mockStorages()

// 1–4. Constant-speed progress
assert.equal(computeBuilder1LinearProgress(0, 1000), 0)
assert.equal(computeBuilder1LinearProgress(500, 1000), 50)
assert.equal(computeBuilder1LinearProgress(1000, 1000), 100)
assert.equal(computeBuilder1LinearProgress(2000, 1000), 100)
assert.equal(computeBuilder1LinearProgress(500, 1000, 40), 50)
assert.equal(computeBuilder1LinearProgress(100, 1000, 50), 50)

const stageJump = resolveBuilder1ProgressFrame({
  elapsedMs: 5000,
  estimatedDurationMs: 10000,
  previousPercent: resolveBuilder1ProgressFrame({
    elapsedMs: 4000,
    estimatedDurationMs: 10000,
    previousPercent: 0
  })
})
assert.equal(stageJump, 50)

assert.equal(
  computeBuilder1LinearProgress(BUILDER1_INITIAL_ESTIMATED_DURATION_MS, BUILDER1_INITIAL_ESTIMATED_DURATION_MS),
  100
)
assert.equal(
  computeBuilder1LinearProgress(BUILDER1_INITIAL_ESTIMATED_DURATION_MS + 5000, BUILDER1_INITIAL_ESTIMATED_DURATION_MS),
  100
)

// 5–6. Early completion animation
const from60 = computeBuilder1CompletionProgress(60, 0)
assert.equal(from60, 60)
const from60Done = computeBuilder1CompletionProgress(60, BUILDER1_PROGRESS_COMPLETION_DURATION_MS)
assert.equal(from60Done, 100)
assert.ok(BUILDER1_PROGRESS_COMPLETION_DURATION_MS >= 300)
assert.ok(BUILDER1_PROGRESS_COMPLETION_DURATION_MS <= 700)

const builderPageSource = readFileSync(join(root, 'src/pages/Builder/BuilderPage.jsx'), 'utf8')
const productFormSource = readFileSync(join(root, 'src/components/Form/ProductForm.jsx'), 'utf8')
const progressBarSource = readFileSync(join(root, 'src/components/ProgressBar/Builder1ProgressBar.jsx'), 'utf8')
const progressCss = readFileSync(join(root, 'src/components/ProgressBar/builder1-progress.css'), 'utf8')

// Progress visibility and normalization
assert.equal(normalizeBuilder1ProgressPercent(undefined), 0)
assert.equal(normalizeBuilder1ProgressPercent(NaN), 0)
assert.equal(normalizeBuilder1ProgressPercent(Infinity), 0)
assert.equal(normalizeBuilder1ProgressPercent('50'), 50)
assert.equal(normalizeBuilder1ProgressPercent(150), 100)
assert.match(builderPageSource, /generationProgressVisible/)
assert.match(builderPageSource, /beginProgress/)
assert.match(builderPageSource, /showProgressBar && !progressTaskFailed/)
assert.match(productFormSource, /builder1-progress-wrap|Builder1ProgressBar/)
assert.match(productFormSource, /form-actions--builder1/)
assert.match(progressBarSource, /builder1-progress-track/)
assert.match(progressBarSource, /builder1-progress-fill/)
assert.match(progressBarSource, /normalizeBuilder1ProgressPercent/)
assert.match(progressBarSource, /if \(!visible\)/)
assert.doesNotMatch(progressBarSource, /progress-bar-track/)
assert.match(progressCss, /\.builder1-progress-track[\s\S]*min-height:\s*8px/)
assert.match(progressCss, /\.builder1-progress-fill[\s\S]*background-color:\s*#4caf50/)
assert.doesNotMatch(progressCss, /display:\s*none/)
assert.doesNotMatch(progressCss, /opacity:\s*0/)
assert.doesNotMatch(progressCss, /visibility:\s*hidden/)
assert.match(builderPageSource, /pollBuilder1Job/)
assert.match(builderPageSource, /onStage/)
assert.doesNotMatch(builderPageSource, /onProgress[\s\S]*progress:/)

assert.match(builderPageSource, /pendingRevealRef/)
assert.match(builderPageSource, /queueSuccessfulReveal/)
assert.match(builderPageSource, /applyPendingReveal/)
assert.doesNotMatch(builderPageSource, /setProgressPercent/)
assert.doesNotMatch(builderPageSource, /computeStageProgress/)

// 7. Error path stops progress without reveal
assert.match(builderPageSource, /stopProgressWithFailure/)
assert.match(builderPageSource, /progressTaskFailed/)

// 8–11. Button labels
assert.equal(getBuilder1GenerateButtonLabel({ hasGeneratedAds: false, canGenerateNext: false }), 'GENERATE')
assert.equal(
  getBuilder1GenerateButtonLabel({ hasGeneratedAds: true, canGenerateNext: true, campaignComplete: false }),
  'GENERATE AGAIN'
)
assert.equal(getBuilder1GenerateButtonLabel({ campaignComplete: true }), 'CONSUMED')
assert.match(builderPageSource, /campaignComplete/)
assert.match(builderPageSource, /generateButtonDisabled/)

// 12. 429 does not produce CONSUMED
assert.equal(getBuilder1GenerateButtonLabel({ campaignComplete: false, hasGeneratedAds: true, canGenerateNext: true }), 'GENERATE AGAIN')

// Endpoints
assert.match(builderPageSource, /\/api\/builder1-generate/)
assert.match(builderPageSource, /\/api\/builder1-generate-next/)
assert.doesNotMatch(builderPageSource, /builder1-download-zip/)
assert.match(builderPageSource, /\/api\/builder1-zip/)

// 13–18. AdCard layout
const adCardSource = readFileSync(join(root, 'src/components/AdCard/AdCard.jsx'), 'utf8')
const adCardCss = readFileSync(join(root, 'src/components/AdCard/adcard.css'), 'utf8')
assert.match(adCardSource, /builder1-ad-canvas/)
assert.match(adCardSource, /builder1-marketing-text/)
assert.match(adCardSource, /builder1-ad-actions/)
assert.match(adCardSource, /DOWNLOAD ZIP/)
assert.match(adCardSource, /marketingText \?\s*\(/)
assert.doesNotMatch(adCardSource, /headline-overlay/)
assert.match(adCardCss, /\.builder1-marketing-text[\s\S]*margin-top: 16px/)
assert.doesNotMatch(adCardCss, /\.builder1-marketing-text[\s\S]*position:\s*absolute/)
assert.doesNotMatch(adCardCss, /\.builder1-ad-actions[\s\S]*position:\s*absolute/)
assert.equal(getFormatRatioCss('square'), '1 / 1')

// 19–22. Per-ad ZIP
assert.equal(sanitizeSingleAdZipFilename(1), 'ad-01.zip')
assert.equal(sanitizeSingleAdZipFilename(4), 'ad-04.zip')
assert.equal(toBuilder1ApiImageBase64('abc123'), 'abc123')
const initial3 = validateInitialCampaignResponse(makeInitialResult(3), 3)
const session3 = createCampaignSessionFromInitial(initial3, 3)
const zipReq = buildSingleAdZipRequest(session3.session, session3.session.ads[0])
assert.equal(zipReq.scope, 'single_ad')
assert.equal(zipReq.ad.index, 1)
assert.equal(zipReq.ad.imageBase64, 'abc123')
assert.match(builderPageSource, /zipStateByAd/)
assert.match(builderPageSource, /handleDownloadAdZip/)

// 23–25. Completion summary removed
assert.doesNotMatch(builderPageSource, /builder-campaign-heading/)
assert.doesNotMatch(builderPageSource, /builder-campaign-meta/)
assert.doesNotMatch(builderPageSource, /builder-campaign-complete/)
assert.doesNotMatch(builderPageSource, /הקמפיין הושלם/)
assert.doesNotMatch(builderPageSource, /קמפיין פרסומי/)

// Marketing word count helper
assert.equal(countMarketingWords('one two three'), 3)
assert.equal(countMarketingWords('word '.repeat(50).trim()), 50)

// Incremental campaign preserved
const next2 = validateNextAdResponse(
  {
    ok: true,
    campaignId: 'camp-abc',
    ad: { index: 2, marketingText: 't', imageBase64: 'x' },
    nextAdIndex: 3
  },
  { campaignId: 'camp-abc', expectedIndex: 2 }
)
const after2 = appendAdToSession(session3.session, next2)
assert.equal(after2.session.ads.length, 2)

// 429 preserves session
const rateInfo = parseRateLimitError({
  status: 429,
  body: { error: 'image_rate_limited', retryAfterSeconds: 30 }
})
assert.equal(rateInfo.rateLimited, true)
assert.equal(after2.session.nextAdIndex, 3)

// Builder2 unchanged
const builder2Source = readFileSync(join(root, 'src/pages/Builder2/Builder2Page.jsx'), 'utf8')
assert.doesNotMatch(builder2Source, /builder1-zip/)
assert.doesNotMatch(builder2Source, /builder1Progress/)

// PREVIEW1 count still works
saveBuilder1CampaignAdCount(preview1TierKeyToAdCount('2'))
assert.equal(readBuilder1CampaignAdCount(), 3)
const payload3 = buildInitialGeneratePayload({
  productName: 'P',
  productDescription: 'D',
  format: 'landscape',
  adCount: 3
})
assert.equal(payload3.adCount, 3)

// Duration constants — next-ad substantially shorter (~25% of initial)
assert.equal(BUILDER1_INITIAL_ESTIMATED_DURATION_MS, 240_000)
assert.equal(BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS, 60_000)
assert.ok(BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS < BUILDER1_INITIAL_ESTIMATED_DURATION_MS)
assert.ok(
  BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS <= BUILDER1_INITIAL_ESTIMATED_DURATION_MS * 0.3
)

// Operation type selection (before request starts)
assert.equal(
  resolveBuilder1ProgressOperationType({ campaignId: null, canGenerateNext: false }),
  BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN
)
assert.equal(
  resolveBuilder1ProgressOperationType({ campaignId: 'camp-1', canGenerateNext: true }),
  BUILDER1_PROGRESS_OPERATION.NEXT_AD
)
assert.equal(
  getBuilder1EstimatedDurationForOperation(BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN),
  BUILDER1_INITIAL_ESTIMATED_DURATION_MS
)
assert.equal(
  getBuilder1EstimatedDurationForOperation(BUILDER1_PROGRESS_OPERATION.NEXT_AD),
  BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS
)
assert.match(builderPageSource, /BUILDER1_PROGRESS_OPERATION\.INITIAL_CAMPAIGN/)
assert.match(builderPageSource, /BUILDER1_PROGRESS_OPERATION\.NEXT_AD/)
assert.match(builderPageSource, /getBuilder1EstimatedDurationForOperation/)

// Same elapsed time → next-ad bar advances faster
const elapsed = 30_000
const initialPct = computeBuilder1LinearProgress(elapsed, BUILDER1_INITIAL_ESTIMATED_DURATION_MS)
const nextPct = computeBuilder1LinearProgress(elapsed, BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS)
assert.ok(nextPct > initialPct)
assert.equal(initialPct, 12.5)
assert.equal(nextPct, 50)

// Both modes linear; stage does not change percentage
assert.equal(
  resolveBuilder1ProgressFrame({ elapsedMs: 10_000, estimatedDurationMs: 60_000, previousPercent: 0 }),
  computeBuilder1LinearProgress(10_000, 60_000)
)

// Next-ad at estimate → 100%, stays there while polling
assert.equal(
  computeBuilder1LinearProgress(60_000, BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS),
  100
)
assert.equal(
  computeBuilder1LinearProgress(90_000, BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS),
  100
)

// Early next-ad success → rapid completion to 100%
assert.equal(computeBuilder1CompletionProgress(40, BUILDER1_PROGRESS_COMPLETION_DURATION_MS), 100)

// Reveal only after completion (pending reveal pattern)
assert.match(builderPageSource, /queueSuccessfulReveal/)
assert.match(builderPageSource, /applyPendingReveal/)
assert.match(builderPageSource, /onProgressRevealReady/)

// Existing ads remain during GENERATE AGAIN (next-ad failure does not clear session)
assert.match(builderPageSource, /appendAdToSession/)
const nextAdCatch = builderPageSource.slice(
  builderPageSource.indexOf('const handleGenerateNextAd'),
  builderPageSource.indexOf('const handleFormSubmit')
)
assert.doesNotMatch(nextAdCatch, /setCampaignSession\(null\)/)

// 26–33. Product name required on initial GENERATE only
assert.equal(validateBuilder1ProductName('').ok, false)
assert.equal(validateBuilder1ProductName('   ').ok, false)
assert.equal(validateBuilder1ProductName('  My Product  ').ok, true)
assert.equal(validateBuilder1ProductName('  My Product  ').productName, 'My Product')

const emptyPayload = buildInitialGeneratePayload({
  productName: '   ',
  productDescription: 'D',
  format: 'portrait',
  adCount: 2
})
assert.equal(emptyPayload.productName, '')

const trimmedPayload = buildInitialGeneratePayload({
  productName: '  Trimmed  ',
  productDescription: 'D',
  format: 'portrait',
  adCount: 2
})
assert.equal(trimmedPayload.productName, 'Trimmed')

assert.equal(trimBuilder1ProductName('  x  '), 'x')
assert.equal(getBuilder1ProductNameFieldMessage('he'), 'יש להזין שם מוצר.')
assert.equal(getBuilder1ProductNameFieldMessage('en'), 'Product name is required.')
assert.equal(
  resolveBuilder1ProductNameFieldError({ code: BUILDER1_MISSING_PRODUCT_NAME }, 'he'),
  getBuilder1ProductNameFieldMessage('he')
)
assert.equal(parseBuilder1ApiErrorCode({ error: 'missing_product_name' }), BUILDER1_MISSING_PRODUCT_NAME)
assert.equal(isBuilder1MissingProductNameError('missing_product_name'), true)

const initialSubmitBlock = builderPageSource.slice(
  builderPageSource.indexOf('const handleInitialSubmit'),
  builderPageSource.indexOf('const handleGenerateNextAd')
)
assert.match(initialSubmitBlock, /validateBuilder1ProductName/)
assert.match(initialSubmitBlock, /if \(!nameValidation\.ok\)/)
const validationReturnIdx = initialSubmitBlock.indexOf('if (!nameValidation.ok)')
const beginProgressIdx = initialSubmitBlock.indexOf('beginProgress(BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN)')
assert.ok(validationReturnIdx > -1 && beginProgressIdx > -1 && validationReturnIdx < beginProgressIdx)
assert.doesNotMatch(
  initialSubmitBlock.slice(0, beginProgressIdx),
  /generateRequestInFlightRef\.current = true[\s\S]*validateBuilder1ProductName/
)
assert.match(initialSubmitBlock, /applyMissingProductNameFieldError/)
assert.match(initialSubmitBlock, /isBuilder1MissingProductNameError/)
assert.match(initialSubmitBlock, /setProductNameFieldError/)
assert.doesNotMatch(initialSubmitBlock, /userLeftProductNameEmpty/)

assert.match(productFormSource, /requireProductName/)
assert.match(productFormSource, /externalProductNameError/)
assert.match(productFormSource, /error-message/)
assert.match(productFormSource, /getBuilder1ProductNameFieldMessage/)

const generateAgainBlock = builderPageSource.slice(
  builderPageSource.indexOf('const handleFormSubmit'),
  builderPageSource.indexOf('const handleRetryInitial')
)
assert.match(generateAgainBlock, /handleGenerateNextAd/)
assert.doesNotMatch(generateAgainBlock, /validateBuilder1ProductName/)

assert.match(builderPageSource, /missing_product_name/)
assert.match(builderPageSource, /getBuilder1ProductNameFieldMessage\('he'\)/)
const mapErrorFn = builderPageSource.slice(
  builderPageSource.indexOf('function mapUserFacingError'),
  builderPageSource.indexOf('async function pollBuilder1Job')
)
assert.match(mapErrorFn, /missing_product_name[\s\S]*getBuilder1ProductNameFieldMessage/)
const missingNameIdx = mapErrorFn.indexOf('missing_product_name')
const planningFailedIdx = mapErrorFn.indexOf('planning_failed')
assert.ok(missingNameIdx > -1 && planningFailedIdx > -1 && missingNameIdx < planningFailedIdx)

console.log('builder1 production-revision tests passed (progress + campaign + product name cases)')
