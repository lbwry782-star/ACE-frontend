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
const BUILDER2_MAX_VIDEOS_SESSION_KEY = 'ace_builder2_max_videos'
const DEFAULT_BUILDER2_SESSION_LIMIT = 2

function resolveBuilder2SessionLimit() {
  try {
    const raw = sessionStorage.getItem(BUILDER2_MAX_VIDEOS_SESSION_KEY)
    const n = Number(raw)
    if (n === 2 || n === 3 || n === 4) return n
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_BUILDER2_SESSION_LIMIT
}

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
      headlineText: apiData.headlineText ?? apiData.headline_text ?? null,
      overlayHeadline: apiData.overlayHeadline ?? apiData.overlay_headline ?? null,
      productNameResolved:
        apiData.productNameResolved ??
        apiData.product_name_resolved ??
        apiData.resolvedProductName ??
        apiData.resolved_product_name ??
        null,
      sessionId: apiData.sessionId ?? apiData.session_id ?? null
    }
  }
  return {
    videoUrl: PLACEHOLDER_VIDEO,
    marketingText: generateMarketingText(1),
    headline: 'Video result (placeholder)',
    headlineText: null,
    overlayHeadline: null,
    productNameResolved: null,
    sessionId: null
  }
}

function buildDemoVideoResult(attemptNumber) {
  return {
    videoUrl: PLACEHOLDER_VIDEO,
    marketingText: generateMarketingText(attemptNumber),
    headline: `Video result (demo ${attemptNumber})`,
    sessionId: null
  }
}

function normalizeStatus(st) {
  return String(st?.status ?? '').toLowerCase()
}

/** Video job interrupted (e.g. worker shutdown); may be nested under infrastructure_interruption */
function getInterruptCode(st) {
  if (!st || typeof st !== 'object') return null
  const nested = st.infrastructure_interruption ?? st.infrastructureInterruption
  const raw =
    st.interrupt_code ??
    st.interruptCode ??
    nested?.interrupt_code ??
    nested?.interruptCode
  return raw != null ? String(raw) : null
}

const INTERRUPT_WORKER_SHUTDOWN = 'interrupted_worker_shutdown'
const MSG_WORKER_SHUTDOWN =
  'The generation was interrupted by a server restart. Please generate again.'

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
    'productNameResolved',
    'product_name_resolved',
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
  console.log('ACE_VIDEO_PRODUCT_NAME_RESOLVED_UI value=' + JSON.stringify(name))
  console.log('ACE_VIDEO_PRODUCT_NAME_AUTOFILL_APPLIED=true')
  setCanonicalResolvedProductName(name)
  setFormData(prev => ({ ...prev, productName: name }))
  setIsProductNameAuto(true)
}

