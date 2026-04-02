import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkUnderConstructionPassword } from '../../services/api'

const SHOW_PREVIEW_LINK = false

function UnderConstructionPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')

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
