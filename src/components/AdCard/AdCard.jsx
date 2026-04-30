import { useState, useEffect, useRef } from 'react'
import { generateMarketingText } from '../../utils/marketingText'
import { API_BASE_URL } from '../../services/api'
import './adcard.css'

function safeHeadlineString(v) {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : String(v)
  return s.trim()
}

/** User-selected Builder1 format only (never model output). */
function normalizeAdFormat(raw) {
  const s = safeHeadlineString(raw).toLowerCase()
  if (s === 'portrait') return 'portrait'
  if (s === 'square') return 'square'
  if (s === 'landscape') return 'landscape'
  return 'landscape'
}

function textContainsHebrew(text) {
  const s = safeHeadlineString(text)
  if (!s) return false
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0x0590 && c <= 0x05ff) return true
    if (c >= 0xfb1d && c <= 0xfb4f) return true
  }
  return false
}

/** Builder1 landscape: Hebrew → headline left / visual right; otherwise visual left / headline right. */
function landscapeCompositionLayout(detectedLanguage, headlineProductName, headlineText, headlineFull, line1, line2) {
  const lang = safeHeadlineString(detectedLanguage).toLowerCase()
  if (lang === 'he' || lang === 'hebrew' || lang.startsWith('he')) {
    return 'headline_left_visual_right'
  }
  if (
    textContainsHebrew(line1) ||
    textContainsHebrew(line2) ||
    textContainsHebrew(headlineProductName) ||
    textContainsHebrew(headlineText) ||
    textContainsHebrew(headlineFull)
  ) {
    return 'headline_left_visual_right'
  }
  return 'visual_left_headline_right'
}

function clampWeight(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function parseHeadlineLines(headlineLines) {
  if (Array.isArray(headlineLines)) {
    return headlineLines
      .map((line) => safeHeadlineString(line))
      .filter(Boolean)
  }
  if (headlineLines && typeof headlineLines === 'object') {
    const values = []
    if (headlineLines.line1 != null) values.push(headlineLines.line1)
    if (headlineLines.line2 != null) values.push(headlineLines.line2)
    if (headlineLines.line3 != null) values.push(headlineLines.line3)
    if (values.length > 0) {
      return values.map((line) => safeHeadlineString(line)).filter(Boolean)
    }
  }
  return []
}

function collectDocumentCssText() {
  let cssText = ''
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      const rules = sheet.cssRules || []
      for (const rule of Array.from(rules)) {
        cssText += rule.cssText + '\n'
      }
    } catch (_) {
      /* Ignore cross-origin stylesheets */
    }
  }
  return cssText
}

async function captureNodeAsPngBase64(node) {
  if (!node) throw new Error('Missing composition node')
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch (_) {
      /* ignore font readiness errors and continue capture */
    }
  }
  const rect = node.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))

  const serialized = new XMLSerializer().serializeToString(node)
  const cssText = collectDocumentCssText()
  const escapedCss = cssText.replace(/<\/style>/g, '<\\/style>')
  const xhtml = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">
      <style>${escapedCss}</style>
      ${serialized}
    </div>
  `
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        ${xhtml}
      </foreignObject>
    </svg>
  `
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to render composition image'))
    img.src = svgDataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(image, 0, 0, width, height)

  const pngDataUrl = canvas.toDataURL('image/png')
  const commaIdx = pngDataUrl.indexOf(',')
  if (commaIdx < 0) throw new Error('Invalid PNG data URL')
  return pngDataUrl.slice(commaIdx + 1)
}

