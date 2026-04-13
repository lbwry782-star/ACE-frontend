import { useNavigate } from 'react-router-dom'
import './preview.css'

const BASE_URL = import.meta.env.BASE_URL

const PREVIEW1_ASSETS = [
  { key: '1', defaultSrc: `${BASE_URL}assets/1.jpg`, hoverSrc: `${BASE_URL}assets/Hover1.jpg` },
  { key: '2', defaultSrc: `${BASE_URL}assets/2.jpg`, hoverSrc: `${BASE_URL}assets/Hover2.jpg` },
  { key: '5', defaultSrc: `${BASE_URL}assets/5.jpg`, hoverSrc: `${BASE_URL}assets/Hover5.jpg` }
]

function PreviewPage() {
  const navigate = useNavigate()

  return (
    <div className="preview-page">
      <div className="preview-asset-row">
        {PREVIEW1_ASSETS.map(({ key, defaultSrc, hoverSrc }) => (
          <button
            key={key}
            type="button"
            className="preview-asset-trigger"
            onClick={() => navigate('/builder')}
          >
            <span className="preview-asset-visual">
              <img src={defaultSrc} alt="" className="preview-asset-img preview-asset-img--default" />
              <img src={hoverSrc} alt="" className="preview-asset-img preview-asset-img--hover" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PreviewPage
