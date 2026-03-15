import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductForm from '../../components/Form/ProductForm'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import AdCard from '../../components/AdCard/AdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { SecurityConfigContext } from '../../App'
import { startPreview, getJobStatus, generate, fetchLatestPaid, API_BASE_URL, getLatestPaidPath, NetworkError, ApiError } from '../../services/api'
import { mockGenerate } from '../../utils/mockGeneration'
import './builder.css'

// Backend base + latest-paid path come from api.js (single source; avoids wrong origin / double slash)
// Security enforcement now comes from backend config (SecurityConfigContext), not frontend env.
const PREVIEW_REDIRECT_URL = 'https://ace-advertising.agency/'

const redirectToPreview = () => {
  window.location.href = PREVIEW_REDIRECT_URL
}
const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  CONSUMED: 'CONSUMED',
  BACKEND_BUSY: 'BACKEND_BUSY'
}

function BuilderPage() {
  const navigate = useNavigate()
  const { securityEnabled = true } = useContext(SecurityConfigContext)
  const [state, setState] = useState(STATE.IDLE)
  const [generationCount, setGenerationCount] = useState(0)
  const [ads, setAds] = useState([]) // Array of ad objects: { imageSize, attemptNumber }
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    imageSize: ''
  })
  const [isProductNameAuto, setIsProductNameAuto] = useState(false)
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [error, setError] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [batchState, setBatchState] = useState(null)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const [sessionId, setSessionId] = useState(null) // Backend session for download-zip (from preview or sessionSeed)
  const generationStartTimeRef = useRef(null)
  const sidRef = useRef(null) // Store sid ONLY in runtime memory
  const bootstrapCompleteRef = useRef(false) // Flag: prevent re-entry after successful bootstrap
  const fromPaymentCheckDoneRef = useRef(false) // Flag: ensure one-shot check runs exactly once
  const sessionSeedRef = useRef(null) // Store session seed for preventing repetition between sessions
  const requestInFlightRef = useRef(false) // Only one generate/preview request at a time
  const fillingResolvedNameRef = useRef(false) // Skip generation-count reset when we fill product name during generation

  // Initialize session seed once on component mount
  useEffect(() => {
    // Get or create session seed from sessionStorage
    let sessionSeed = sessionStorage.getItem('ace_session_seed')
    if (!sessionSeed) {
      // Create new session seed if not exists
      sessionSeed = crypto.randomUUID()
      sessionStorage.setItem('ace_session_seed', sessionSeed)
    }
    sessionSeedRef.current = sessionSeed
  }, [])

  // Restore backend sessionId from localStorage so Download ZIP works after refresh
  useEffect(() => {
    const stored = localStorage.getItem('ace_session_id')
    if (stored) setSessionId(stored)
  }, [])

  // Route guard: allow Builder only for immediate post-payment (sid in URL or fromPayment=1 + latest-paid). All other access redirects. Depends on backend security config.
  useEffect(() => {
    if (!securityEnabled) {
      bootstrapCompleteRef.current = true
      return
    }
    // Prevent re-entry if bootstrap already completed
    if (bootstrapCompleteRef.current) {
      return
    }

    // Prevent re-entry if fromPayment check already done
    if (fromPaymentCheckDoneRef.current) {
      return
    }

    // Step 1: Parse URL hash query parameters (synchronously, before async)
    // Payment gateways often append params to search (?fromPayment=1) not inside hash (#/builder?...), so read both.
    let baseHash = window.location.hash
    let sidFromUrl = null
    let fromPayment = false

    if (window.location.hash && window.location.hash.includes('?')) {
      const hashParts = window.location.hash.split('?')
      baseHash = hashParts[0]  // e.g., "#/builder"
      const hashQuery = hashParts[1]  // e.g., "sid=XXXX" or "fromPayment=1"
      
      // Parse query parameters
      const hashParams = new URLSearchParams(hashQuery)
      sidFromUrl = hashParams.get('sid')
      fromPayment = hashParams.get('fromPayment') === '1'
      
      // If sid found in URL - save to runtime and clean URL
      if (sidFromUrl) {
        sidRef.current = sidFromUrl
        bootstrapCompleteRef.current = true // Mark bootstrap as complete
        // Clean URL immediately (remove all query parameters)
        window.history.replaceState(null, '', baseHash)
        return // Early return - no need to continue
      }
    }

    // Step 1b: If hash had no sid/fromPayment, check location.search (e.g. ?fromPayment=1#/builder)
    if (!sidFromUrl && !fromPayment && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search)
      sidFromUrl = searchParams.get('sid')
      fromPayment = searchParams.get('fromPayment') === '1'
      if (sidFromUrl) {
        sidRef.current = sidFromUrl
        bootstrapCompleteRef.current = true
        // Clear search from URL, keep hash only
        const clean = window.location.pathname + (window.location.hash || '#/builder')
        window.history.replaceState(null, '', clean)
        return
      }
    }

    // Step 2: If sid exists in runtime -> allow Builder
    if (sidRef.current) {
      bootstrapCompleteRef.current = true // Mark bootstrap as complete
      return
    }

    // Step 3: No sid in runtime
    // Check if this is return from payment (fromPayment=1) or Refresh/Tab/Incognito
    if (fromPayment) {
      // CRITICAL: Set guard IMMEDIATELY before any async operation to prevent re-runs
      fromPaymentCheckDoneRef.current = true
      
      // ONE-SHOT check: Perform exactly ONE fetch to latest-paid
      const performOneShotCheck = async () => {
        try {
          const data = await fetchLatestPaid()
          // If sid exists and status is paid, save to runtime
          if (data.sid && data.status === 'paid') {
            sidRef.current = data.sid
            bootstrapCompleteRef.current = true // Mark bootstrap as complete - prevent re-entry
            // Clean URL immediately (remove fromPayment from hash and search)
            const cleanUrl = window.location.search
              ? window.location.pathname + baseHash
              : baseHash
            window.history.replaceState(null, '', cleanUrl)
            return // Success - stay on Builder
          }
          // No sid or not paid -> redirect to Preview unless lawful payment return (fromPayment=1)
          if (fromPayment === '1' || fromPayment === true) {
            bootstrapCompleteRef.current = true
            // Remove fromPayment=1 from URL so refresh will redirect to Preview (one-time marker)
            const cleanUrl = window.location.search ? window.location.pathname + baseHash : baseHash
            window.history.replaceState(null, '', cleanUrl)
            return
          }
          redirectToPreview()
          return
        } catch (error) {
          if (fromPayment === '1' || fromPayment === true) {
            bootstrapCompleteRef.current = true
            // Remove fromPayment=1 from URL so refresh will redirect to Preview (one-time marker)
            const cleanUrl = window.location.search ? window.location.pathname + baseHash : baseHash
            window.history.replaceState(null, '', cleanUrl)
            return
          }
          redirectToPreview()
          return
        }
      }
      
      // Execute the one-shot check
      performOneShotCheck()
    } else {
      // No fromPayment=1 -> Refresh/Tab/Incognito without sid in runtime -> redirect to Preview
      redirectToPreview()
      return
    }
  }, [securityEnabled])

  const handleSubmit = async (data) => {
    console.log('PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    // Only one generate/preview request at a time (debounce / double-click protection)
    if (requestInFlightRef.current) {
      return
    }
    // Block if already consumed (3 generations)
    if (generationCount >= 3) {
      return
    }

    if (securityEnabled && !sidRef.current) {
      // One-shot latest-paid may still be in flight (fromPayment=1 just set); don't redirect yet or we break lawful entry
      if (fromPaymentCheckDoneRef.current) {
        return
      }
      redirectToPreview()
      return
    }

    requestInFlightRef.current = true
    const userLeftProductNameEmpty = !data.productName?.trim()
    setIsProductNameAuto(false)
    // Lock fields on first generation
    if (!fieldsLocked) {
      setFieldsLocked(true)
    }

    setState(STATE.GENERATING)
    setError(null)
    setProgressKey(prev => prev + 1) // Reset progress bar
    setProgressActive(true)
    setShowProgressBar(true)
    generationStartTimeRef.current = Date.now()

    try {
      // Start async preview job via /api/preview
      const adIndex = generationCount + 1 // Use 1-based indexing: first ad = 1, second = 2, third = 3
      // Build payload explicitly (exclude fastSession if present)
      const previewPayload = {
        productName: data.productName,
        productDescription: data.productDescription,
        imageSize: data.imageSize,
        adIndex: adIndex,
        batchState: batchState,
        sessionSeed: sessionSeedRef.current
      }
      // Include sid only if security is enabled and sid exists
      if (securityEnabled && sidRef.current) {
        previewPayload.sid = sidRef.current
      }

      const startResponse = await startPreview(previewPayload)
      const jobId = startResponse.jobId ?? startResponse.job_id

      if (!jobId && !startResponse.result) {
        throw new Error('Missing jobId from preview response')
      }

      // If user left Product Name empty, fill it as soon as backend sends resolvedProductName (without resetting progress)
      const applyResolvedProductName = (resolvedName) => {
        if (!userLeftProductNameEmpty || !resolvedName) return
        const name = typeof resolvedName === 'string'
          ? resolvedName
          : (resolvedName?.name ?? resolvedName?.productName ?? '')
        if (!name.trim()) return
        const valueToSet = name.trim()
        console.log('PRODUCT_NAME_SET_SOURCE=backend_resolved value="' + valueToSet.replace(/"/g, '\\"') + '"')
        fillingResolvedNameRef.current = true
        setFormData(prev => ({ ...prev, productName: valueToSet }))
        setIsProductNameAuto(true)
        console.log('PRODUCT_NAME_FIELD_SOURCE=backend_resolved', valueToSet)
        console.log('PRODUCT_NAME_FIELD_UPDATED_DURING_GENERATION')
        console.log('PRODUCT_NAME_FIELD_FILLED_EARLY', valueToSet)
      }

      const initialResolved = startResponse.resolvedProductName ?? startResponse.resolved_product_name
      if (initialResolved) {
        const resolvedStr = typeof initialResolved === 'string' ? initialResolved : (initialResolved?.name ?? initialResolved?.productName ?? '')
        console.log('BACKEND_RESOLVED_PRODUCT_NAME="' + resolvedStr.replace(/"/g, '\\"') + '"')
      }
      if (!initialResolved && startResponse.productName) {
        console.log('PRODUCT_NAME_FIELD_SOURCE=description_derived_BLOCKED', startResponse.productName)
      }
      applyResolvedProductName(initialResolved)

      // If backend already returned result inline, use it; otherwise poll job status
      let previewResponse = startResponse.result || null
      let realSessionId = null // Backend sessionId from job-status (status=done); used for Download ZIP
      const POLL_INTERVAL_MS = 1800
      let productNameFilledFromPoll = false

      while (!previewResponse && jobId) {
        // Poll job status until done/error
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        const jobStatusResponse = await getJobStatus(jobId)
        const status = jobStatusResponse.status || jobStatusResponse.jobStatus || jobStatusResponse.state

        if (!productNameFilledFromPoll) {
          const resolvedFromStatus = jobStatusResponse.resolvedProductName ?? jobStatusResponse.resolved_product_name
          if (resolvedFromStatus) {
            const resolvedStr = typeof resolvedFromStatus === 'string' ? resolvedFromStatus : (resolvedFromStatus?.name ?? resolvedFromStatus?.productName ?? '')
            console.log('BACKEND_RESOLVED_PRODUCT_NAME="' + resolvedStr.replace(/"/g, '\\"') + '"')
          }
          if (!resolvedFromStatus && jobStatusResponse.productName) {
            console.log('PRODUCT_NAME_FIELD_SOURCE=description_derived_BLOCKED', jobStatusResponse.productName)
          }
          if (resolvedFromStatus) {
            applyResolvedProductName(resolvedFromStatus)
            productNameFilledFromPoll = true
          }
        }

        if (!status || status === 'pending' || status === 'running' || status === 'in_progress') {
          // Still running Γאף keep loading UI
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

        // Unknown status Γאף treat as error
        throw new Error('Error creating ad')
      }

      // Success - clear demo mode if it was set
      setIsDemoMode(false)
      // Use backend sessionId only for download-zip (no local/sessionSeed fallback)
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

      // Stop progress immediately after receiving response
      setProgressActive(false)

      console.log('FULL_RESPONSE', previewResponse)

      // Create imageDataURL from response when present (optional in text-only mode)
      let imageDataURL = null
      if (previewResponse.image_base64) {
        imageDataURL = `data:image/png;base64,${previewResponse.image_base64}`
      } else if (previewResponse.image_url) {
        imageDataURL = previewResponse.image_url
      } else if (previewResponse.imageBase64) {
        imageDataURL = `data:image/jpeg;base64,${previewResponse.imageBase64}`
      } else if (previewResponse.imageDataURL) {
        imageDataURL = previewResponse.imageDataURL
      } else if (previewResponse.imageDataUrl) {
        imageDataURL = previewResponse.imageDataUrl
      }

      const marketingText = previewResponse.marketingText || previewResponse.marketing_text || previewResponse.body_text
      const headline = previewResponse.headline ?? previewResponse.Headline ?? ''
      const objectA = previewResponse.objectA ?? previewResponse.object_a ?? ''
      const objectB = previewResponse.objectB ?? previewResponse.object_b ?? ''
      const modeDecision = previewResponse.modeDecision ?? previewResponse.mode_decision ?? null

      // Update batchState if returned
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

      const isTextOnly = !imageDataURL
      const newCount = generationCount + 1
      const newAd = {
        imageSize: data.imageSize,
        attemptNumber: newCount,
        imageDataURL: imageDataURL,
        image_base64: previewResponse.image_base64,
        image_url: previewResponse.image_url,
        marketingText: marketingText,
        previewId: previewResponse.previewId,
        formData: data,
        sessionId: realSessionId,
        ...(isTextOnly && {
          previewType: 'text_only',
          headline,
          objectA,
          objectB,
          modeDecision
        })
      }
      setAds(prev => [...prev, newAd])
      // Limit generationCount to 3 (max generations per session)
      setGenerationCount(prev => Math.min(prev + 1, 3))

      setState(STATE.SUCCESS)
    } catch (err) {
      // Backend busy (409): keep UI locked, show "Generation in progress" and Retry
      if (err instanceof ApiError && err.code === 'BUSY') {
        setState(STATE.BACKEND_BUSY)
        setError('Generation in progress')
        setProgressActive(false)
        return
      }
      // Rate limited: friendly message and Retry button
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setError('Too many requests. Please wait a moment and try again.')
        setState(STATE.ERROR)
        setProgressActive(false)
        return
      }
      // Check if it's a network error - use mock generation as fallback
      if (err instanceof NetworkError || err.isNetworkError) {
        setIsDemoMode(true)
        
        // Use mock generation with timing (30-150 seconds)
        const generationTime = Math.random() * 120000 + 30000
        
        try {
          await mockGenerate(data, generationTime)
          
          // Mock generation succeeded - add ad (placeholder text for display)
          setSessionId(sessionSeedRef.current ?? null)
          const newCount = generationCount + 1
          const newAd = {
            imageSize: data.imageSize,
            attemptNumber: newCount,
            marketingText: 'Demo ad body. This is placeholder text for the 50-word marketing copy when the backend is unavailable.',
            headline: `Ad ${newCount} (demo)`
          }
          setAds(prev => [...prev, newAd])
          // Limit generationCount to 3 (max generations per session)
          setGenerationCount(prev => Math.min(prev + 1, 3))
          
          // Stop progress bar - it will accelerate to 100% if needed
          setProgressActive(false)

          setState(STATE.SUCCESS)
        } catch (mockErr) {
          // Even mock failed (shouldn't happen, but handle it)
          setError(mockErr.message || 'Error creating ad')
          setState(STATE.ERROR)
          setProgressActive(false)
        }
      } else {
        // Non-network error - show error panel
        setError(err.message || 'Error creating ad')
        setState(STATE.ERROR)
        setProgressActive(false)
      }
    } finally {
      requestInFlightRef.current = false
    }
  }

  const handleProgressComplete = useCallback(() => {
    // Progress bar reached 100%, but generation might still be running
    // Progress bar will stay at 100% until generation finishes
  }, [])

  const handleRetry = () => {
    handleSubmit(formData)
  }

  const getButtonText = () => {
    if (generationCount === 0) {
      return 'GENERATE'
    } else if (generationCount < 3) {
      return 'GENERATE AGAIN'
    } else {
      return 'CONSUMED'
    }
  }

  const isButtonDisabled = () => {
    // Button is disabled during generation, when backend is busy, or after 3 generations
    return state === STATE.GENERATING || state === STATE.BACKEND_BUSY || generationCount >= 3
  }

  // Reset generation count when product name or description changes (new session); skip when we filled name during generation
  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      console.log('PROGRESS_NOT_RESET_ON_NAME_FILL')
      return
    }
    setGenerationCount(0)
  }, [formData.productName, formData.productDescription])

  return (
    <div className="builder-page">
      <h1 className="builder-title">Ad Builder</h1>

      <ProductForm
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
              Backend unavailable Γאפ using demo mode.
            </div>
          )}
          <h2 className="results-title">Results</h2>
          {ads.map((ad, index) => {
            const response = ad
            console.log('FULL_RESPONSE', response)
            const imageSrc =
              response?.image_base64
                ? `data:image/png;base64,${response.image_base64}`
                : response?.image_url || null
            return (
              <div key={index}>
                {imageSrc && (
                  <img
                    src={imageSrc}
                    alt="Generated Ad"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}
                  />
                )}
                <AdCard
                  attemptNumber={ad.attemptNumber}
                  imageDataURL={null}
                  marketingText={ad.marketingText}
                  headline={ad.headline}
                  sessionId={ad.sessionId ?? sessionId}
                  isGenerating={state === STATE.GENERATING}
                />
              </div>
            )
          })}
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

export default BuilderPage

