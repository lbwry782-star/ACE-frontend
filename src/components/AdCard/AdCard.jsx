import { useState, useEffect } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { downloadZip } from '../../services/api'
import './adcard.css'

function safeHeadlineString(v) {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : String(v)
  return s.trim()
}

function normalizedCompositionLayout(raw) {
  const s = safeHeadlineString(raw).toLowerCase()
  if (s === 'headline_below_visual') return 'headline_below_visual'
  if (s === 'headline_left_visual_right') return 'headline_left_visual_right'
  if (s === 'visual_left_headline_right') return 'visual_left_headline_right'
  return 'headline_below_visual'
}

/** User-selected Builder1 format only (never model output). */
function normalizeAdFormat(raw) {
  const s = safeHeadlineString(raw).toLowerCase()
  if (s === 'portrait') return 'portrait'
  if (s === 'square') return 'square'
  if (s === 'landscape') return 'landscape'
  return 'landscape'
}

function clampWeight(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function parseHeadlineLines(headlineLines) {
  if (Array.isArray(headlineLines)) {
    return headlineLines
      .map((line) => safeHeadlineString(line))
      .filter(Boolean)
  }
  if (headlineLines && typeof headlineLines === 'object') {
    const values = []
    if (headlineLines.line1 != null) values.push(headlineLines.line1)
    if (headlineLines.line2 != null) values.push(headlineLines.line2)
    if (headlineLines.line3 != null) values.push(headlineLines.line3)
    if (values.length > 0) {
      return values.map((line) => safeHeadlineString(line)).filter(Boolean)
    }
  }
  return []
}

function AdCard({
  attemptNumber,
  format: propFormat,
  imageDataURL: propImageDataURL,
  marketingText: propMarketingText,
  headline: propHeadline,
  headlineProductName: propHeadlineProductName,
  headlineText: propHeadlineText,
  headlineFull: propHeadlineFull,
  compositionLayout: propCompositionLayout,
  headlineAlign: propHeadlineAlign,
  headlineLines: propHeadlineLines,
  visualWeight: propVisualWeight,
  headlineWeight: propHeadlineWeight,
  safeMarginCss: propSafeMarginCss,
  headlineSizeRule: propHeadlineSizeRule,
  productNameScale: propProductNameScale,
  headlineTextScale: propHeadlineTextScale,
  headlinePlacement: propHeadlinePlacement,
  sessionId,
  isGenerating
}) {
  const [imageDataURL, setImageDataURL] = useState(propImageDataURL || null)
  const [marketingText, setMarketingText] = useState(propMarketingText ?? generateMarketingText(attemptNumber))
  const [headline, setHeadline] = useState(propHeadline ?? '')
  const [downloadLoading, setDownloadLoading] = useState(false)

  useEffect(() => {
    if (propImageDataURL) setImageDataURL(propImageDataURL)
  }, [propImageDataURL])
  useEffect(() => {
    if (propMarketingText != null) setMarketingText(propMarketingText)
  }, [propMarketingText])
  useEffect(() => {
    if (propHeadline != null) setHeadline(propHeadline)
  }, [propHeadline])

  const canDownload = !!sessionId && !isGenerating && !downloadLoading

  const handleDownload = async () => {
    if (!canDownload) return
    setDownloadLoading(true)
    try {
      const { zipBlob } = await downloadZip(sessionId, attemptNumber)
      if (zipBlob) {
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ad-${attemptNumber}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download ZIP:', error)
    } finally {
      setDownloadLoading(false)
    }
  }

  const headlineTrimmed = typeof headline === 'string' ? headline.trim() : ''
  const parsedLines = parseHeadlineLines(propHeadlineLines)
  const fallbackLine1 = safeHeadlineString(propHeadlineProductName)
  const fallbackLine2 = safeHeadlineString(propHeadlineText)
  const fallbackFull = safeHeadlineString(propHeadlineFull) || headlineTrimmed
  const line1 = parsedLines[0] || fallbackLine1 || fallbackFull
  const line2 = parsedLines.length > 1
    ? parsedLines.slice(1).join('\n')
    : (fallbackLine2 || (line1 === fallbackFull ? '' : fallbackFull))
  const hasHeadlineData = Boolean(line1 || line2)
  const showComposition = Boolean(imageDataURL || hasHeadlineData)
  const adFormat = normalizeAdFormat(propFormat)
  let effectiveLayout = normalizedCompositionLayout(propCompositionLayout)
  if (adFormat === 'portrait' || adFormat === 'square') {
    effectiveLayout = 'headline_below_visual'
  }
  const layoutClass = `ad-card-layout-${effectiveLayout}`
  const formatClass = `ad-card-format-${adFormat}`
  const showHeadlineBlock = hasHeadlineData
  const visualWeight = clampWeight(propVisualWeight, 0.68)
  const headlineWeight = clampWeight(propHeadlineWeight, 0.32)
  const equalSideBySide =
    effectiveLayout !== 'headline_below_visual' && Math.abs(visualWeight - headlineWeight) < 0.001
  const safeMarginCss = safeHeadlineString(propSafeMarginCss) || 'clamp(24px, 4vw, 48px)'
  const productScale = clampWeight(propProductNameScale, 1)
  const textScale = clampWeight(propHeadlineTextScale, 1)
  const formatRatioCss =
    adFormat === 'portrait' ? '1080 / 1536' : adFormat === 'square' ? '1 / 1' : '1536 / 1080'

  const compositionStyle = {
    '--ad-safe-margin': safeMarginCss,
    '--ad-format-ratio': formatRatioCss,
    '--visual-weight': String(visualWeight),
    '--headline-weight': String(headlineWeight),
    '--grid-cols-hv': `${headlineWeight}fr ${visualWeight}fr`,
    '--grid-cols-vh': `${visualWeight}fr ${headlineWeight}fr`,
    '--headline-product-scale': String(productScale),
    '--headline-text-scale': String(textScale)
  }
  if (equalSideBySide) {
    compositionStyle['--visual-weight'] = '1'
    compositionStyle['--headline-weight'] = '1'
    compositionStyle['--grid-cols-hv'] = '1fr 1fr'
    compositionStyle['--grid-cols-vh'] = '1fr 1fr'
  }

  return (
    <div className="ad-card">
      {showComposition && (
        <div className="ad-card-composition">
          <div
            className={`ad-card-composition-adunit ${layoutClass} ${formatClass}`}
            style={compositionStyle}
            data-ad-format={adFormat}
            data-headline-align={safeHeadlineString(propHeadlineAlign) || undefined}
            data-headline-size-rule={safeHeadlineString(propHeadlineSizeRule) || undefined}
            data-headline-placement={safeHeadlineString(propHeadlinePlacement) || undefined}
          >
            {showHeadlineBlock ? (
              <div className="ad-card-composition-headline-zone ad-card-builder1-headline">
                {line1 ? (
                  <div className="ad-card-builder1-headline-product" dir="auto">
                    <bdi>{line1}</bdi>
                  </div>
                ) : null}
                {line2 ? (
                  <div className="ad-card-builder1-headline-text" dir="auto">
                    <bdi>{line2}</bdi>
                  </div>
                ) : null}
              </div>
            ) : null}
            {imageDataURL ? (
              <div className="ad-card-composition-visual-zone">
                <div className="ad-card-image">
                  <img src={imageDataURL} alt={`Ad ${attemptNumber}`} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="ad-card-text">
        <p>{marketingText}</p>
      </div>
      <button
        type="button"
        className="ad-card-download"
        onClick={handleDownload}
        disabled={!canDownload}
      >
        {downloadLoading ? 'Downloading…' : 'Download ZIP'}
      </button>
    </div>
  )
}

export default AdCard
