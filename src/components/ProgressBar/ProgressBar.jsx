import { useEffect, useRef, useState } from 'react'
import './progressbar.css'

function ProgressBar({
  isActive,
  onComplete,
  progressKey,
  durationMs = 240000,
  progressPercent = null,
  stageLabel = ''
}) {
  const [timeProgress, setTimeProgress] = useState(0)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const accelerateIntervalRef = useRef(null)
  const duration = durationMs
  const useStageProgress = progressPercent != null && Number.isFinite(Number(progressPercent))
  const displayProgress = useStageProgress
    ? Math.max(0, Math.min(100, Number(progressPercent)))
    : timeProgress

  useEffect(() => {
    setTimeProgress(0)
  }, [progressKey])

  useEffect(() => {
    if (useStageProgress) return undefined

    if (isActive) {
      setTimeProgress(0)
      startTimeRef.current = Date.now()

      if (accelerateIntervalRef.current) {
        clearInterval(accelerateIntervalRef.current)
        accelerateIntervalRef.current = null
      }

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current
        const newProgress = Math.min((elapsed / duration) * 100, 100)
        setTimeProgress(newProgress)

        if (newProgress >= 100) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          if (onComplete) onComplete()
        }
      }

      intervalRef.current = setInterval(updateProgress, 100)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    if (!isActive && timeProgress < 100 && timeProgress > 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      const accelerate = () => {
        setTimeProgress((prev) => {
          if (prev >= 100) {
            if (accelerateIntervalRef.current) {
              clearInterval(accelerateIntervalRef.current)
              accelerateIntervalRef.current = null
            }
            if (onComplete) onComplete()
            return 100
          }
          const increment = (100 - prev) * 0.15
          return Math.min(prev + increment, 100)
        })
      }

      accelerateIntervalRef.current = setInterval(accelerate, 50)

      return () => {
        if (accelerateIntervalRef.current) {
          clearInterval(accelerateIntervalRef.current)
          accelerateIntervalRef.current = null
        }
      }
    }

    return undefined
  }, [isActive, duration, onComplete, useStageProgress, timeProgress])

  useEffect(() => {
    if (useStageProgress && isActive && displayProgress >= 100 && onComplete) {
      onComplete()
    }
  }, [useStageProgress, isActive, displayProgress, onComplete])

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

export default ProgressBar
