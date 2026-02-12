import { useState, useEffect } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { generate, NetworkError } from '../../services/api'
import './adcard.css'

function AdCard({ imageSize, attemptNumber, imageDataURL: propImageDataURL, marketingText: propMarketingText, previewId, batchState, isGenerating, sid }) {
  const [imageDataURL, setImageDataURL] = useState(propImageDataURL || null)
  const [marketingText, setMarketingText] = useState(propMarketingText || generateMarketingText(attemptNumber))

  useEffect(() => {
    if (propImageDataURL) {
      setImageDataURL(propImageDataURL)
    }
  }, [propImageDataURL])

  useEffect(() => {
    if (propMarketingText) {
      setMarketingText(propMarketingText)
    }
  }, [propMarketingText])

  const handleDownload = async () => {
    if (!isGenerating) {
      try {
        if (!previewId) {
          throw new Error("Missing previewId – cannot download ZIP")
        }
        
        // Normalize adIndex: 1..3 -> 0..2
        const adIndex = attemptNumber - 1
        
        // Normalize batchState
        let normalizedBatchState = null
        if (batchState) {
          if (typeof batchState === 'string') {
            try {
              normalizedBatchState = JSON.parse(batchState)
            } catch (e) {
              normalizedBatchState = null
            }
          } else if (typeof batchState === 'object') {
            normalizedBatchState = batchState
          }
        }
        
        const generatePayload = {
          previewId,
          adIndex,
          batchState: normalizedBatchState,
          sid: sid // Include sid from runtime memory
        }
        const response = await generate(generatePayload)
        
        if (response.zipBlob) {
          // Download the ZIP file
          const url = URL.createObjectURL(response.zipBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'ad.zip'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error('Failed to download ZIP:', error)
        // Fallback to local ZIP creation if network fails
        if (imageDataURL) {
          const { createAndDownloadZip } = await import('../../utils/zipCreator')
          await createAndDownloadZip(imageDataURL, marketingText, `ad-${attemptNumber}.zip`)
        }
      }
    }
  }

  if (!imageDataURL) {
    return <div className="ad-card-loading">No preview image returned</div>
  }

  return (
    <div className="ad-card">
      <div className="ad-card-image">
        <img src={imageDataURL} alt={`Ad ${attemptNumber}`} />
      </div>
      <div className="ad-card-text">
        <p>{marketingText}</p>
      </div>
      <button 
        className="ad-card-download" 
        onClick={handleDownload}
        disabled={isGenerating}
      >
        Download ZIP
      </button>
    </div>
  )
}

export default AdCard

