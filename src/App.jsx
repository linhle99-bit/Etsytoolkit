import { useCallback, useEffect } from 'react'
import Settings from './components/Settings'
import Uploader from './components/Uploader'
import MockupEditor from './components/MockupEditor'
import BatchQueue from './components/BatchQueue'
import CostPanel from './components/CostPanel'
import AuthPanel from './components/AuthPanel'
import { useSettings, isSettingsComplete } from './hooks/useSettings'
import { useBatch } from './hooks/useBatch'
import { useTrelloMockups } from './hooks/useTrelloMockups'
import { useMockupSets } from './hooks/useMockupSets'
import { useApiCost } from './hooks/useApiCost'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { settings, update } = useSettings()
  const {
    queue,
    running,
    addItems,
    removeItem,
    clearDone,
    clearAll,
    upsert,
    runAll,
    processItem,
    downloadItem,
    downloadAll
  } = useBatch()

  const trelloMockups = useTrelloMockups({
    key: settings.trelloKey,
    token: settings.trelloToken,
    cardId: settings.trelloMockupCardId
  })

  const mockupSets = useMockupSets()
  const apiCost = useApiCost()
  const auth = useAuth()

  const canRun =
    isSettingsComplete(settings) && trelloMockups.readyCount > 0

  const handleRunOne = useCallback(
    async id => {
      const item = queue.find(x => x.id === id)
      if (!item) return
      await processItem(item, settings, trelloMockups.templates, apiCost.recordCall)
    },
    [queue, settings, trelloMockups.templates, processItem, apiCost.recordCall]
  )

  const handleDownloadOne = useCallback(
    async id => {
      const item = queue.find(x => x.id === id)
      if (!item) return
      await downloadItem(item, trelloMockups.templates)
    },
    [queue, trelloMockups.templates, downloadItem]
  )

  const canDownload = trelloMockups.readyCount > 0

  // Auto-snapshot 1 lần: nếu có templates đã chấm corners đầy đủ
  // mà chưa có set nào → tạo backup tự động "Bộ tự động"
  useEffect(() => {
    const FLAG = 'etsy-tool.auto-snapshot-done.v1'
    if (localStorage.getItem(FLAG)) return
    if (
      mockupSets.sets.length === 0 &&
      trelloMockups.templates.length > 0 &&
      trelloMockups.readyCount > 0
    ) {
      mockupSets.saveAsSet('Bộ tự động', trelloMockups.templates)
      localStorage.setItem(FLAG, '1')
    }
  }, [
    mockupSets.sets.length,
    trelloMockups.templates,
    trelloMockups.readyCount,
    mockupSets
  ])

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 shadow relative">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Etsy Product Tool</h1>
            <p className="text-sm text-indigo-100">
              Pull mockup → Ghép PNG → Vision SEO → Push Trello / Download ZIP
            </p>
          </div>
          <div className="relative">
            <AuthPanel auth={auth} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <Settings settings={settings} update={update} />

        <CostPanel
          totalCost={apiCost.totalCost}
          totalCalls={apiCost.totalCalls}
          totalTokens={apiCost.totalTokens}
          byModel={apiCost.byModel}
          todayCost={apiCost.todayCost}
          todayCalls={apiCost.todayCalls}
          onReset={apiCost.reset}
        />

        <MockupEditor
          templates={trelloMockups.templates}
          status={trelloMockups.status}
          onFetch={trelloMockups.fetchAll}
          onAddLocal={trelloMockups.addLocalMockups}
          onRemoveTemplate={trelloMockups.removeTemplate}
          onClear={trelloMockups.clearAll}
          onUpdateCorners={trelloMockups.updateCorners}
          onUpdateFitMode={trelloMockups.updateFitMode}
          readyCount={trelloMockups.readyCount}
          sets={mockupSets.sets}
          onSaveAsSet={mockupSets.saveAsSet}
          onLoadSet={trelloMockups.loadFromSet}
          onDeleteSet={mockupSets.deleteSet}
          onOverwriteSet={mockupSets.overwriteSet}
        />

        <Uploader skuPrefix={settings.skuPrefix} onAdd={addItems} />

        <BatchQueue
          queue={queue}
          lengthMode={settings.lengthMode}
          onItemChange={upsert}
          onRemove={removeItem}
          onClearDone={clearDone}
          onClearAll={clearAll}
          onRunAll={() => runAll(settings, trelloMockups.templates, apiCost.recordCall)}
          onRunOne={handleRunOne}
          onDownloadAll={() => downloadAll(trelloMockups.templates)}
          onDownloadOne={handleDownloadOne}
          canDownload={canDownload}
          running={running}
          canRun={canRun}
          extraWarning={
            !isSettingsComplete(settings)
              ? 'Cần đủ Trello key/token + destination list + Claude key.'
              : trelloMockups.readyCount === 0
              ? 'Chưa có template nào setup đủ 4 góc. Pull mockup từ Trello và chấm 4 góc trước.'
              : null
          }
        />

        <footer className="text-center text-xs text-slate-400 py-4">
          Mockup từ Trello · Perspective warp · Vision SEO · Push Trello card
        </footer>
      </main>
    </div>
  )
}
