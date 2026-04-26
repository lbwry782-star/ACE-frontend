import { useState, useEffect } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { downloadZip } from '../../services/api'
import '../AdCard/adcard.css'
import './video-ad-card.css'

/**
 * Builder2 result card: video + ~50-word marketing copy + Download ZIP (same behavior as AdCard).
 */
function VideoAdCard({
  attemptNumber,
  videoSrc: propVideoSrc,
  marketingText: propMarketingText,
  headline: propHeadline,
  headlineText: propHeadlineText,
  overlayHeadline: propOverlayHeadline,
  productNameResolved: propProductNameResolved,
  sessionId,
  isGenerating
}) {
  const [videoSrc, setVideoSrc] = useState(propVideoSrc || null)
  const [marketingText, setMarketingText] = useState(propMarketingText ?? generateMarketingText(attemptNumber))
  const [headline, setHeadline] = useState(propHeadline ?? '')
  const [downloadLoading, setDownloadLoading] = useState(false)

  useEffect(() => {
    if (propVideoSrc) setVideoSrc(propVideoSrc)
  }, [propVideoSrc])
  useEffect(() => {
    if (propMarketingText != null) setMarketingText(propMarketingText)
  }, [propMarketingText])
  useEffect(() => {
    if (propHeadline != null) setHeadline(propHeadline)
  }, [propHeadline])

  const safe = (v) => (v == null ? '' : String(v).trim())
  const splitHeadline = (raw) => {
    const text = safe(raw)
    if (!text) return { first: '', rest: '' }
    const commaIdx = text.indexOf(',')
    const spaceIdx = text.search(/\s/)
    if (commaIdx !== -1 && (spaceIdx === -1 || commaIdx < spaceIdx)) {
      return {
        first: text.slice(0, commaIdx).trim(),
        rest: text.slice(commaIdx + 1).trim()
      }
    }
    if (spaceIdx !== -1) {
      return {
        first: text.slice(0, spaceIdx).trim(),
        rest: text.slice(spaceIdx + 1).trim()
      }
    }
    return { first: text, rest: '' }
  }

  const baseHeadline = safe(propOverlayHeadline) || safe(headline)
  const split = splitHeadline(baseHeadline)
  const productLine = safe(propProductNameResolved) || split.first
  const restFromApi = safe(propHeadlineText)
  const restLine = restFromApi || split.rest || '\u00A0'

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
        a.download = `video-ad-${attemptNumber}.zip`
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

  return (
    <div className="ad-card">
      {videoSrc && (
        <div className="ad-card-video-wrap">
          <video
            className="ad-card-video"
            src={videoSrc}
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      {baseHeadline && (
        <div className="ad-card-video-headline" dir="auto">
          <div className="ad-card-video-headline-product">
            <bdi>{productLine || split.first}</bdi>
          </div>
          <div className="ad-card-video-headline-text">
            <bdi>{restLine}</bdi>
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

export default VideoAdCard
