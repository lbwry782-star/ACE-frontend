import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './UnderConstructionPage.css'

const BASE_URL = import.meta.env.BASE_URL
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`
const ucAsset = (name) => `${BASE_URL}assets/${encodeURIComponent(name)}`

const ASSETS = {
  welcome: ucAsset('ברוכים הבאים.png'),
  agree: ucAsset('אני מסכים.png'),
  checkbox: ucAsset('תיבת סימון.png'),
  spacer2: ucAsset('רווח2.png'),
  terms: ucAsset('לצפיה בתנאים.png'),
  termsHover: ucAsset('תנאיםHOVER.png'),
  groupBase: ucAsset('רווח4.png'),
  groupTop: ucAsset('רווח.png'),
  spacer3: ucAsset('רווח3.png'),
  video: ucAsset('וידאו.png'),
  videoHover: ucAsset('וידאוHOVER.png'),
  ad: ucAsset('מודעה.png'),
  adHover: ucAsset('מודעהHOVER.png')
}

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
  const [isTermsHovered, setIsTermsHovered] = useState(false)
  const [isVideoHovered, setIsVideoHovered] = useState(false)
  const [isAdHovered, setIsAdHovered] = useState(false)
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
            <div className="under-construction-ui-group" dir="rtl">
              <img className="uc-welcome-img" src={ASSETS.welcome} alt="" decoding="async" />

              <div className="uc-terms-row">
                <img className="uc-piece uc-agree-img" src={ASSETS.agree} alt="" decoding="async" />

                <label className="uc-checkbox-piece" htmlFor="uc-terms-checkbox">
                  <img className="uc-piece uc-checkbox-img" src={ASSETS.checkbox} alt="" decoding="async" />
                  <input
                    id="uc-terms-checkbox"
                    type="checkbox"
                    className="uc-checkbox-native"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    aria-label="אני מסכים לתנאים"
                  />
                  {termsAccepted ? (
                    <span className="uc-checkbox-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </label>

                <img className="uc-piece uc-spacer2-img" src={ASSETS.spacer2} alt="" decoding="async" />

                <a
                  href={termsPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uc-terms-link-img"
                  aria-label="לצפיה בתנאים"
                  onMouseEnter={() => setIsTermsHovered(true)}
                  onMouseLeave={() => setIsTermsHovered(false)}
                >
                  <img
                    className="uc-piece uc-terms-img"
                    src={isTermsHovered ? ASSETS.termsHover : ASSETS.terms}
                    alt=""
                    decoding="async"
                  />
                </a>
              </div>

              <div className="uc-main-visual-group">
                <div className="uc-group-base-row">
                  <img className="uc-piece uc-group-base-img" src={ASSETS.groupBase} alt="" decoding="async" />
                  <img className="uc-piece uc-group-top-img" src={ASSETS.groupTop} alt="" decoding="async" />
                </div>

                <div className="uc-main-buttons-row">
                  <button
                    type="button"
                    className="uc-nav-image-btn"
                    disabled={!canProceed}
                    aria-label="וידאו"
                    onMouseEnter={() => setIsVideoHovered(true)}
                    onMouseLeave={() => setIsVideoHovered(false)}
                    onClick={() => navigate('/preview2')}
                  >
                    <img
                      className="uc-piece uc-video-img"
                      src={isVideoHovered && canProceed ? ASSETS.videoHover : ASSETS.video}
                      alt=""
                      decoding="async"
                    />
                  </button>

                  <img className="uc-piece uc-spacer3-img" src={ASSETS.spacer3} alt="" decoding="async" />

                  <button
                    type="button"
                    className="uc-nav-image-btn"
                    disabled={!canProceed}
                    aria-label="מודעה"
                    onMouseEnter={() => setIsAdHovered(true)}
                    onMouseLeave={() => setIsAdHovered(false)}
                    onClick={() => navigate('/preview')}
                  >
                    <img
                      className="uc-piece uc-ad-img"
                      src={isAdHovered && canProceed ? ASSETS.adHover : ASSETS.ad}
                      alt=""
                      decoding="async"
                    />
                  </button>
                </div>
              </div>
            </div>

            <form
              className="under-construction-password-form"
              onSubmit={handlePasswordSubmit}
            >
              <input
                type="password"
                autoComplete="off"
                value={passwordValue}
                onChange={(ev) => setPasswordValue(ev.target.value)}
                className="under-construction-password-field"
                aria-label="הזנת סיסמה"
                aria-invalid={Boolean(errorMessage)}
              />
              <button type="submit" className="under-construction-enter-visible">
                ENTER
              </button>
              {errorMessage ? (
                <p className="under-construction-password-error-visible" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
