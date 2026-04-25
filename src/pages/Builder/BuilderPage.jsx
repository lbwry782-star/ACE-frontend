import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductForm from '../../components/Form/ProductForm'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import AdCard from '../../components/AdCard/AdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { SecurityConfigContext } from '../../App'
import { fetchLatestPaid, API_BASE_URL, getLatestPaidPath, NetworkError, ApiError } from '../../services/api'
import { mockGenerate } from '../../utils/mockGeneration'
import './builder.css'

// Backend base + latest-paid path come from api.js (single source; avoids wrong origin / double slash)
// Security enforcement now comes from backend config (SecurityConfigContext), not frontend env.
/** When true: no Preview redirect, no latest-paid gate; `#/builder` (with or without query) loads for testing. Set false to restore paid/sid guard. */
const BUILDER1_ACCESS_GUARD_DISABLED = true

const PREVIEW_REDIRECT_URL = 'https://ace-advertising.agency/#/preview'

const redirectToPreview = () => {
  if (BUILDER1_ACCESS_GUARD_DISABLED) return
  window.location.href = PREVIEW_REDIRECT_URL
}

/** Builder1 only: `#/builder?dev=1` (or `?dev=1` in search) allows direct access without payment; Builder2 unchanged. */
function hasBuilder1DevQueryUnlock() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  if (hash.includes('?')) {
    const query = hash.split('?').slice(1).join('?')
    if (new URLSearchParams(query).get('dev') === '1') return true
  }
  try {
    if (new URLSearchParams(window.location.search || '').get('dev') === '1') return true
  } catch (_) {
    /* ignore */
  }
  return false
}

/** Local/dev only OR `dev=1` query: skip Builder1 access redirects without sid/payment. Production #/builder unchanged. */
function isBuilder1DevAccessBypass() {
  if (BUILDER1_ACCESS_GUARD_DISABLED) return true
  if (typeof window === 'undefined') return false
  if (hasBuilder1DevQueryUnlock()) return true
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return true
  return Boolean(import.meta.env?.DEV)
}
const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  CONSUMED: 'CONSUMED',
  BACKEND_BUSY: 'BACKEND_BUSY'
}

/** Builder1: single successful generation per visit; no multi-ad / Preview tier limits on the client for now. */
const BUILDER1_MAX_GENERATIONS = 1

/** Model-driven headline band alignment (`headlinePlacement` from preview response). */
function normalizeHeadlinePlacement(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim().toLowerCase().replace(/-/g, '_')
  if (s === 'top_left' || s === 'top_center' || s === 'top_right') return s
  return null
}

/** Builder1 → POST /api/builder1-generate `format` (backend: portrait | landscape | square only). */
function normalizeBuilder1FormatForApi(raw) {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x')
  if (!key) return ''

  const map = {
    '1080x1536': 'portrait',
    '1536x1080': 'landscape',
    '1080x1080': 'square',
    vertical: 'portrait',
    horizontal: 'landscape',
    wide: 'landscape',
    portrait: 'portrait',
    landscape: 'landscape',
    square: 'square',
    // ProductForm select values (same aspect intent)
    '1024x1536': 'portrait',
    '1536x1024': 'landscape',
    '1024x1024': 'square'
  }
  if (map[key] != null) return map[key]

  const m = key.match(/^(\d+)x(\d+)$/)
  if (m) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (w > 0 && h > 0) {
      if (w === h) return 'square'
      if (w < h) return 'portrait'
      return 'landscape'
    }
  }

  return ''
}

