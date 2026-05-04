import { useCallback, useEffect, useState } from 'react'

// Preset = { id, name, mockupDataUrl, mockupType, mockupName, corners, fitMode, shapeMode, createdAt }
// Lưu vào localStorage. mockup binary lưu base64 dataURL — đủ cho mockup ~1MB.

const STORAGE_KEY = 'etsy-tool.presets.v1'

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Cannot save presets — quota exceeded?', e)
  }
}

function readBlobAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export function usePresets() {
  const [presets, setPresets] = useState(loadAll)

  useEffect(() => saveAll(presets), [presets])

  const create = useCallback(
    async ({ name, mockupBlob, corners, fitMode, shapeMode }) => {
      const dataUrl = await readBlobAsDataURL(mockupBlob)
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const preset = {
        id,
        name: (name || '').trim().slice(0, 80) || 'Untitled',
        mockupDataUrl: dataUrl,
        mockupType: mockupBlob.type || 'image/jpeg',
        mockupName: mockupBlob.name || 'mockup',
        corners,
        fitMode: fitMode || 'fit',
        shapeMode: shapeMode || 'free',
        createdAt: new Date().toISOString()
      }
      setPresets(prev => [...prev, preset])
      return preset
    },
    []
  )

  const remove = useCallback(id => {
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [])

  const update = useCallback((id, patch) => {
    setPresets(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  return { presets, create, remove, update }
}
