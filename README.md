# Etsy Product Tool

Web app **100% client-side** tự động hoá quy trình tạo sản phẩm Etsy digital:

**Upload PNG → Ghép mockup (perspective warp) → Vision AI sinh title + 13 tags → Push Trello card / Download ZIP**

Stack: React 18 + Vite + Tailwind · Claude Vision API · Trello REST · IndexedDB · JSZip

---

## Chạy local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle vào dist/
npm run preview  # serve dist/
```

Yêu cầu **Node.js ≥ 20**.

---

## Cấu hình lần đầu

Mở app → **Settings**:

1. **Trello**: lấy Key + Token tại https://trello.com/app-key
2. **Trello Board ID**: từ URL board, vd `trello.com/b/XXXXXXXX/...`
3. Click **🔍 Tải Lists & Cards của Board** → pick:
   - **Destination List**: nơi tạo card output
   - **Mockup Source Card**: card chứa các mockup template (Trello pull có thể bị CORS — fallback Upload local)
4. **Claude API Key**: lấy tại https://console.anthropic.com/settings/keys
5. Chọn **Claude Model** (Sonnet 4.6 mặc định) + **SKU prefix** (vd `DN`)

Tất cả key + mọi state lưu trong **localStorage** + **IndexedDB** của browser, **không gửi đi đâu khác**.

---

## Workflow

1. **Mockup Templates**: click **+ Upload local** chọn mockup PNG/JPG → chấm 4 góc TL/TR/BR/BL trên canvas. Bộ mockup persist qua reload.
2. **💾 Lưu thành bộ**: snapshot bộ hiện tại theo tên (vd "Disney T-shirt") để tái dùng / switch giữa các store.
3. **Upload Design PNG**: kéo thả nhiều file → tự gán SKU `{PREFIX}{DDMMYY}{NN}` (counter persistent).
4. Click **🚀 Push lên Trello** chạy batch:
   - Ghép design vào tất cả mockup templates (perspective warp + tight-alpha-crop)
   - Vision AI sinh title 130-140 ký tự + 13 tags Etsy SEO (TM-safe)
   - Tạo card mới trong Destination List → attach mockup JPG + PNG gốc
5. Hoặc **↓ Download all (.zip)**: bundle tất cả thành 1 mega ZIP có folder cho mỗi sản phẩm (mockup JPG + PNG zipped cho Etsy delivery).
6. **💰 API Cost** track tổng $ đã chi cho Claude, breakdown theo model.

---

## Deploy lên Cloudflare Pages

App là static site (chỉ HTML/JS/CSS), deploy lên Cloudflare Pages cực kỳ đơn giản. Có 2 cách:

### Cách 1: Connect Git (recommended) — auto-deploy mỗi lần push

**Bước 1**: Đăng nhập https://dash.cloudflare.com → menu trái chọn **Workers & Pages**.

**Bước 2**: Click **Create application** → tab **Pages** → **Connect to Git**.

**Bước 3**: Authorize Cloudflare access GitHub → chọn repo `linhle99-bit/Etsytoolkit`.

**Bước 4**: Cấu hình build:

| Field | Value |
|---|---|
| Project name | `etsytoolkit` (hoặc tuỳ ý) |
| Production branch | `main` |
| Framework preset | **Vite** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (để trống) |

**Bước 5**: Mở **Environment variables** → thêm 1 biến cho cả Production và Preview:

| Variable | Value |
|---|---|
| `NODE_VERSION` | `20` |

(Đã có file `.node-version` trong repo nên Cloudflare auto-detect, biến này là backup để chắc.)

**Bước 6**: Click **Save and Deploy**. Cloudflare clone repo → chạy `npm install` → `npm run build` → publish `dist/`.

Build thành công → app live tại `https://etsytoolkit.pages.dev` (hoặc `<project-name>.pages.dev`).

Mỗi lần `git push origin main` → Cloudflare tự re-deploy. PR / branch khác auto-tạo preview URL.

### Cách 2: Wrangler CLI (manual upload)

```bash
npm install -g wrangler
wrangler login
npm run build
wrangler pages deploy dist --project-name=etsytoolkit
```

---

## Build verify (đã test)

- ✅ `npm run build` clean — 0 errors, 0 warnings
- ✅ Bundle size: 305KB JS (100KB gzip), 18KB CSS, 1KB HTML — well under Cloudflare 25MB/file limit
- ✅ Không có top-level await / browser-only API ở module level
- ✅ Không cần Pages Functions / Workers / SSR — pure static
- ✅ `_redirects` config cho SPA fallback (`/* → /index.html` 200)
- ✅ `.node-version` pin Node 20

### Cấu hình deploy nâng cao (optional)

**Custom domain**: Cloudflare Pages → Project → **Custom domains** → Add domain. DNS auto-config nếu domain ở Cloudflare.

**Preview deployments**: tự động cho mọi branch không phải `main`. Mỗi PR có URL riêng để test.

**Build cache**: Cloudflare cache `node_modules` giữa các build → build sau nhanh hơn.

**Environment limits**: Pages free tier:
- 500 builds/tháng
- Unlimited requests
- Unlimited bandwidth
- 25MB per file, 20K files per deployment

---

## Lưu ý CORS

App gọi 2 API ngoài từ browser:
- **Anthropic** (`api.anthropic.com`): cần header `anthropic-dangerous-direct-browser-access: true` (đã set sẵn)
- **Trello** (`api.trello.com`): support CORS qua key/token query params

**Trello attachment download** (`/cards/.../attachments/.../download/...`) thường bị CORS block từ browser → fallback **+ Upload local**.

---

## Troubleshooting

**Build fail trên Cloudflare với "Engine version not found"**: kiểm tra biến `NODE_VERSION=20` đã set ở Environment variables.

**`Cannot find module 'jszip'`**: chạy lại `npm install` trước build. Cloudflare tự chạy `npm ci`, không gặp lỗi này.

**App load nhưng không gọi được Claude**: kiểm tra Claude API key valid, đã add billing, đúng key (`sk-ant-...`).

**Trello pull mockup fail CORS**: đây là policy của Trello, không fix được từ phía client. Dùng **+ Upload local** thay thế.

**Mất bộ mockup sau F5**: localStorage quota đầy. Đã chuyển binary sang IndexedDB (vài GB) — không còn vấn đề này từ phiên bản hiện tại.

---

## Cấu trúc source

```
src/
├── lib/
│   ├── claude.js     Vision SEO API + TM filter
│   ├── trello.js     REST API client
│   ├── mockup.js     4-point perspective warp + tight-crop
│   ├── idb.js        IndexedDB blob store
│   ├── download.js   ZIP + trigger download
│   └── sku.js        SKU generator
├── hooks/
│   ├── useSettings.js     localStorage settings + SKU counter
│   ├── useBatch.js        queue + process item + download
│   ├── useTrelloMockups.js Trello pull + local upload (IDB)
│   ├── useMockupSets.js   named sets (IDB)
│   └── useApiCost.js      cost tracking
└── components/
    ├── Settings.jsx        config + Lists/Cards picker
    ├── MockupEditor.jsx    canvas corner picker + sets
    ├── Uploader.jsx        PNG drag-drop + SKU
    ├── BatchQueue.jsx      queue + push + download
    ├── ProductCard.jsx     per-item row
    ├── SeoPanel.jsx        title + 13 tags edit
    └── CostPanel.jsx       💰 API cost display
```
