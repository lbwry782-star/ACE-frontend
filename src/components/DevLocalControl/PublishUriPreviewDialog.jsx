import { isLocalUndoShell } from '../../utils/localDevUndoShell.js'
import {
  PUBLISH_CANDIDATE_DRY_RUN_SUCCESS_MESSAGE,
  canOfferPublishCandidateDryRun,
  publishCandidateUserFacingMessage
} from '../../utils/localDevPublishUriCandidate.js'

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
  alignItems: 'center',
  justifyContent: 'center',
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

const dryRunStyle = {
  padding: '14px 28px',
  border: 'none',
  borderRadius: 4,
  background: '#1e5c3a',
  color: '#fff',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer'
}

const disabledDryRunStyle = {
  ...dryRunStyle,
  background: '#9aa39a',
  cursor: 'not-allowed'
}

function PublishUriPreviewDialog({ preview, dryRunResult, dryRunBusy, onDryRun, onClose }) {
  if (!preview) return null
  const dryRunSucceeded = dryRunResult?.ok === true
  const dryRunFailed = Boolean(dryRunResult) && dryRunResult.ok !== true
  const canOfferDryRun = !dryRunSucceeded
    && !dryRunFailed
    && canOfferPublishCandidateDryRun(preview)
    && typeof onDryRun === 'function'
  const errorMessage = dryRunSucceeded
    ? ''
    : dryRunFailed
      ? String(dryRunResult.message || 'בדיקת הפרסום נכשלה.')
      : canOfferDryRun
        ? ''
        : publishCandidateUserFacingMessage(preview)
  const shell = isLocalUndoShell()
  const overlay = shell
    ? { ...overlayStyle, alignItems: 'stretch', justifyContent: 'stretch', padding: 8 }
    : overlayStyle
  const dialog = shell
    ? { ...dialogStyle, width: '100%', maxWidth: '100%', maxHeight: '100%' }
    : dialogStyle

  return (
    <div style={overlay} role="presentation">
      <div
        style={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-uri-preview-title"
        dir="rtl"
      >
        <div style={contentStyle}>
          {dryRunSucceeded ? (
            <p id="publish-uri-preview-title" style={messageStyle}>
              {PUBLISH_CANDIDATE_DRY_RUN_SUCCESS_MESSAGE}
            </p>
          ) : canOfferDryRun ? (
            <button
              id="publish-uri-preview-title"
              type="button"
              style={dryRunBusy ? disabledDryRunStyle : dryRunStyle}
              onClick={dryRunBusy ? undefined : onDryRun}
              disabled={Boolean(dryRunBusy)}
            >
              {dryRunBusy ? 'בודק…' : 'בדיקת פרסום'}
            </button>
          ) : (
            <p id="publish-uri-preview-title" style={messageStyle}>
              {errorMessage}
            </p>
          )}
        </div>
        <div style={footerStyle}>
          <button type="button" style={closeStyle} onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}

export default PublishUriPreviewDialog
