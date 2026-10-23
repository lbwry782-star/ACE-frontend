import { useCallback, useEffect, useRef, useState } from 'react'
import { LOCAL_BACKEND_URL, isLocalDevFrontend } from '../../services/backendUrl.js'
import {
  UNDO_COMPACT_SIZE,
  UNDO_EXPANDED_SIZE,
  isLocalUndoShell,
  requestUndoShellResize
} from '../../utils/localDevUndoShell.js'
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
import { PlusCircleIcon, RotateCcwIcon, UploadCloudIcon } from './UndoActionIcons.jsx'

const overlayPanelStyle = {
  position: 'fixed',
  zIndex: 12000,
  left: 12,
  bottom: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 10,
  width: 'min(420px, calc(100vw - 24px))',
  padding: '12px 14px',
  borderRadius: 12,
  background: '#1a1b1f',
  color: '#f4f1ea',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  boxSizing: 'border-box'
}

const shellPanelStyle = {
  position: 'relative',
  zIndex: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 8,
  width: '100%',
  height: 'auto',
  minHeight: 0,
  padding: 8,
  borderRadius: 0,
  background: 'transparent',
  color: 'CanvasText',
  boxShadow: 'none',
  fontFamily: "'Segoe UI', Arial, sans-serif",
  boxSizing: 'border-box'
}

const urlStyle = {
  fontSize: 12,
  lineHeight: 1.35,
  wordBreak: 'break-all',
  color: '#fff'
}

const buttonRowStyle = {
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  width: '100%'
}

const baseButtonStyle = {
  margin: 0,
  flex: 1,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 10px',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.3,
  cursor: 'pointer'
}

const disabledButtonStyle = {
  ...baseButtonStyle,
  background: '#5c5a54',
  color: '#d7d4cc',
  cursor: 'not-allowed',
  opacity: 0.55,
  pointerEvents: 'none'
}

const newButtonStyle = {
  ...baseButtonStyle,
  background: '#163a6b'
}

const cancelButtonStyle = {
  ...baseButtonStyle,
  background: '#7a1f1a'
}

const publishButtonStyle = {
  ...baseButtonStyle,
  background: '#1e5c3a'
}

const titleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8
}

const titleStyle = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 0.6
}

const localBadgeStyle = {
  flex: '0 0 auto',
  padding: '2px 8px',
  borderRadius: 999,
  background: '#2f6f4e',
  color: '#e8f6ec',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.8
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
  const panelRef = useRef(null)

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
      setStatusError(result.message || 'לא ניתן לטעון את מצב הבקרה המקומית.')
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
        setStatusError(result.message || 'לא ניתן לטעון את מצב הבקרה המקומית.')
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
    if (!isLocalUndoShell()) return undefined
    const expanded = Boolean(preview) || confirming || Boolean(publishPreview)
    if (expanded) {
      requestUndoShellResize(UNDO_EXPANDED_SIZE)
      return undefined
    }
    const node = panelRef.current
    if (!node) {
      requestUndoShellResize(UNDO_COMPACT_SIZE)
      return undefined
    }
    const sendHeight = () => {
      requestUndoShellResize({
        width: UNDO_COMPACT_SIZE.width,
        height: Math.ceil(node.getBoundingClientRect().height)
      })
    }
    sendHeight()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(sendHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [preview, confirming, publishPreview])

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
  const shell = isLocalUndoShell()

  const notices = (
    <>
      {statusError ? <p style={errorStyle}>{statusError}</p> : null}
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
    </>
  )

  return (
    <aside ref={panelRef} style={shell ? shellPanelStyle : overlayPanelStyle} dir="rtl" aria-label="לוח בקרת פיתוח מקומי">
      <div style={titleRowStyle}>
        <h1 style={titleStyle}>UNDO</h1>
        <span style={localBadgeStyle}>LOCAL</span>
      </div>
      {notices}
      <div style={buttonRowStyle}>
        <button
          type="button"
          style={canStart ? newButtonStyle : disabledButtonStyle}
          onClick={canStart ? handleStart : undefined}
          disabled={!canStart}
          title={invalid ? status?.message : undefined}
        >
          <PlusCircleIcon />
          {busy === 'start' ? 'פותח…' : 'NEW'}
        </button>
        <button
          type="button"
          style={canPreviewCancel ? cancelButtonStyle : disabledButtonStyle}
          onClick={canPreviewCancel ? handleCancelPreview : undefined}
          disabled={!canPreviewCancel}
        >
          <RotateCcwIcon />
          {busy === 'preview' ? 'בודק…' : 'CANCEL'}
        </button>
        <button
          type="button"
          style={canPreviewPublish ? publishButtonStyle : disabledButtonStyle}
          onClick={canPreviewPublish ? handlePublishPreview : undefined}
          disabled={!canPreviewPublish}
        >
          <UploadCloudIcon />
          {busy === 'publish' ? 'טוען…' : 'PUBLISH'}
        </button>
      </div>
      {!shell || preview || confirming ? (
        <CancelDevelopmentPreviewDialog
          preview={preview}
          onConfirm={handleConfirmExecute}
          confirming={confirming}
          confirmError={confirmError}
          elapsedSeconds={elapsedSeconds}
          progressSnapshot={progressSnapshot}
        />
      ) : null}
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
