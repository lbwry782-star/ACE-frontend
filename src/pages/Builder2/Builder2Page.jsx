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

/** Video API: resolved name may appear at top level, under result/data, or as productName echo. */
function extractResolvedProductName(payload) {
  if (!payload || typeof payload !== 'object') return null

  const tryString = (v) => {
    if (v == null) return null
    if (typeof v === 'string') {
      const t = v.trim()
      return t || null
    }
    if (typeof v === 'object') {
      const n = v.name ?? v.productName ?? v.value
      if (typeof n === 'string' && n.trim()) return n.trim()
    }
    return null
  }

  const flatKeys = [
    'resolvedProductName',
    'resolved_product_name',
    'resolvedName',
    'chosenProductName',
    'generatedProductName',
    'autoProductName',
    'backendProductName',
    'canonicalProductName'
  ]
  for (const k of flatKeys) {
    const s = tryString(payload[k])
    if (s) return s
  }

  const nested = [
    payload.result,
    payload.data,
    payload.job,
    payload.metadata,
    payload.video,
    payload.response
  ]
  for (const obj of nested) {
    if (!obj || typeof obj !== 'object') continue
    for (const k of flatKeys) {
      const s = tryString(obj[k])
      if (s) return s
    }
    const s = tryString(obj.productName)
    if (s) return s
  }

  return tryString(payload.productName)
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
    /* Re-affirm UI state on later polls so canonical/bold cannot drop after first paint */
    setCanonicalResolvedProductName(lockedResolvedNameRef.current)
    setFormData(prev => ({ ...prev, productName: lockedResolvedNameRef.current }))
    setIsProductNameAuto(true)
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
  /** Monotonic id: incremented on each Generate and on unmount — only the latest run may poll / set UI */
  const activeRunIdRef = useRef(0)
  /** Single job id for the current run (ref only; no stale closures across runs) */
  const activeJobIdRef = useRef(null)
  const lockedResolvedNameRef = useRef(null)
  const fillingResolvedNameRef = useRef(false)

  useEffect(() => {
    return () => {
      activeRunIdRef.current += 1
      activeJobIdRef.current = null
      console.log('FRONTEND_CLEAR_PREVIOUS_JOB')
    }
  }, [])

  const handleSubmit = async (data) => {
    console.log('BUILDER2_PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('BUILDER2_PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    console.log('FRONTEND_GENERATE_CLICK')

    if (requestInFlightRef.current || hasGenerated) {
      return
    }

    const runId = ++activeRunIdRef.current
    activeJobIdRef.current = null
    console.log('FRONTEND_CLEAR_PREVIOUS_JOB')

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

    const isCurrentRun = () => activeRunIdRef.current === runId

    const finish = () => {
      if (!isCurrentRun()) return
      setProgressActive(false)
      requestInFlightRef.current = false
    }

    try {
      const start = await generateVideo({
        productName: data.productName,
        productDescription: data.productDescription
      })

      if (!isCurrentRun()) {
        finish()
        return
      }

      const rawJobId = start?.jobId ?? start?.job_id
      const jobId = rawJobId != null && String(rawJobId).trim() ? String(rawJobId).trim() : null

      if (!start?.ok || !jobId) {
        if (isCurrentRun()) {
          setErrorMessage(
            start?.error ||
              start?.message ||
              'Could not start video generation. Please try again.'
          )
          setState(STATE.IDLE)
        }
        finish()
        return
      }

      console.log('FRONTEND_JOB_CREATED jobId=' + jobId)
      activeJobIdRef.current = jobId
      console.log('FRONTEND_SET_ACTIVE_JOB jobId=' + jobId)

      tryApplyResolvedProductName(
        start,
        userLeftProductNameEmpty,
        lockedResolvedNameRef,
        fillingResolvedNameRef,
        setFormData,
        setIsProductNameAuto,
        setCanonicalResolvedProductName
      )

      while (isCurrentRun()) {
        const pollJobId = activeJobIdRef.current
        if (!pollJobId || pollJobId !== jobId) {
          break
        }

        console.log('FRONTEND_POLLING_JOB jobId=' + pollJobId)
        const st = await fetchVideoStatus(pollJobId)

        if (!isCurrentRun()) {
          break
        }

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
          if (isCurrentRun()) {
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
          }
          finish()
          return
        }

        if (status === 'error') {
          const errMsg =
            typeof st.error === 'string'
              ? st.error
              : st.error?.message || st.message || 'Video generation failed'
          if (isCurrentRun()) {
            setErrorMessage(errMsg)
            setState(STATE.IDLE)
          }
          finish()
          return
        }

        if (status !== 'running') {
          if (isCurrentRun()) {
            setErrorMessage('Unexpected response from server. Please try again.')
            setState(STATE.IDLE)
          }
          finish()
          return
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      }

      finish()
    } catch {
      if (isCurrentRun()) {
        setErrorMessage('Something went wrong. Please try again.')
        setState(STATE.IDLE)
      }
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
