import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../Preview/preview.css'

const BASE_URL = import.meta.env.BASE_URL

const MOBILE_LAYOUT_MQ = '(max-width: 768px)'
const MOBILE_NAV_DELAY_MS = 1000
const PREVIEW2_ASSET_KEY_TO_MAX_VIDEOS = { '1': 2, '2': 3, '5': 4 }
const BUILDER2_MAX_VIDEOS_SESSION_KEY = 'ace_builder2_max_videos'

const PREVIEW2_ASSETS = [
  {
    key: '5',
    defaultSrc: `${BASE_URL}assets/8.png`,
    hoverSrc: `${BASE_URL}assets/Hover8.png`,
    lines: [
      '● 4 סרטונים ב-70 ש"ח',
      '● 17.5 ש"ח לסרטון',
      '● טקסט שיווקי בן 50 מילים לכל סרטון',
      '● אפשרות להגיע לסרטון אחד עם איכות מקסימלית'
    ]
  },
  {
    key: '2',
    defaultSrc: `${BASE_URL}assets/7.png`,
    hoverSrc: `${BASE_URL}assets/Hover7.png`,
    lines: [
      '● 3 סרטונים ב-55 ש"ח',
      '● טקסט שיווקי בן 50 מילים לכל סרטון',
      '● אפשרות השוואה ובחירה בין שני סרטונים'
    ]
  },
  {
    key: '1',
    defaultSrc: `${BASE_URL}assets/6.png`,
    hoverSrc: `${BASE_URL}assets/Hover6.png`,
    lines: ['● 2 סרטונים ב-40 ש"ח', '● טקסט שיווקי בן 50 מילים']
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

  const goToBuilder2WithSessionLength = (assetKey) => {
    const maxVideos = PREVIEW2_ASSET_KEY_TO_MAX_VIDEOS[assetKey] ?? 2
    try {
      sessionStorage.setItem(BUILDER2_MAX_VIDEOS_SESSION_KEY, String(maxVideos))
    } catch (_) {
      /* ignore */
    }
    navigate('/builder2')
  }

  const handleMobileTap = (key) => {
    if (navigateLockRef.current) return
    navigateLockRef.current = true
    setMobileActiveKey(key)
    navigateTimeoutRef.current = setTimeout(() => {
      navigateTimeoutRef.current = null
      goToBuilder2WithSessionLength(key)
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
              onClick={() => (isMobile ? handleMobileTap(key) : goToBuilder2WithSessionLength(key))}
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
