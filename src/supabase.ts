import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ưu tiên: biến môi trường lúc build (Cloudflare Pages) → fallback: localStorage (cấu hình qua UI)
function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('sb_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('sb_key') || '';
  if (url && key) {
    return createClient(url, key);
  }
  return null;
}

export let supabase = getSupabaseClient();

// Gọi hàm này sau khi người dùng lưu settings để tạo lại client mà không cần reload
export function reinitSupabase(): SupabaseClient | null {
  supabase = getSupabaseClient();
  return supabase;
}
