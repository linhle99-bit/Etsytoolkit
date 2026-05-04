import { useState } from 'react'
import { listListsWithCards } from '../lib/trello'

export default function Settings({ settings, update }) {
  const [open, setOpen] = useState(true)
  const [pickerStatus, setPickerStatus] = useState({ loading: false, error: null })
  const [lists, setLists] = useState([]) // [{id, name, cards: [{id, name}]}]

  async function loadListsAndCards() {
    if (!settings.trelloKey || !settings.trelloToken || !settings.trelloBoardId) {
      setPickerStatus({
        loading: false,
        error: 'Cần Trello Key + Token + Board ID trước'
      })
      return
    }
    setPickerStatus({ loading: true, error: null })
    try {
      const data = await listListsWithCards({
        key: settings.trelloKey,
        token: settings.trelloToken,
        boardId: settings.trelloBoardId
      })
      setLists(Array.isArray(data) ? data : [])
      setPickerStatus({ loading: false, error: null })
    } catch (e) {
      setPickerStatus({ loading: false, error: e.message })
    }
  }

  // Flatten cards với prefix list name để render trong <optgroup>
  const groupedCards = lists.map(l => ({
    listId: l.id,
    listName: l.name,
    cards: l.cards || []
  }))

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">⚙️ Settings</h2>
        <button className="btn-secondary text-sm" onClick={() => setOpen(o => !o)}>
          {open ? 'Thu gọn' : 'Mở rộng'}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Trello API Key</label>
            <input
              type="password"
              className="input"
              value={settings.trelloKey}
              onChange={e => update({ trelloKey: e.target.value })}
              placeholder="Lấy tại https://trello.com/app-key"
            />
          </div>
          <div>
            <label className="label">Trello Token</label>
            <input
              type="password"
              className="input"
              value={settings.trelloToken}
              onChange={e => update({ trelloToken: e.target.value })}
              placeholder="Click link Token trên trang app-key"
            />
          </div>

          <div>
            <label className="label">Trello Board ID</label>
            <input
              className="input"
              value={settings.trelloBoardId}
              onChange={e => update({ trelloBoardId: e.target.value.trim() })}
              placeholder="Từ URL board: trello.com/b/XXXXXXXX/..."
            />
          </div>

          <div className="flex items-end">
            <button
              className="btn-secondary text-sm w-full"
              onClick={loadListsAndCards}
              disabled={pickerStatus.loading}
            >
              {pickerStatus.loading
                ? 'Đang tải…'
                : '🔍 Tải Lists & Cards của Board'}
            </button>
          </div>

          {pickerStatus.error && (
            <div className="md:col-span-2 text-sm p-2 rounded bg-red-50 text-red-700 border border-red-200">
              {pickerStatus.error}
            </div>
          )}

          <div>
            <label className="label">Destination List ID (Disney-DN)</label>
            {lists.length > 0 ? (
              <select
                className="input"
                value={settings.trelloListId}
                onChange={e => update({ trelloListId: e.target.value })}
              >
                <option value="">— Chọn list —</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={settings.trelloListId}
                onChange={e => update({ trelloListId: e.target.value.trim() })}
                placeholder="List nơi tạo card output (hoặc bấm 🔍 để pick)"
              />
            )}
          </div>

          <div>
            <label className="label">Mockup Source Card ID</label>
            {groupedCards.some(g => g.cards.length > 0) ? (
              <select
                className="input"
                value={settings.trelloMockupCardId}
                onChange={e => update({ trelloMockupCardId: e.target.value })}
              >
                <option value="">— Chọn card chứa mockup —</option>
                {groupedCards.map(
                  g =>
                    g.cards.length > 0 && (
                      <optgroup key={g.listId} label={g.listName}>
                        {g.cards.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                )}
              </select>
            ) : (
              <input
                className="input"
                value={settings.trelloMockupCardId}
                onChange={e => update({ trelloMockupCardId: e.target.value.trim() })}
                placeholder="Card chứa mockup template (hoặc bấm 🔍 để pick)"
              />
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              App sẽ pull mọi attachment ảnh trong card này làm mockup template.
            </p>
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <label className="label">Claude API Key</label>
            <input
              type="password"
              className="input"
              value={settings.claudeApiKey}
              onChange={e => update({ claudeApiKey: e.target.value })}
              placeholder="sk-ant-..."
            />
          </div>

          <div>
            <label className="label">Claude Model (vision)</label>
            <select
              className="input"
              value={settings.claudeModel}
              onChange={e => update({ claudeModel: e.target.value })}
            >
              <option value="claude-sonnet-4-5">Sonnet 4.5</option>
              <option value="claude-sonnet-4-6">Sonnet 4.6 (mới nhất)</option>
              <option value="claude-haiku-4-5-20251001">Haiku 4.5 (rẻ, nhanh)</option>
              <option value="claude-opus-4-7">Opus 4.7 (chất lượng cao nhất)</option>
            </select>
          </div>

          <div>
            <label className="label">SKU prefix</label>
            <input
              className="input uppercase"
              maxLength={12}
              value={settings.skuPrefix}
              onChange={e => update({ skuPrefix: e.target.value.toUpperCase() })}
              placeholder="VD: DN"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Format: <code>{settings.skuPrefix || 'DN'}DDMMYYNN</code> · counter giữ qua reload
            </p>
          </div>

          <div>
            <label className="label">Rate limit giữa request (ms)</label>
            <input
              type="number"
              className="input"
              value={settings.rateLimitMs}
              onChange={e => update({ rateLimitMs: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
