/**
 * Lightweight node assertions for builder1Campaign helpers.
 * Run: node scripts/test-builder1-campaign.mjs
 */
import assert from 'node:assert/strict'
import {
  normalizeBuilder1AdCount,
  toBuilder1ImageSrc,
  validateCampaignResponse,
  sortAdsByIndex,
  computeStageProgress,
  getFormatRatioCss,
  sanitizeHexColor,
  buildCampaignPresentation
} from '../src/utils/builder1Campaign.js'

assert.equal(normalizeBuilder1AdCount(2), 2)
assert.equal(normalizeBuilder1AdCount(4), 4)
assert.equal(normalizeBuilder1AdCount('3'), 3)
assert.equal(normalizeBuilder1AdCount('2'), 2)
assert.equal(normalizeBuilder1AdCount(true), 2)
assert.equal(normalizeBuilder1AdCount(5), 2)
assert.equal(normalizeBuilder1AdCount(1), 2)

const rawB64 = 'abcd'
assert.equal(toBuilder1ImageSrc(rawB64), 'data:image/png;base64,abcd')
assert.equal(toBuilder1ImageSrc('data:image/png;base64,xyz'), 'data:image/png;base64,xyz')
assert.equal(toBuilder1ImageSrc(''), '')

assert.equal(getFormatRatioCss('portrait'), '1024 / 1536')
assert.equal(getFormatRatioCss('landscape'), '1536 / 1024')
assert.equal(getFormatRatioCss('square'), '1 / 1')

assert.equal(sanitizeHexColor('#abc'), '#abc')
assert.equal(sanitizeHexColor('#aabbcc'), '#aabbcc')
assert.equal(sanitizeHexColor('url(#x)'), null)
assert.equal(sanitizeHexColor('#abc; position:fixed'), null)

function makeValidResult(adCount = 2) {
  const ads = Array.from({ length: adCount }, (_, i) => ({
    index: i + 1,
    headline: i === 0 ? 'Line' : null,
    marketingText: `Text ${i + 1}`,
    imageBase64: 'abc123'
  }))
  return {
    ok: true,
    campaign: {
      productNameResolved: 'Brand X',
      brandSlogan: 'Slogan here',
      detectedLanguage: 'he',
      format: 'portrait',
      adCount
    },
    ads,
    composition: {
      format: 'portrait',
      brandSlogan: 'Slogan here',
      graphicGenerator: { brandPlacement: 'bottom-left', palette: { primary: '#112233' } }
    }
  }
}

let v2 = validateCampaignResponse(makeValidResult(2), 2)
assert.equal(v2.ok, true)
assert.equal(v2.ads.length, 2)

let v4 = validateCampaignResponse(makeValidResult(4), 4)
assert.equal(v4.ok, true)
assert.equal(v4.ads.length, 4)

const sorted = sortAdsByIndex([{ index: 3 }, { index: 1 }, { index: 2 }])
assert.deepEqual(sorted.map((a) => a.index), [1, 2, 3])

const dup = makeValidResult(2)
dup.ads[1].index = 1
assert.equal(validateCampaignResponse(dup, 2).ok, false)

const missingIdx = makeValidResult(2)
missingIdx.ads[1].index = 3
assert.equal(validateCampaignResponse(missingIdx, 2).ok, false)

const noSlogan = makeValidResult(2)
noSlogan.campaign.brandSlogan = ''
noSlogan.composition.brandSlogan = ''
assert.equal(validateCampaignResponse(noSlogan, 2).ok, false)

const mismatch = makeValidResult(2)
assert.equal(validateCampaignResponse(mismatch, 3).ok, false)

let progress = 0
progress = computeStageProgress({ stage: 'planning' }, progress)
assert.equal(progress, 8)
progress = computeStageProgress({ stage: 'generating_images', completedAds: 2, totalAds: 4 }, progress)
assert.equal(progress, 60)
progress = computeStageProgress({ stage: 'generating_images', completedAds: 1, totalAds: 4 }, 50)
assert.equal(progress, 50)

const presentation = buildCampaignPresentation(
  { productNameResolved: 'Ace', detectedLanguage: 'he', format: 'portrait' },
  { brandSlogan: 'Tag', graphicGenerator: { brandPlacement: 'bottom-left' } }
)
assert.equal(presentation.brandSlogan, 'Tag')
assert.equal(presentation.direction, 'rtl')

console.log('builder1Campaign helper tests passed')
