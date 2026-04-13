import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './preview.css'

const BASE_URL = import.meta.env.BASE_URL

const MOBILE_LAYOUT_MQ = '(max-width: 768px)'
const MOBILE_NAV_DELAY_MS = 1000

const PREVIEW1_ASSETS = [
  { key: '1', defaultSrc: `${BASE_URL}assets/1.png`, hoverSrc: `${BASE_URL}assets/Hover1.png` },
  { key: '2', defaultSrc: `${BASE_URL}assets/2.png`, hoverSrc: `${BASE_URL}assets/Hover2.png` },
  { key: '5', defaultSrc: `${BASE_URL}assets/5.png`, hoverSrc: `${BASE_URL}assets/Hover5.png` }
]

function usePreview1MobileLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_LAYOUT_MQ).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

function PreviewPage() {
  const navigate = useNavigate()
  const isMobile = usePreview1MobileLayout()
  const [mobileActiveKey, setMobileActiveKey] = useState(null)
  const navigateLockRef = useRef(false)
  const navigateTimeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current)
        navigateTimeoutRef.current = null
      }
      navigateLockRef.current = false
      setMobileActiveKey(null)
    }
  }, [isMobile])

  const handleMobileTap = (key) => {
    if (navigateLockRef.current) return
    navigateLockRef.current = true
    setMobileActiveKey(key)
    navigateTimeoutRef.current = setTimeout(() => {
      navigateTimeoutRef.current = null
      navigate('/builder')
    }, MOBILE_NAV_DELAY_MS)
  }

  return (
    <div className="preview-page">
      <div className={`preview-asset-row${isMobile ? ' preview-asset-row--mobile' : ''}`}>
        {PREVIEW1_ASSETS.map(({ key, defaultSrc, hoverSrc }) => (
          <button
            key={key}
            type="button"
            className="preview-asset-trigger"
            onClick={() => (isMobile ? handleMobileTap(key) : navigate('/builder'))}
          >
            <span className="preview-asset-visual">
              {isMobile ? (
                <img
                  src={mobileActiveKey === key ? hoverSrc : defaultSrc}
                  alt=""
                  className="preview-asset-img preview-asset-img--mobile"
                />
              ) : (
                <>
                  <img
                    src={defaultSrc}
                    alt=""
                    className="preview-asset-img preview-asset-img--default"
                  />
                  <img
                    src={hoverSrc}
                    alt=""
                    className="preview-asset-img preview-asset-img--hover"
                  />
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PreviewPage
