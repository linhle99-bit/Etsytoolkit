import { useCallback, useEffect, useState } from 'react'
import {
  blobToObjectUrl,
  generateBlobId,
  getBlob,
  putBlob
} from '../lib/idb'

// Lưu nhiều bộ mockup theo tên. Binary mockup ở IndexedDB, metadata
// (id, name, blobId, corners, fitMode) ở localStorage để tránh quota.

const SETS_KEY = 'etsy-tool.mockup-sets.v2'

function loadMeta() {
  try {
    const raw = localStorage.getItem(SETS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveMeta(arr) {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(arr))
  } catch (e) {
    console.error('Save mockup-sets metadata fail', e)
    alert('Không lưu được metadata bộ mockup. Có thể localStorage đầy.')
  }
}

// Strip volatile/runtime fields trước khi lưu xuống localStorage
function toMeta(set) {
  return {
    id: set.id,
    name: set.name,
    templates: (set.templates || []).map(t => ({
      id: t.id,
      name: t.name,
      blobId: t.blobId,
      corners: t.corners || [],
      fitMode: t.fitMode || 'fit'
    })),
    createdAt: set.createdAt,
    updatedAt: set.updatedAt
  }
}

export function useMockupSets() {
  // sets trong state đã được expand: blob + previewUrl từ IDB
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)

  // Load metadata + fetch blobs from IDB on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      const meta = loadMeta()
      const expanded = []
      for (const m of meta) {
        const tpls = []
        for (const t of m.templates || []) {
          const blob = await getBlob(t.blobId).catch(() => null)
          tpls.push({
            id: t.id,
            name: t.name,
            blobId: t.blobId,
            blob,
            dataUrl: blobToObjectUrl(blob),
            corners: t.corners || [],
            fitMode: t.fitMode || 'fit'
          })
        }
        expanded.push({
          id: m.id,
          name: m.name,
          templates: tpls,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt
        })
      }
      if (!cancelled) {
        setSets(expanded)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist metadata mỗi khi sets thay đổi (sau khi đã load xong)
  useEffect(() => {
    if (loading) return
    saveMeta(sets.map(toMeta))
  }, [sets, loading])

  // Lưu templates hiện tại thành 1 set có tên. Đảm bảo mọi blob có blobId trong IDB.
  const saveAsSet = useCallback(async (name, templates) => {
    const cleanName = (name || '').trim().slice(0, 80) || 'Untitled'
    const id = `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tpls = []
    for (const t of templates || []) {
      let blobId = t.blobId
      if (!blobId && t.blob) {
        blobId = generateBlobId()
        try {
          await putBlob(blobId, t.blob)
        } catch (e) {
          console.error('IDB putBlob fail', e)
          alert('Không lưu được mockup vào IndexedDB. Browser có thể đang restrict storage.')
          return null
        }
      }
      tpls.push({
        id: t.id,
        name: t.name,
        blobId,
        blob: t.blob,
        dataUrl: t.dataUrl,
        corners: t.corners || [],
        fitMode: t.fitMode || 'fit'
      })
    }
    const snapshot = {
      id,
      name: cleanName,
      templates: tpls,
      createdAt: new Date().toISOString()
    }
    setSets(prev => [...prev, snapshot])
    return snapshot
  }, [])

  const deleteSet = useCallback(id => {
    setSets(prev => prev.filter(s => s.id !== id))
    // Không delete blob từ IDB — có thể được set khác hoặc local cache reference.
    // Orphaned blobs an toàn vì IDB có quota lớn.
  }, [])

  const renameSet = useCallback((id, newName) => {
    const cleanName = (newName || '').trim().slice(0, 80) || 'Untitled'
    setSets(prev =>
      prev.map(s => (s.id === id ? { ...s, name: cleanName } : s))
    )
  }, [])

  const overwriteSet = useCallback(async (id, templates) => {
    const tpls = []
    for (const t of templates || []) {
      let blobId = t.blobId
      if (!blobId && t.blob) {
        blobId = generateBlobId()
        try {
          await putBlob(blobId, t.blob)
        } catch (e) {
          console.error('IDB putBlob fail', e)
          return
        }
      }
      tpls.push({
        id: t.id,
        name: t.name,
        blobId,
        blob: t.blob,
        dataUrl: t.dataUrl,
        corners: t.corners || [],
        fitMode: t.fitMode || 'fit'
      })
    }
    setSets(prev =>
      prev.map(s =>
        s.id === id
          ? {
              ...s,
              templates: tpls,
              updatedAt: new Date().toISOString()
            }
          : s
      )
    )
  }, [])

  return {
    sets,
    loading,
    saveAsSet,
    deleteSet,
    renameSet,
    overwriteSet
  }
}
