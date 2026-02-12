import JSZip from 'jszip'

/**
 * Creates a ZIP file containing image and text files
 * @param {string} imageDataURL - Data URL of the image
 * @param {string} marketingText - Marketing text content
 * @param {string} filename - ZIP filename (e.g., "ad-1.zip")
 * @returns {Promise<void>}
 */
export async function createAndDownloadZip(imageDataURL, marketingText, filename) {
  const zip = new JSZip()

  // Convert image data URL to blob
  const imageBlob = dataURLtoBlob(imageDataURL)
  zip.file('image.jpg', imageBlob)

  // Add text file
  zip.file('text.txt', marketingText)

  // Generate ZIP and trigger download
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Converts data URL to Blob
 * @param {string} dataURL - Data URL string
 * @returns {Blob} Blob object
 */
function dataURLtoBlob(dataURL) {
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

