import JSZip from 'jszip'

// Trigger browser download cho 1 blob.
export function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke để browser kịp save file
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Tạo ZIP chứa 1 file PNG (cho Etsy customer download).
// Trả về Blob của ZIP.
export async function zipPngFile(pngBlob, innerFileName) {
  const zip = new JSZip()
  const ext =
    (innerFileName.match(/\.[^.]+$/) || ['.png'])[0].toLowerCase()
  const baseName = innerFileName.replace(/\.[^.]+$/, '')
  zip.file(`${baseName}${ext}`, pngBlob)
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
}

// Sleep helper cho batch download (tránh browser block multi-download)
export const sleep = ms => new Promise(r => setTimeout(r, ms))
