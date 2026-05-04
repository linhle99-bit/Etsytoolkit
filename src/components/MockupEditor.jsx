import { useEffect, useRef, useState } from 'react'
import { rectFrom } from '../lib/mockup'
const isLocal = id => typeof id === 'string' && id.startsWith('local-')

const LABELS = ['TL', 'TR', 'BR', 'BL']
const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24']
const HANDLE_RADIUS = 9
const HIT_RADIUS = 16
const MAX_CANVAS_W = 720

export default function MockupEditor({
  templates,
  status,
  onFetch,
  onClear,
  onAddLocal,
  onRemoveTemplate,
  onUpdateCorners,
  onUpdateFitMode,
  readyCount,
  // Mockup sets
  sets,
  onSaveAsSet,
  onLoadSet,
  onDeleteSet,
  onOverwriteSet
}) {
  const [activeId, setActiveId] = useState(null)
  const [shapeMode, setShapeMode] = useState('free')
  const [selectedSetId, setSelectedSetId] = useState('')
  const canvasRef = useRef(null)
  const localFileInputRef = useRef(null)
  const [imgEl, setImgEl] = useState(null)
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(null)

  function handleSaveSet() {
    if (templates.length === 0) {
      alert('Chưa có mockup nào để lưu')
      return
    }
    const name = prompt('Tên bộ mockup? (VD: Disney T-shirt, Mug PNG…)')
    if (!name?.trim()) return
    const created = onSaveAsSet?.(name.trim(), templates)
    if (created?.id) setSelectedSetId(created.id)
  }

  function handleLoadSet(id) {
    setSelectedSetId(id)
    if (!id) return
    const set = sets?.find(s => s.id === id)
    if (!set) return
    if (
      templates.length > 0 &&
      !confirm(`Load bộ "${set.name}" sẽ thay thế ${templates.length} mockup hiện tại. Tiếp tục?`)
    ) {
      setSelectedSetId('')
      return
    }
    onLoadSet?.(set.templates)
  }

  function handleDeleteSet() {
    if (!selectedSetId) return
    const set = sets?.find(s => s.id === selectedSetId)
    if (!set) return
    if (!confirm(`Xoá bộ "${set.name}"?`)) return
    onDeleteSet?.(selectedSetId)
    setSelectedSetId('')
  }

  function handleOverwriteSet() {
    if (!selectedSetId) return
    const set = sets?.find(s => s.id === selectedSetId)
    if (!set) return
    if (!confirm(`Lưu đè bộ "${set.name}" với ${templates.length} mockup hiện tại?`)) return
    onOverwriteSet?.(selectedSetId, templates)
  }

  const active = templates.find(t => t.id === activeId)

  // Auto-pick first template (chưa có corners) khi list đổi
  useEffect(() => {
    if (!templates.length) {
      setActiveId(null)
      return
    }
    if (!activeId || !templates.find(t => t.id === activeId)) {
      const firstUnconfigured = templates.find(t => !t.corners || t.corners.length !== 4)
      setActiveId((firstUnconfigured || templates[0]).id)
    }
  }, [templates, activeId])

  // Load active mockup vào DOM
  useEffect(() => {
    if (!active?.dataUrl) {
      setImgEl(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      setImgEl(img)
      setScale(Math.min(1, MAX_CANVAS_W / img.naturalWidth))
    }
    img.src = active.dataUrl
  }, [active?.id, active?.dataUrl])

  // Re-draw canvas
  useEffect(() => {
    if (!imgEl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = Math.round(imgEl.naturalWidth * scale)
    canvas.height = Math.round(imgEl.naturalHeight * scale)
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)

    const corners = active?.corners || []
    if (corners.length >= 2) {
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      corners.forEach((p, i) => {
        const x = p[0] * scale
        const y = p[1] * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (corners.length === 4) ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])

      if (corners.length === 4) {
        ctx.fillStyle = 'rgba(167, 139, 250, 0.15)'
        ctx.beginPath()
        corners.forEach((p, i) => {
          const x = p[0] * scale
          const y = p[1] * scale
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fill()
      }
    }

    corners.forEach((p, i) => {
      const x = p[0] * scale
      const y = p[1] * scale
      ctx.fillStyle = COLORS[i]
      ctx.strokeStyle = '#0f0f17'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#0f0f17'
      ctx.font = 'bold 10px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(LABELS[i], x, y)
    })
  }, [imgEl, scale, active])

  function clampToImage(x, y) {
    if (!imgEl) return [x, y]
    return [
      Math.max(0, Math.min(imgEl.naturalWidth, x)),
      Math.max(0, Math.min(imgEl.naturalHeight, y))
    ]
  }

  function getMousePoint(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    const cx = cssX * (canvasRef.current.width / rect.width)
    const cy = cssY * (canvasRef.current.height / rect.height)
    return {
      canvasX: cx,
      canvasY: cy,
      origX: cx / scale,
      origY: cy / scale
    }
  }

  function hitTestCorner(pt, corners) {
    for (let i = 0; i < corners.length; i++) {
      const cx = corners[i][0] * scale
      const cy = corners[i][1] * scale
      if (Math.hypot(cx - pt.canvasX, cy - pt.canvasY) < HIT_RADIUS) return i
    }
    return -1
  }

  function setActiveCorners(corners) {
    if (!active) return
    onUpdateCorners(active.id, corners)
  }

  function onCanvasMouseDown(e) {
    if (!imgEl || !active) return
    const pt = getMousePoint(e)
    const corners = active.corners || []
    const hit = hitTestCorner(pt, corners)
    if (hit >= 0) {
      setDragging(hit)
      return
    }
    const [ox, oy] = clampToImage(pt.origX, pt.origY)
    if (shapeMode === 'free') {
      if (corners.length >= 4) return
      setActiveCorners([...corners, [ox, oy]])
    } else {
      if (corners.length === 0) {
        setActiveCorners([[ox, oy]])
      } else if (corners.length === 1) {
        const tl = corners[0]
        setActiveCorners(rectFrom(tl, [ox, oy], shapeMode === 'square'))
      }
    }
  }

  function onCanvasMouseMove(e) {
    if (!imgEl || !active) return
    const pt = getMousePoint(e)
    const corners = active.corners || []
    if (dragging !== null) {
      const [nx, ny] = clampToImage(pt.origX, pt.origY)
      const next = corners.map((p, i) => (i === dragging ? [nx, ny] : p))
      setActiveCorners(next)
      return
    }
    const cursor = hitTestCorner(pt, corners) >= 0 ? 'grab' : 'crosshair'
    if (canvasRef.current) canvasRef.current.style.cursor = cursor
  }

  function onCanvasMouseUp() {
    if (dragging !== null) setDragging(null)
  }

  function resetCorners() {
    if (active) setActiveCorners([])
  }

  function changeShape(m) {
    setShapeMode(m)
    if (active) setActiveCorners([])
  }

  function setFit(m) {
    if (active) onUpdateFitMode(active.id, m)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">🖼️ Mockup Templates</h2>
          <p className="text-xs text-slate-500">
            {templates.length === 0
              ? 'Upload mockup local (đã persist qua reload) hoặc thử pull từ Trello'
              : `${readyCount}/${templates.length} template đã setup corners`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary text-sm"
            onClick={onFetch}
            disabled={status?.loading}
          >
            {status?.loading ? 'Đang tải…' : '↓ Pull mockup từ Trello'}
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={() => localFileInputRef.current?.click()}
            disabled={status?.loading}
          >
            + Upload local
          </button>
          <input
            ref={localFileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => {
              if (onAddLocal && e.target.files?.length) {
                onAddLocal(e.target.files)
                e.target.value = ''
              }
            }}
          />
          {templates.length > 0 && (
            <button className="btn-secondary text-sm" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mockup sets row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 mb-3 items-stretch">
        <select
          className="input"
          value={selectedSetId}
          onChange={e => handleLoadSet(e.target.value)}
        >
          <option value="">— Chọn bộ mockup đã lưu ({sets?.length || 0}) —</option>
          {(sets || []).map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.templates?.length || 0} mockup)
            </option>
          ))}
        </select>
        <button
          className="btn-secondary text-sm whitespace-nowrap"
          onClick={handleSaveSet}
          disabled={templates.length === 0}
          title="Lưu templates hiện tại thành 1 bộ mới"
        >
          💾 Lưu thành bộ
        </button>
        <button
          className="btn-secondary text-sm whitespace-nowrap"
          onClick={handleOverwriteSet}
          disabled={!selectedSetId || templates.length === 0}
          title="Lưu đè bộ đang chọn"
        >
          ↻ Lưu đè
        </button>
        <button
          className="btn-secondary text-sm whitespace-nowrap text-red-600"
          onClick={handleDeleteSet}
          disabled={!selectedSetId}
        >
          🗑 Xoá bộ
        </button>
      </div>

      {(status?.error || status?.msg) && (
        <div
          className={`text-sm p-2 rounded mb-3 ${
            status.error
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {status.error || status.msg}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-6 space-y-2">
          <p>Chưa có template.</p>
          <p>
            <b>Khuyến nghị</b>: click <b>+ Upload local</b> chọn mockup từ máy (đã persist qua reload).
          </p>
          <p className="text-xs">
            Trello pull có thể bị CORS chặn. Cách thay thế: tải mockup từ Trello về máy (right-click attachment → Save as) rồi Upload local.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
          {/* Template list */}
          <div className="space-y-1 max-h-[500px] overflow-auto">
            {templates.map(t => {
              const isReady = t.corners?.length === 4
              const isActive = t.id === activeId
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => setActiveId(t.id)}
                    className="flex-1 text-left flex items-center gap-2 min-w-0"
                  >
                    <img
                      src={t.dataUrl}
                      alt=""
                      className="w-12 h-12 object-cover rounded bg-slate-100 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate flex items-center gap-1">
                        {isLocal(t.id) && (
                          <span className="chip bg-slate-200 text-slate-600 text-[10px]">
                            local
                          </span>
                        )}
                        <span className="truncate">{t.name}</span>
                      </p>
                      <span
                        className={`chip mt-0.5 ${
                          isReady
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isReady ? '✓ Ready' : '○ Cần 4 góc'}
                      </span>
                    </div>
                  </button>
                  {onRemoveTemplate && (
                    <button
                      onClick={() => onRemoveTemplate(t.id)}
                      className="text-slate-400 hover:text-red-500 text-xs px-1"
                      title="Xóa template"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Editor */}
          <div className="space-y-3">
            {active ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium truncate">{active.name}</p>
                  <div className="flex gap-2">
                    <div className="flex gap-1">
                      {[
                        ['free', 'Tứ giác'],
                        ['rect', 'Chữ nhật'],
                        ['square', 'Vuông']
                      ].map(([m, label]) => (
                        <button
                          key={m}
                          onClick={() => changeShape(m)}
                          className={`text-xs px-2 py-1 rounded border ${
                            shapeMode === m
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white border-slate-300 text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {[
                        ['fit', 'Fit'],
                        ['stretch', 'Stretch']
                      ].map(([m, label]) => (
                        <button
                          key={m}
                          onClick={() => setFit(m)}
                          className={`text-xs px-2 py-1 rounded border ${
                            (active.fitMode || 'fit') === m
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white border-slate-300 text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-lg p-2 inline-block max-w-full overflow-auto">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp}
                    className="block max-w-full cursor-crosshair select-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary text-sm"
                    onClick={resetCorners}
                    disabled={!active.corners?.length}
                  >
                    Reset góc
                  </button>
                  <code className="text-xs text-slate-500 break-all">
                    {JSON.stringify(
                      (active.corners || []).map(p => [
                        Math.round(p[0]),
                        Math.round(p[1])
                      ])
                    )}
                  </code>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Chọn 1 template bên trái</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
