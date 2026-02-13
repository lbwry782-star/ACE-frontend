import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './preview.css'

// Get base URL for assets (respects vite.config.js base path)
const BASE_URL = import.meta.env.BASE_URL
const builderDemoVideo = `${BASE_URL}assets/builder-demo-v3.mp4`
const mobileDemoVideo = `${BASE_URL}assets/mobile-demo.mp4`
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`

// Get backend URL
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

function PreviewPage() {
  const navigate = useNavigate()
  const [consentChecked, setConsentChecked] = useState(false)
  const mobileVideoRef = useRef(null)

  const handleViewDemo = () => {
    navigate('/demo')
  }

  useEffect(() => {
    const v = mobileVideoRef.current
    if (v) {
      v.muted = true
      v.play().catch(() => {
        // Silently ignore autoplay failures
      })
    }
  }, [])

  const generatePaymentSession = () => {
    // Generate UUID v4
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const handleCheckout = async () => {
    // Generate unique payment session ID
    const paymentSession = generatePaymentSession()
    
    // Save to localStorage
    localStorage.setItem('payment_session', paymentSession)
    
    // Create entitlement before redirecting to payment
    try {
      const response = await fetch(`${API_BASE_URL}/api/entitlement/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({})
      })
      
      if (response.ok) {
        console.log("ENTITLEMENT_CREATED", "Entitlement created before payment")
      } else {
        console.warn("ENTITLEMENT_CREATE_FAILED", `Status: ${response.status}`)
      }
    } catch (error) {
      // Allow redirect even if create fails
      console.warn("ENTITLEMENT_CREATE_ERROR", error)
    }
    
    // Build URL with payment_session parameter
    const baseUrl = 'https://app.icount.co.il/m/1f410'
    const url = `${baseUrl}?m__payment_session=${encodeURIComponent(paymentSession)}`
    
    // Redirect to iCount with full URL including query parameter
    window.location.href = url
  }

  return (
    <div className="preview-page">
      <div className="preview-hero">
        <h1 className="preview-title">Welcome to ACE</h1>
        <p className="preview-description">
          Smart ad creation system that produces professional results
        </p>
        <p className="preview-description">
          Fill in the details and get personalized ads in minutes
        </p>
      </div>

      <div className="preview-video-container">
        <video
          className="preview-video preview-video-desktop"
          src={builderDemoVideo}
          width="896"
          height="741"
          autoPlay
          loop
          muted
          controls
        >
          Your browser does not support the video tag.
        </video>
        <video
          ref={mobileVideoRef}
          className="preview-video preview-video-mobile"
          src={mobileDemoVideo}
          autoPlay
          muted
          defaultMuted
          playsInline
          loop
        >
          Your browser does not support the video tag.
        </video>
        <button
          className="preview-demo-button"
          onClick={handleViewDemo}
        >
          VIEW DEMO
        </button>
      </div>

      <div className="preview-consent">
        <div className="consent-row">
          <a
            href={termsPdf}
            target="_blank"
            rel="noreferrer"
            className="terms-link"
          >
            View Terms & Policies
          </a>
          <label className="consent-checkbox-label">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="consent-checkbox"
            />
            <span>I Agree – Terms & Policies</span>
          </label>
        </div>
        <div className="checkout-section">
          <button
            className="checkout-button"
            onClick={handleCheckout}
            disabled={!consentChecked}
          >
            Start Secure Checkout
          </button>
        </div>
      </div>
    </div>
  )
}

export default PreviewPage

