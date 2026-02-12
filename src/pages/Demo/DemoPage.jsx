import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './demo.css'

function DemoPage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)

  useEffect(() => {
    // Redirect desktop users to Preview (mobile-only feature)
    if (window.innerWidth > 768) {
      navigate('/')
      return
    }

    const v = videoRef.current
    if (v) {
      v.muted = true
      v.play().catch(() => {
        // Silently ignore autoplay failures
      })
    }
  }, [navigate])

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="demo-page">
      <button className="demo-back-button" onClick={handleBack}>
        BACK &gt;
      </button>
      <video
        ref={videoRef}
        className="demo-video"
        src="/assets/mobile-demo.mp4"
        autoPlay
        muted
        defaultMuted
        playsInline
        loop
      >
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

export default DemoPage

