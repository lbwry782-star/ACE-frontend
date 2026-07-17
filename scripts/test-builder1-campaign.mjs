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
  parseStoredBuilder1AdCount,
  readRawBuilder1CampaignAdCount,
  resolveBuilder1InitialAdCount,
  getBuilder1GenerateButtonLabel,
  BUILDER1_CAMPAIGN_AD_COUNT_KEY,
  BUILDER1_LEGACY_MAX_ADS_KEY
} from '../src/utils/builder1CampaignCount.js'
import {
  buildInitialGeneratePayload,
  validateInitialCampaignResponse,
  validateNextAdResponse,
  createCampaignSessionFromInitial,
  appendAdToSession,
  getFormatRatioCss,
  toBuilder1ZipImageBase64,
  parseRateLimitError
} from '../src/utils/builder1Campaign.js'

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

function simulatePreview1Select(tierKey) {
  const adCount = preview1TierKeyToAdCount(tierKey)
  assert.notEqual(adCount, null)
  saveBuilder1CampaignAdCount(adCount)
  return adCount
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
      marketingText: 'Text 1',
      imageBase64: 'abc123',
      imageContainsFinalCopy: true
    },
    composition: {
      format: 'portrait',
      brandSlogan: 'Slogan here'
    },
    nextAdIndex: 2
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
      imageBase64: 'xyz789',
      imageContainsFinalCopy: true
    },
    nextAdIndex: index + 1
  }
}

const { local, session } = mockStorages()

// 1–3. PREVIEW1 tier 3 and 4 reach API payload; valid values do not fall back to 2
simulatePreview1Select('2')
assert.equal(readBuilder1CampaignAdCount(), 3)
let payload3 = buildInitialGeneratePayload({
  productName: 'P',
  productDescription: 'D',
  format: 'landscape',
  adCount: readBuilder1CampaignAdCount()
})
assert.equal(payload3.adCount, 3)
assert.equal(typeof payload3.adCount, 'number')
assert.equal(JSON.stringify(payload3).includes('"adCount":3'), true)

local.clear()
session.clear()
simulatePreview1Select('5')
assert.equal(readBuilder1CampaignAdCount(), 4)
let payload4 = buildInitialGeneratePayload({
  productName: 'P',
  productDescription: 'D',
  format: 'landscape',
  adCount: readBuilder1CampaignAdCount()
})
assert.equal(payload4.adCount, 4)
assert.equal(JSON.stringify(payload4).includes('"adCount":4'), true)

local.set(BUILDER1_CAMPAIGN_AD_COUNT_KEY, '3')
session.clear()
assert.equal(readBuilder1CampaignAdCount(), 3)
assert.equal(local.get(BUILDER1_LEGACY_MAX_ADS_KEY), undefined)

local.set(BUILDER1_LEGACY_MAX_ADS_KEY, '4')
local.delete(BUILDER1_CAMPAIGN_AD_COUNT_KEY)
assert.equal(readBuilder1CampaignAdCount(), 4)
assert.equal(local.get(BUILDER1_CAMPAIGN_AD_COUNT_KEY), '4')
assert.equal(local.get(BUILDER1_LEGACY_MAX_ADS_KEY), undefined)

// 4. Target count remains fixed during GENERATE AGAIN
const initial3 = validateInitialCampaignResponse(makeInitialResult(3), 3)
const session3 = createCampaignSessionFromInitial(initial3, 3)
assert.equal(session3.session.targetAdCount, 3)
const next2 = validateNextAdResponse(makeNextAdResult('camp-abc', 2), {
  campaignId: 'camp-abc',
  expectedIndex: 2
})
const after2 = appendAdToSession(session3.session, next2)
assert.equal(after2.session.targetAdCount, 3)
assert.equal(resolveBuilder1InitialAdCount({ targetAdCount: after2.session.targetAdCount }), 3)

// 5–7. Button labels
assert.equal(getBuilder1GenerateButtonLabel({ hasGeneratedAds: false, canGenerateNext: false }), 'GENERATE')
assert.equal(
  getBuilder1GenerateButtonLabel({ hasGeneratedAds: true, canGenerateNext: true }),
  'GENERATE AGAIN'
)
const builderPageSource = readFileSync(join(root, 'src/pages/Builder/BuilderPage.jsx'), 'utf8')
assert.match(builderPageSource, /getBuilder1GenerateButtonLabel/)
assert.doesNotMatch(builderPageSource, /GENERATE NEXT AD/)
assert.doesNotMatch(builderPageSource, /GENERATE NEW CAMPAIGN/)
assert.doesNotMatch(builderPageSource, /captureNodeAsPngBase64/)