function BuilderPage() {
  const navigate = useNavigate()
  const { securityEnabled = true, securityConfigLoaded = false } = useContext(SecurityConfigContext)
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

  useEffect(() => {
    console.log('BuilderPage mounted')
  }, [])

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
    if (BUILDER1_ACCESS_GUARD_DISABLED) {
      let baseHash = window.location.hash
      let sidFromUrl = null
      if (window.location.hash && window.location.hash.includes('?')) {
        const hashParts = window.location.hash.split('?')
        baseHash = hashParts[0]
        const hashParams = new URLSearchParams(hashParts[1])
        sidFromUrl = hashParams.get('sid')
        if (sidFromUrl) {
          sidRef.current = sidFromUrl
          window.history.replaceState(null, '', baseHash)
        }
      }
      if (!sidFromUrl && window.location.search) {
        const searchParams = new URLSearchParams(window.location.search)
        sidFromUrl = searchParams.get('sid')
        if (sidFromUrl) {
          sidRef.current = sidFromUrl
          const clean = window.location.pathname + (window.location.hash || '#/builder')
          window.history.replaceState(null, '', clean)
        }
      }
      bootstrapCompleteRef.current = true
      fromPaymentCheckDoneRef.current = true
      return
    }

    const devBypass = isBuilder1DevAccessBypass()
    console.log('[BUILDER1_GUARD_TRACE] tick', {
      securityEnabled,
      securityConfigLoaded,
      sidRef: sidRef.current,
      bootstrapComplete: bootstrapCompleteRef.current,
      fromPaymentCheckDone: fromPaymentCheckDoneRef.current,
      locationHash: typeof window !== 'undefined' ? window.location.hash : '',
      locationSearch: typeof window !== 'undefined' ? window.location.search : '',
      devBypass
    })
    if (!securityConfigLoaded) {
      console.log('[BUILDER1_GUARD_TRACE] exit branch: securityConfigLoaded false (no redirect)')
      return
    }
    if (!securityEnabled) {
      console.log('[BUILDER1_GUARD_TRACE] exit branch: securityEnabled false (allow builder, no redirect)')
      bootstrapCompleteRef.current = true
      return
    }
    // Prevent re-entry if bootstrap already completed
    if (bootstrapCompleteRef.current) {
      console.log('[BUILDER1_GUARD_TRACE] exit branch: bootstrap already complete')
      return
    }

    // Prevent re-entry if fromPayment check already done
    if (fromPaymentCheckDoneRef.current) {
      console.log('[BUILDER1_GUARD_TRACE] exit branch: fromPayment check already done')
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
      console.log('[BUILDER1_GUARD_TRACE] exit branch: sid in runtime', { sid: sidRef.current })
      bootstrapCompleteRef.current = true // Mark bootstrap as complete
      return
    }

    console.log('[BUILDER1_GUARD_TRACE] parsed url', {
      sidFromUrl,
      fromPayment,
      baseHash
    })

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
          if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
            console.log('[BUILDER1_GUARD_TRACE] REDIRECT_TO_PREVIEW', {
              reason: 'performOneShotCheck_try: latest-paid not paid and not fromPayment cleanup; devBypass false',
              willCallRedirectToPreview: true,
              latestPaid: data,
              securityEnabled,
              securityConfigLoaded,
              sidRef: sidRef.current,
              fromPaymentFlag: fromPayment
            })
            redirectToPreview()
          } else {
            bootstrapCompleteRef.current = true
          }
          return
        } catch (error) {
          if (fromPayment === '1' || fromPayment === true) {
            bootstrapCompleteRef.current = true
            // Remove fromPayment=1 from URL so refresh will redirect to Preview (one-time marker)
            const cleanUrl = window.location.search ? window.location.pathname + baseHash : baseHash
            window.history.replaceState(null, '', cleanUrl)
            return
          }
          if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
            console.log('[BUILDER1_GUARD_TRACE] REDIRECT_TO_PREVIEW', {
              reason: 'performOneShotCheck_catch: fetchLatestPaid error; devBypass false',
              willCallRedirectToPreview: true,
              error: String(error?.message ?? error),
              securityEnabled,
              securityConfigLoaded,
              sidRef: sidRef.current,
              fromPaymentFlag: fromPayment
            })
            redirectToPreview()
          } else {
            bootstrapCompleteRef.current = true
          }
          return
        }
      }
      
      // Execute the one-shot check
      performOneShotCheck()
    } else {
      // No fromPayment=1 -> Refresh/Tab/Incognito without sid in runtime -> redirect to Preview
      if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
        console.log('[BUILDER1_GUARD_TRACE] REDIRECT_TO_PREVIEW', {
          reason: 'sync_else: no sid, no fromPayment=1, devBypass false',
          willCallRedirectToPreview: true,
          securityEnabled,
          securityConfigLoaded,
          sidRef: sidRef.current,
          fromPaymentFlag: fromPayment
        })
        redirectToPreview()
      } else {
        bootstrapCompleteRef.current = true
      }
      return
    }
  }, [securityEnabled, securityConfigLoaded])

  const handleSubmit = async (data) => {
    console.log('PRODUCT_NAME_AT_SUBMIT="' + (data.productName ?? '') + '"')
    console.log('PRODUCT_DESCRIPTION_AT_SUBMIT="' + (data.productDescription ?? '') + '"')
    // Only one generate/preview request at a time (debounce / double-click protection)
    if (requestInFlightRef.current) {
      return
    }
    if (generationCount >= BUILDER1_MAX_GENERATIONS) {
      return
    }

    if (!BUILDER1_ACCESS_GUARD_DISABLED && !securityConfigLoaded) {
      console.log('[BUILDER1_GUARD_TRACE] handleSubmit early exit: securityConfigLoaded false')
      return
    }

    if (!BUILDER1_ACCESS_GUARD_DISABLED && securityEnabled && !sidRef.current) {
      // One-shot latest-paid may still be in flight (fromPayment=1 just set); don't redirect yet or we break lawful entry
      if (fromPaymentCheckDoneRef.current) {
        return
      }
      if (!BUILDER1_ACCESS_GUARD_DISABLED && !isBuilder1DevAccessBypass()) {
        console.log('[BUILDER1_GUARD_TRACE] REDIRECT_TO_PREVIEW', {
          reason: 'handleSubmit: securityEnabled and no sid, devBypass false',
          willCallRedirectToPreview: true,
          securityEnabled,
          securityConfigLoaded,
          sidRef: sidRef.current,
          fromPaymentCheckDone: fromPaymentCheckDoneRef.current,
          locationHash: window.location.hash,
          locationSearch: window.location.search
        })
        redirectToPreview()
        return
      }
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
      // If user left Product Name empty, fill it when backend sends productNameResolved (without resetting progress)
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

      const requestBody = {
        productName: data.productName ?? '',
        productDescription: data.productDescription ?? '',
        format: normalizeBuilder1FormatForApi(data.imageSize)
      }

      let response
      try {
        response = await fetch(`${API_BASE_URL}/api/builder1-generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(requestBody)
        })
      } catch (fetchErr) {
        if (
          fetchErr instanceof TypeError ||
          (fetchErr?.message && (
            String(fetchErr.message).includes('fetch') ||
            String(fetchErr.message).includes('Network') ||
            String(fetchErr.message).includes('Failed to fetch')
          )) ||
          fetchErr?.name === 'NetworkError'
        ) {
          throw new NetworkError('Network error: Unable to connect to server')
        }
        throw fetchErr
      }

      const previewResponse = await response.json().catch(() => null)
      if (!response.ok) {
        const msg = previewResponse?.message ?? previewResponse?.error
        const errStr = typeof msg === 'string' ? msg : (msg?.message ?? `Server error: ${response.status}`)
        const errLower = String(errStr).toLowerCase()
        if (response.status === 409 && errLower.includes('busy')) {
          throw new ApiError(errStr || 'Generation in progress', { code: 'BUSY', status: 409 })
        }
        if (response.status === 429 || errLower.includes('rate_limited') || errLower.includes('rate limited')) {
          throw new ApiError(errStr || 'Too many requests', { code: 'RATE_LIMITED', status: response.status })
        }
        throw new Error(errStr || `Server error: ${response.status}`)
      }

      if (!previewResponse || typeof previewResponse !== 'object') {
        throw new Error('Error creating ad')
      }

      if (previewResponse.ok === false) {
        const failMsg = previewResponse.message ?? previewResponse.error
        const errStr = typeof failMsg === 'string' ? failMsg : (failMsg?.message ?? 'Error creating ad')
        throw new Error(errStr)
      }

      if (previewResponse.ok !== true) {
        throw new Error('Error creating ad')
      }

      const resolvedFromGenerate =
        previewResponse.productNameResolved ??
        previewResponse.resolvedProductName ??
        previewResponse.resolved_product_name
      if (resolvedFromGenerate) {
        const resolvedStr = typeof resolvedFromGenerate === 'string'
          ? resolvedFromGenerate
          : (resolvedFromGenerate?.name ?? resolvedFromGenerate?.productName ?? '')
        console.log('BACKEND_RESOLVED_PRODUCT_NAME="' + String(resolvedStr).replace(/"/g, '\\"') + '"')
      }
      applyResolvedProductName(resolvedFromGenerate)

      // Success - clear demo mode if it was set
      setIsDemoMode(false)

      const realSessionId =
        previewResponse.sessionId ?? previewResponse.session_id ?? previewResponse.sid ?? null
      if (realSessionId) {
        localStorage.setItem('ace_session_id', realSessionId)
        setSessionId(realSessionId)
      } else {
        setSessionId(null)
      }

      // Stop progress immediately after receiving response
      setProgressActive(false)

      console.log('FULL_RESPONSE', previewResponse)

      // imageBase64 from Builder1 generate — display as PNG data URL
      let imageDataURL = null
      if (previewResponse.image_base64) {
        imageDataURL = `data:image/png;base64,${previewResponse.image_base64}`
      } else if (previewResponse.image_url) {
        imageDataURL = previewResponse.image_url
      } else if (previewResponse.imageBase64) {
        imageDataURL = `data:image/png;base64,${previewResponse.imageBase64}`
      } else if (previewResponse.imageDataURL) {
        imageDataURL = previewResponse.imageDataURL
      } else if (previewResponse.imageDataUrl) {
        imageDataURL = previewResponse.imageDataUrl
      }

      if (!imageDataURL) {
        throw new Error('Error creating ad')
      }

      const marketingText = previewResponse.marketingText ?? previewResponse.marketing_text ?? previewResponse.body_text ?? ''
      const headline = previewResponse.headline ?? previewResponse.Headline ?? ''
      const headlinePlacement = normalizeHeadlinePlacement(
        previewResponse.headlinePlacement ?? previewResponse.headline_placement
      )
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
        image_base64: previewResponse.image_base64 ?? previewResponse.imageBase64,
        image_url: previewResponse.image_url,
        marketingText: marketingText,
        headline,
        ...(headlinePlacement != null && { headlinePlacement }),
        modeDecision,
        previewId: previewResponse.previewId,
        formData: data,
        sessionId: realSessionId,
        ...(isTextOnly && {
          previewType: 'text_only'
        })
      }
      setAds([newAd])
      setGenerationCount(BUILDER1_MAX_GENERATIONS)

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
          setAds([newAd])
          setGenerationCount(BUILDER1_MAX_GENERATIONS)
          
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
    }
    return 'CONSUMED'
  }

  const isButtonDisabled = () => {
    return (
      state === STATE.GENERATING ||
      state === STATE.BACKEND_BUSY ||
      generationCount >= BUILDER1_MAX_GENERATIONS
    )
  }

  // Reset generation count when product name or description changes (new session); skip when we filled name during generation
  useEffect(() => {
    if (fillingResolvedNameRef.current) {
      fillingResolvedNameRef.current = false
      console.log('PROGRESS_NOT_RESET_ON_NAME_FILL')
      return
    }
    setGenerationCount(0)
    setAds([])
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
            const imageDataURLForCard =
              ad.imageDataURL ??
              (ad.image_base64
                ? `data:image/png;base64,${ad.image_base64}`
                : ad.image_url || null)
            return (
              <div key={index}>
                <AdCard
                  attemptNumber={ad.attemptNumber}
                  imageDataURL={imageDataURLForCard}
                  marketingText={ad.marketingText}
                  headline={ad.headline}
                  headlinePlacement={ad.headlinePlacement}
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

