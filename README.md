# Etsy Product Tool

Web app client-side tự động hoá quy trình tạo sản phẩm Etsy:
**Upload PNG → SKU → Mockup → AI Title + 13 Tags → Trello card**

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
```

## Cấu hình lần đầu

1. Mở app, mở khối **Settings**.
2. Lấy Trello credentials:
   - **API Key**: https://trello.com/app-key
   - **Token**: click link "Token" trên trang đó
3. Nhấn **Tải Boards** → chọn Board → chọn List "To Do".
4. Nhập **Claude API Key** (sk-ant-...). Mặc định model `claude-sonnet-4-5`.

Tất cả key lưu trong `localStorage` của browser, không gửi đi đâu khác.

## Quy trình

1. **Upload** nhiều PNG hoặc 1 folder → mỗi file được gán SKU `TDDDMMYY-NN`.
2. **Mockup**: thêm template (vd t-shirt trắng), căn chỉnh X/Y/W/H/rotation/opacity. Preview realtime với design đầu tiên.
3. **Push lên Trello**: nút 🚀 sẽ chạy tuần tự cho từng item:
   - Ghép mockup (tất cả templates) → resize ≤ 2000px
   - Gọi Claude → title + 13 tags
   - Tạo Trello card → attach design gốc + mockups → set description

## Cấu trúc

```
src/
├── lib/        sku, trello, mockup, claude
├── hooks/      useSettings, useBatch
└── components/ Settings, Uploader, MockupEditor, SeoPanel, ProductCard, BatchQueue
```

## Lưu ý

- **CORS**: Trello + Claude đều cho phép gọi từ browser khi dùng đúng header (Claude cần `anthropic-dangerous-direct-browser-access: true`).
- **Rate limit Claude**: chỉnh `rateLimitMs` trong Settings (mặc định 500ms giữa các call).
- **Title** giới hạn 140 ký tự, **tags** mỗi tag ≤ 20 ký tự, đúng 13 tags theo chuẩn Etsy.
- Có thể edit title/tags trực tiếp trên Queue trước khi push lại.
