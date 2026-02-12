import './status.css'

function StatusPanel() {
  return (
    <div className="status-panel">
      <div className="spinner"></div>
      <p className="status-text">Generating...</p>
    </div>
  )
}

export default StatusPanel

