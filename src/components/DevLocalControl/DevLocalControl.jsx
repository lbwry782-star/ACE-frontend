import { LOCAL_BACKEND_URL, isLocalDevFrontend } from '../../services/backendUrl.js'
import { API_BASE_URL } from '../../services/api.js'

const panelStyle = {
  position: 'fixed',
  zIndex: 12000,
  left: 12,
  bottom: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  maxWidth: 'min(280px, calc(100vw - 24px))',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(28, 28, 26, 0.92)',
  color: '#f4f1ea',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
  fontFamily: "'Segoe UI', Arial, sans-serif"
}

const statusStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8
}

const lampStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#e67e22',
  boxShadow: '0 0 0 3px rgba(230, 126, 34, 0.28), 0 0 8px rgba(230, 126, 34, 0.9)',
  flex: '0 0 auto'
}

const modeStyle = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.02em'
}

const backendWrapStyle = {
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  width: '100%'
}

const labelStyle = {
  fontSize: 11,
  color: '#c8c4ba'
}

const urlStyle = {
  fontSize: 12,
  lineHeight: 1.35,
  wordBreak: 'break-all',
  color: '#fff'
}

const buttonStyle = {
  margin: 0,
  padding: '6px 10px',
  border: 'none',
  borderRadius: 4,
  background: '#5c5a54',
  color: '#d7d4cc',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'not-allowed',
  opacity: 0.55,
  pointerEvents: 'none'
}

function DevLocalControl() {
  if (!isLocalDevFrontend()) return null

  const backendUrl = API_BASE_URL || LOCAL_BACKEND_URL

  return (
    <aside style={panelStyle} dir="rtl" aria-label="לוח בקרת פיתוח מקומי">
      <div style={statusStyle}>
        <span style={lampStyle} aria-hidden="true" />
        <span style={modeStyle}>מקומי</span>
      </div>
      <p style={backendWrapStyle}>
        <span style={labelStyle}>Backend</span>
        <span style={urlStyle}>{backendUrl}</span>
      </p>
      <button
        type="button"
        style={buttonStyle}
        disabled
        aria-disabled="true"
        title="העדכון הציבורי אינו זמין בסביבה המקומית"
      >
        עדכן את אורי
      </button>
    </aside>
  )
}

export default DevLocalControl
