import { useState, useEffect } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { downloadZip } from '../../services/api'
import MixedDirectionHeadline from '../MixedDirectionHeadline/MixedDirectionHeadline'
import './adcard.css'

/** Maps stored placement to composition modifier (Builder1 CSS). Unknown / missing → fallback. */
function compositionPlacementClass(placement) {
  if (placement === 'top_left') return 'ad-card-composition--hp-top-left'
  if (placement === 'top_center') return 'ad-card-composition--hp-top-center'
  if (placement === 'top_right') return 'ad-card-composition--hp-top-right'
  return 'ad-card-composition--hp-fallback'
}

function AdCard({
  attemptNumber,
  imageDataURL: propImageDataURL,
  marketingText: propMarketingText,
  headline: propHeadline,
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
  const showComposition = Boolean(imageDataURL || headlineTrimmed)
  const placementClass = compositionPlacementClass(propHeadlinePlacement ?? null)

  return (
    <div className="ad-card">
      {showComposition && (
        <div className={`ad-card-composition ${placementClass}`}>
          <div className="ad-card-composition-adunit">
            {headlineTrimmed ? (
              <div className="ad-card-composition-headline-zone">
                <MixedDirectionHeadline className="ad-card-headline ad-card-headline--composition">
                  {headlineTrimmed}
                </MixedDirectionHeadline>
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
