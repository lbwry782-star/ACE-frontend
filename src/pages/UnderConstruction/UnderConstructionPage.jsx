import { useState, useEffect, useRef, useCallback } from 'react'
import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`

const MQ_MOBILE = '(max-width: 900px)'
const MQ_PORTRAIT = '(orientation: portrait)'

function getMobilePortraitBlock() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia(MQ_MOBILE).matches &&
    window.matchMedia(MQ_PORTRAIT).matches
  )
}

function isInteractiveEventTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  return !!target.closest(
    'a, button, input, textarea, select, label, [role="button"], [contenteditable="true"]'
  )
}

function UnderConstructionPage() {
  const sceneRef = useRef(null)
  const [blockMobilePortrait, setBlockMobilePortrait] = useState(getMobilePortraitBlock)

  useEffect(() => {
    const mqMobile = window.matchMedia(MQ_MOBILE)
    const mqPortrait = window.matchMedia(MQ_PORTRAIT)

    const syncBlock = () => {
      setBlockMobilePortrait(mqMobile.matches && mqPortrait.matches)
    }

    syncBlock()
    mqMobile.addEventListener('change', syncBlock)
    mqPortrait.addEventListener('change', syncBlock)

    return () => {
      mqMobile.removeEventListener('change', syncBlock)
      mqPortrait.removeEventListener('change', syncBlock)
    }
  }, [])

  const tryFullscreenScene = useCallback(() => {
    if (typeof document === 'undefined') return
    if (!window.matchMedia(MQ_MOBILE).matches) return
    const el = sceneRef.current
    if (!el) return
    const doc = document
    const current =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement
    if (current === el) return
    if (current && current !== el) return

    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen
    if (typeof req !== 'function') return
    try {
      const result = req.call(el)
      if (result != null && typeof result.catch === 'function') {
        result.catch(() => {})
      }
    } catch {
      /* unsupported or blocked */
    }
  }, [])

  const handleSceneTap = useCallback(
    (e) => {
      if (!window.matchMedia(MQ_MOBILE).matches) return
      if (isInteractiveEventTarget(e.target)) return
      tryFullscreenScene()
    },
    [tryFullscreenScene]
  )

  if (blockMobilePortrait) {
    return (
      <div className="under-construction-portrait-block" role="alert">
        <div className="under-construction-portrait-block-inner">
          <span className="under-construction-portrait-block-icon" aria-hidden>
            ↻
          </span>
          <p className="under-construction-portrait-block-msg" dir="rtl">
            יש לסובב את המכשיר לרוחב
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={sceneRef} className="under-construction-page" onClick={handleSceneTap}>
      <div className="under-construction-video-bg" aria-hidden="true">
        <video
          className="under-construction-bg-video"
          src={openingVideoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
        />
        <div className="under-construction-bg-scrim" />
      </div>

      <div className="under-construction-foreground">
        <div className="under-construction-foreground-empty" aria-hidden="true" />
      </div>
    </div>
  )
}

export default UnderConstructionPage
