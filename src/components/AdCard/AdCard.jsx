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

function AdCard({
  attemptNumber,
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
  const headlineLinesObj =
    propHeadlineLines && typeof propHeadlineLines === 'object' ? propHeadlineLines : null
  const headlineProductLine =
    safeHeadlineString(headlineLinesObj?.line1) || safeHeadlineString(propHeadlineProductName)
  const headlineTextLine =
    safeHeadlineString(headlineLinesObj?.line2) || safeHeadlineString(propHeadlineText)
  const headlineFullLine = safeHeadlineString(propHeadlineFull)
  const hasSplitHeadline = Boolean(headlineProductLine || headlineTextLine)
  const hasLegacyHeadline = Boolean(headlineTrimmed && !hasSplitHeadline)
  const hasHeadlineData = Boolean(hasSplitHeadline || hasLegacyHeadline || headlineFullLine)
  const showComposition = Boolean(imageDataURL || hasHeadlineData)
  const layoutClass = `ad-card-layout-${normalizedCompositionLayout(propCompositionLayout)}`
  const showHeadlineBlock = hasSplitHeadline || Boolean(headlineFullLine) || hasLegacyHeadline
  const line1 = headlineProductLine || headlineFullLine || headlineTrimmed
  const line2 = headlineTextLine

  return (
    <div className="ad-card">
      {showComposition && (
        <div className="ad-card-composition">
          <div
            className={`ad-card-composition-adunit ${layoutClass}`}
            data-headline-align={safeHeadlineString(propHeadlineAlign) || undefined}
            data-visual-weight={safeHeadlineString(propVisualWeight) || undefined}
            data-headline-weight={safeHeadlineString(propHeadlineWeight) || undefined}
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
