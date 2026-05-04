import { useCallback, useEffect, useState } from 'react'

// Pricing $ per 1M tokens (theo bảng giá Anthropic)
// Cache write = 1.25× input, cache read = 0.1× input
const PRICING = {
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-4-7': { input: 15, output: 75 },
  default: { input: 3, output: 15 }
}

function priceFor(model) {
  if (!model) return PRICING.default
  // Match prefix nếu model có version date suffix
  for (const [key, val] of Object.entries(PRICING)) {
    if (key === 'default') continue
    if (model.startsWith(key)) return val
  }
  return PRICING.default
}

export function computeCallCost(model, usage) {
  if (!usage) return 0
  const p = priceFor(model)
  const input = (usage.input_tokens || 0) * p.input
  const output = (usage.output_tokens || 0) * p.output
  const cacheWrite = (usage.cache_creation_input_tokens || 0) * p.input * 1.25
  const cacheRead = (usage.cache_read_input_tokens || 0) * p.input * 0.1
  return (input + output + cacheWrite + cacheRead) / 1e6
}

const COST_KEY = 'etsy-tool.api-cost-log.v1'

function loadLog() {
  try {
    const raw = localStorage.getItem(COST_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveLog(log) {
  try {
    // Cap log to last 5000 entries để tránh localStorage phình
    const capped = log.length > 5000 ? log.slice(-5000) : log
    localStorage.setItem(COST_KEY, JSON.stringify(capped))
  } catch (e) {
    console.warn('Save api-cost log failed', e)
  }
}

export function useApiCost() {
  const [log, setLog] = useState(loadLog)

  useEffect(() => saveLog(log), [log])

  const recordCall = useCallback(({ model, usage }) => {
    if (!usage) return
    setLog(prev => [
      ...prev,
      {
        model: model || 'unknown',
        usage,
        cost: computeCallCost(model, usage),
        ts: Date.now()
      }
    ])
  }, [])

  const reset = useCallback(() => setLog([]), [])

  // Aggregate stats
  const totalCalls = log.length
  const totalCost = log.reduce((s, e) => s + (e.cost || 0), 0)
  const totalTokens = log.reduce(
    (acc, e) => {
      const u = e.usage || {}
      acc.input +=
        (u.input_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0)
      acc.output += u.output_tokens || 0
      return acc
    },
    { input: 0, output: 0 }
  )

  // Per-model breakdown
  const byModel = {}
  for (const e of log) {
    const m = e.model || 'unknown'
    if (!byModel[m]) byModel[m] = { calls: 0, cost: 0 }
    byModel[m].calls++
    byModel[m].cost += e.cost || 0
  }

  // Today total
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startTs = startOfDay.getTime()
  const todayCost = log
    .filter(e => e.ts >= startTs)
    .reduce((s, e) => s + (e.cost || 0), 0)
  const todayCalls = log.filter(e => e.ts >= startTs).length

  return {
    log,
    totalCalls,
    totalCost,
    totalTokens,
    byModel,
    todayCost,
    todayCalls,
    recordCall,
    reset
  }
}
