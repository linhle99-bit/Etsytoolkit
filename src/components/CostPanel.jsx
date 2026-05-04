import { useState } from 'react'

function fmt(n) {
  if (n < 0.01) return `$${n.toFixed(5)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function fmtTokens(n) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(2)}M`
}

export default function CostPanel({
  totalCost,
  totalCalls,
  totalTokens,
  byModel,
  todayCost,
  todayCalls,
  onReset
}) {
  const [expanded, setExpanded] = useState(false)

  const handleReset = () => {
    if (confirm('Reset toàn bộ log API cost? (không hoàn tác được)')) {
      onReset()
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              💰 API Cost
              <span className="text-2xl font-bold text-emerald-600">
                {fmt(totalCost)}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {totalCalls} call · hôm nay {fmt(todayCost)} ({todayCalls} call)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Thu gọn' : 'Chi tiết'}
          </button>
          <button
            className="btn-secondary text-sm text-red-600"
            onClick={handleReset}
            disabled={totalCalls === 0}
          >
            Reset log
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total $" value={fmt(totalCost)} />
            <Stat label="Total calls" value={totalCalls} />
            <Stat label="Input tokens" value={fmtTokens(totalTokens.input)} />
            <Stat label="Output tokens" value={fmtTokens(totalTokens.output)} />
          </div>

          {Object.keys(byModel).length > 0 && (
            <div>
              <p className="font-medium text-slate-700 mb-1">Theo model</p>
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left py-1">Model</th>
                    <th className="text-right py-1">Calls</th>
                    <th className="text-right py-1">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byModel)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([model, stats]) => (
                      <tr key={model} className="border-t border-slate-100">
                        <td className="py-1 font-mono">{model}</td>
                        <td className="text-right py-1">{stats.calls}</td>
                        <td className="text-right py-1">{fmt(stats.cost)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Pricing: Sonnet $3/$15 · Haiku $1/$5 · Opus $15/$75 per 1M tokens (input/output).
            Cache write 1.25×, cache read 0.1×.
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <p className="text-[11px] text-slate-500 uppercase">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  )
}
