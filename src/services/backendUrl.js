/**
 * Backend origin resolution.
 * Local Vite dev never falls back to the public Render host.
 */

export const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000'
export const PRODUCTION_BACKEND_FALLBACK = 'https://ace-backend-k1p6.onrender.com'

function stripTrailingSlashes(value) {
  let text = String(value ?? '').trim()
  while (text.endsWith('/')) text = text.slice(0, -1)
  return text
}

export function normalizeBackendUrl(value) {
  return stripTrailingSlashes(value)
}

export function isPublicRenderBackendUrl(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return false
  return text.includes('onrender.com') || text.includes('ace-backend-k1p6')
}

export function isLocalDevBackendUrl(value) {
  try {
    const parsed = new URL(stripTrailingSlashes(value))
    const hostOk = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
    const portOk = parsed.port === '5000'
    const protocolOk = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    return hostOk && portOk && protocolOk
  } catch (_) {
    return false
  }
}

/**
 * @param {{ isDev: boolean, envUrl?: string|null }} options
 */
export function resolveBackendUrl({ isDev, envUrl } = {}) {
  const configured = stripTrailingSlashes(envUrl)

  if (isDev) {
    if (configured && isLocalDevBackendUrl(configured)) {
      return configured
    }
    return LOCAL_BACKEND_URL
  }

  if (configured && isLocalDevBackendUrl(configured)) {
    return PRODUCTION_BACKEND_FALLBACK
  }
  if (configured) {
    return configured
  }
  return PRODUCTION_BACKEND_FALLBACK
}

function readEnvBackendUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    const value = String(import.meta.env.VITE_BACKEND_URL).trim()
    if (value) return value
  }
  if (typeof process !== 'undefined' && process.env?.VITE_BACKEND_URL) {
    const value = String(process.env.VITE_BACKEND_URL).trim()
    if (value) return value
  }
  if (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) {
    const value = String(process.env.REACT_APP_BACKEND_URL).trim()
    if (value) return value
  }
  return ''
}

export function isLocalDevFrontend() {
  return Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV)
}

export function getBackendUrl() {
  return resolveBackendUrl({
    isDev: isLocalDevFrontend(),
    envUrl: readEnvBackendUrl()
  })
}
