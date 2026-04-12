import { useNavigate } from 'react-router-dom'
import './preview.css'

function PreviewPage() {
  const navigate = useNavigate()

  return (
    <div className="preview-page">
      <div className="preview-plan-row">
        {[1, 2, 3].map((n) => (
          <div key={n} className="preview-plan-card">
            <button
              type="button"
              className="preview-plan-button"
              dir="rtl"
              onClick={() => navigate('/builder')}
            >
              לתשלום
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PreviewPage
