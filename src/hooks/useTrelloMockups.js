import { useCallback, useEffect, useState } from 'react'
import { downloadAttachment, listAttachments } from '../lib/trello'
import {
  blobToObjectUrl,
  generateBlobId,
  getBlob,
  putBlob
} from '../lib/idb'

// Binary mockup ở IndexedDB (vài GB), metadata ở localStorage để tránh quota.
const CORNERS_KEY = 'etsy-tool.trello-mockup-corners.v1'
const CACHE_KEY = 'etsy-tool.trello-mockup-cache.v2' // bump v2 — shape đổi (blobId thay dataUrl)
const LOCAL_KEY = 'etsy-tool.local-mockup-cache.v2'

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJson(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn(`Save ${key} failed`, e)
  }
}

const loadCorners = () => loadJson(CORNERS_KEY, {})
const loadTrelloMeta = () => loadJson(CACHE_KEY, {}) // {[cardId]: [{id, name, blobId}]}
const loadLocalMeta = () => loadJson(LOCAL_KEY, []) //  [{id, name, blobId}]

const isImageAttachment = att => {
  const m = (att.mimeType || '').toLowerCase()
  if (m.startsWith('image/')) return true
  const n = (att.fileName || att.name || '').toLowerCase()
  return /\.(png|jpg|jpeg|webp)$/.test(n)
}

const isLocalId = id => typeof id === 'string' && id.startsWith('local-')

