import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkUnderConstructionPassword } from '../../services/api'
import './UnderConstructionPage.css'

const SHOW_PREVIEW_LINK = false

const BASE_URL = import.meta.env.BASE_URL
const termsPdf = `${BASE_URL}assets/ACE_TERMS_AND_POLICIES.pdf`

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
      <div className="under-construction-layout">
        <div className="under-construction-content">
          <div className="under-construction-terms-row">
            <label htmlFor="ace-terms-under-construction">
              <input
                id="ace-terms-under-construction"
                type="checkbox"
                checked={aceTermsChecked}
                onChange={(e) => setAceTermsChecked(e.target.checked)}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              <span>ACE TERMS AND POLICIES</span>
            </label>
            <a
              href={termsPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="under-construction-terms-link"
            >
              View Terms & Policies
            </a>
          </div>

          <div className="under-construction-mode-row">
            <button type="button" disabled className="under-construction-mode-btn">
              <span className="under-construction-mode-btn-he" dir="rtl">
                מודעה
              </span>
              <span className="under-construction-mode-btn-en">AD</span>
            </button>
            <button type="button" disabled className="under-construction-mode-btn">
              <span className="under-construction-mode-btn-he" dir="rtl">
                וידאו
              </span>
              <span className="under-construction-mode-btn-en">VIDEO</span>
            </button>
          </div>

          <h1 className="under-construction-title">UNDER CONSTRUCTION</h1>
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
          <p className="under-construction-blurb">
            We&apos;re currently updating ACE. Please check back soon.
          </p>
          {SHOW_PREVIEW_LINK && (
            <Link to="/preview" className="under-construction-preview-link">
              Access Preview
            </Link>
          )}
        </div>

        <div className="under-construction-video-placeholder" aria-hidden="true">
          <span className="under-construction-video-placeholder-title">VIDEO PLACEHOLDER</span>
          <span className="under-construction-video-placeholder-note">1920×1080</span>
        </div>
      </div>
    </div>
  )
}

export default UnderConstructionPage
