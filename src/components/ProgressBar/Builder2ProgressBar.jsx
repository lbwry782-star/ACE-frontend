import { useEffect, useRef, useState } from 'react'
import {
  resolveBuilder2ProgressFrame,
  normalizeBuilder2ProgressPercent,
  getBuilder2RemainingTimeText,
  formatBuilder2ProgressStatusLine
} from '../../utils/builder2Progress'
import './builder2-progress.css'

function Builder2ProgressBar({
  visible,
  progressKey,
  jobStartTimeMs = null,
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
  const jobStartTimeMsRef = useRef(jobStartTimeMs)
  const onRevealReadyRef = useRef(onRevealReady)

  visibleRef.current = visible
  taskSucceededRef.current = taskSucceeded
  taskFailedRef.current = taskFailed
  jobStartTimeMsRef.current = jobStartTimeMs
  onRevealReadyRef.current = onRevealReady

  useEffect(() => {
    setDisplayProgress(0)
    progressRef.current = 0
    fallbackStartRef.current = null
    completionStartRef.current = null
    completionFromRef.current = null
    revealCalledRef.current = false
    lastRemainingSecondRef.current = -1
    setRemainingTimeText(getBuilder2RemainingTimeText(0))
  }, [progressKey])

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
        nextPercent = resolveBuilder2ProgressFrame({
          elapsedMs,
          previousPercent: progressRef.current,
          taskSucceeded: true,
          completionFromPercent: completionFromRef.current,
          completionElapsedMs
        })
      } else {
        nextPercent = resolveBuilder2ProgressFrame({
          elapsedMs,
          previousPercent: progressRef.current
        })
      }

      progressRef.current = nextPercent
      setDisplayProgress(nextPercent)

      const elapsedSecond = Math.floor(elapsedMs / 1000)
      if (elapsedSecond !== lastRemainingSecondRef.current) {
        lastRemainingSecondRef.current = elapsedSecond
        setRemainingTimeText(getBuilder2RemainingTimeText(elapsedMs))
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
  }, [visible, taskFailed, progressKey, jobStartTimeMs])

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

  const safeProgress = normalizeBuilder2ProgressPercent(displayProgress)
  const statusLine = formatBuilder2ProgressStatusLine(
    remainingTimeText || getBuilder2RemainingTimeText(0)
  )

  return (
    <div className="builder2-progress-wrap">
      <p className="builder2-progress-status-line" dir="rtl" aria-live="polite">
        {statusLine}
      </p>
      <div
        className="builder2-progress"
        dir="ltr"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeProgress)}
        aria-label={statusLine}
      >
        <div className="builder2-progress-track">
          <div
            className="builder2-progress-fill"
            style={{ width: `${safeProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default Builder2ProgressBar