export function useTrelloMockups({ key, token, cardId }) {
  const [templates, setTemplates] = useState([])
  const [status, setStatus] = useState({ loading: false, error: null, msg: '' })
  const [cornerMap, setCornerMap] = useState(loadCorners)
  const [restored, setRestored] = useState(false)

  useEffect(() => saveJson(CORNERS_KEY, cornerMap), [cornerMap])

  // Restore: local cache + Trello cache theo cardId, async load blob từ IDB
  useEffect(() => {
    let cancelled = false
    async function load() {
      const localMeta = loadLocalMeta()
      const trelloMetaMap = loadTrelloMeta()
      const trelloMeta =
        cardId && Array.isArray(trelloMetaMap[cardId])
          ? trelloMetaMap[cardId]
          : []

      const expanded = []
      // Trello first, then local
      for (const m of [...trelloMeta, ...localMeta]) {
        const blob = await getBlob(m.blobId).catch(() => null)
        expanded.push({
          id: m.id,
          name: m.name,
          blobId: m.blobId,
          blob,
          dataUrl: blobToObjectUrl(blob),
          corners: cornerMap[m.id]?.corners || [],
          fitMode: cornerMap[m.id]?.fitMode || 'fit'
        })
      }
      if (!cancelled) {
        setTemplates(expanded)
        setRestored(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  const fetchAll = useCallback(async () => {
    if (!key || !token || !cardId) {
      setStatus({
        loading: false,
        error: 'Cần Trello Key/Token + Mockup Card ID',
        msg: ''
      })
      return
    }
    setStatus({ loading: true, error: null, msg: 'Đang lấy danh sách attachment…' })
    try {
      const attachments = await listAttachments({ key, token, cardId })
      const images = attachments.filter(isImageAttachment)
      if (!images.length) {
        setStatus({
          loading: false,
          error: 'Card không có attachment ảnh nào',
          msg: ''
        })
        return
      }

      setStatus({
        loading: true,
        error: null,
        msg: `Đang download ${images.length} mockup…`
      })

      const result = []
      const newMeta = []
      for (let i = 0; i < images.length; i++) {
        const att = images[i]
        const fileName = att.fileName || att.name || `mockup-${i + 1}.png`
        setStatus({
          loading: true,
          error: null,
          msg: `Download ${i + 1}/${images.length}: ${fileName}`
        })
        const blob = await downloadAttachment({
          attachment: att,
          key,
          token,
          cardId,
          attachmentId: att.id,
          fileName
        })
        const blobId = generateBlobId()
        await putBlob(blobId, blob)
        const tpl = {
          id: att.id,
          name: fileName,
          blobId,
          blob,
          dataUrl: blobToObjectUrl(blob),
          corners: cornerMap[att.id]?.corners || [],
          fitMode: cornerMap[att.id]?.fitMode || 'fit'
        }
        result.push(tpl)
        newMeta.push({ id: tpl.id, name: tpl.name, blobId })
      }

      const allMeta = loadTrelloMeta()
      allMeta[cardId] = newMeta
      saveJson(CACHE_KEY, allMeta)

      setTemplates(prev => {
        const localOnly = prev.filter(t => isLocalId(t.id))
        return [...result, ...localOnly]
      })
      setStatus({
        loading: false,
        error: null,
        msg: `✓ Đã load ${result.length} mockup từ Trello`
      })
    } catch (err) {
      console.error(err)
      setStatus({
        loading: false,
        error: err.message || String(err),
        msg: ''
      })
    }
  }, [key, token, cardId, cornerMap])

  const updateCorners = useCallback((id, corners) => {
    setCornerMap(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), corners }
    }))
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, corners } : t))
    )
  }, [])

  const updateFitMode = useCallback((id, fitMode) => {
    setCornerMap(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), fitMode }
    }))
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, fitMode } : t))
    )
  }, [])

  const clearAll = useCallback(() => {
    saveJson(LOCAL_KEY, [])
    if (cardId) {
      const c = loadTrelloMeta()
      delete c[cardId]
      saveJson(CACHE_KEY, c)
    }
    setTemplates([])
    setStatus({ loading: false, error: null, msg: '' })
  }, [cardId])

  // Local upload: lưu blob vào IDB, metadata vào localStorage (tránh quota)
  const addLocalMockups = useCallback(
    async fileList => {
      const files = Array.from(fileList || []).filter(
        f =>
          f.type.startsWith('image/') ||
          /\.(png|jpe?g|webp)$/i.test(f.name)
      )
      if (!files.length) return
      setStatus({
        loading: true,
        error: null,
        msg: `Đang load ${files.length} mockup local…`
      })
      try {
        const additions = []
        for (const f of files) {
          const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const blobId = generateBlobId()
          await putBlob(blobId, f)
          additions.push({
            id,
            name: f.name,
            blobId,
            blob: f,
            dataUrl: blobToObjectUrl(f),
            corners: [],
            fitMode: 'fit'
          })
        }
        setTemplates(prev => {
          const next = [...prev, ...additions]
          // Persist tất cả local mockup metadata (không có dataUrl/blob)
          const localOnly = next
            .filter(t => isLocalId(t.id))
            .map(t => ({ id: t.id, name: t.name, blobId: t.blobId }))
          saveJson(LOCAL_KEY, localOnly)
          return next
        })
        setStatus({
          loading: false,
          error: null,
          msg: `✓ Đã thêm ${additions.length} mockup local (đã lưu vào IndexedDB)`
        })
      } catch (err) {
        setStatus({
          loading: false,
          error: `Load local fail: ${err.message}`,
          msg: ''
        })
      }
    },
    []
  )

  const removeTemplate = useCallback(id => {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== id)
      if (isLocalId(id)) {
        const localOnly = next
          .filter(t => isLocalId(t.id))
          .map(t => ({ id: t.id, name: t.name, blobId: t.blobId }))
        saveJson(LOCAL_KEY, localOnly)
      }
      return next
    })
  }, [])

  // Load 1 set: thay templates hiện tại bằng snapshot. Set đã có blob + blobId
  // (đã expanded từ IDB ở useMockupSets), nên persist trực tiếp.
  const loadFromSet = useCallback(snapshot => {
    if (!Array.isArray(snapshot)) return
    const restored = snapshot.map(t => ({
      id: t.id,
      name: t.name,
      blobId: t.blobId,
      blob: t.blob,
      dataUrl: t.dataUrl || blobToObjectUrl(t.blob),
      corners: t.corners || [],
      fitMode: t.fitMode || 'fit'
    }))
    setCornerMap(prev => {
      const next = { ...prev }
      snapshot.forEach(t => {
        next[t.id] = {
          corners: t.corners || [],
          fitMode: t.fitMode || 'fit'
        }
      })
      return next
    })
    setTemplates(restored)
    // Persist vào LOCAL_KEY để session sau load lại — chỉ metadata
    const persistable = restored.map(t => ({
      id: t.id,
      name: t.name,
      blobId: t.blobId
    }))
    saveJson(LOCAL_KEY, persistable)
    setStatus({
      loading: false,
      error: null,
      msg: `✓ Đã load bộ ${restored.length} mockup`
    })
  }, [])

  const readyCount = templates.filter(t => t.corners?.length === 4).length

  return {
    templates,
    status,
    fetchAll,
    addLocalMockups,
    removeTemplate,
    updateCorners,
    updateFitMode,
    clearAll,
    loadFromSet,
    readyCount,
    restored
  }
}
