import { useCallback, useState } from 'react'
import JSZip from 'jszip'
import { generateSEO, sleep } from '../lib/claude'
import { compositeDesignOnMockup, resizeBlob } from '../lib/mockup'
import {
  attachImage,
  buildCardDesc,
  createCard
} from '../lib/trello'
import { triggerDownload, zipPngFile } from '../lib/download'

function sanitizeFileName(s) {
  return String(s || '')
    .replace(/[\/\\:\*\?"<>\|]/g, '') // ký tự cấm trong filename Windows
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

export const STATUSES = {
  PENDING: 'pending',
  MOCKUP: 'processing_mockup',
  SEO: 'processing_seo',
  PUSHING: 'pushing_trello',
  DONE: 'done',
  ERROR: 'error'
}

export function useBatch() {
  const [queue, setQueue] = useState([])
  const [running, setRunning] = useState(false)

  const upsert = useCallback((id, patch) => {
    setQueue(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const addItems = useCallback(items => {
    setQueue(prev => [...prev, ...items])
  }, [])

  const removeItem = useCallback(id => {
    setQueue(prev => {
      const it = prev.find(x => x.id === id)
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl)
      return prev.filter(x => x.id !== id)
    })
  }, [])

  const clearDone = useCallback(() => {
    setQueue(prev => {
      prev.forEach(it => {
        if (it.status === STATUSES.DONE && it.previewUrl) {
          URL.revokeObjectURL(it.previewUrl)
        }
      })
      return prev.filter(it => it.status !== STATUSES.DONE)
    })
  }, [])

  const clearAll = useCallback(() => {
    setQueue(prev => {
      prev.forEach(it => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
      return []
    })
  }, [])

  // Xử lý 1 item: ghép N mockup → vision SEO → push Trello card với hết
  // templates: array [{ id, name, blob, corners, fitMode }]
  // onUsage: callback({model, usage}) sau mỗi Claude API call để track cost
  const processItem = useCallback(
    async (item, settings, templates, onUsage) => {
      try {
        const usable = (templates || []).filter(
          t => t.blob && t.corners?.length === 4
        )

        // 1) Ghép TẤT CẢ mockup
        const mockupResults = []
        if (usable.length > 0) {
          upsert(item.id, { status: STATUSES.MOCKUP })
          for (let i = 0; i < usable.length; i++) {
            const t = usable[i]
            let blob = await compositeDesignOnMockup({
              designSrc: item.file,
              mockupSrc: t.blob,
              corners: t.corners,
              fitMode: t.fitMode || 'fit',
              outputType: 'image/jpeg',
              jpegQuality: 0.9
            })
            blob = await resizeBlob(blob, 2000)
            mockupResults.push({ template: t, blob })
          }
        }

        // 2) SEO (title + tags, vision) — phân tích mockup đầu tiên nếu có
        upsert(item.id, { status: STATUSES.SEO })
        const visionInput = mockupResults[0]?.blob || item.file
        const seo = await generateSEO({
          apiKey: settings.claudeApiKey,
          imageBlob: visionInput,
          model: settings.claudeModel,
          lengthMode: settings.lengthMode || 'default',
          onUsage
        })
        upsert(item.id, {
          title: seo.title,
          tags: seo.tags,
          titleValid: seo.titleValid,
          tagsValid: seo.tagsValid,
          attempts: seo.attempts,
          mockupCount: mockupResults.length
        })

        // 3) Push Trello: tạo card → attach mockup JPG + PNG gốc
        // Card name = SKU + cụm đầu tiên của title (trước dấu phẩy đầu).
        // Attachment name = title trước dấu phẩy (bỏ SKU).
        // Title đầy đủ vẫn được lưu trong description.
        upsert(item.id, { status: STATUSES.PUSHING })
        const titleHead = (seo.title || '').split(',')[0].trim()
        const safeTitleHead =
          sanitizeFileName(titleHead) || item.sku || 'mockup'
        const cardName = item.sku
          ? `${item.sku}-${titleHead}`.slice(0, 200)
          : titleHead.slice(0, 200)
        const desc = buildCardDesc({
          sku: item.sku,
          title: seo.title,
          tags: seo.tags,
          attempts: seo.attempts,
          titleValid: seo.titleValid,
          tagsValid: seo.tagsValid,
          mockupCount: mockupResults.length
        })
        const card = await createCard({
          key: settings.trelloKey,
          token: settings.trelloToken,
          listId: settings.trelloListId,
          name: cardName,
          desc
        })

        // Attach từng mockup JPG. Nếu nhiều mockup → đánh số. 1 mockup → không số.
        for (let i = 0; i < mockupResults.length; i++) {
          const m = mockupResults[i]
          const fileName =
            mockupResults.length > 1
              ? `${safeTitleHead} ${i + 1}.jpg`
              : `${safeTitleHead}.jpg`
          await attachImage({
            key: settings.trelloKey,
            token: settings.trelloToken,
            cardId: card.id,
            file: new File([m.blob], fileName, { type: 'image/jpeg' }),
            name: fileName
          })
        }

        // Attach PNG gốc với tên = title trước dấu phẩy
        const origExt =
          (item.file.name.match(/\.[^.]+$/) || ['.png'])[0]
        const designFileName = `${safeTitleHead}${origExt}`
        await attachImage({
          key: settings.trelloKey,
          token: settings.trelloToken,
          cardId: card.id,
          file: new File([item.file], designFileName, {
            type: item.file.type || 'image/png'
          }),
          name: designFileName
        })

        upsert(item.id, {
          status: STATUSES.DONE,
          cardId: card.id,
          cardUrl: card.shortUrl || card.url
        })
      } catch (err) {
        console.error('processItem error', err)
        upsert(item.id, {
          status: STATUSES.ERROR,
          error: String(err.message || err)
        })
      }
    },
    [upsert]
  )

  const runAll = useCallback(
    async (settings, templates, onUsage) => {
      setRunning(true)
      try {
        const pending = queue.filter(
          it => it.status === STATUSES.PENDING || it.status === STATUSES.ERROR
        )
        for (const item of pending) {
          await processItem(item, settings, templates, onUsage)
          if (settings.rateLimitMs) await sleep(settings.rateLimitMs)
        }
      } finally {
        setRunning(false)
      }
    },
    [queue, processItem]
  )

  // Download 1 item về máy: re-composite mockup, trigger download JPG +
  // ZIP chứa PNG. Dùng được cả khi item PENDING (chưa SEO) — fallback name.
  const downloadItem = useCallback(async (item, templates) => {
    const titleHead =
      ((item.title || '').split(',')[0] || '').trim() ||
      item.sku ||
      item.file?.name?.replace(/\.[^.]+$/, '') ||
      'design'
    const safeTitleHead =
      sanitizeFileName(titleHead) || item.sku || 'design'

    const usable = (templates || []).filter(
      t => t.blob && t.corners?.length === 4
    )

    // 1) Re-composite + download mockup JPG
    for (let i = 0; i < usable.length; i++) {
      const t = usable[i]
      let blob = await compositeDesignOnMockup({
        designSrc: item.file,
        mockupSrc: t.blob,
        corners: t.corners,
        fitMode: t.fitMode || 'fit',
        outputType: 'image/jpeg',
        jpegQuality: 0.9
      })
      blob = await resizeBlob(blob, 2000)
      const fileName =
        usable.length > 1
          ? `${safeTitleHead} ${i + 1}.jpg`
          : `${safeTitleHead}.jpg`
      triggerDownload(blob, fileName)
      // Delay nhỏ giữa các download để Chrome không block
      await sleep(200)
    }

    // 2) ZIP PNG (cho Etsy delivery), tên zip = title
    const zipBlob = await zipPngFile(item.file, `${safeTitleHead}.png`)
    triggerDownload(zipBlob, `${safeTitleHead}.zip`)
  }, [])

  // Bundle TẤT CẢ items vào 1 mega ZIP với cấu trúc:
  // etsy-batch-DDMMYY.zip
  //   └── {SKU} - {title}/
  //         ├── {title} 1.jpg, {title} 2.jpg, ...   (mockup JPGs)
  //         └── {title}.zip                        (zipped PNG cho Etsy delivery)
  const downloadAll = useCallback(
    async templates => {
      const targets = queue.filter(
        it =>
          it.status === STATUSES.DONE ||
          it.status === STATUSES.PENDING ||
          it.status === STATUSES.ERROR
      )
      if (!targets.length) return

      const usable = (templates || []).filter(
        t => t.blob && t.corners?.length === 4
      )
      if (!usable.length) {
        alert('Cần ít nhất 1 mockup template đã chấm 4 góc')
        return
      }

      setRunning(true)
      try {
        const megaZip = new JSZip()

        for (const item of targets) {
          const originalStatus = item.status
          // Mark item as "processing mockup" để user thấy progress
          upsert(item.id, { status: STATUSES.MOCKUP })

          const titleHead =
            ((item.title || '').split(',')[0] || '').trim() ||
            item.sku ||
            item.file?.name?.replace(/\.[^.]+$/, '') ||
            'design'
          const safeTitleHead =
            sanitizeFileName(titleHead) || item.sku || 'design'
          const folderName = item.sku
            ? sanitizeFileName(`${item.sku} - ${safeTitleHead}`)
            : safeTitleHead

          const folder = megaZip.folder(folderName)

          // 1) Composite + add JPG mockups vào folder
          for (let i = 0; i < usable.length; i++) {
            const t = usable[i]
            let blob = await compositeDesignOnMockup({
              designSrc: item.file,
              mockupSrc: t.blob,
              corners: t.corners,
              fitMode: t.fitMode || 'fit',
              outputType: 'image/jpeg',
              jpegQuality: 0.9
            })
            blob = await resizeBlob(blob, 2000)
            const fileName =
                usable.length > 1
                  ? `${safeTitleHead} ${i + 1}.jpg`
                  : `${safeTitleHead}.jpg`
            folder.file(fileName, blob)
          }

          // 2) Inner ZIP chứa PNG (Etsy delivery)
          const innerZip = new JSZip()
          innerZip.file(`${safeTitleHead}.png`, item.file)
          const innerZipBlob = await innerZip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          })
          folder.file(`${safeTitleHead}.zip`, innerZipBlob)

          // Khôi phục status gốc — download không thay đổi state thật
          upsert(item.id, { status: originalStatus })
        }

        const megaBlob = await megaZip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        })

        const today = new Date()
        const dd = String(today.getDate()).padStart(2, '0')
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const yy = String(today.getFullYear()).slice(-2)
        const megaName = `etsy-batch-${dd}${mm}${yy}-${targets.length}items.zip`
        triggerDownload(megaBlob, megaName)
      } finally {
        setRunning(false)
      }
    },
    [queue, upsert]
  )

  return {
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
  }
}
