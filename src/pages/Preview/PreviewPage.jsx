import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './preview.css'

// Get base URL for assets (respects vite.config.js base path)
const BASE_URL = import.meta.env.BASE_URL
const builderDemoVideo = `${BASE_URL}assets/builder-demo-v3.mp4`
const mobileDemoVideo = `${BASE_URL}assets/mobile-demo.mp4`
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`

function PreviewPage() {
  const navigate = useNavigate()
  const [consentChecked, setConsentChecked] = useState(false)
  const [showRefreshWarning, setShowRefreshWarning] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)
  const mobileVideoRef = useRef(null)
  const checkoutTimeoutRef = useRef(null)

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

  // Clear navigation delay timeout on unmount to avoid stale timers
  useEffect(() => {
    return () => {
      if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current)
    }
  }, [])

  const ICOUNT_PAYMENT_URL = 'https://app.icount.co.il/m/1f410'

  // Show warning, wait ~3s so it is visible, then redirect to iCount payment (same tab)
  const handleCheckout = () => {
    if (checkoutPending) return
    setCheckoutPending(true)
    setShowRefreshWarning(true)
    if (checkoutTimeoutRef.current) clearTimeout(checkoutTimeoutRef.current)
    checkoutTimeoutRef.current = setTimeout(() => {
      checkoutTimeoutRef.current = null
      // One-time marker so when iCount redirects back to site root we can send user to Builder with fromPayment=1
      sessionStorage.setItem('ace_payment_return_pending', '1')
      window.location.href = ICOUNT_PAYMENT_URL
    }, 3000)
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
            disabled={!consentChecked || checkoutPending}
          >
            Start Secure Checkout
          </button>
          {showRefreshWarning && (
            <div
              style={{
                marginTop: '16px',
                padding: '10px 14px',
                backgroundColor: 'rgba(255,0,0,0.08)',
                border: '1px solid rgba(255,0,0,0.25)',
                borderRadius: '6px',
                color: '#ff4d4f',
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'center',
                maxWidth: '420px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
            >
              ⚠ DO NOT REFRESH THE PAGE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PreviewPage

