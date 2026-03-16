import { createClient } from '@supabase/supabase-js';

// ⚙️ ĐIỀN THÔNG TIN SUPABASE CỦA BẠN VÀO ĐÂY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
