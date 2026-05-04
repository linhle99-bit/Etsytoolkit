import { useCallback, useRef, useState } from 'react'
import { allocateSKUs } from '../hooks/useSettings'

let counter = 0
const nextId = () => `${Date.now()}-${++counter}`

export default function Uploader({ skuPrefix, onAdd }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)
  const folderRef = useRef(null)

  const handleFiles = useCallback(
    fileList => {
      const files = Array.from(fileList).filter(
        f => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')
      )
      if (!files.length) return
      const skus = allocateSKUs(skuPrefix || 'TD', files.length)
      const items = files.map((f, i) => ({
        id: nextId(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        sku: skus[i],
        title: '',
        status: 'pending'
      }))
      onAdd(items)
    },
    [skuPrefix, onAdd]
  )

  const onDrop = useCallback(
    e => {
      e.preventDefault()
      setDrag(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-3">📁 Upload Design PNG</h2>
      <div
        onDragOver={e => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
          drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <p className="text-slate-600 mb-3">Kéo thả PNG vào đây hoặc:</p>
        <div className="flex justify-center gap-2">
          <button
            className="btn-primary"
            onClick={() => inputRef.current?.click()}
          >
            Chọn nhiều file
          </button>
          <button
            className="btn-secondary"
            onClick={() => folderRef.current?.click()}
          >
            Chọn folder
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <input
          ref={folderRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <p className="text-xs text-slate-500 mt-3">
          SKU tự động: <code>{skuPrefix || 'TD'}DDMMYY-NN</code> · counter persistent qua reload
        </p>
      </div>
    </div>
  )
}
