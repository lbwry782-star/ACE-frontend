import { useState, useRef, useEffect, useCallback } from 'react'
import ProductForm2 from '../../components/Form/ProductForm2'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import VideoAdCard from '../../components/VideoAdCard/VideoAdCard'
import { generateMarketingText } from '../../utils/marketingText'
import { generateVideo } from '../../services/api'
import '../Builder/builder.css'
import './builder2.css'

// Future dedicated video engine may standardize on a fixed frame size (e.g. 1920×1080).

// TEMPORARY:
// Builder2 MVP: one video result per generate; backend POST /api/generate-video.

const PLACEHOLDER_VIDEO =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS'
}

/**
 * Normalize API response into a single result for VideoAdCard.
 * ok === true: use backend videoUrl + marketingText when present; missing video URL → placeholder.
 * ok !== true or errors: full placeholder (no crash).
 */
function buildVideoResult(apiData) {
  if (apiData && apiData.ok === true) {
    const rawUrl = apiData.videoUrl ?? apiData.video_url ?? null
    const videoUrl =
      rawUrl && String(rawUrl).trim() ? String(rawUrl).trim() : PLACEHOLDER_VIDEO
    const mt = (apiData.marketingText ?? apiData.marketing_text ?? '').trim()
    const marketingText = mt || generateMarketingText(1)
    return {
      videoUrl,
      marketingText,
      headline: apiData.headline || 'Video result',
      sessionId: apiData.sessionId ?? apiData.session_id ?? null
    }
  }
  return {
    videoUrl: PLACEHOLDER_VIDEO,
    marketingText: generateMarketingText(1),
    headline: 'Video result (placeholder)',
    sessionId: null
  }
}

function Builder2Page() {
  const [state, setState] = useState(STATE.IDLE)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [result, setResult] = useState(null)
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: ''
  })
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const requestInFlightRef = useRef(false)

  const handleSubmit = async (data) => {
    console.log('BUILDER2_PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('BUILDER2_PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    if (requestInFlightRef.current || hasGenerated) {
      return
    }

    requestInFlightRef.current = true

    setState(STATE.GENERATING)
    setProgressKey(prev => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)

    try {
      const apiData = await generateVideo({
        productName: data.productName,
        productDescription: data.productDescription
      })
      setResult(buildVideoResult(apiData))
      setHasGenerated(true)
      setState(STATE.SUCCESS)
    } catch {
      setResult(buildVideoResult({ ok: false }))
      setHasGenerated(true)
      setState(STATE.SUCCESS)
    } finally {
      setProgressActive(false)
      requestInFlightRef.current = false
    }
  }

  const handleProgressComplete = useCallback(() => {}, [])

  const getButtonText = () => {
    return hasGenerated ? 'CONSUMED' : 'GENERATE'
  }

  const isButtonDisabled = () => {
    return state === STATE.GENERATING || hasGenerated
  }

  useEffect(() => {
    setHasGenerated(false)
    setResult(null)
  }, [formData.productName, formData.productDescription])

  return (
    <div className="builder-page builder2-page">
      <h1 className="builder-title">Video Ad Builder</h1>

      <ProductForm2
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        fieldsLocked={state === STATE.GENERATING}
        buttonText={getButtonText()}
        buttonDisabled={isButtonDisabled()}
        showProgress={showProgressBar}
        progressActive={progressActive}
        progressKey={progressKey}
        onProgressComplete={handleProgressComplete}
        isProductNameAuto={false}
      />

      {result && (
        <div className="builder-results">
          <h2 className="results-title">Results</h2>
          <VideoAdCard
            attemptNumber={1}
            videoSrc={result.videoUrl}
            marketingText={result.marketingText}
            headline={result.headline}
            sessionId={result.sessionId}
            isGenerating={state === STATE.GENERATING}
          />
        </div>
      )}
    </div>
  )
}

export default Builder2Page
