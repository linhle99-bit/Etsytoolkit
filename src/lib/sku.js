// Format: TD + DDMMYY + "-" + STT 2 chữ số
// VD: TD030526-01

export function generateSKU(index, date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  const stt = String(index + 1).padStart(2, '0')
  return `TD${dd}${mm}${yy}-${stt}`
}

export function generateSKUBatch(count, startIndex = 0, date = new Date()) {
  return Array.from({ length: count }, (_, i) =>
    generateSKU(startIndex + i, date)
  )
}
