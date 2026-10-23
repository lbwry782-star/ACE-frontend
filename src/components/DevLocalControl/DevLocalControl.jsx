import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCAL_BACKEND_URL, isLocalDevFrontend } from '../../services/backendUrl.js'
import { API_BASE_URL } from '../../services/api.js'
import {
  canConfirmCancelExecute,
  fetchCancelDevPreview
} from '../../utils/localDevCancelPreview.js'
import {
  CONNECTION_LOST_MESSAGE,
  EXECUTE_UNAVAILABLE_MESSAGE,
  START_BLOCKED_OPEN_MESSAGE,
  createInFlightLock,
  executeCancelDevelopment,
  fetchDevCycleStatus,
  startDevCycle
} from '../../utils/localDevCycleApi.js'
import {
  buildProgressOutcome,
  clearCancelProgressHandle,
  createCancelOperationId,
  createCancelProgressPoller,
  fetchCancelProgress,
  isTerminalProgress,
  loadCancelProgressHandle,
  saveCancelProgressHandle
} from '../../utils/localDevCancelProgress.js'
import { fetchPublishUriPreview } from '../../utils/localDevPublishUriPreview.js'
import CancelDevelopmentPreviewDialog from './CancelDevelopmentPreviewDialog.jsx'
import PublishUriPreviewDialog from './PublishUriPreviewDialog.jsx'

