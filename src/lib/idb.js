// IndexedDB blob store — dùng để lưu binary mockup (PNG/JPG) tránh
// quota của localStorage (5-10MB). IndexedDB cho phép vài trăm MB
// tới vài GB tuỳ browser.
//
// Mỗi blob lưu kèm 1 ID. Hooks chỉ lưu blobId trong localStorage,
// còn binary thực thì ở IDB.

const DB_NAME = 'etsy-tool-blobs'
const STORE = 'blobs'
const VERSION = 1

let dbPromise = null

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function putBlob(id, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getBlob(id) {
  if (!id) return null
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBlob(id) {
  if (!id) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listBlobIds() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(Array.from(req.result || []))
    req.onerror = () => reject(req.error)
  })
}

export function generateBlobId() {
  return `blob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Tạo URL object cho <img src> — sync, dùng trong React state.
// Cần URL.revokeObjectURL khi không dùng nữa để tránh memory leak.
export function blobToObjectUrl(blob) {
  return blob ? URL.createObjectURL(blob) : null
}
