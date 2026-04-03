import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Preview/preview.css'

// Get base URL for assets (respects vite.config.js base path)
const BASE_URL = import.meta.env.BASE_URL
// Preview 2 — separate demo media paths (add preview2-demo-desktop.mp4 / preview2-demo-mobile.mp4 under public/assets/ when ready)
const preview2DesktopDemo = `${BASE_URL}assets/preview2-demo-desktop.mp4`
const preview2MobileDemo = `${BASE_URL}assets/preview2-demo-mobile.mp4`
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`

function Preview2Page() {
  const navigate = useNavigate()
  const [consentChecked, setConsentChecked] = useState(false)

  // TEMPORARY:
  // Preview2 CTA currently routes directly to /builder2.
  // Replace with the correct payment flow later.

  // Preview2 only — demo is neutralized on all viewports:
  // - Mobile: "VIEW DEMO" stays in layout (preview.css) but is disabled and does not navigate.
  // - Desktop/tablet: no autoplay, no controls, so inline demo video cannot be started here yet.

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
          src={preview2DesktopDemo}
          width="896"
          height="741"
          loop
          muted
          playsInline
          preload="metadata"
          style={{ pointerEvents: 'none' }}
        >
          Your browser does not support the video tag.
        </video>
        <video
          className="preview-video preview-video-mobile"
          src={preview2MobileDemo}
          muted
          defaultMuted
          playsInline
          loop
          preload="metadata"
          style={{ pointerEvents: 'none' }}
        >
          Your browser does not support the video tag.
        </video>
        <button
          type="button"
          className="preview-demo-button"
          disabled
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
            type="button"
            className="checkout-button"
            disabled={!consentChecked}
            onClick={() => navigate('/builder2')}
          >
            Start Secure Checkout
          </button>
        </div>
      </div>
    </div>
  )
}

export default Preview2Page
