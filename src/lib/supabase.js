import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = !!(url && anonKey)

// Singleton client. Nếu chưa cấu hình env vars, supabase = null
// → toàn bộ tính năng cloud sẽ disable, app vẫn chạy local-only.
export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null

if (!supabaseEnabled) {
  console.warn(
    'Supabase env vars chưa cấu hình. Cloud sync + auth disabled. ' +
      'Set VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong .env.local hoặc Cloudflare env vars.'
  )
}
