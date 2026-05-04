import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './demo.css'

const BASE_URL = import.meta.env.BASE_URL
const MOBILE_LAYOUT_MQ = '(max-width: 768px)'
const DEMO_COMP_VIDEO = `${BASE_URL}assets/DEMO_COMP_VIDEO.mp4`
const DEMO_MOBILE_VIDEO = `${BASE_URL}assets/DEMO_MOBILE_VIDEO.mp4`
const DEMO_BACK_GIF_SRC = `${BASE_URL}assets/${encodeURIComponent('חזרה.gif')}`

function useDemoMobileLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_LAYOUT_MQ).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function DemoPage() {
  const rootRef = useRef(null)
  const isMobile = useDemoMobileLayout()
  const videoSrc = isMobile ? DEMO_MOBILE_VIDEO : DEMO_COMP_VIDEO

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
      <div className="demo-inner">
        {!isMobile && (
          <Link
            to="/preview2"
            className="demo-back-gif-btn"
            aria-label="חזרה לדף PREVIEW2"
          >
            <img src={DEMO_BACK_GIF_SRC} alt="" className="demo-back-gif" />
          </Link>
        )}
        <div className="demo-video-wrap">
          <video
            className="demo-video"
            src={videoSrc}
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

export default DemoPage
