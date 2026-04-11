import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkUnderConstructionPassword } from '../../services/api'

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
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundColor: '#fff',
        color: '#000',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem 1rem',
          marginBottom: '0.75rem',
          maxWidth: 'min(28rem, 92vw)',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <input
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
          style={{
            fontSize: '0.9rem',
            color: '#000',
            textDecoration: 'underline',
          }}
        >
          View Terms & Policies
        </a>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: 'min(18rem, 90vw)',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          disabled
          style={{
            flex: 1,
            padding: '0.35rem 1rem',
            fontSize: '0.9rem',
            border: '1px solid #000',
            backgroundColor: '#f0f0f0',
            color: '#555',
            cursor: 'not-allowed',
            opacity: 0.75,
          }}
        >
          AD
        </button>
        <button
          type="button"
          disabled
          style={{
            flex: 1,
            padding: '0.35rem 1rem',
            fontSize: '0.9rem',
            border: '1px solid #000',
            backgroundColor: '#f0f0f0',
            color: '#555',
            cursor: 'not-allowed',
            opacity: 0.75,
          }}
        >
          VIDEO
        </button>
      </div>
      <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', margin: '0 0 1rem', fontWeight: 700 }}>
        UNDER CONSTRUCTION
      </h1>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <input
          type="password"
          autoComplete="off"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          style={{
            width: 'min(16rem, 85vw)',
            padding: '0.4rem 0.5rem',
            fontSize: '0.95rem',
            border: '1px solid #000',
            backgroundColor: '#fff',
            color: '#000',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.35rem 1rem',
            fontSize: '0.9rem',
            border: '1px solid #000',
            backgroundColor: '#fff',
            color: '#000',
            cursor: 'pointer',
          }}
        >
          ENTER
        </button>
      </form>
      <p style={{ margin: 0, maxWidth: '28rem', lineHeight: 1.5, fontSize: '1rem' }}>
        We&apos;re currently updating ACE. Please check back soon.
      </p>
      {SHOW_PREVIEW_LINK && (
        <Link
          to="/preview"
          style={{
            marginTop: '1.5rem',
            fontSize: '0.9rem',
            color: '#000',
            textDecoration: 'underline',
          }}
        >
          Access Preview
        </Link>
      )}
    </div>
  )
}

export default UnderConstructionPage
