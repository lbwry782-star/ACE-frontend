import { useState, useRef, useEffect, useCallback } from 'react'
import ProductForm2 from '../../components/Form/ProductForm2'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import VideoAdCard from '../../components/VideoAdCard/VideoAdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { startPreview, getJobStatus, NetworkError, ApiError } from '../../services/api'
import { mockGenerate } from '../../utils/mockGeneration'
import '../Builder/builder.css'
import './builder2.css'

/** Fixed “size” sent to existing API shape; user does not choose size in Builder2. */
const BUILDER2_FIXED_IMAGE_SIZE = '1920x1080'
const BUILDER2_MAX_GENERATIONS = 2

/** Safe placeholder when backend has no video URL yet (UI structure only). */
const PLACEHOLDER_VIDEO_SRC =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  CONSUMED: 'CONSUMED',
  BACKEND_BUSY: 'BACKEND_BUSY'
}

function extractVideoUrl(previewResponse) {
  if (!previewResponse) return null
  const r = previewResponse
  if (r.video_url) return r.video_url
  if (r.videoUrl) return r.videoUrl
  if (r.video_mp4_url) return r.video_mp4_url
  if (r.videoMp4Url) return r.videoMp4Url
  if (r.video_base64) return `data:video/mp4;base64,${r.video_base64}`
  if (r.videoBase64) return `data:video/mp4;base64,${r.videoBase64}`
  return null
}

