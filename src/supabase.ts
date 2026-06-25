import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://aelxgbnkyqpeckzknemv.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbHhnYm5reXFwZWNremtuZW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTI5NDcsImV4cCI6MjA4ODc2ODk0N30.8jL7qazYaSsC5ebKVwda623CC8ObGWj5-5yHiVJhAZg';

// Ưu tiên: biến môi trường lúc build (Cloudflare Pages) → fallback: localStorage (cấu hình qua UI) → default hardcoded
function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('sb_url') || DEFAULT_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('sb_key') || DEFAULT_KEY;
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
