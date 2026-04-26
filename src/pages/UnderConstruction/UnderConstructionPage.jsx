import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`
const heroPngSrc = `${BASE_URL}assets/${encodeURIComponent('טקסט.png')}`
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`

const UC_FRONTEND_PASSWORD = '4622231'

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
  const navigate = useNavigate()
  const sceneRef = useRef(null)
  const [passwordValue, setPasswordValue] = useState('')
  const [passwordAccepted, setPasswordAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [blockMobilePortrait, setBlockMobilePortrait] = useState(getMobilePortraitBlock)

  const canProceed = useMemo(
    () => passwordAccepted && termsAccepted,
    [passwordAccepted, termsAccepted]
  )

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

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlHeight = html.style.height
    const prevBodyHeight = body.style.height
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.height = '100%'
    body.style.height = '100%'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.height = prevHtmlHeight
      body.style.height = prevBodyHeight
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

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (passwordValue === UC_FRONTEND_PASSWORD) {
      setPasswordAccepted(true)
      setErrorMessage('')
    } else {
      setPasswordAccepted(false)
      setErrorMessage('סיסמה שגויה')
    }
  }

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
        <div className="under-construction-foreground-scale">
          <div className="under-construction-content">
            <div className="under-construction-content-frame">
              <img
                className="under-construction-hero-png"
                src={heroPngSrc}
                alt=""
                decoding="async"
              />

              <div className="under-construction-terms-row" dir="rtl">
                <a
                  href={termsPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="under-construction-terms-link"
                >
                  לצפיה בתנאים
                </a>
                <label className="under-construction-checkbox-label">
                  <input
                    type="checkbox"
                    className="under-construction-checkbox-input"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    aria-label="אישור תנאים"
                  />
                  <span className="under-construction-checkbox-face" aria-hidden>
                    {termsAccepted ? '✓' : ''}
                  </span>
                </label>
                <span className="under-construction-terms-small-label">אני מסכים לתנאים</span>
              </div>

              <form className="under-construction-form" onSubmit={handlePasswordSubmit}>
                <input
                  type="password"
                  autoComplete="off"
                  value={passwordValue}
                  onChange={(ev) => setPasswordValue(ev.target.value)}
                  className="under-construction-password-input"
                  aria-invalid={Boolean(errorMessage)}
                />
                <button type="submit" className="under-construction-enter-btn">
                  ENTER
                </button>
                {errorMessage ? (
                  <p className="under-construction-password-error" role="alert">
                    {errorMessage}
                  </p>
                ) : null}
              </form>

              <div className="under-construction-mode-row">
                <button
                  type="button"
                  disabled={!canProceed}
                  className="under-construction-mode-btn"
                  dir="rtl"
                  onClick={() => navigate('/preview')}
                >
                  מודעה
                </button>
                <button
                  type="button"
                  disabled={!canProceed}
                  className="under-construction-mode-btn"
                  dir="rtl"
                  onClick={() => navigate('/preview2')}
                >
                  וידאו
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