function Builder2Page() {
  const [state, setState] = useState(STATE.IDLE)
  const [sessionLimit, setSessionLimit] = useState(DEFAULT_BUILDER2_SESSION_LIMIT)
  const [results, setResults] = useState([])
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [errorPanelTitle, setErrorPanelTitle] = useState('Generation failed')
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
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const requestInFlightRef = useRef(false)
  /** Monotonic id: incremented on each Generate and on unmount — only the latest run may poll / set UI */
  const activeRunIdRef = useRef(0)
  /** Single job id for the current run (ref only; no stale closures across runs) */
  const activeJobIdRef = useRef(null)
  const lockedResolvedNameRef = useRef(null)
  const fillingResolvedNameRef = useRef(false)

  useEffect(() => {
    setSessionLimit(resolveBuilder2SessionLimit())
  }, [])

  useEffect(() => {
    return () => {
      activeRunIdRef.current += 1
      activeJobIdRef.current = null
      console.log('FRONTEND_CLEAR_PREVIOUS_JOB')
    }
  }, [])

  const generatedCount = results.length

  const handleSubmit = async (data) => {
    console.log('BUILDER2_PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('BUILDER2_PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    console.log('FRONTEND_GENERATE_CLICK')

    if (requestInFlightRef.current || generatedCount >= sessionLimit) {
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
    if (!fieldsLocked) {
      setFieldsLocked(true)
    }
    setIsDemoMode(false)
    setErrorMessage(null)
    setErrorPanelTitle('Generation failed')
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
        const startErr = String(start?.error || start?.message || '').toLowerCase()
        const isLikelyOffline =
          !navigator.onLine ||
          startErr.includes('network') ||
          startErr.includes('failed to fetch') ||
          startErr.includes('fetch')
        if (isLikelyOffline) {
          if (isCurrentRun()) {
            const nextAttempt = generatedCount + 1
            setIsDemoMode(true)
            setResults(prev => [...prev, buildDemoVideoResult(nextAttempt)])
            setState(STATE.SUCCESS)
          }
          finish()
          return
        }
        if (isCurrentRun()) {
          setErrorPanelTitle('Generation failed')
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
            const builtResult =
              buildVideoResult({
                ok: true,
                videoUrl: st.videoUrl ?? st.video_url,
                marketingText: st.marketingText ?? st.marketing_text,
                headline: st.headline,
                sessionId: st.sessionId ?? st.session_id
              })
            setResults(prev => [...prev, builtResult])
            setState(STATE.SUCCESS)
            setIsDemoMode(false)
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
            setErrorPanelTitle('Generation failed')
            setErrorMessage(errMsg)
            setState(STATE.IDLE)
          }
          finish()
          return
        }

        if (status === 'interrupted') {
          const ic = getInterruptCode(st)?.toLowerCase() ?? ''
          if (isCurrentRun()) {
            setErrorPanelTitle('Generation interrupted')
            setErrorMessage(
              ic === INTERRUPT_WORKER_SHUTDOWN
                ? MSG_WORKER_SHUTDOWN
                : 'The generation was interrupted. Please generate again.'
            )
            setState(STATE.IDLE)
          }
          finish()
          return
        }

        if (status !== 'running') {
          if (isCurrentRun()) {
            setErrorPanelTitle('Generation failed')
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
        setErrorPanelTitle('Generation failed')
        setErrorMessage('Something went wrong. Please try again.')
        setState(STATE.IDLE)
      }
      finish()
    }
  }

  const handleProgressComplete = useCallback(() => {}, [])

  const getButtonText = () => {
    if (generatedCount >= sessionLimit) return 'CONSUMED'
    if (generatedCount === 0) return 'GENERATE'
    return 'GENERATE AGAIN'
  }

  const isButtonDisabled = () => {
    return state === STATE.GENERATING || generatedCount >= sessionLimit
  }

  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      return
    }
    lockedResolvedNameRef.current = null
    setResults([])
    setIsDemoMode(false)
    setErrorMessage(null)
    setErrorPanelTitle('Generation failed')
    setIsProductNameAuto(false)
    setCanonicalResolvedProductName(null)
    setFieldsLocked(false)
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
        progressDurationMs={300000}
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
          onRetry={() => {
            setErrorMessage(null)
            setErrorPanelTitle('Generation failed')
          }}
          buttonLabel="Dismiss"
          title={errorPanelTitle}
        />
      )}

      {results.length > 0 && (
        <div className="builder-results">
          {isDemoMode && (
            <div className="demo-mode-notice">
              Backend unavailable — using demo mode.
            </div>
          )}
          <h2 className="results-title">Results</h2>
          {results.map((result, idx) => (
            <VideoAdCard
              key={idx}
              attemptNumber={idx + 1}
              videoSrc={result.videoUrl}
              marketingText={result.marketingText}
              headline={result.headline}
              headlineText={result.headlineText}
              overlayHeadline={result.overlayHeadline}
              productNameResolved={result.productNameResolved}
              sessionId={result.sessionId}
              isGenerating={state === STATE.GENERATING}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Builder2Page
