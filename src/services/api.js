// Get backend URL from environment variables
// Support both Vite (import.meta.env) and CRA (process.env)
const getBackendUrl = () => {
  // Vite
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }
  // CRA / Node.js
  if (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL
  }
  // Fallback
  return 'https://ace-backend-k1p6.onrender.com'
}

const API_BASE_URL = getBackendUrl()

// Custom error class for network errors
class NetworkError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NetworkError'
    this.isNetworkError = true
  }
}

async function preview(payload) {
  try {
    const requestBody = {
      productName: payload.productName,
      productDescription: payload.productDescription,
      imageSize: payload.imageSize,
      adIndex: payload.adIndex,
      batchState: payload.batchState,
      language: "en"
    }
    
    // Include sid if provided (required for session validation)
    if (payload.sid) {
      requestBody.sid = payload.sid
    }

    const response = await fetch(`${API_BASE_URL}/api/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      // Try to read error as JSON, fallback to text
      const errorData = await response.json().catch(async () => {
        const errorText = await response.text().catch(() => '')
        return { message: errorText || `Server error: ${response.status}` }
      })
      throw new Error(errorData.message || `Server error: ${response.status}`)
    }

    // Preview returns JSON with imageBase64 field (not ZIP)
    // Response format: { imageBase64: "...", marketingText: "...", previewId: "..." }
    const data = await response.json()
    
    // Get batchState from response body or header
    const batchStateFromHeader = response.headers.get('x-ace-batch-state')
    if (batchStateFromHeader) {
      data.batchState = batchStateFromHeader
    }
    
    return data
  } catch (error) {
    // Check for network/fetch errors
    if (
      error instanceof TypeError ||
      error.message.includes('fetch') ||
      error.message.includes('Network') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError'
    ) {
      throw new NetworkError('Network error: Unable to connect to server')
    }
    throw error
  }
}

async function generate(payload) {
  try {
    const requestBody = {
      previewId: payload.previewId,
      adIndex: payload.adIndex,
      batchState: payload.batchState,
      language: "en"
    }
    
    // Include sid if provided (required for session validation)
    if (payload.sid) {
      requestBody.sid = payload.sid
    }

    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      // Try to read error as JSON, fallback to text
      const errorData = await response.json().catch(async () => {
        const errorText = await response.text().catch(() => '')
        return { message: errorText || `Server error: ${response.status}` }
      })
      throw new Error(errorData.message || `Server error: ${response.status}`)
    }

    // Generate returns ZIP file (binary blob, not JSON)
    // Use response.blob() to read the ZIP file
    const zipBlob = await response.blob()
    const batchState = response.headers.get('x-ace-batch-state')
    return { zipBlob, batchState }
  } catch (error) {
    // Check for network/fetch errors
    if (
      error instanceof TypeError ||
      error.message.includes('fetch') ||
      error.message.includes('Network') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError'
    ) {
      throw new NetworkError('Network error: Unable to connect to server')
    }
    throw error
  }
}

export { preview, generate, NetworkError }

