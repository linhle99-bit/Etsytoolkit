# Supabase Setup — Auth + Cloud Sync

App dùng Supabase cho 2 thứ:
1. **Auth** (email/password) — login/signup ở góc phải header
2. **Cloud sync** (sẽ build phase 2): lưu bộ mockup theo từng user

## Bước 1 — Thiết lập Authentication

Mặc định Supabase đã bật email/password. Cần check:

1. Vào **Authentication → Providers** → Email phải **Enabled** (mặc định OK)
2. Vào **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (cho dev) hoặc `https://etsytoolkit.pages.dev` (cho production)
   - **Redirect URLs**: thêm cả 2 nếu cần
3. (Tuỳ chọn) **Authentication → Email Templates**: tuỳ chỉnh email confirm
4. Có thể tắt confirm email cho test nhanh: **Authentication → Sign In / Up → Email** → tắt "Confirm email" tạm thời (production nên bật lại)

## Bước 2 — Schema database

Vào **SQL Editor** → New query → paste đoạn SQL bên dưới → **Run**:

```sql
-- ============================================================================
-- Etsy Tool — Supabase setup: mockup_sets table + Storage bucket + RLS
-- Chạy 1 lần. Idempotent (an toàn khi chạy lại).
-- ============================================================================

-- 1) Table chứa metadata bộ mockup. Binary mockup lưu ở Storage bucket.
create table if not exists public.mockup_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  templates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mockup_sets_user_id_idx
  on public.mockup_sets (user_id, created_at desc);

-- 2) Trigger auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_mockup_sets on public.mockup_sets;
create trigger trg_touch_mockup_sets
  before update on public.mockup_sets
  for each row execute function public.touch_updated_at();

-- 3) RLS: user chỉ thao tác được set của chính mình
alter table public.mockup_sets enable row level security;

drop policy if exists "user can read own sets" on public.mockup_sets;
create policy "user can read own sets" on public.mockup_sets
  for select using (auth.uid() = user_id);

drop policy if exists "user can insert own sets" on public.mockup_sets;
create policy "user can insert own sets" on public.mockup_sets
  for insert with check (auth.uid() = user_id);

drop policy if exists "user can update own sets" on public.mockup_sets;
create policy "user can update own sets" on public.mockup_sets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user can delete own sets" on public.mockup_sets;
create policy "user can delete own sets" on public.mockup_sets
  for delete using (auth.uid() = user_id);

-- 4) Storage bucket cho mockup binary
insert into storage.buckets (id, name, public)
values ('mockup-blobs', 'mockup-blobs', false)
on conflict (id) do nothing;

-- 5) RLS storage: user chỉ upload/đọc thư mục {user_id}/...
drop policy if exists "user can upload own folder" on storage.objects;
create policy "user can upload own folder" on storage.objects
  for insert with check (
    bucket_id = 'mockup-blobs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "user can read own folder" on storage.objects;
create policy "user can read own folder" on storage.objects
  for select using (
    bucket_id = 'mockup-blobs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "user can update own folder" on storage.objects;
create policy "user can update own folder" on storage.objects
  for update using (
    bucket_id = 'mockup-blobs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "user can delete own folder" on storage.objects;
create policy "user can delete own folder" on storage.objects
  for delete using (
    bucket_id = 'mockup-blobs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Bước 3 — Cấu hình env

### Local dev

File `.env.local` đã tạo sẵn với key của bạn. Restart dev server:
```bash
npm run dev
```

### Cloudflare Pages

Vào project Cloudflare Pages → **Settings → Environment variables** → thêm 2 biến cho cả Production và Preview:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://hwcgsxplvngwsqhkxyxs.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` (publishable key đầy đủ) |

Click **Save** → re-deploy để env vars có hiệu lực.

## Bước 4 — Test

1. Mở app → góc phải header có 2 nút **Login** / **Sign up**
2. Click **Sign up** → nhập email + password (≥ 6 ký tự)
3. Nếu enabled "Confirm email" → check inbox, click link confirm
4. Login lại → header hiển thị `👤 email@... [Logout]`

Nếu thấy `⚠ Cloud sync disabled` ở góc → env vars chưa load. Kiểm tra `.env.local` rồi restart `npm run dev`.

## Phase 2 — Cloud sync (sẽ build sau)

Khi auth chạy OK, tôi sẽ thêm:
- Hook `useCloudSync` upload bộ mockup local lên Storage bucket
- Pull bộ từ cloud về khi login máy mới
- Auto-sync khi đổi bộ
- UI: nút "☁ Sync to cloud" / "↓ Pull from cloud" trong MockupEditor
