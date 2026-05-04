import SeoPanel from './SeoPanel'
import { STATUSES } from '../hooks/useBatch'

const STATUS_LABELS = {
  [STATUSES.PENDING]: { text: 'Chờ', cls: 'bg-slate-100 text-slate-700' },
  [STATUSES.MOCKUP]: { text: 'Đang ghép mockup...', cls: 'bg-blue-100 text-blue-700' },
  [STATUSES.SEO]: { text: 'Đang tạo title...', cls: 'bg-purple-100 text-purple-700' },
  [STATUSES.PUSHING]: { text: 'Đang push Trello...', cls: 'bg-amber-100 text-amber-700' },
  [STATUSES.DONE]: { text: '✓ Done', cls: 'bg-green-100 text-green-700' },
  [STATUSES.ERROR]: { text: '✗ Error', cls: 'bg-red-100 text-red-700' }
}

export default function ProductCard({
  item,
  lengthMode,
  onChange,
  onRemove,
  onRunOne,
  onDownload,
  runDisabled,
  downloadDisabled
}) {
  const status = STATUS_LABELS[item.status] || STATUS_LABELS[STATUSES.PENDING]

  return (
    <div className="border border-slate-200 rounded-lg p-3 flex gap-3">
      <img
        src={item.previewUrl}
        alt={item.sku}
        className="w-24 h-24 object-cover rounded bg-slate-100 flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-semibold">{item.sku}</span>
            <span className={`chip ${status.cls}`}>{status.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {onRunOne && (item.status === STATUSES.PENDING || item.status === STATUSES.ERROR) && (
              <button
                className="text-xs text-indigo-600 hover:underline disabled:text-slate-400"
                onClick={onRunOne}
                disabled={runDisabled}
                title="Chạy riêng item này"
              >
                ▶ Run
              </button>
            )}
            {onDownload && (
              <button
                className="text-xs text-emerald-600 hover:underline disabled:text-slate-400"
                onClick={onDownload}
                disabled={downloadDisabled}
                title="Tải mockup JPG + PNG zip về máy"
              >
                ↓ Download
              </button>
            )}
            {item.cardUrl && (
              <a
                href={item.cardUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline"
              >
                Mở Trello ↗
              </a>
            )}
            <button
              onClick={onRemove}
              className="text-xs text-slate-400 hover:text-red-500"
              title="Xóa khỏi queue"
            >
              ✕
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 truncate mb-2">{item.file?.name}</p>

        {item.error && (
          <p className="text-xs text-red-600 mb-2 break-all">{item.error}</p>
        )}

        <SeoPanel item={item} lengthMode={lengthMode} onChange={onChange} />
      </div>
    </div>
  )
}
