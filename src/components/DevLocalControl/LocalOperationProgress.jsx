const wrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  width: '100%',
  maxWidth: '22em'
}

const titleStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.6,
  color: '#232320'
}

const statusStyle = {
  margin: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: '#5c5c56'
}

const trackStyle = {
  width: 'min(360px, 86%)',
  height: 10,
  borderRadius: 6,
  background: '#deded5',
  overflow: 'hidden',
  position: 'relative'
}

const fillStyle = {
  height: '100%',
  borderRadius: 6,
  background: '#1e5c3a',
  transition: 'width 240ms ease'
}

const activityFillStyle = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '36%',
  borderRadius: 6,
  background: '#1e5c3a',
  animation: 'aceLocalProgressSlide 1.2s ease-in-out infinite'
}

function LocalOperationProgress({ title, status = '', ratio = null }) {
  const numeric = typeof ratio === 'number' && Number.isFinite(ratio)
  const width = numeric ? `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` : null
  return (
    <div style={wrapStyle}>
      <style>
        {`@keyframes aceLocalProgressSlide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(280%); }
        }`}
      </style>
      <p style={titleStyle}>{title}</p>
      <div style={trackStyle} aria-hidden="true">
        {numeric ? (
          <div style={{ ...fillStyle, width }} />
        ) : (
          <div style={activityFillStyle} />
        )}
      </div>
      {status ? <p style={statusStyle}>{status}</p> : null}
    </div>
  )
}

export default LocalOperationProgress
