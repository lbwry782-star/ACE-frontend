/**
 * DOM capture helper for Builder1 campaign ZIP export.
 */

function collectDocumentCssText() {
  let cssText = ''
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      const rules = sheet.cssRules || []
      for (const rule of Array.from(rules)) {
        cssText += rule.cssText + '\n'
      }
    } catch (_) {
      /* cross-origin stylesheet */
    }
  }
  return cssText
}

/**
 * @param {HTMLElement | null} node
 * @returns {Promise<string>} raw base64 PNG without data-uri prefix
 */
export async function captureNodeAsPngBase64(node) {
  if (!node) throw new Error('Missing composition node')

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch (_) {
      /* continue */
    }
  }

  const images = node.querySelectorAll('img')
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  )

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