// 8–9. Endpoint routing
assert.match(builderPageSource, /\/api\/builder1-generate/)
assert.match(builderPageSource, /\/api\/builder1-generate-next/)
assert.match(builderPageSource, /canGenerateAgain[\s\S]*handleGenerateNextAd/)
assert.match(builderPageSource, /handleInitialSubmit/)

// 10–11. Append one ad; no multi-ad initial contract
assert.equal(after2.session.ads.length, 2)
const multi = makeInitialResult(3)
multi.ad = undefined
multi.ads = [
  { index: 1, marketingText: 'A', imageBase64: 'a' },
  { index: 2, marketingText: 'B', imageBase64: 'b' }
]
assert.equal(validateInitialCampaignResponse(multi, 3).ok, false)

// 12. Complete campaign disables generate
const complete = {
  ...after2.session,
  generatedCount: 3,
  targetAdCount: 3,
  canGenerateNext: false,
  ads: [
    after2.session.ads[0],
    after2.session.ads[1],
    { index: 3, marketingText: 'T3', imageSrc: 'data:image/png;base64,x' }
  ]
}
assert.equal(complete.canGenerateNext, false)
assert.match(builderPageSource, /showGenerateButton = !campaignComplete/)

// 13–14. No Frontend headline/brand overlays
const adCardSource = readFileSync(join(root, 'src/components/AdCard/AdCard.jsx'), 'utf8')
assert.match(adCardSource, /builder1-ad-canvas/)
assert.match(adCardSource, /builder1-final-ad-image/)
assert.doesNotMatch(adCardSource, /headline-overlay/)
assert.doesNotMatch(adCardSource, /brand-slogan/)
assert.doesNotMatch(adCardSource, /brand-name/)
assert.doesNotMatch(adCardSource, /forwardRef/)

// 15–17. Canvas ratio + marketing text separation
const adCardCss = readFileSync(join(root, 'src/components/AdCard/adcard.css'), 'utf8')
assert.match(adCardCss, /\.builder1-ad-canvas[\s\S]*aspect-ratio: var\(--builder1-ad-ratio/)
assert.match(adCardCss, /\.builder1-final-ad-image[\s\S]*object-fit: contain/)
assert.match(adCardCss, /\.builder1-marketing-text[\s\S]*margin-top: 16px/)
assert.equal(getFormatRatioCss('portrait'), '1024 / 1536')
assert.equal(getFormatRatioCss('landscape'), '1536 / 1024')
assert.equal(getFormatRatioCss('square'), '1 / 1')
assert.doesNotMatch(adCardCss, /\.builder1-marketing-text[\s\S]*position:\s*absolute/)

// 18. Empty marketing text renders no block
assert.match(adCardSource, /marketingText \?\s*\(/)

// 19. ZIP uses original imageBase64
assert.match(builderPageSource, /toBuilder1ZipImageBase64/)
assert.equal(toBuilder1ZipImageBase64('abc123'), 'data:image/png;base64,abc123')
assert.equal(toBuilder1ZipImageBase64('data:image/png;base64,xyz'), 'data:image/png;base64,xyz')

// 20. 429 preserves session state
const rateInfo = parseRateLimitError({
  status: 429,
  body: { error: 'image_rate_limited', retryAfterSeconds: 30 }
})
assert.equal(rateInfo.rateLimited, true)
assert.equal(after2.session.nextAdIndex, 3)
assert.equal(after2.session.ads.length, 2)

// 21. Builder2 unchanged
const builder2Source = readFileSync(join(root, 'src/pages/Builder2/Builder2Page.jsx'), 'utf8')
assert.doesNotMatch(builder2Source, /builder1-generate-next/)
assert.doesNotMatch(builder2Source, /builder1Campaign/)

// PREVIEW1 selects 3 → exactly 3 ads allowed
assert.equal(preview1TierKeyToAdCount('2'), 3)
local.clear()
session.clear()
simulatePreview1Select('2')
const builderTarget = readBuilder1CampaignAdCount()
assert.equal(builderTarget, 3)
const validated3 = validateInitialCampaignResponse(makeInitialResult(3), builderTarget)
const sess = createCampaignSessionFromInitial(validated3, builderTarget)
assert.equal(sess.session.targetAdCount, 3)
assert.equal(sess.session.canGenerateNext, true)

console.log('builder1 production-revision tests passed (21 cases)')
