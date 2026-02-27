import './error.css'

function ErrorPanel({ error, onRetry, buttonLabel = 'Try Again', title = 'Error' }) {
  return (
    <div className="error-panel">
      <div className="error-icon">⚠️</div>
      <h2 className="error-title">{title}</h2>
      <p className="error-message">{error}</p>
      <button className="retry-button" onClick={onRetry}>
        {buttonLabel}
      </button>
    </div>
  )
}

export default ErrorPanel

