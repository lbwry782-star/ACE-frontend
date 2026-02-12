/**
 * Generates a placeholder image with size label
 * @param {string} sizeLabel - e.g., "1024×1024"
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Promise<string>} Data URL of the generated image
 */
export function generatePlaceholderImage(sizeLabel, width, height) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#1a1a1a')
    gradient.addColorStop(1, '#0a0a0a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, width - 2, height - 2)

    // Size label text (scale font size based on image dimensions)
    const fontSize = Math.min(width, height) * 0.05 // 5% of smaller dimension
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.max(24, Math.min(fontSize, 72))}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(sizeLabel, width / 2, height / 2)

    // Convert to data URL
    const dataURL = canvas.toDataURL('image/jpeg', 0.9)
    resolve(dataURL)
  })
}

/**
 * Converts data URL to Blob
 * @param {string} dataURL - Data URL string
 * @returns {Blob} Blob object
 */
export function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

