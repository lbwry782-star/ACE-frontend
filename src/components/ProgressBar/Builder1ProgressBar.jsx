import { useEffect, useRef, useState } from 'react'
import {
  resolveBuilder1ProgressFrame,
  normalizeBuilder1ProgressPercent
} from '../../utils/builder1Progress'
import './builder1-progress.css'

function Builder1ProgressBar({
  visible,
  progressKey,
  estimatedDurationMs,
  stageLabel = '',
  taskSucceeded = false,
  taskFailed = false,
  onRevealReady
}) {
  const [displayProgress, setDisplayProgress] = useState(0)
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)
  const completionStartRef = useRef(null)
  const completionFromRef = useRef(null)
  const revealCalledRef = useRef(false)
  const progressRef = useRef(0)

  const visibleRef = useRef(visible)
  const taskSucceededRef = useRef(taskSucceeded)
  const taskFailedRef = useRef(taskFailed)
  const estimatedDurationRef = useRef(estimatedDurationMs)
  const onRevealReadyRef = useRef(onRevealReady)

  visibleRef.current = visible
  taskSucceededRef.current = taskSucceeded
  taskFailedRef.current = taskFailed
  estimatedDurationRef.current = estimatedDurationMs
  onRevealReadyRef.current = onRevealReady

  useEffect(() => {
    setDisplayProgress(0)
    progressRef.current = 0
    startTimeRef.current = null
    completionStartRef.current = null
    completionFromRef.current = null
    revealCalledRef.current = false
  }, [progressKey])

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (!visible || taskFailed) {
      return undefined
    }

    startTimeRef.current = performance.now()

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

    const tick = (now) => {
      if (!visibleRef.current || taskFailedRef.current) {
        return
      }

      const elapsedMs = now - (startTimeRef.current ?? now)
      const estimate = estimatedDurationRef.current

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
          taskSucceeded: true,
          completionFromPercent: completionFromRef.current,
          completionElapsedMs
        })
      } else {
        nextPercent = resolveBuilder1ProgressFrame({
          elapsedMs,
          estimatedDurationMs: estimate,
          previousPercent: progressRef.current
        })
      }

      progressRef.current = nextPercent
      setDisplayProgress(nextPercent)
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
  }, [visible, taskFailed, progressKey])

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

  return (
    <div className="builder1-progress-wrap">
      {stageLabel ? (
        <p className="builder1-progress-stage" aria-live="polite">
          {stageLabel}
        </p>
      ) : null}
      <div
        className="builder1-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeProgress)}
        aria-label={stageLabel || 'Generation progress'}
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
