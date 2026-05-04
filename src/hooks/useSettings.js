import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'etsy-tool.settings.v2'

const DEFAULTS = {
  trelloKey: '',
  trelloToken: '',
  trelloBoardId: '',
  trelloListId: '',                 // List đích (DISNEY-DN) — nơi tạo thẻ output
  trelloMockupCardId: '',           // Thẻ chứa mockup template (MOCKUP card)
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-5',
  lengthMode: 'default',            // 'default' | 'long' | 'short'
  skuPrefix: 'DN',
  rateLimitMs: 500
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {}
  }, [settings])

  const update = useCallback(patch => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => setSettings({ ...DEFAULTS }), [])

  return { settings, update, reset }
}

export function isSettingsComplete(s) {
  return !!(s.trelloKey && s.trelloToken && s.trelloListId && s.claudeApiKey)
}

// Persistent SKU counter — port từ sku_counter.py
// Key: `${prefix}${DDMMYY}` → last seq number
const SKU_KEY = 'etsy-tool.sku_counter.v1'

function loadSkuCounter() {
  try {
    const raw = localStorage.getItem(SKU_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSkuCounter(data) {
  try {
    localStorage.setItem(SKU_KEY, JSON.stringify(data))
  } catch {}
}

function formatDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}${mm}${yy}`
}

function formatSeq(n) {
  return n < 100 ? String(n).padStart(2, '0') : String(n)
}

// Format: {PREFIX}{DDMMYY}{NN} (no dash) — VD: DN03052601
export function allocateSKUs(prefix, count, today = new Date()) {
  if (!prefix || count <= 0) return []
  const cleanPrefix = prefix.trim().toUpperCase()
  const datePart = formatDate(today)
  const key = `${cleanPrefix}${datePart}`
  const counter = loadSkuCounter()
  const last = counter[key] || 0
  const skus = []
  for (let i = 1; i <= count; i++) {
    skus.push(`${cleanPrefix}${datePart}${formatSeq(last + i)}`)
  }
  counter[key] = last + count
  saveSkuCounter(counter)
  return skus
}

export function resetSkuCounter(prefix, today = new Date()) {
  const key = `${prefix.trim().toUpperCase()}${formatDate(today)}`
  const counter = loadSkuCounter()
  if (key in counter) {
    delete counter[key]
    saveSkuCounter(counter)
    return true
  }
  return false
}
