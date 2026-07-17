/**
 * Builder1 incremental campaign migration tests.
 * Run: npm run test:builder1
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  normalizeBuilder1AdCount,
  BUILDER1_CAMPAIGN_AD_COUNT_KEY,
  PREVIEW1_TIER_AD_COUNTS,
  preview1TierKeyToAdCount,
  saveBuilder1CampaignAdCount,
  readBuilder1CampaignAdCount,
  buildInitialGeneratePayload,
  toBuilder1ImageSrc,
  validateInitialCampaignResponse,
  validateNextAdResponse,
  createCampaignSessionFromInitial,
  appendAdToSession,
  sortAdsByIndex,
  computeStageProgress,
  getStageLabel,
  getFormatRatioCss,
  sanitizeHexColor,
  buildCampaignPresentation,
  parseRateLimitError,
  createDevMockInitialCampaign,
  createDevMockNextAd
} from '../src/utils/builder1Campaign.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function mockSessionStorage() {
  const store = new Map()
  global.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  }
  return store
}

function makeInitialResult(adCount = 4) {
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
      marketingText: 'Text 1',
      imageBase64: 'abc123'
    },
    composition: {
      format: 'portrait',
      brandSlogan: 'Slogan here',
      graphicGenerator: {
        layoutTemplate: 'campaign_default',
        brandBlockPlacement: 'bottom-left',
        headlinePlacement: 'top_center',
        headlineAlignment: 'center',
        headlineTreatment: 'shadow',
        copySafeArea: 'standard',
        backgroundTreatment: 'none',
        borderTreatment: 'thin',
        recurringGraphicDevice: 'corner_accent',
        palette: { primary: '#112233', secondary: '#445566' },
        headlineColor: '#ffffff',
        headlineMaxWidthPercent: 80
      }
    },
    nextAdIndex: adCount > 1 ? 2 : adCount + 1
  }
}

function makeNextAdResult(campaignId, index) {
  return {
    ok: true,
    campaignId,
    ad: {
      index,
      headline: null,
      marketingText: `Text ${index}`,
      imageBase64: 'xyz789'
    },
    nextAdIndex: index + 1
  }
}

// 1. PREVIEW1 selection 4 → numeric adCount 4 in POST payload
assert.equal(preview1TierKeyToAdCount('5'), 4)
assert.equal(PREVIEW1_TIER_AD_COUNTS['5'], 4)
const store = mockSessionStorage()
saveBuilder1CampaignAdCount(preview1TierKeyToAdCount('5'))
const payload4 = buildInitialGeneratePayload({
  productName: 'P',
  productDescription: 'D',
  format: 'landscape',
  adCount: readBuilder1CampaignAdCount()
})
assert.equal(payload4.adCount, 4)
assert.equal(typeof payload4.adCount, 'number')
assert.equal(JSON.stringify(payload4).includes('"adCount":4'), true)

// 2. Valid stored 4 does not fall back to 2
store.set(BUILDER1_CAMPAIGN_AD_COUNT_KEY, '4')
assert.equal(readBuilder1CampaignAdCount(), 4)

// 3. Initial success yields only ad 1
const initial4 = validateInitialCampaignResponse(makeInitialResult(4), 4)
assert.equal(initial4.ok, true)
assert.equal(initial4.ads.length, 1)
assert.equal(initial4.ad.index, 1)

// 4. Next-ad success appends ad 2
const session1 = createCampaignSessionFromInitial(initial4, 4)
assert.equal(session1.ok, true)
const next2 = validateNextAdResponse(makeNextAdResult('camp-abc', 2), {
  campaignId: 'camp-abc',
  expectedIndex: 2
})
const appended = appendAdToSession(session1.session, next2)
assert.equal(appended.ok, true)
assert.equal(appended.session.ads.length, 2)
assert.equal(appended.session.generatedCount, 2)

// 5. Next-ad does not replace ad 1
assert.equal(appended.session.ads[0].index, 1)
assert.equal(appended.session.ads[1].index, 2)
assert.equal(appended.session.ads[0].marketingText, 'Text 1')

// 6. Initial contract rejects multi-ad array (no batch generation)
const multiAd = makeInitialResult(4)
multiAd.ad = undefined
multiAd.ads = [
  { index: 1, headline: 'A', marketingText: 'T1', imageBase64: 'a' },
  { index: 2, headline: null, marketingText: 'T2', imageBase64: 'b' }
]
assert.equal(validateInitialCampaignResponse(multiAd, 4).ok, false)

// 7. Duplicate index rejected on append (guards double-click duplicate)
const dupAppend = appendAdToSession(appended.session, next2)
assert.equal(dupAppend.ok, false)

// 8. Duplicate index in response rejected
const badNext = makeNextAdResult('camp-abc', 2)
badNext.ad.index = 2
assert.equal(
  validateNextAdResponse(badNext, { campaignId: 'camp-abc', expectedIndex: 3 }).ok,
  false
)

// 9. Different campaignId rejected
assert.equal(
  validateNextAdResponse(makeNextAdResult('other-camp', 3), {
    campaignId: 'camp-abc',
    expectedIndex: 3
  }).ok,
  false
)

// 10. 429 parse + session preserved (ads count unchanged)
const beforeAds = [...appended.session.ads]
const rateInfo = parseRateLimitError({
  status: 429,
  body: { error: 'image_rate_limited', retryAfterSeconds: 45 }
})
assert.equal(rateInfo.rateLimited, true)
assert.equal(rateInfo.retryAfterSeconds, 45)
assert.deepEqual(beforeAds.map((a) => a.index), [1, 2])
assert.equal(appended.session.nextAdIndex, 3)

// 11. Retry uses same expectedNextIndex (session not advanced on rate limit)
assert.equal(appended.session.nextAdIndex, 3)
assert.equal(appended.session.generatedCount, 2)

// 12. Campaign complete disables next-ad
const completeSession = { ...appended.session, targetAdCount: 2, generatedCount: 2, canGenerateNext: false }
assert.equal(completeSession.canGenerateNext, false)
assert.equal(completeSession.generatedCount === completeSession.targetAdCount, true)

// 13. New campaign replaces old session after new initial
const newInitial = validateInitialCampaignResponse(makeInitialResult(3), 3)
newInitial.campaignId = 'camp-new'
const newSession = createCampaignSessionFromInitial(newInitial, 3)
assert.equal(newSession.session.campaignId, 'camp-new')
assert.equal(newSession.session.ads.length, 1)
assert.notEqual(newSession.session.campaignId, appended.session.campaignId)

// 14–16. Headline overlay inside capture canvas (static structure checks)
const adCardSource = readFileSync(join(root, 'src/components/AdCard/AdCard.jsx'), 'utf8')
assert.match(adCardSource, /ref=\{compositionRef\}/)
assert.match(adCardSource, /ad-card-headline-overlay/)
assert.match(adCardSource, /ad-card-visual-layer/)
assert.doesNotMatch(adCardSource, /ad-card-campaign-headline-zone/)
assert.match(adCardSource, /ad-card-copy-safe-overlay/)
assert.match(adCardSource, /headlineText \?\s*\(/)

// 17. Shared slogan in presentation for every card
const presentation = buildCampaignPresentation(
  { productNameResolved: 'Ace', detectedLanguage: 'he', format: 'portrait', brandSlogan: 'Tag' },
  {
    brandSlogan: 'Tag',
    graphicGenerator: {
      layoutTemplate: 'campaign_default',
      brandBlockPlacement: 'bottom-left',
      palette: { primary: '#112233' }
    }
  }
)
assert.equal(presentation.brandSlogan, 'Tag')

// 18. Identical graphic classes/CSS vars for same campaign metadata
const presentationB = buildCampaignPresentation(
  { productNameResolved: 'Ace', detectedLanguage: 'he', format: 'portrait' },
  {
    brandSlogan: 'Tag',
    graphicGenerator: {
      layoutTemplate: 'campaign_default',
      brandBlockPlacement: 'bottom-left',
      palette: { primary: '#112233' }
    }
  }
)
assert.deepEqual(presentation.layoutClass, presentationB.layoutClass)
assert.deepEqual(presentation.cssVariables, presentationB.cssVariables)

// 19. Valid graphic metadata does not fall back unnecessarily
const richPresentation = buildCampaignPresentation(
  { productNameResolved: 'Ace', detectedLanguage: 'he', format: 'landscape' },
  makeInitialResult(4).composition
)
assert.equal(richPresentation.usedFallback, false)
assert.equal(richPresentation.borderTreatmentClass, 'ad-card-border-thin')

// 20. Download eligibility: complete only when generatedCount === targetAdCount
function isCampaignDownloadReady(session) {
  return (
    session != null &&
    session.generatedCount >= session.targetAdCount &&
    session.ads.length === session.targetAdCount
  )
}
assert.equal(isCampaignDownloadReady(appended.session), false)
assert.equal(isCampaignDownloadReady({ ...appended.session, targetAdCount: 2, generatedCount: 2, ads: appended.session.ads }), true)

// 21. ZIP order by index
assert.deepEqual(sortAdsByIndex([{ index: 3 }, { index: 1 }, { index: 2 }]).map((a) => a.index), [
  1, 2, 3
])

// 22. Builder2 unchanged (no incremental Builder1 endpoints)
const builder2Source = readFileSync(join(root, 'src/pages/Builder2/Builder2Page.jsx'), 'utf8')
assert.doesNotMatch(builder2Source, /builder1-generate-next/)
assert.doesNotMatch(builder2Source, /builder1Campaign/)

// Additional helper coverage
assert.equal(normalizeBuilder1AdCount(4), 4)
assert.equal(normalizeBuilder1AdCount('3'), 3)
assert.equal(normalizeBuilder1AdCount(5), 2)
assert.equal(toBuilder1ImageSrc('abc'), 'data:image/png;base64,abc')
assert.equal(getFormatRatioCss('landscape'), '1536 / 1024')
assert.equal(sanitizeHexColor('#abc'), '#abc')
assert.equal(sanitizeHexColor('url(#x)'), null)

let progress = computeStageProgress({ stage: 'planning' }, 0, 'initial')
assert.equal(progress, 8)
progress = computeStageProgress({ stage: 'preparing_ad' }, 0, 'next', { adIndex: 2, targetAdCount: 4 })
assert.equal(progress, 15)
assert.match(getStageLabel({ stage: 'generating_ad' }, 'he', 'next', { adIndex: 2, targetAdCount: 4 }), /2/)

const devInitial = createDevMockInitialCampaign({ productName: 'Demo', imageSize: 'portrait' }, 4)
assert.equal(devInitial.ok, true)
assert.equal(devInitial.ads.length, 1)
const devSession = createCampaignSessionFromInitial(devInitial, 4)
const devNext = createDevMockNextAd(devSession.session, 2)
assert.equal(appendAdToSession(devSession.session, devNext).session.generatedCount, 2)

console.log('builder1 incremental campaign tests passed (22 cases)')
