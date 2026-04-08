import { useState, useRef, useEffect, useCallback } from 'react'
import ProductForm2 from '../../components/Form/ProductForm2'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import VideoAdCard from '../../components/VideoAdCard/VideoAdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { generateMarketingText } from '../../utils/marketingText'
import { generateVideo, fetchVideoStatus } from '../../services/api'
import '../Builder/builder.css'
import './builder2.css'

// Future dedicated video engine may standardize on a fixed frame size (e.g. 1920×1080).

// Builder2: async job POST /api/generate-video → poll GET /api/video-status?jobId=

const PLACEHOLDER_VIDEO =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const POLL_INTERVAL_MS = 2000

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS'
}

/**
 * Map a successful "done" status payload (or inline ok response) into VideoAdCard props.
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

function normalizeStatus(st) {
  return String(st?.status ?? '').toLowerCase()
}

/** Video API may use resolvedProductName, or echo chosen name as productName only. */
function extractResolvedProductName(payload) {
  if (!payload) return null
  const r =
    payload.resolvedProductName ??
    payload.resolved_product_name ??
    payload.chosenProductName ??
    payload.generatedProductName ??
    payload.autoProductName
  if (r != null) {
    if (typeof r === 'string') {
      const t = r.trim()
      return t || null
    }
    const n = r.name ?? r.productName ?? ''
    if (typeof n === 'string' && n.trim()) return n.trim()
  }
  const pn = payload.productName
  if (typeof pn === 'string' && pn.trim()) return pn.trim()
  return null
}

/**
 * When the user left Product Name empty, show the first backend-resolved name only.
 * Later poll/done payloads with a different string are ignored (no variant overwrite).
 */
function tryApplyResolvedProductName(
  payload,
  userLeftProductNameEmpty,
  lockedResolvedNameRef,
  fillingResolvedNameRef,
  setFormData,
  setIsProductNameAuto,
  setCanonicalResolvedProductName
) {
  if (!userLeftProductNameEmpty) return
  const name = extractResolvedProductName(payload)
  if (!name) return
  if (lockedResolvedNameRef.current !== null) {
    if (name !== lockedResolvedNameRef.current) return
    return
  }
  lockedResolvedNameRef.current = name
  fillingResolvedNameRef.current = true
  console.log('VIDEO_UI_PRODUCT_NAME_RESOLVED value=' + JSON.stringify(name))
  setCanonicalResolvedProductName(name)
  setFormData(prev => ({ ...prev, productName: name }))
  setIsProductNameAuto(true)
}

function Builder2Page() {
  const [state, setState] = useState(STATE.IDLE)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: ''
  })
  const [isProductNameAuto, setIsProductNameAuto] = useState(false)
  /** Canonical backend string for bold Product Name area — independent of isProductNameAuto timing/races */
  const [canonicalResolvedProductName, setCanonicalResolvedProductName] = useState(null)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const requestInFlightRef = useRef(false)
  const pollAbortRef = useRef(false)
  const lockedResolvedNameRef = useRef(null)
  const fillingResolvedNameRef = useRef(false)

  useEffect(() => {
    pollAbortRef.current = false
    return () => {
      pollAbortRef.current = true
    }
  }, [])

  const handleSubmit = async (data) => {
    console.log('BUILDER2_PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('BUILDER2_PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    if (requestInFlightRef.current || hasGenerated) {
      return
    }

    const userLeftProductNameEmpty = !data.productName?.trim()
    setCanonicalResolvedProductName(null)
    if (userLeftProductNameEmpty) {
      lockedResolvedNameRef.current = null
    }

    requestInFlightRef.current = true
    setErrorMessage(null)
    setState(STATE.GENERATING)
    setProgressKey(prev => prev + 1)
    setProgressActive(true)
    setShowProgressBar(true)

    const finish = () => {
      setProgressActive(false)
      requestInFlightRef.current = false
    }

    try {
      const start = await generateVideo({
        productName: data.productName,
        productDescription: data.productDescription
      })

      const jobId = start?.jobId ?? start?.job_id
      if (!start?.ok || !jobId) {
        setErrorMessage(
          start?.error ||
            start?.message ||
            'Could not start video generation. Please try again.'
        )
        setState(STATE.IDLE)
        finish()
        return
      }

      tryApplyResolvedProductName(
        start,
        userLeftProductNameEmpty,
        lockedResolvedNameRef,
        fillingResolvedNameRef,
        setFormData,
        setIsProductNameAuto,
        setCanonicalResolvedProductName
      )

      while (!pollAbortRef.current) {
        const st = await fetchVideoStatus(jobId)
        const status = normalizeStatus(st)

        if (status === 'running') {
          tryApplyResolvedProductName(
            st,
            userLeftProductNameEmpty,
            lockedResolvedNameRef,
            fillingResolvedNameRef,
            setFormData,
            setIsProductNameAuto,
            setCanonicalResolvedProductName
          )
        }

        if (status === 'done') {
          tryApplyResolvedProductName(
            st,
            userLeftProductNameEmpty,
            lockedResolvedNameRef,
            fillingResolvedNameRef,
            setFormData,
            setIsProductNameAuto,
            setCanonicalResolvedProductName
          )
          setResult(
            buildVideoResult({
              ok: true,
              videoUrl: st.videoUrl ?? st.video_url,
              marketingText: st.marketingText ?? st.marketing_text,
              headline: st.headline,
              sessionId: st.sessionId ?? st.session_id
            })
          )
          setHasGenerated(true)
          setState(STATE.SUCCESS)
          finish()
          return
        }

        if (status === 'error') {
          const errMsg =
            typeof st.error === 'string'
              ? st.error
              : st.error?.message || st.message || 'Video generation failed'
          setErrorMessage(errMsg)
          setState(STATE.IDLE)
          finish()
          return
        }

        if (status !== 'running') {
          setErrorMessage('Unexpected response from server. Please try again.')
          setState(STATE.IDLE)
          finish()
          return
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      }

      finish()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
      setState(STATE.IDLE)
      finish()
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
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      return
    }
    lockedResolvedNameRef.current = null
    setHasGenerated(false)
    setResult(null)
    setErrorMessage(null)
    setIsProductNameAuto(false)
    setCanonicalResolvedProductName(null)
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
        isProductNameAuto={isProductNameAuto}
        boldResolvedProductName={canonicalResolvedProductName}
        onProductNameEdited={() => {
          lockedResolvedNameRef.current = null
          setIsProductNameAuto(false)
          setCanonicalResolvedProductName(null)
        }}
      />

      {errorMessage && (
        <ErrorPanel
          error={errorMessage}
          onRetry={() => setErrorMessage(null)}
          buttonLabel="Dismiss"
          title="Generation failed"
        />
      )}

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
