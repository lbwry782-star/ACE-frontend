import { useRef, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import './demo2.css'

const BASE_URL = import.meta.env.BASE_URL
const DEMO2_VIDEO_SRC = `${BASE_URL}assets/DEMO_COMP_AD.mp4`
const DEMO2_BACK_GIF_SRC = `${BASE_URL}assets/${encodeURIComponent('חזרה.gif')}`

function DemoPage2() {
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
    <div className="demo2-page" ref={rootRef}>
      <div className="demo2-inner">
        <Link
          to="/preview1"
          className="demo2-back-gif-btn"
          aria-label="חזרה לדף PREVIEW1"
        >
          <img src={DEMO2_BACK_GIF_SRC} alt="" className="demo2-back-gif" />
        </Link>
        <div className="demo2-video-wrap">
          <video
            className="demo2-video"
            src={DEMO2_VIDEO_SRC}
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
    </div>
  )
}

export default DemoPage2