const panelStyle = {
  position: 'fixed',
  zIndex: 12000,
  left: 12,
  bottom: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  maxWidth: 'min(320px, calc(100vw - 24px))',
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

const sessionStyle = {
  ...urlStyle,
  direction: 'ltr',
  textAlign: 'left',
  unicodeBidi: 'isolate',
  fontFamily: "Consolas, 'Courier New', monospace",
  fontSize: 11
}

function DevLocalControl() {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [busy, setBusy] = useState('')
  const [outcomeLines, setOutcomeLines] = useState([])
  const [outcomeKind, setOutcomeKind] = useState('')
  const [shownSessionId, setShownSessionId] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [progressSnapshot, setProgressSnapshot] = useState(null)
  const [pollWarning, setPollWarning] = useState('')
  const [publishPreview, setPublishPreview] = useState(null)
  const executeLockRef = useRef(createInFlightLock())
  const pollerRef = useRef(null)

  const backendUrl = API_BASE_URL || LOCAL_BACKEND_URL
  const invalid = status?.invalid === true
  const canStart = status?.canStartNewCycle === true && !invalid && busy === ''
  const canPreviewCancel = status?.canCancelCycle === true && !invalid && busy === ''
  const canPreviewPublish = busy === ''
  const confirming = busy === 'execute'

  const stopPoller = useCallback(() => {
    pollerRef.current?.stop()
    pollerRef.current = null
  }, [])

  const applyStatusOnce = useCallback(async () => {
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

  const applyTerminalProgress = useCallback(async (progress) => {
    stopPoller()
    executeLockRef.current.end()
    clearCancelProgressHandle()
    setBusy('')
    setPreview(null)
    const outcome = buildProgressOutcome(progress)
    if (!outcome) {
      setOutcomeKind('uncertain')
      setOutcomeLines([CONNECTION_LOST_MESSAGE])
      setShownSessionId('')
      await applyStatusOnce()
      return
    }
    setOutcomeKind(outcome.kind)
    setOutcomeLines(outcome.lines)
    setShownSessionId(outcome.sessionId)
    setConfirmError(outcome.kind === 'error' ? outcome.lines[0] : '')
    await applyStatusOnce()
  }, [applyStatusOnce, stopPoller])

  const beginPolling = useCallback((operationId, sessionId) => {
    stopPoller()
    const poller = createCancelProgressPoller({
      backendBase: backendUrl,
      operationId,
      sessionId,
      onUpdate: (progress) => {
        setPollWarning('')
        setProgressSnapshot(progress)
      },
      onTerminal: (progress) => {
        applyTerminalProgress(progress)
      },
      onNotFound: (_result, meta) => {
        if (meta?.seenProgress) {
          setPollWarning(CONNECTION_LOST_MESSAGE)
        }
      },
      onDisconnect: () => {
        setPollWarning(CONNECTION_LOST_MESSAGE)
      }
    })
    pollerRef.current = poller
    poller.start()
  }, [applyTerminalProgress, backendUrl, stopPoller])

  useEffect(() => {
    if (!isLocalDevFrontend()) return undefined
    let cancelled = false
    ;(async () => {
      const stored = loadCancelProgressHandle()
      if (stored) {
        const first = await fetchCancelProgress({
          backendBase: backendUrl,
          operationId: stored.operationId,
          sessionId: stored.sessionId
        })
        if (cancelled) return
        if (first.ok && isTerminalProgress(first)) {
          await applyTerminalProgress(first)
          return
        }
        setBusy('execute')
        setProgressSnapshot(first.ok ? first : null)
        if (!first.ok) setPollWarning(CONNECTION_LOST_MESSAGE)
        beginPolling(stored.operationId, stored.sessionId)
        return
      }
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
      stopPoller()
    }
  }, [applyTerminalProgress, backendUrl, beginPolling, stopPoller])

  useEffect(() => {
    if (busy !== 'execute') {
      setElapsedSeconds(0)
      return undefined
    }
    const startedAt = Date.now()
    setElapsedSeconds(0)
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [busy])

  if (!isLocalDevFrontend()) return null

  const handleStart = async () => {
    if (busy || invalid) return
    if (status?.activeCycle?.status === 'OPEN' || status?.canStartNewCycle !== true) {
      setOutcomeKind('error')
      setOutcomeLines([START_BLOCKED_OPEN_MESSAGE])
      setShownSessionId('')
      return
    }
    setOutcomeLines([])
    setShownSessionId('')
    setBusy('start')
    const result = await startDevCycle({ backendBase: backendUrl })
    setBusy('')
    const nextStatus = await applyStatusOnce()
    if (result.ok && nextStatus?.activeCycle?.status === 'OPEN') {
      setOutcomeKind('success')
      setOutcomeLines(['מחזור פיתוח חדש נפתח.'])
      setShownSessionId(nextStatus.activeCycle.sessionId || '')
      return
    }
    setOutcomeKind('error')
    setOutcomeLines([result.message])
    setShownSessionId('')
  }

  const handleCancelPreview = async () => {
    if (busy || invalid) return
    setOutcomeLines([])
    setShownSessionId('')
    setConfirmError('')
    setPreview(null)
    setBusy('preview')
    const result = await fetchCancelDevPreview({ backendBase: backendUrl })
    setBusy('')
    if (!result.ok) {
      setOutcomeKind('error')
      setOutcomeLines([result.message || 'לא ניתן לטעון את בדיקת הביטול.'])
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
      await applyStatusOnce()
      return
    }
    setPreview(result)
  }

  const handlePublishPreview = async () => {
    if (busy) return
    setOutcomeLines([])
    setShownSessionId('')
    setPublishPreview(null)
    setBusy('publish')
    const result = await fetchPublishUriPreview({ backendBase: backendUrl })
    setBusy('')
    if (result.error === 'backend_unavailable' || result.error === 'local_backend_required') {
      setOutcomeKind('error')
      setOutcomeLines([result.message])
      return
    }
    if (!result.ok) {
      setOutcomeKind('error')
      setOutcomeLines([result.message || 'לא ניתן לטעון את תוכנית הפרסום.'])
    }
    setPublishPreview(result)
  }

  const handleConfirmExecute = async () => {
    if (!preview) return
    if (!executeLockRef.current.tryBegin()) return
    if (!canConfirmCancelExecute(preview)) {
      executeLockRef.current.end()
      setConfirmError(EXECUTE_UNAVAILABLE_MESSAGE)
      return
    }
    const operationId = createCancelOperationId()
    const sessionId = preview.activeCycle?.sessionId
    if (!saveCancelProgressHandle({ operationId, sessionId })) {
      executeLockRef.current.end()
      setConfirmError(EXECUTE_UNAVAILABLE_MESSAGE)
      return
    }
    setConfirmError('')
    setOutcomeLines([])
    setShownSessionId('')
    setPollWarning('')
    setBusy('execute')
    beginPolling(operationId, sessionId)
    const result = await executeCancelDevelopment({
      backendBase: backendUrl,
      previewFingerprint: preview.previewFingerprint,
      operationId
    })
    if (result.uncertain) {
      setPollWarning(CONNECTION_LOST_MESSAGE)
      return
    }
    if (!result.ok && !result.cancelSucceeded) {
      if (pollerRef.current?.seenProgress) return
      stopPoller()
      executeLockRef.current.end()
      clearCancelProgressHandle()
      setBusy('')
      setConfirmError(result.message)
    }
  }

  const lineStyle = outcomeKind === 'error' || outcomeKind === 'uncertain'
    ? errorStyle
    : outcomeKind === 'mixed'
      ? errorStyle
      : successStyle

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
        {busy === 'start' ? 'פותח…' : 'NEW'}
      </button>
      <button
        type="button"
        style={canPreviewCancel ? cancelButtonStyle : disabledButtonStyle}
        onClick={canPreviewCancel ? handleCancelPreview : undefined}
        disabled={!canPreviewCancel}
      >
        {busy === 'preview' ? 'בודק…' : 'CANCEL'}
      </button>
      <button
        type="button"
        style={canPreviewPublish ? actionButtonStyle : disabledButtonStyle}
        onClick={canPreviewPublish ? handlePublishPreview : undefined}
        disabled={!canPreviewPublish}
      >
        {busy === 'publish' ? 'טוען…' : 'PUBLISH'}
      </button>
      {pollWarning ? <p style={errorStyle}>{pollWarning}</p> : null}
      {outcomeLines.map((line) => (
        <p
          key={line}
          style={line === outcomeLines[0] && outcomeKind === 'mixed' ? successStyle : lineStyle}
        >
          {line}
        </p>
      ))}
      {shownSessionId ? <p style={sessionStyle}>{shownSessionId}</p> : null}
      <CancelDevelopmentPreviewDialog
        preview={preview}
        onConfirm={handleConfirmExecute}
        confirming={confirming}
        confirmError={confirmError}
        elapsedSeconds={elapsedSeconds}
        progressSnapshot={progressSnapshot}
      />
      {publishPreview ? (
        <PublishUriPreviewDialog
          preview={publishPreview}
          onClose={() => setPublishPreview(null)}
        />
      ) : null}
    </aside>
  )
}

export default DevLocalControl