function Builder2Page() {
  const [state, setState] = useState(STATE.IDLE)
  const [generationCount, setGenerationCount] = useState(0)
  const [ads, setAds] = useState([])
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: ''
  })
  const [isProductNameAuto, setIsProductNameAuto] = useState(false)
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [error, setError] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [batchState, setBatchState] = useState(null)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const sessionSeedRef = useRef(null)
  const requestInFlightRef = useRef(false)
  const fillingResolvedNameRef = useRef(false)

  useEffect(() => {
    let sessionSeed = sessionStorage.getItem('ace_session_seed')
    if (!sessionSeed) {
      sessionSeed = crypto.randomUUID()
      sessionStorage.setItem('ace_session_seed', sessionSeed)
    }
    sessionSeedRef.current = sessionSeed
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('ace_session_id')
    if (stored) setSessionId(stored)
  }, [])

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
    const userLeftProductNameEmpty = !data.productName?.trim()
    setIsProductNameAuto(false)
    if (!fieldsLocked) {
      setFieldsLocked(true)
    }

    setState(STATE.GENERATING)
    setError(null)
    setProgressKey(prev => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)

    try {
      const adIndex = generationCount + 1
      const previewPayload = {
        productName: data.productName,
        productDescription: data.productDescription,
        imageSize: BUILDER2_FIXED_IMAGE_SIZE,
        adIndex,
        batchState,
        sessionSeed: sessionSeedRef.current
      }

      const startResponse = await startPreview(previewPayload)
      const jobId = startResponse.jobId ?? startResponse.job_id

      if (!jobId && !startResponse.result) {
        throw new Error('Missing jobId from preview response')
      }

      const applyResolvedProductName = (resolvedName) => {
        if (!userLeftProductNameEmpty || !resolvedName) return
        const name = typeof resolvedName === 'string'
          ? resolvedName
          : (resolvedName?.name ?? resolvedName?.productName ?? '')
        if (!name.trim()) return
        const valueToSet = name.trim()
        fillingResolvedNameRef.current = true
        setFormData(prev => ({ ...prev, productName: valueToSet }))
        setIsProductNameAuto(true)
      }

      const initialResolved = startResponse.resolvedProductName ?? startResponse.resolved_product_name
      applyResolvedProductName(initialResolved)

      let previewResponse = startResponse.result || null
      let realSessionId = null
      const POLL_INTERVAL_MS = 1800
      let productNameFilledFromPoll = false

      while (!previewResponse && jobId) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        const jobStatusResponse = await getJobStatus(jobId)
        const status = jobStatusResponse.status || jobStatusResponse.jobStatus || jobStatusResponse.state

        if (!productNameFilledFromPoll) {
          const resolvedFromStatus = jobStatusResponse.resolvedProductName ?? jobStatusResponse.resolved_product_name
          if (resolvedFromStatus) {
            applyResolvedProductName(resolvedFromStatus)
            productNameFilledFromPoll = true
          }
        }

        if (!status || status === 'pending' || status === 'running' || status === 'in_progress') {
          continue
        }

        if (status === 'done' || status === 'completed' || status === 'success') {
          previewResponse = jobStatusResponse.result || jobStatusResponse.data || jobStatusResponse
          const realSid = jobStatusResponse.sessionId || jobStatusResponse.sid || jobStatusResponse.session_id ||
            previewResponse?.sessionId || previewResponse?.sid || previewResponse?.session_id || null
          if (realSid) {
            realSessionId = realSid
            localStorage.setItem('ace_session_id', realSid)
            setSessionId(realSid)
          }
          break
        }

        if (status === 'error' || status === 'failed') {
          const errPayload = jobStatusResponse.error || 'Error creating ad'
          const errMsg = typeof errPayload === 'string' ? errPayload : (errPayload.message || 'Error creating ad')
          throw new Error(errMsg)
        }

        throw new Error('Error creating ad')
      }

      setIsDemoMode(false)
      if (realSessionId == null) {
        realSessionId =
          previewResponse.sessionId ?? previewResponse.session_id ?? previewResponse.sid ?? null
        if (realSessionId) {
          localStorage.setItem('ace_session_id', realSessionId)
          setSessionId(realSessionId)
        } else {
          setSessionId(null)
        }
      }

      setProgressActive(false)

      let videoUrl = extractVideoUrl(previewResponse)
      if (!videoUrl) {
        videoUrl = PLACEHOLDER_VIDEO_SRC
      }

      const marketingText = previewResponse.marketingText || previewResponse.marketing_text || previewResponse.body_text
      const headline = previewResponse.headline ?? previewResponse.Headline ?? ''

      if (previewResponse.batchState) {
        if (typeof previewResponse.batchState === 'string') {
          try {
            const parsed = JSON.parse(previewResponse.batchState)
            setBatchState(parsed)
          } catch (e) {
            setBatchState(previewResponse.batchState)
          }
        } else {
          setBatchState(previewResponse.batchState)
        }
      }

      const newCount = generationCount + 1
      const newAd = {
        attemptNumber: newCount,
        videoUrl,
        marketingText,
        headline,
        formData: data,
        sessionId: realSessionId
      }
      setAds(prev => [...prev, newAd])
      setGenerationCount(prev => Math.min(prev + 1, BUILDER2_MAX_GENERATIONS))

      setState(STATE.SUCCESS)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BUSY') {
        setState(STATE.BACKEND_BUSY)
        setError('Generation in progress')
        setProgressActive(false)
        return
      }
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setError('Too many requests. Please wait a moment and try again.')
        setState(STATE.ERROR)
        setProgressActive(false)
        return
      }
      if (err instanceof NetworkError || err.isNetworkError) {
        setIsDemoMode(true)
        const generationTime = Math.random() * 120000 + 30000
        try {
          await mockGenerate(
            { ...data, imageSize: BUILDER2_FIXED_IMAGE_SIZE },
            generationTime
          )
          setSessionId(sessionSeedRef.current ?? null)
          const newCount = generationCount + 1
          const newAd = {
            attemptNumber: newCount,
            videoUrl: PLACEHOLDER_VIDEO_SRC,
            marketingText: 'Demo video ad body. Placeholder marketing copy for approximately fifty words while the video pipeline is unavailable. This text illustrates the marketing area beside each generated video result in Builder2.',
            headline: `Video ad ${newCount} (demo)`
          }
          setAds(prev => [...prev, newAd])
          setGenerationCount(prev => Math.min(prev + 1, BUILDER2_MAX_GENERATIONS))
          setProgressActive(false)
          setState(STATE.SUCCESS)
        } catch (mockErr) {
          setError(mockErr.message || 'Error creating ad')
          setState(STATE.ERROR)
          setProgressActive(false)
        }
      } else {
        setError(err.message || 'Error creating ad')
        setState(STATE.ERROR)
        setProgressActive(false)
      }
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
    return state === STATE.GENERATING || state === STATE.BACKEND_BUSY || generationCount >= BUILDER2_MAX_GENERATIONS
  }

  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      return
    }
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
        isProductNameAuto={isProductNameAuto}
        onProductNameEdited={() => setIsProductNameAuto(false)}
      />

      {ads.length > 0 && (
        <div className="builder-results">
          {isDemoMode && (
            <div className="demo-mode-notice">
              Backend unavailable — using demo mode.
            </div>
          )}
          <h2 className="results-title">Results</h2>
          {ads.map((ad, index) => (
            <VideoAdCard
              key={index}
              attemptNumber={ad.attemptNumber}
              videoSrc={ad.videoUrl}
              marketingText={ad.marketingText}
              headline={ad.headline}
              sessionId={ad.sessionId ?? sessionId}
              isGenerating={state === STATE.GENERATING}
            />
          ))}
        </div>
      )}

      {state === STATE.BACKEND_BUSY && error && (
        <ErrorPanel error={error} onRetry={handleRetry} buttonLabel="Retry" title="Please wait" />
      )}
      {state === STATE.ERROR && error && !isDemoMode && (
        <ErrorPanel error={error} onRetry={handleRetry} buttonLabel="Retry" />
      )}
    </div>
  )
}

export default Builder2Page
