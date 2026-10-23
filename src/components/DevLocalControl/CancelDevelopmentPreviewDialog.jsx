import {
  CANCEL_BACK_LABEL,
  CANCEL_BUSY_MESSAGE,
  CANCEL_CLOSE_LABEL,
  CANCEL_CONFIRM_QUESTION,
  CANCEL_CONFIRM_YES_LABEL,
  CANCEL_SIMPLE_MIXED_MESSAGE,
  CANCEL_SIMPLE_SUCCESS_MESSAGE,
  canConfirmCancelExecute,
  cancelSpecialDecisionWarning,
  cancelUserFacingMessage
} from '../../utils/localDevCancelPreview.js'
import { isLocalUndoShell } from '../../utils/localDevUndoShell.js'

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 11900,
  background: 'transparent',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  padding: '12px 12px 12px 348px',
  boxSizing: 'border-box',
  pointerEvents: 'none'
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
  boxSizing: 'border-box',
  pointerEvents: 'auto'
}

const contentStyle = {
  flex: '1 1 auto',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
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

const warningStyle = {
  ...messageStyle,
  color: '#6b1f14',
  fontSize: 16
}

const confirmStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 4,
  background: '#c44c33',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer'
}

const backStyle = {
  ...confirmStyle,
  background: '#232320'
}

function outcomeMessage(outcome) {
  if (!outcome) return ''
  if (outcome.kind === 'success') return CANCEL_SIMPLE_SUCCESS_MESSAGE
  if (outcome.kind === 'mixed') return CANCEL_SIMPLE_MIXED_MESSAGE
  return String(outcome.message || 'הביטול נכשל.')
}

function CancelDevelopmentPreviewDialog({
  preview,
  outcome = null,
  onConfirm,
  onClose,
  confirming = false,
  confirmError = ''
}) {
  const canConfirm = Boolean(preview)
    && !outcome
    && !confirming
    && !confirmError
    && canConfirmCancelExecute(preview)
  const specialWarning = canConfirm ? cancelSpecialDecisionWarning(preview) : ''
  const blockedMessage = !outcome && !confirming && !canConfirm
    ? (confirmError || cancelUserFacingMessage(preview) || 'לא ניתן לבטל כרגע.')
    : ''
  const shell = isLocalUndoShell()
  const overlay = shell
    ? {
      ...overlayStyle,
      padding: 8,
      alignItems: 'stretch',
      justifyContent: 'stretch',
      pointerEvents: 'auto',
      background: 'rgba(0, 0, 0, 0.2)'
    }
    : overlayStyle
  const dialog = shell
    ? { ...dialogStyle, width: '100%', maxWidth: '100%', maxHeight: '100%' }
    : dialogStyle

  let body = null
  if (outcome) {
    body = (
      <p id="cancel-dev-preview-title" style={messageStyle}>
        {outcomeMessage(outcome)}
      </p>
    )
  } else if (confirming) {
    body = (
      <p id="cancel-dev-preview-title" style={messageStyle}>
        {CANCEL_BUSY_MESSAGE}
      </p>
    )
  } else if (canConfirm) {
    body = (
      <>
        {specialWarning ? <p style={warningStyle}>{specialWarning}</p> : null}
        <p id="cancel-dev-preview-title" style={messageStyle}>
          {CANCEL_CONFIRM_QUESTION}
        </p>
      </>
    )
  } else {
    body = (
      <p id="cancel-dev-preview-title" style={messageStyle}>
        {blockedMessage}
      </p>
    )
  }

  return (
    <div style={overlay} role="presentation">
      <div
        style={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dev-preview-title"
        dir="rtl"
      >
        <div style={contentStyle}>{body}</div>
        {confirming ? null : (
          <div style={footerStyle}>
            {canConfirm ? (
              <button
                type="button"
                style={confirmStyle}
                onClick={onConfirm}
              >
                {CANCEL_CONFIRM_YES_LABEL}
              </button>
            ) : null}
            <button type="button" style={backStyle} onClick={onClose}>
              {canConfirm ? CANCEL_BACK_LABEL : CANCEL_CLOSE_LABEL}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CancelDevelopmentPreviewDialog
