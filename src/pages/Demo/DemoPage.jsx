import { useRef, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import './demo.css'

const BASE_URL = import.meta.env.BASE_URL
const DEMO_VIDEO_SRC = `${BASE_URL}assets/DEMO_COMP_VIDEO.mp4`

function DemoPage() {
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const main = document.querySelector('.main-content')
    const el = rootRef.current
    if (!main || !el) return

    const apply = () => {
      const styles = window.getComputedStyle(main)
      const pt = parseFloat(styles.paddingTop) || 0
      const pb = parseFloat(styles.paddingBottom) || 0
      const h = main.clientHeight - pt - pb
      el.style.height = `${Math.max(0, h)}px`
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(main)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])

  return (
    <div className="demo-page" ref={rootRef}>
      <Link to="/preview2" className="demo-back-link" aria-label="חזרה לדף PREVIEW2">
        &gt;&gt;
      </Link>
      <div className="demo-video-wrap">
        <video
          className="demo-video"
          src={DEMO_VIDEO_SRC}
          autoPlay
          loop
          muted
          defaultMuted
          controls
          playsInline
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}

export default DemoPage
