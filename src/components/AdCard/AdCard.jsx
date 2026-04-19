import { useState, useEffect } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { downloadZip, NetworkError } from '../../services/api'
import MixedDirectionHeadline from '../MixedDirectionHeadline/MixedDirectionHeadline'
import './adcard.css'

function AdCard({
  attemptNumber,
  imageDataURL: propImageDataURL,
  marketingText: propMarketingText,
  headline: propHeadline,
  objectA: propObjectA,
  objectB: propObjectB,
  sessionId,
  isGenerating
}) {
  const [imageDataURL, setImageDataURL] = useState(propImageDataURL || null)
  const [marketingText, setMarketingText] = useState(propMarketingText ?? generateMarketingText(attemptNumber))
  const [headline, setHeadline] = useState(propHeadline ?? '')
  const [objectA, setObjectA] = useState(propObjectA ?? '')
  const [objectB, setObjectB] = useState(propObjectB ?? '')
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
  useEffect(() => {
    if (propObjectA != null) setObjectA(propObjectA)
  }, [propObjectA])
  useEffect(() => {
    if (propObjectB != null) setObjectB(propObjectB)
  }, [propObjectB])

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
  const objectATrim = typeof objectA === 'string' ? objectA.trim() : ''
  const objectBTrim = typeof objectB === 'string' ? objectB.trim() : ''
  const hasObjects = Boolean(objectATrim || objectBTrim)
  const showComposition = Boolean(imageDataURL || headlineTrimmed || hasObjects)

  return (
    <div className="ad-card">
      {showComposition && (
        <div className="ad-card-composition">
          {headlineTrimmed ? (
            <MixedDirectionHeadline className="ad-card-headline ad-card-headline--composition">
              {headlineTrimmed}
            </MixedDirectionHeadline>
          ) : null}
          {hasObjects ? (
            <div className="ad-card-objects" aria-label="Detected objects">
              {objectATrim ? (
                <span className="ad-card-object" title={objectATrim}>
                  {objectATrim}
                </span>
              ) : null}
              {objectBTrim ? (
                <span className="ad-card-object" title={objectBTrim}>
                  {objectBTrim}
                </span>
              ) : null}
            </div>
          ) : null}
          {imageDataURL ? (
            <div className="ad-card-image">
              <img src={imageDataURL} alt={`Ad ${attemptNumber}`} />
            </div>
          ) : null}
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
