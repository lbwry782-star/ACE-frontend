import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkUnderConstructionPassword } from '../../services/api'
import { getAgentDisplayName } from '../../utils/agentDisplayName'
import './UnderConstructionPage.css'

const SHOW_PREVIEW_LINK = false

const BASE_URL = import.meta.env.BASE_URL
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`
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
  const navigate = useNavigate()
  const sceneRef = useRef(null)
  const [password, setPassword] = useState('')
  const [aceTermsChecked, setAceTermsChecked] = useState(false)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = password
    try {
      const result = await checkUnderConstructionPassword(value)
      if (result?.ok === true) {
        navigate('/preview2')
        return
      }
    } catch {
      // silent — no visible feedback
    } finally {
      setPassword('')
    }
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
          <h1 className="under-construction-title" dir="rtl">
            <span className="under-construction-title-line">ברוכים הבאים</span>
            <span className="under-construction-title-line">לפרסום {getAgentDisplayName('he')}</span>
          </h1>

          <div className="under-construction-terms-row">
            <a
              href={termsPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="under-construction-terms-link"
              dir="rtl"
            >
              לצפייה בתנאים
            </a>
            <input
              id="ace-terms-under-construction"
              type="checkbox"
              className="under-construction-terms-checkbox"
              checked={aceTermsChecked}
              onChange={(e) => setAceTermsChecked(e.target.checked)}
            />
            <label
              htmlFor="ace-terms-under-construction"
              className="under-construction-terms-agree"
              dir="rtl"
            >
              אני מסכים
            </label>
          </div>

          <div className="under-construction-mode-row">
            <button
              type="button"
              disabled
              className="under-construction-mode-btn"
              dir="rtl"
            >
              מודעה
            </button>
            <button
              type="button"
              disabled
              className="under-construction-mode-btn"
              dir="rtl"
            >
              וידאו
            </button>
          </div>

          <form className="under-construction-form" onSubmit={handleSubmit}>
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="under-construction-password-input"
            />
            <button type="submit" className="under-construction-enter-btn">
              ENTER
            </button>
          </form>
            </div>
          {SHOW_PREVIEW_LINK && (
            <Link to="/preview" className="under-construction-preview-link">
              Access Preview
            </Link>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
