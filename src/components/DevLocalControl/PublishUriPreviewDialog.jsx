import { isLocalUndoShell } from '../../utils/localDevUndoShell.js'
import {
  PUBLISH_PREPARE_CHECKING_MESSAGE,
  PUBLISH_PREPARE_SUCCESS_MESSAGE,
  isPublishPrepareVerifiedSuccess,
  publishPrepareBarRatio,
  publishPrepareStatusMessage
} from '../../utils/localDevPublishPrepareProgress.js'
import LocalOperationProgress from './LocalOperationProgress.jsx'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 14000,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
  boxSizing: 'border-box'
}

const dialogStyle = {
  width: 'min(680px, 100%)',
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 24px)',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#f7f6f2',
  color: '#232320',
  borderRadius: 8,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28)',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  direction: 'rtl',
  textAlign: 'center',
  boxSizing: 'border-box'
}

const contentStyle = {
  flex: '1 1 auto',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 18,
  padding: '24px 24px 12px',
  boxSizing: 'border-box'
}

const footerStyle = {
  flex: '0 0 auto',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'center',
  padding: '10px 18px 16px'
}

const messageStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.6,
  color: '#232320',
  maxWidth: '22em'
}

const closeStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 4,
  background: '#232320',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
}

function PublishUriPreviewDialog({ phase, progress, message, onClose }) {
  if (!phase) return null
  const succeeded = phase === 'success' && isPublishPrepareVerifiedSuccess(progress)
  const failed = phase === 'failed' || (phase === 'success' && !succeeded)
  const inFlight = phase === 'checking' || phase === 'preparing'
  const shell = isLocalUndoShell()
  const overlay = shell
    ? { ...overlayStyle, alignItems: 'stretch', justifyContent: 'stretch', padding: 8 }
    : overlayStyle
  const dialog = shell
    ? { ...dialogStyle, width: '100%', maxWidth: '100%', maxHeight: '100%' }
    : dialogStyle

  let body = null
  if (succeeded) {
    body = (
      <p id="publish-uri-preview-title" style={messageStyle}>
        {PUBLISH_PREPARE_SUCCESS_MESSAGE}
      </p>
    )
  } else if (failed) {
    body = (
      <p id="publish-uri-preview-title" style={messageStyle}>
        {message || 'בדיקת הפרסום נכשלה.'}
      </p>
    )
  } else {
    body = (
      <div id="publish-uri-preview-title">
        <LocalOperationProgress
          title={PUBLISH_PREPARE_CHECKING_MESSAGE}
          status={publishPrepareStatusMessage(progress)}
          ratio={publishPrepareBarRatio(progress)}
        />
      </div>
    )
  }

  return (
    <div style={overlay} role="presentation">
      <div
        style={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-uri-preview-title"
        dir="rtl"
      >
        <div style={contentStyle}>{body}</div>
        {inFlight ? null : (
          <div style={footerStyle}>
            <button type="button" style={closeStyle} onClick={onClose}>
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PublishUriPreviewDialog
