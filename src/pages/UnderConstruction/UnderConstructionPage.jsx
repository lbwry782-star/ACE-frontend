import { Link } from 'react-router-dom'

const SHOW_PREVIEW_LINK = false

function UnderConstructionPage() {
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
