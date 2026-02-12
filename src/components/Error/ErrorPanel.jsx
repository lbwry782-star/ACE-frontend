import './error.css'

function ErrorPanel({ error, onRetry }) {
  return (
    <div className="error-panel">
      <div className="error-icon">⚠️</div>
      <h2 className="error-title">Error</h2>
      <p className="error-message">{error}</p>
      <button className="retry-button" onClick={onRetry}>
        Try Again
      </button>
    </div>
  )
}

export default ErrorPanel

