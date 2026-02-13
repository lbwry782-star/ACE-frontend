import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductForm from '../../components/Form/ProductForm'
import ProgressBar from '../../components/ProgressBar/ProgressBar'
import AdCard from '../../components/AdCard/AdCard'
import ErrorPanel from '../../components/Error/ErrorPanel'
import { preview, generate, NetworkError } from '../../services/api'
import { mockGenerate } from '../../utils/mockGeneration'
import './builder.css'

// Get backend URL (same logic as api.js)
const getBackendUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }
  if (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL
  }
  return 'https://ace-backend-k1p6.onrender.com'
}

const API_BASE_URL = getBackendUrl()

// Feature flag: Payment/security guard is disabled - Builder is now publicly accessible
// Set to true to re-enable payment checks (ICount integration)
const PAYWALL_ENABLED = false

const STATE = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  CONSUMED: 'CONSUMED'
}

function BuilderPage() {
  const navigate = useNavigate()
  const [state, setState] = useState(STATE.IDLE)
  const [generationCount, setGenerationCount] = useState(0)
  const [ads, setAds] = useState([]) // Array of ad objects: { imageSize, attemptNumber }
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    imageSize: ''
  })
  const [fieldsLocked, setFieldsLocked] = useState(false)
  const [error, setError] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [batchState, setBatchState] = useState(null)
  const [progressActive, setProgressActive] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [showProgressBar, setShowProgressBar] = useState(false)
  const generationStartTimeRef = useRef(null)
  const sidRef = useRef(null) // Store sid ONLY in runtime memory
  const bootstrapCompleteRef = useRef(false) // Flag: prevent re-entry after successful bootstrap
  const fromPaymentCheckDoneRef = useRef(false) // Flag: ensure one-shot check runs exactly once

  // Route guard: Read sid from URL and enforce session rules
  // NOTE: Payment guard is currently disabled (PAYWALL_ENABLED=false)
  // Builder is intentionally public - payments/ICount integration is ignored for now
  useEffect(() => {
    // PAYWALL DISABLED: Builder is publicly accessible - skip all payment/guard logic
    if (!PAYWALL_ENABLED) {
      bootstrapCompleteRef.current = true
      // No redirects, no checks, no console warnings - builder is open
      return
    }

    // PAYWALL ENABLED: Execute payment guard logic below
    // Prevent re-entry if bootstrap already completed
    if (bootstrapCompleteRef.current) {
      return
    }

    // Prevent re-entry if fromPayment check already done
    if (fromPaymentCheckDoneRef.current) {
      return
    }

    // Step 1: Parse URL hash query parameters (synchronously, before async)
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
        console.log("SID_RECEIVED_FROM_URL", sidFromUrl)
        
        // Clean URL immediately (remove all query parameters)
        window.history.replaceState(null, '', baseHash)
        console.log("URL_CLEANED_SID_REMOVED", { before: window.location.hash, after: baseHash })
        return // Early return - no need to continue
      }
    }

    // Step 2: If sid exists in runtime -> allow Builder
    if (sidRef.current) {
      bootstrapCompleteRef.current = true // Mark bootstrap as complete
      console.log("BUILDER_MOUNTED", window.location.href, window.location.hash, window.location.search)
      return
    }

    // Step 3: No sid in runtime
    // Check if this is return from payment (fromPayment=1) or Refresh/Tab/Incognito
    if (fromPayment) {
      // CRITICAL: Set guard IMMEDIATELY before any async operation to prevent re-runs
      fromPaymentCheckDoneRef.current = true
      console.log("fromPayment=1 detected -> one-shot latest-paid")
      
      // ONE-SHOT check: Perform exactly ONE fetch to latest-paid
      const performOneShotCheck = async () => {
        try {
          // Build absolute URL
          const url = `${API_BASE_URL}/api/entitlement/latest-paid`
          
          // Fetch with explicit CORS options
          const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            credentials: "omit",
            redirect: "manual",
            headers: {
              "Accept": "application/json"
            }
          })

          // Only process if response.ok === true
          if (response.ok) {
            const data = await response.json()
            
            // If sid exists and status is paid, save to runtime
            if (data.sid && data.status === 'paid') {
              sidRef.current = data.sid
              bootstrapCompleteRef.current = true // Mark bootstrap as complete - prevent re-entry
              console.log("latest-paid success -> sid received")
              
              // Clean URL immediately (remove fromPayment and all query parameters)
              window.history.replaceState(null, '', baseHash)
              console.log("BUILDER_MOUNTED", window.location.href, window.location.hash, window.location.search)
              return // Success - stay on Builder
            }
          }
          
          // No sid, non-200, or invalid response -> redirect to Preview immediately
          console.log("latest-paid failed -> redirect preview")
          navigate('/')
        } catch (error) {
          // Network/CORS error -> redirect to Preview immediately
          console.log("latest-paid failed -> redirect preview", error)
          navigate('/')
        }
      }
      
      // Execute the one-shot check
      performOneShotCheck()
    } else {
      // No fromPayment=1 -> this is Refresh/Tab/Incognito -> redirect to Preview
      // NOTE: This code only executes when PAYWALL_ENABLED=true (early return above prevents execution)
      if (PAYWALL_ENABLED) {
        console.log("BUILDER_ACCESS_DENIED_NO_SID_REFRESH", "Redirecting to Preview")
        navigate('/')
      }
      // When PAYWALL_ENABLED=false, no redirect occurs - builder is publicly accessible
    }
  }, []) // Empty deps - effect runs once on mount. Guard is disabled when PAYWALL_ENABLED=false

  const handleSubmit = async (data) => {
    // Before generate: Check sid in runtime memory (only if paywall is enabled)
    // PAYWALL DISABLED: No sid check needed - builder is publicly accessible
    if (PAYWALL_ENABLED && !sidRef.current) {
      console.log("GENERATE_BLOCKED_NO_SID", "Redirecting to Preview")
      navigate('/')
      return
    }

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
      // Try real API call to /api/preview
      const newCount = generationCount + 1
      const adIndex = newCount // Use 1-based indexing: first ad = 1, second = 2, third = 3
      const previewPayload = {
        ...data,
        adIndex: adIndex,
        batchState: batchState
      }
      // Include sid only if paywall is enabled and sid exists
      if (PAYWALL_ENABLED && sidRef.current) {
        previewPayload.sid = sidRef.current
      }
      const previewResponse = await preview(previewPayload)
      
      // Success - clear demo mode if it was set
      setIsDemoMode(false)
      
      // Stop progress immediately after receiving response
      setProgressActive(false)
      
      // Create imageDataURL from response
      // Preview returns JSON with imageBase64 field - convert to data URL
      let imageDataURL
      if (previewResponse.imageBase64) {
        // Use base64 image from response
        imageDataURL = `data:image/jpeg;base64,${previewResponse.imageBase64}`
      } else if (previewResponse.imageDataURL) {
        // Fallback to imageDataURL if provided
        imageDataURL = previewResponse.imageDataURL
      } else if (previewResponse.imageDataUrl) {
        // Fallback to imageDataUrl (camelCase variant)
        imageDataURL = previewResponse.imageDataUrl
      } else {
        throw new Error("Preview response missing image data (expected imageBase64)")
      }
      
      // Set marketingText from response
      const marketingText = previewResponse.marketingText || previewResponse.marketing_text
      
      // Update batchState if returned
      if (previewResponse.batchState) {
        if (typeof previewResponse.batchState === 'string') {
          try {
            const parsed = JSON.parse(previewResponse.batchState)
            setBatchState(parsed)
          } catch (e) {
            // If parsing fails, use as-is
            setBatchState(previewResponse.batchState)
          }
        } else {
          setBatchState(previewResponse.batchState)
        }
      }
      
      // Add new ad to the array with preview data
      const newAd = {
        imageSize: data.imageSize,
        attemptNumber: newCount,
        imageDataURL: imageDataURL,
        marketingText: marketingText,
        previewId: previewResponse.previewId,
        formData: data // Store formData for ZIP download
      }
      setAds(prev => [...prev, newAd])
      setGenerationCount(newCount)

      // Always allow more generations
      setState(STATE.SUCCESS)
    } catch (err) {
      // Check if it's a network error - use mock generation as fallback
      if (err instanceof NetworkError || err.isNetworkError) {
        setIsDemoMode(true)
        
        // Use mock generation with timing (30-150 seconds)
        const generationTime = Math.random() * 120000 + 30000
        
        try {
          await mockGenerate(data, generationTime)
          
          // Mock generation succeeded - add ad
          const newCount = generationCount + 1
          const newAd = {
            imageSize: data.imageSize,
            attemptNumber: newCount
          }
          setAds(prev => [...prev, newAd])
          setGenerationCount(newCount)
          
          // Stop progress bar - it will accelerate to 100% if needed
          setProgressActive(false)

          // Always allow more generations
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
    }
  }

  const handleProgressComplete = () => {
    // Progress bar reached 100%, but generation might still be running
    // Progress bar will stay at 100% until generation finishes
  }

  const handleRetry = () => {
    handleSubmit(formData)
  }

  const getButtonText = () => {
    if (generationCount === 0) {
      return 'GENERATE'
    }
    return 'GENERATE AGAIN'
  }

  const isButtonDisabled = () => {
    // Button is disabled only during generation
    return state === STATE.GENERATING
  }

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
            <AdCard
              key={index}
              imageSize={ad.imageSize}
              attemptNumber={ad.attemptNumber}
              imageDataURL={ad.imageDataURL}
              marketingText={ad.marketingText}
              previewId={ad.previewId}
              batchState={batchState}
              isGenerating={state === STATE.GENERATING}
              sid={sidRef.current}
            />
          ))}
        </div>
      )}

      {state === STATE.ERROR && error && !isDemoMode && (
        <ErrorPanel error={error} onRetry={handleRetry} />
      )}
    </div>
  )
}

export default BuilderPage

