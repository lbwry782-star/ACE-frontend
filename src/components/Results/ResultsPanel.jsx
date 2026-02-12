import './results.css'

function ResultsPanel({ result }) {
  return (
    <div className="results-panel">
      <h2 className="results-title">Results</h2>
      
      {result.result && (
        <div className="result-content">
          {result.result.title && (
            <div className="result-item">
              <h3 className="result-label">Title:</h3>
              <p className="result-value">{result.result.title}</p>
            </div>
          )}
          
          {result.result.summary && (
            <div className="result-item">
              <h3 className="result-label">Summary:</h3>
              <p className="result-value">{result.result.summary}</p>
            </div>
          )}
          
          {result.result.files && result.result.files.length > 0 && (
            <div className="result-item">
              <h3 className="result-label">Files:</h3>
              <ul className="files-list">
                {result.result.files.map((file, index) => (
                  <li key={index}>{file}</li>
                ))}
              </ul>
            </div>
          )}
          
          {(!result.result.files || result.result.files.length === 0) && (
            <div className="result-thumbnail">
              <div className="thumbnail-placeholder">Image will appear here</div>
            </div>
          )}
        </div>
      )}
      
      {result.requestId && (
        <div className="result-meta">
          <small>Request ID: {result.requestId}</small>
        </div>
      )}
    </div>
  )
}

export default ResultsPanel

