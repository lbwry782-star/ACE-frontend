import { useState, useRef, useEffect, useCallback } from 'react'
import ProductForm2 from '../../components/Form/ProductForm2'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import VideoAdCard from '../../components/VideoAdCard/VideoAdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { generateMarketingText } from '../../utils/marketingText'
import { mockGenerate } from '../../utils/mockGeneration'
import '../Builder/builder.css'
import './builder2.css'

// Future dedicated video engine may standardize on a fixed frame size (e.g. 1920×1080).
// That value is not sent to any API from this prototype.

// TEMPORARY:
// Builder2 currently uses placeholder video results until the dedicated video engine is implemented.
// Future video generation may use its own request/response format and a standard video size such as 1920x1080.

const BUILDER2_MAX_GENERATIONS = 2

/** Builder2-only placeholder delay (ms). Keeps progress bar visible briefly without long waits. */
const BUILDER2_PLACEHOLDER_MS_MIN = 1000
const BUILDER2_PLACEHOLDER_MS_SPREAD = 1400 // min + random * spread → ~1.0s–2.4s

/** Public sample clips — UI-only placeholders; replace when the video engine ships. */
const PLACEHOLDER_VIDEOS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/sample.mp4'
]

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
}

function Builder2Page() {
  const [state, setState] = useState(STATE.IDLE)
  const [generationCount, setGenerationCount] = useState(0)
  const [ads, setAds] = useState([])
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: ''
  })
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [error, setError] = useState(null)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const requestInFlightRef = useRef(false)

  const handleSubmit = async (data) => {
    console.log('BUILDER2_PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('BUILDER2_PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    if (requestInFlightRef.current) {
      return
    }
    if (generationCount >= BUILDER2_MAX_GENERATIONS) {
      return
    }

    requestInFlightRef.current = true
    if (!fieldsLocked) {
      setFieldsLocked(true)
    }

    setState(STATE.GENERATING)
    setError(null)
    setProgressKey(prev => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)

    try {
      // UI-only “generation” delay — no image/preview backend pipeline.
      const prototypeMs =
        BUILDER2_PLACEHOLDER_MS_MIN + Math.random() * BUILDER2_PLACEHOLDER_MS_SPREAD
      await mockGenerate(
        { productName: data.productName, productDescription: data.productDescription },
        prototypeMs
      )

      const newCount = generationCount + 1
      const videoUrl = PLACEHOLDER_VIDEOS[(newCount - 1) % PLACEHOLDER_VIDEOS.length]
      const newAd = {
        attemptNumber: newCount,
        videoUrl,
        marketingText: generateMarketingText(newCount),
        headline: `Video result ${newCount} (placeholder)`,
        sessionId: null
      }
      setAds(prev => [...prev, newAd])
      setGenerationCount(prev => Math.min(prev + 1, BUILDER2_MAX_GENERATIONS))

      setProgressActive(false)
      setState(STATE.SUCCESS)
    } catch (err) {
      setError(err.message || 'Error creating ad')
      setState(STATE.ERROR)
      setProgressActive(false)
    } finally {
      requestInFlightRef.current = false
    }
  }

  const handleProgressComplete = useCallback(() => {}, [])

  const handleRetry = () => {
    handleSubmit(formData)
  }

  const getButtonText = () => {
    if (generationCount === 0) {
      return 'GENERATE'
    }
    if (generationCount < BUILDER2_MAX_GENERATIONS) {
      return 'GENERATE AGAIN'
    }
    return 'CONSUMED'
  }

  const isButtonDisabled = () => {
    return state === STATE.GENERATING || generationCount >= BUILDER2_MAX_GENERATIONS
  }

  useEffect(() => {
    setGenerationCount(0)
  }, [formData.productName, formData.productDescription])

  return (
    <div className="builder-page builder2-page">
      <h1 className="builder-title">Video Ad Builder</h1>

      <ProductForm2
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        fieldsLocked={fieldsLocked}
        buttonText={getButtonText()}
        buttonDisabled={isButtonDisabled()}
        showProgress={showProgressBar}
        progressActive={progressActive}
        progressKey={progressKey}
        onProgressComplete={handleProgressComplete}
        isProductNameAuto={false}
      />

      {ads.length > 0 && (
        <div className="builder-results">
          <h2 className="results-title">Results</h2>
          {ads.map((ad, index) => (
            <VideoAdCard
              key={index}
              attemptNumber={ad.attemptNumber}
              videoSrc={ad.videoUrl}
              marketingText={ad.marketingText}
              headline={ad.headline}
              sessionId={ad.sessionId}
              isGenerating={state === STATE.GENERATING}
            />
          ))}
        </div>
      )}

      {state === STATE.ERROR && error && (
        <ErrorPanel error={error} onRetry={handleRetry} buttonLabel="Retry" />
      )}
    </div>
  )
}

export default Builder2Page
