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

const PREVIEW_TIMEOUT_MS = 90000 // 90 seconds

// Custom error class for network errors
class NetworkError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NetworkError'
    this.isNetworkError = true
  }
}

// API error with code for backend busy (409) and rate_limited
class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const TIMEOUT_MESSAGE = 'The preview request took too long. Please try again.'

async function preview(payload) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS)

  try {
    const requestBody = {
      productName: payload.productName,
      productDescription: payload.productDescription,
      imageSize: payload.imageSize,
      adIndex: payload.adIndex,
      batchState: payload.batchState,
      language: "en"
    }

    if (payload.sessionSeed) {
      requestBody.sessionSeed = payload.sessionSeed
    }
    if (payload.sid) {
      requestBody.sid = payload.sid
    }

    const response = await fetch(`${API_BASE_URL}/api/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(async () => {
        const errorText = await response.text().catch(() => '')
        return { message: errorText || `Server error: ${response.status}` }
      })
      const msg = errorData.message || errorData.error || `Server error: ${response.status}`
      const errStr = typeof msg === 'string' ? msg : (msg.message || '')
      const errLower = errStr.toLowerCase()

      if (response.status === 409 && errLower.includes('busy')) {
        throw new ApiError(errStr || 'Generation in progress', { code: 'BUSY', status: 409 })
      }
      if (response.status === 429 || errLower.includes('rate_limited') || errLower.includes('rate limited')) {
        throw new ApiError(errStr || 'Too many requests', { code: 'RATE_LIMITED', status: response.status })
      }
      throw new Error(errStr)
    }

    const data = await response.json()

    // Backend timeout / busy / rate_limited in 200 body
    if (data && data.error) {
      const errStr = typeof data.error === 'string' ? data.error : (data.error.message || '')
      const errLower = errStr.toLowerCase()
      if (errLower.includes('timeout')) {
        throw new Error(TIMEOUT_MESSAGE)
      }
      if (errLower.includes('busy')) {
        throw new ApiError(errStr || 'Generation in progress', { code: 'BUSY', status: 409 })
      }
      if (errLower.includes('rate_limited') || errLower.includes('rate limited')) {
        throw new ApiError(errStr || 'Too many requests', { code: 'RATE_LIMITED' })
      }
      throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Server error')
    }

    const batchStateFromHeader = response.headers.get('x-ace-batch-state')
    if (batchStateFromHeader) {
      data.batchState = batchStateFromHeader
    }

    return data
  } catch (error) {
    clearTimeout(timeoutId)

    // Client-side timeout (abort after 90s)
    if (error.name === 'AbortError') {
      throw new Error(TIMEOUT_MESSAGE)
    }

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
    
    // Include sessionSeed if provided (prevents repetition between sessions)
    if (payload.sessionSeed) {
      requestBody.sessionSeed = payload.sessionSeed
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

/**
 * Download ZIP for a specific ad by session and index.
 * GET /api/download-zip?sessionId=...&adIndex=...
 */
async function downloadZip(sessionId, adIndex) {
  if (!sessionId || adIndex == null) {
    throw new Error('Missing sessionId or adIndex')
  }
  const params = new URLSearchParams({ sessionId: String(sessionId), adIndex: String(adIndex) })
  const url = `${API_BASE_URL}/api/download-zip?${params.toString()}`
  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    const errorData = await response.json().catch(async () => {
      const errorText = await response.text().catch(() => '')
      return { message: errorText || `Server error: ${response.status}` }
    })
    throw new Error(errorData.message || errorData.error || `Server error: ${response.status}`)
  }

  const zipBlob = await response.blob()
  return { zipBlob }
}

export { preview, generate, downloadZip, NetworkError, ApiError }

