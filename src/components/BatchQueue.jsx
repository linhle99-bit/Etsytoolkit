import ProductCard from './ProductCard'
import { STATUSES } from '../hooks/useBatch'

export default function BatchQueue({
  queue,
  lengthMode,
  onItemChange,
  onRemove,
  onClearDone,
  onClearAll,
  onRunAll,
  onRunOne,
  onDownloadAll,
  onDownloadOne,
  canDownload,
  running,
  canRun,
  extraWarning
}) {
  const stats = queue.reduce((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1
    return acc
  }, {})

  const pendingCount =
    (stats[STATUSES.PENDING] || 0) + (stats[STATUSES.ERROR] || 0)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">📋 Queue ({queue.length})</h2>
          <p className="text-xs text-slate-500">
            ✓ {stats[STATUSES.DONE] || 0} done · ⏳ {pendingCount} pending · ✗{' '}
            {stats[STATUSES.ERROR] || 0} error
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-secondary text-sm"
            onClick={onClearDone}
            disabled={!stats[STATUSES.DONE]}
          >
            Xóa items đã done
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={onClearAll}
            disabled={!queue.length}
          >
            Xóa hết
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={onDownloadAll}
            disabled={!canDownload || running || !queue.length}
            title="Bundle mọi item thành 1 ZIP có folder cho mỗi sản phẩm"
          >
            {running ? 'Đang zip…' : '↓ Download all (.zip)'}
          </button>
          <button
            className="btn-primary"
            onClick={onRunAll}
            disabled={!canRun || running || !pendingCount}
          >
            {running ? 'Đang chạy...' : `🚀 Push ${pendingCount} lên Trello`}
          </button>
        </div>
      </div>

      {!canRun && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          {extraWarning || 'Cần điền đủ Settings trước khi push.'}
        </div>
      )}

      {queue.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Chưa có sản phẩm. Upload PNG để bắt đầu.
        </p>
      ) : (
        <div className="space-y-2">
          {queue.map(item => (
            <ProductCard
              key={item.id}
              item={item}
              lengthMode={lengthMode}
              onChange={patch => onItemChange(item.id, patch)}
              onRemove={() => onRemove(item.id)}
              onRunOne={onRunOne ? () => onRunOne(item.id) : null}
              onDownload={onDownloadOne ? () => onDownloadOne(item.id) : null}
              runDisabled={!canRun || running}
              downloadDisabled={!canDownload || running}
            />
          ))}
        </div>
      )}
    </div>
  )
}
