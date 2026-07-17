import { useEffect, useRef, useState } from 'react'
import {
  resolveBuilder1ProgressFrame
} from '../../utils/builder1Progress'
import './progressbar.css'

function Builder1ProgressBar({
  isActive,
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

    if (!isActive || taskFailed) {
      return undefined
    }

    startTimeRef.current = performance.now()

    const tick = (now) => {
      if (!isActive || taskFailed) return

      const elapsedMs = now - (startTimeRef.current ?? now)

      if (taskSucceeded && completionStartRef.current == null && progressRef.current < 100) {
        completionStartRef.current = now
        completionFromRef.current = progressRef.current
      }

      let nextPercent
      if (taskSucceeded && completionStartRef.current != null) {
        const completionElapsedMs = now - completionStartRef.current
        nextPercent = resolveBuilder1ProgressFrame({
          elapsedMs,
          estimatedDurationMs,
          previousPercent: progressRef.current,
          taskSucceeded: true,
          completionFromPercent: completionFromRef.current,
          completionElapsedMs
        })
      } else {
        nextPercent = resolveBuilder1ProgressFrame({
          elapsedMs,
          estimatedDurationMs,
          previousPercent: progressRef.current
        })
      }

      progressRef.current = nextPercent
      setDisplayProgress(nextPercent)

      if (taskSucceeded && nextPercent >= 100 && !revealCalledRef.current) {
        revealCalledRef.current = true
        if (onRevealReady) onRevealReady()
      }

      if (taskSucceeded && nextPercent >= 100) {
        return
      }

      if (isActive && !taskFailed) {
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
  }, [isActive, estimatedDurationMs, taskSucceeded, taskFailed, onRevealReady, progressKey])

  useEffect(() => {
    if (!isActive || taskFailed || !taskSucceeded) return
    if (progressRef.current >= 100 && !revealCalledRef.current) {
      revealCalledRef.current = true
      if (onRevealReady) onRevealReady()
    }
  }, [isActive, taskFailed, taskSucceeded, onRevealReady])

  if (!isActive && displayProgress <= 0) {
    return null
  }

  return (
    <div className="progress-bar-container">
      {stageLabel ? (
        <p className="progress-bar-stage" aria-live="polite">
          {stageLabel}
        </p>
      ) : null}
      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayProgress)}
        aria-label={stageLabel || 'Generation progress'}
      >
        <div className="progress-bar-fill" style={{ width: `${displayProgress}%` }} />
      </div>
    </div>
  )
}

export default Builder1ProgressBar