function AdCard({
  attemptNumber,
  format: propFormat,
  imageBase64: propImageBase64,
  imageDataURL: propImageDataURL,
  marketingText: propMarketingText,
  headline: propHeadline,
  headlineProductName: propHeadlineProductName,
  headlineText: propHeadlineText,
  headlineFull: propHeadlineFull,
  headlineAlign: propHeadlineAlign,
  headlineLines: propHeadlineLines,
  visualWeight: propVisualWeight,
  headlineWeight: propHeadlineWeight,
  safeMarginCss: propSafeMarginCss,
  headlineSizeRule: propHeadlineSizeRule,
  productNameScale: propProductNameScale,
  headlineTextScale: propHeadlineTextScale,
  headlinePlacement: propHeadlinePlacement,
  detectedLanguage: propDetectedLanguage,
  sessionId,
  isGenerating
}) {
  const compositionRef = useRef(null)
  const [imageDataURL, setImageDataURL] = useState(propImageDataURL || null)
  const [marketingText, setMarketingText] = useState(propMarketingText ?? generateMarketingText(attemptNumber))
  const [imageBase64, setImageBase64] = useState(safeHeadlineString(propImageBase64))
  const [headline, setHeadline] = useState(propHeadline ?? '')
  const [downloadLoading, setDownloadLoading] = useState(false)

  useEffect(() => {
    if (propImageDataURL) setImageDataURL(propImageDataURL)
  }, [propImageDataURL])
  useEffect(() => {
    if (propMarketingText != null) setMarketingText(propMarketingText)
  }, [propMarketingText])
  useEffect(() => {
    setImageBase64(safeHeadlineString(propImageBase64))
  }, [propImageBase64])
  useEffect(() => {
    if (propHeadline != null) setHeadline(propHeadline)
  }, [propHeadline])

  const canDownload = Boolean(imageBase64) && !isGenerating && !downloadLoading

  const handleDownload = async () => {
    if (!canDownload) return
    setDownloadLoading(true)
    try {
      const compositionNode = compositionRef.current
      if (!compositionNode) {
        throw new Error('Builder1 composition not found for ZIP export')
      }
      const composedImageBase64 = await captureNodeAsPngBase64(compositionNode)
      const response = await fetch(`${API_BASE_URL}/api/builder1-download-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/zip, application/octet-stream, */*'
        },
        body: JSON.stringify({
          imageBase64: composedImageBase64,
          marketingText: marketingText ?? ''
        })
      })

      if (!response.ok) {
        const errBody = await response.json().catch(async () => {
          const errText = await response.text().catch(() => '')
          return { message: errText || `Server error: ${response.status}` }
        })
        const msg = errBody?.message || errBody?.error || `Server error: ${response.status}`
        throw new Error(typeof msg === 'string' ? msg : 'Download ZIP failed')
      }

      const zipBlob = await response.blob()
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'builder1-ad.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download Builder1 ZIP:', error)
    } finally {
      setDownloadLoading(false)
    }
  }

  const headlineTrimmed = typeof headline === 'string' ? headline.trim() : ''
  const parsedLines = parseHeadlineLines(propHeadlineLines)
  const fallbackLine1 = safeHeadlineString(propHeadlineProductName)
  const fallbackLine2 = safeHeadlineString(propHeadlineText)
  const fallbackFull = safeHeadlineString(propHeadlineFull) || headlineTrimmed
  const line1 = parsedLines[0] || fallbackLine1 || fallbackFull
  const line2 = parsedLines.length > 1
    ? parsedLines.slice(1).join('\n')
    : (fallbackLine2 || (line1 === fallbackFull ? '' : fallbackFull))
  const hasHeadlineData = Boolean(line1 || line2)
  const showComposition = Boolean(imageDataURL || hasHeadlineData)
  const adFormat = normalizeAdFormat(propFormat)
  let effectiveLayout
  if (adFormat === 'portrait' || adFormat === 'square') {
    effectiveLayout = 'headline_below_visual'
  } else if (adFormat === 'landscape') {
    effectiveLayout = landscapeCompositionLayout(
      propDetectedLanguage,
      propHeadlineProductName,
      propHeadlineText,
      propHeadlineFull,
      line1,
      line2
    )
  } else {
    effectiveLayout = 'headline_below_visual'
  }
  const layoutClass = `ad-card-layout-${effectiveLayout}`
  const formatClass = `ad-card-format-${adFormat}`
  const showHeadlineBlock = hasHeadlineData
  const visualWeight = clampWeight(propVisualWeight, 0.68)
  const headlineWeight = clampWeight(propHeadlineWeight, 0.32)
  const safeMarginCss = safeHeadlineString(propSafeMarginCss) || 'clamp(24px, 4vw, 48px)'
  const productScale = clampWeight(propProductNameScale, 1)
  const textScale = clampWeight(propHeadlineTextScale, 1)
  const formatRatioCss =
    adFormat === 'portrait' ? '1080 / 1536' : adFormat === 'square' ? '1 / 1' : '1536 / 1080'

  const compositionStyle = {
    '--ad-safe-margin': safeMarginCss,
    '--ad-format-ratio': formatRatioCss,
    '--visual-weight': String(visualWeight),
    '--headline-weight': String(headlineWeight),
    '--headline-product-scale': String(productScale),
    '--headline-text-scale': String(textScale)
  }

  return (
    <div className="ad-card">
      {showComposition && (
        <div className="ad-card-composition">
          <div
            ref={compositionRef}
            className={`ad-card-composition-adunit ${layoutClass} ${formatClass}`}
            style={compositionStyle}
            data-ad-format={adFormat}
            data-composition-layout={effectiveLayout}
            data-headline-align={safeHeadlineString(propHeadlineAlign) || undefined}
            data-headline-size-rule={safeHeadlineString(propHeadlineSizeRule) || undefined}
            data-headline-placement={safeHeadlineString(propHeadlinePlacement) || undefined}
          >
            {showHeadlineBlock ? (
              <div className="ad-card-composition-headline-zone ad-card-builder1-headline">
                {line1 ? (
                  <div className="ad-card-builder1-headline-product" dir="auto">
                    <bdi>{line1}</bdi>
                  </div>
                ) : null}
                {line2 ? (
                  <div className="ad-card-builder1-headline-text" dir="auto">
                    <bdi>{line2}</bdi>
                  </div>
                ) : null}
              </div>
            ) : null}
            {imageDataURL ? (
              <div className="ad-card-composition-visual-zone">
                <div className="ad-card-image">
                  <img src={imageDataURL} alt={`Ad ${attemptNumber}`} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="ad-card-text">
        <p>{marketingText}</p>
      </div>
      <button
        type="button"
        className="ad-card-download"
        onClick={handleDownload}
        disabled={!canDownload}
      >
        {downloadLoading ? 'Downloading…' : 'DOWNLOAD ZIP להורדה'}
      </button>
    </div>
  )
}

export default AdCard
