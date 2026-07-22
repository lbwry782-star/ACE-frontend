import { useEffect, useRef, useState } from 'react'
import {
  resolveBuilder1ProgressFrame,
  normalizeBuilder1ProgressPercent,
  getBuilder1InitialRemainingTimeText,
  formatBuilder1InitialProgressStatusLine,
  BUILDER1_PROGRESS_OPERATION
} from '../../utils/builder1Progress'
import './builder1-progress.css'

function Builder1ProgressBar({
  visible,
  progressKey,
  estimatedDurationMs,
  progressOperationType = BUILDER1_PROGRESS_OPERATION.NEXT_AD,
  progressLanguage = 'he',
  jobStartTimeMs = null,
  stageLabel = '',
  taskSucceeded = false,
  taskFailed = false,
  onRevealReady
}) {
  const [displayProgress, setDisplayProgress] = useState(0)
  const [remainingTimeText, setRemainingTimeText] = useState('')
  const rafRef = useRef(null)
  const fallbackStartRef = useRef(null)
  const completionStartRef = useRef(null)
  const completionFromRef = useRef(null)
  const revealCalledRef = useRef(false)
  const progressRef = useRef(0)
  const lastRemainingSecondRef = useRef(-1)

  const visibleRef = useRef(visible)
  const taskSucceededRef = useRef(taskSucceeded)
  const taskFailedRef = useRef(taskFailed)
  const estimatedDurationRef = useRef(estimatedDurationMs)
  const operationTypeRef = useRef(progressOperationType)
  const progressLanguageRef = useRef(progressLanguage)
  const jobStartTimeMsRef = useRef(jobStartTimeMs)
  const onRevealReadyRef = useRef(onRevealReady)

  visibleRef.current = visible
  taskSucceededRef.current = taskSucceeded
  taskFailedRef.current = taskFailed
  estimatedDurationRef.current = estimatedDurationMs
  operationTypeRef.current = progressOperationType
  progressLanguageRef.current = progressLanguage
  jobStartTimeMsRef.current = jobStartTimeMs
  onRevealReadyRef.current = onRevealReady

  const isInitialCampaign = progressOperationType === BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN

  useEffect(() => {
    setDisplayProgress(0)
    progressRef.current = 0
    fallbackStartRef.current = null
    completionStartRef.current = null
    completionFromRef.current = null
    revealCalledRef.current = false
    lastRemainingSecondRef.current = -1
    setRemainingTimeText(
      isInitialCampaign ? getBuilder1InitialRemainingTimeText(0, progressLanguage) : ''
    )
  }, [progressKey, isInitialCampaign, progressLanguage])

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (!visible || taskFailed) {
      return undefined
    }

    if (fallbackStartRef.current == null) {
      fallbackStartRef.current = performance.now()
    }

    const scheduleRevealIfReady = (pct) => {
      if (
        taskSucceededRef.current &&
        pct >= 100 &&
        !revealCalledRef.current &&
        onRevealReadyRef.current
      ) {
        revealCalledRef.current = true
        onRevealReadyRef.current()
      }
    }

    const resolveElapsedMs = () => {
      if (jobStartTimeMsRef.current != null) {
        return Math.max(0, Date.now() - jobStartTimeMsRef.current)
      }
      const anchor = fallbackStartRef.current ?? performance.now()
      return Math.max(0, performance.now() - anchor)
    }

    const tick = (now) => {
      if (!visibleRef.current || taskFailedRef.current) {
        return
      }

      const elapsedMs = resolveElapsedMs()
      const estimate = estimatedDurationRef.current
      const operationType = operationTypeRef.current

      if (
        taskSucceededRef.current &&
        completionStartRef.current == null &&
        progressRef.current < 100
      ) {
        completionStartRef.current = now
        completionFromRef.current = progressRef.current
      }

      let nextPercent
      if (taskSucceededRef.current && completionStartRef.current != null) {
        const completionElapsedMs = now - completionStartRef.current
        nextPercent = resolveBuilder1ProgressFrame({
          elapsedMs,
          estimatedDurationMs: estimate,
          previousPercent: progressRef.current,
          operationType,
          taskSucceeded: true,
          completionFromPercent: completionFromRef.current,
          completionElapsedMs
        })
      } else {
        nextPercent = resolveBuilder1ProgressFrame({
          elapsedMs,
          estimatedDurationMs: estimate,
          previousPercent: progressRef.current,
          operationType
        })
      }

      progressRef.current = nextPercent
      setDisplayProgress(nextPercent)

      if (operationType === BUILDER1_PROGRESS_OPERATION.INITIAL_CAMPAIGN) {
        const elapsedSecond = Math.floor(elapsedMs / 1000)
        if (elapsedSecond !== lastRemainingSecondRef.current) {
          lastRemainingSecondRef.current = elapsedSecond
          setRemainingTimeText(
            getBuilder1InitialRemainingTimeText(elapsedMs, progressLanguageRef.current)
          )
        }
      }

      scheduleRevealIfReady(nextPercent)

      if (taskSucceededRef.current && nextPercent >= 100) {
        return
      }

      if (visibleRef.current && !taskFailedRef.current) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [visible, taskFailed, progressKey, jobStartTimeMs, progressOperationType])

  useEffect(() => {
    if (!visible || taskFailed || !taskSucceeded) return
    if (progressRef.current >= 100 && !revealCalledRef.current && onRevealReadyRef.current) {
      revealCalledRef.current = true
      onRevealReadyRef.current()
    }
  }, [visible, taskFailed, taskSucceeded])

  if (!visible) {
    return null
  }

  const safeProgress = normalizeBuilder1ProgressPercent(displayProgress)
  const initialStatusLine = isInitialCampaign
    ? formatBuilder1InitialProgressStatusLine(
        remainingTimeText || getBuilder1InitialRemainingTimeText(0, progressLanguage),
        progressLanguage
      )
    : ''

  return (
    <div className="builder1-progress-wrap">
      {isInitialCampaign ? (
        <p className="builder1-progress-status-line" dir="rtl" aria-live="polite">
          {initialStatusLine}
        </p>
      ) : stageLabel ? (
        <p
          className="builder1-progress-stage"
          dir={progressLanguage === 'he' ? 'rtl' : undefined}
          aria-live="polite"
        >
          {stageLabel}
        </p>
      ) : null}
      <div
        className="builder1-progress"
        dir="ltr"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeProgress)}
        aria-label={isInitialCampaign ? initialStatusLine : stageLabel || 'Generation progress'}
      >
        <div className="builder1-progress-track">
          <div
            className="builder1-progress-fill"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default Builder1ProgressBar
