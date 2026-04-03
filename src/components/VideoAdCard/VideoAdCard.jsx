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
      {headline && (
        <h3 className="ad-card-headline">{headline}</h3>
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
