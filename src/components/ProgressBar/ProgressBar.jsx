import { useEffect, useRef, useState } from 'react'
import './progressbar.css'

function ProgressBar({ isActive, onComplete, key }) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)
  const accelerateIntervalRef = useRef(null)
  const duration = 90000 // 90 seconds in milliseconds

  // Reset progress when component mounts or key changes
  useEffect(() => {
    setProgress(0)
  }, [key])

  useEffect(() => {
    if (isActive) {
      // Reset and start progress
      setProgress(0)
      startTimeRef.current = Date.now()

      // Clear any acceleration interval
      if (accelerateIntervalRef.current) {
        clearInterval(accelerateIntervalRef.current)
        accelerateIntervalRef.current = null
      }

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current
        const newProgress = Math.min((elapsed / duration) * 100, 100)
        setProgress(newProgress)

        if (newProgress >= 100) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          // Progress reached 100%, but generation might still be running
          // Stay at 100% and notify parent
          if (onComplete) {
            onComplete()
          }
        }
      }

      intervalRef.current = setInterval(updateProgress, 100) // Update every 100ms

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } else if (!isActive && progress < 100 && progress > 0) {
      // Generation finished early - accelerate to 100%
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      const accelerate = () => {
        setProgress(prev => {
          if (prev >= 100) {
            if (accelerateIntervalRef.current) {
              clearInterval(accelerateIntervalRef.current)
              accelerateIntervalRef.current = null
            }
            if (onComplete) {
              onComplete()
            }
            return 100
          }
          const increment = (100 - prev) * 0.15 // 15% of remaining per update
          return Math.min(prev + increment, 100)
        })
      }

      accelerateIntervalRef.current = setInterval(accelerate, 50) // Faster updates for acceleration

      return () => {
        if (accelerateIntervalRef.current) {
          clearInterval(accelerateIntervalRef.current)
          accelerateIntervalRef.current = null
        }
      }
    }
  }, [isActive, duration, onComplete])

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  )
}

export default ProgressBar

