import { useCallback, useEffect, useState } from 'react'
import { LOCAL_BACKEND_URL, isLocalDevFrontend } from '../../services/backendUrl.js'
import { API_BASE_URL } from '../../services/api.js'
import {
  canConfirmCancelExecute,
  fetchCancelDevPreview
} from '../../utils/localDevCancelPreview.js'
import {
  EXECUTE_UNAVAILABLE_MESSAGE,
  START_BLOCKED_OPEN_MESSAGE,
  executeCancelDevelopment,
  fetchDevCycleStatus,
  startDevCycle
} from '../../utils/localDevCycleApi.js'
import CancelDevelopmentPreviewDialog from './CancelDevelopmentPreviewDialog.jsx'

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

const disabledButtonStyle = {
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

const actionButtonStyle = {
  margin: 0,
  padding: '6px 10px',
  border: 'none',
  borderRadius: 4,
  background: '#2f6f4e',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
}

const cancelButtonStyle = {
  ...actionButtonStyle,
  background: '#c44c33'
}

const messageStyle = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.4,
  color: '#d7d4cc'
}

const errorStyle = {
  ...messageStyle,
  color: '#ffd0c4'
}

const successStyle = {
  ...messageStyle,
  color: '#c6e6c8'
}

function DevLocalControl() {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirmError, setConfirmError] = useState('')

  const backendUrl = API_BASE_URL || LOCAL_BACKEND_URL
  const invalid = status?.invalid === true
  const canStart = status?.canStartNewCycle === true && !invalid && busy === ''
  const canPreviewCancel = status?.canCancelCycle === true && !invalid && busy === ''
  const confirming = busy === 'execute'

  const refreshStatus = useCallback(async () => {
    const result = await fetchDevCycleStatus({ backendBase: backendUrl })
    if (!result.ok) {
      setStatus(result)
      setStatusError(result.message || 'לא ניתן לטעון את מצב מחזור הפיתוח.')
      return result
    }
    setStatus(result)
    setStatusError(result.invalid ? result.message : '')
    return result
  }, [backendUrl])

  useEffect(() => {
    if (!isLocalDevFrontend()) return undefined
    let cancelled = false
    ;(async () => {
      const result = await fetchDevCycleStatus({ backendBase: backendUrl })
      if (cancelled) return
      if (!result.ok) {
        setStatus(result)
        setStatusError(result.message || 'לא ניתן לטעון את מצב מחזור הפיתוח.')
        return
      }
      setStatus(result)
      setStatusError(result.invalid ? result.message : '')
    })()
    return () => {
      cancelled = true
    }
  }, [backendUrl])

  if (!isLocalDevFrontend()) return null

  const handleStart = async () => {
    if (busy || invalid) return
    if (status?.activeCycle?.status === 'OPEN' || status?.canStartNewCycle !== true) {
      setMessageKind('error')
      setMessage(START_BLOCKED_OPEN_MESSAGE)
      return
    }
    setMessage('')
    setBusy('start')
    const result = await startDevCycle({ backendBase: backendUrl })
    setBusy('')
    setMessageKind(result.ok ? 'success' : 'error')
    setMessage(result.message)
    await refreshStatus()
  }

  const handleCancelPreview = async () => {
    if (busy || invalid) return
    setMessage('')
    setConfirmError('')
    setPreview(null)
    setBusy('preview')
    const result = await fetchCancelDevPreview({ backendBase: backendUrl })
    setBusy('')
    if (!result.ok) {
      setMessageKind('error')
      setMessage(result.message || 'לא ניתן לטעון את בדיקת הביטול.')
      if (result.blockers?.length) {
        setPreview({
          ok: false,
          cycleActive: false,
          hasWork: false,
          blockers: result.blockers,
          previewFingerprint: '',
          executeEndpointAvailable: false,
          commitsToCancel: { backend: [], frontend: [] },
          pathsToRevert: { backend: [], frontend: [] },
          infraPreserved: { commits: { backend: [], frontend: [] }, paths: { backend: [], frontend: [] } },
          envChanges: {
            backend: { addedKeys: [], removedKeys: [], changedKeys: [], preservedKeys: [] },
            frontend: { addedKeys: [], removedKeys: [], changedKeys: [], preservedKeys: [] }
          },
          preBaselineWarnings: [],
          activeCycle: { status: 'UNKNOWN', canExecuteInEngine: false, executeAvailableInApi: false },
          wipBranches: []
        })
      }
      await refreshStatus()
      return
    }
    setPreview(result)
  }

  const handleConfirmExecute = async () => {
    if (busy || !preview) return
    if (!canConfirmCancelExecute(preview)) {
      setConfirmError(EXECUTE_UNAVAILABLE_MESSAGE)
      return
    }
    setConfirmError('')
    setBusy('execute')
    const result = await executeCancelDevelopment({
      backendBase: backendUrl,
      previewFingerprint: preview.previewFingerprint
    })
    setBusy('')
    if (!result.ok) {
      setConfirmError(result.message)
      setMessageKind('error')
      setMessage(result.message)
      await refreshStatus()
      return
    }
    setPreview(null)
    setMessageKind('success')
    setMessage(result.message)
    await refreshStatus()
  }

  return (
    <aside style={panelStyle} dir="rtl" aria-label="לוח בקרת פיתוח מקומי">
      <p style={backendWrapStyle}>
        <span style={labelStyle}>מצב</span>
        <span style={urlStyle}>
          {statusError || status?.message || 'טוען מצב מחזור הפיתוח…'}
        </span>
      </p>
      <button
        type="button"
        style={canStart ? actionButtonStyle : disabledButtonStyle}
        onClick={canStart ? handleStart : undefined}
        disabled={!canStart}
        title={invalid ? status?.message : undefined}
      >
        {busy === 'start' ? 'פותח…' : 'התחל פיתוח'}
      </button>
      <button
        type="button"
        style={canPreviewCancel ? cancelButtonStyle : disabledButtonStyle}
        onClick={canPreviewCancel ? handleCancelPreview : undefined}
        disabled={!canPreviewCancel}
      >
        {busy === 'preview' ? 'בודק…' : 'בטל את הפיתוח'}
      </button>
      <button
        type="button"
        style={disabledButtonStyle}
        disabled
        aria-disabled="true"
        title="העדכון הציבורי אינו זמין בסביבה המקומית"
      >
        עדכן את אורי
      </button>
      {message ? (
        <p style={messageKind === 'success' ? successStyle : errorStyle}>{message}</p>
      ) : null}
      {preview ? (
        <CancelDevelopmentPreviewDialog
          preview={preview}
          onClose={() => {
            if (confirming) return
            setPreview(null)
            setConfirmError('')
          }}
          onConfirm={handleConfirmExecute}
          confirming={confirming}
          confirmError={confirmError}
        />
      ) : null}
    </aside>
  )
}

export default DevLocalControl
