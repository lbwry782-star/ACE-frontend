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
  parseRateLimitError
} from '../src/utils/builder1Campaign.js'
import {
  BUILDER1_INITIAL_ESTIMATED_DURATION_MS,
  BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS,
  BUILDER1_PROGRESS_COMPLETION_DURATION_MS,
  computeBuilder1LinearProgress,
  computeBuilder1CompletionProgress,
  resolveBuilder1ProgressFrame
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

// Duration constants documented
assert.equal(BUILDER1_INITIAL_ESTIMATED_DURATION_MS, 240_000)
assert.equal(BUILDER1_NEXT_AD_ESTIMATED_DURATION_MS, 120_000)

console.log('builder1 production-revision tests passed (26 cases)')
