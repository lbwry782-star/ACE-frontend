function Preview2Page() {
  return (
    <div
      style={{
        minHeight: '50vh',
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
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', margin: '0 0 0.75rem', fontWeight: 700 }}>
        PREVIEW 2
      </h1>
      <p style={{ margin: 0, fontSize: '1rem' }}>Video ads area</p>
    </div>
  )
}

export default Preview2Page
