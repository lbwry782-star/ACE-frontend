import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkUnderConstructionPassword } from '../../services/api'
import './UnderConstructionPage.css'

const SHOW_PREVIEW_LINK = false

const BASE_URL = import.meta.env.BASE_URL
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`
const openingVideoSrc = `${BASE_URL}assets/${encodeURIComponent('ווידאו_פתיחה.mp4')}`

function UnderConstructionPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [aceTermsChecked, setAceTermsChecked] = useState(false)

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
    <div className="under-construction-page">
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
        <div className="under-construction-content">
          <h1 className="under-construction-title" dir="rtl">
            <span className="under-construction-title-line">ברוכים הבאים</span>
            <span className="under-construction-title-line">לפרסום אס</span>
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
          {SHOW_PREVIEW_LINK && (
            <Link to="/preview" className="under-construction-preview-link">
              Access Preview
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
