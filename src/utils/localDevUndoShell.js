import { isLocalDevFrontend } from '../services/backendUrl.js'

export const LOCAL_UNDO_HASH_PATH = '/local-undo'
export const UNDO_COMPACT_SIZE = { width: 420, height: 168 }
export const UNDO_EXPANDED_SIZE = { width: 760, height: 820 }

export function isLocalUndoShell() {
  if (!isLocalDevFrontend()) return false
  if (typeof window === 'undefined') return false
  const hash = String(window.location.hash || '')
  return hash.includes(LOCAL_UNDO_HASH_PATH)
}

export function requestUndoShellResize(size) {
  if (!isLocalUndoShell()) return
  const width = Math.max(360, Number(size?.width) || UNDO_COMPACT_SIZE.width)
  const height = Math.max(260, Number(size?.height) || UNDO_COMPACT_SIZE.height)
  const payload = JSON.stringify({ type: 'ace-undo-resize', width, height })
  try {
    window.chrome?.webview?.postMessage(payload)
  } catch (_) {
    /* not hosted in WebView2 */
  }
  try {
    window.webkit?.messageHandlers?.aceUndo?.postMessage(payload)
  } catch (_) {
    /* not hosted in WKWebView */
  }
}
