import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Preview/preview.css'

const BASE_URL = import.meta.env.BASE_URL

const MOBILE_LAYOUT_MQ = '(max-width: 768px)'
const MOBILE_NAV_DELAY_MS = 1000

const PREVIEW2_ASSETS = [
  {
    key: '5',
    defaultSrc: `${BASE_URL}assets/8.png`,
    hoverSrc: `${BASE_URL}assets/Hover8.png`,
    lines: [
      '● 5 סרטונים ב-60 ש"ח',
      '● 10.2 ש"ח לסרטון',
      '● טקסט שיווקי בן 50 מילים לכל סרטון',
      '● אפשרות להגיע לסרטון אחד עם איכות מקסימלית'
    ]
  },
  {
    key: '2',
    defaultSrc: `${BASE_URL}assets/7.png`,
    hoverSrc: `${BASE_URL}assets/Hover7.png`,
    lines: [
      '● 2 סרטונים ב-50 ש"ח',
      '● טקסט שיווקי בן 50 מילים לכל סרטון',
      '● אפשרות השוואה ובחירה בין שני סרטונים'
    ]
  },
  {
    key: '1',
    defaultSrc: `${BASE_URL}assets/6.png`,
    hoverSrc: `${BASE_URL}assets/Hover6.png`,
    lines: ['● סרטון אחד ב-40 ש"ח', '● טקסט שיווקי בן 50 מילים']
  }
]

function usePreview2MobileLayout() {
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

function Preview2Page() {
  const navigate = useNavigate()
  const isMobile = usePreview2MobileLayout()
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
      navigate('/builder2')
    }, MOBILE_NAV_DELAY_MS)
  }

  return (
    <div className="preview-page">
      <div className={`preview-asset-row${isMobile ? ' preview-asset-row--mobile' : ''}`}>
        {PREVIEW2_ASSETS.map(({ key, defaultSrc, hoverSrc, lines }) => (
          <div key={key} className="preview-asset-group">
            <button
              type="button"
              className="preview-asset-trigger"
              onClick={() => (isMobile ? handleMobileTap(key) : navigate('/builder2'))}
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
            <div className="preview-asset-desc" dir="rtl">
              {lines.map((line, i) => (
                <p key={i} className="preview-asset-desc-line">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Preview2Page
