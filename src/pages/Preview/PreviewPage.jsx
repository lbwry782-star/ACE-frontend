import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './preview.css'

// Get base URL for assets (respects vite.config.js base path)
const BASE_URL = import.meta.env.BASE_URL
const builderDemoVideo = `${BASE_URL}assets/builder-demo-v3.mp4`
const mobileDemoVideo = `${BASE_URL}assets/mobile-demo.mp4`
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`

function PreviewPage() {
  const navigate = useNavigate()
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

      <div className="preview-plans">
        <div className="consent-row">
          <a
            href={termsPdf}
            target="_blank"
            rel="noreferrer"
            className="terms-link"
          >
            View Terms & Policies
          </a>
        </div>
        <div className="preview-plan-row">
          {[1, 2, 3].map((n) => (
            <div key={n} className="preview-plan-card">
              <button
                type="button"
                className="preview-plan-button"
                onClick={() => navigate('/builder')}
              >
                Continue
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PreviewPage

