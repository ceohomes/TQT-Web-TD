-- ============================================================
-- SQL TẠO BẢNG SUPABASE CHO ỨNG DỤNG QUẢN LÝ ỨNG VIÊN PHÒNG TQT
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Bảng cấu hình Nhóm
CREATE TABLE IF NOT EXISTS public.settings_groups (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng cấu hình Tình trạng tuyển dụng
CREATE TABLE IF NOT EXISTS public.settings_statuses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color_bg    TEXT DEFAULT '#f1f5f9',
  color_text  TEXT DEFAULT '#475569',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng Người giới thiệu
CREATE TABLE IF NOT EXISTS public.settings_referrers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng Nhân sự P.TD
CREATE TABLE IF NOT EXISTS public.settings_recruiters (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo bảng candidates
CREATE TABLE IF NOT EXISTS public.candidates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stt             INTEGER,
  group_type      TEXT NOT NULL DEFAULT 'I',
  full_name       TEXT NOT NULL,
  birth_year      TEXT,
  phone           TEXT,
  experience      TEXT,
  position        TEXT,
  desired_location TEXT,
  referral_date   TEXT,
  referrer        TEXT,
  ptd_received    BOOLEAN DEFAULT FALSE,
  ptd_received_date TEXT,
  recruiter       TEXT,
  recruitment_status TEXT DEFAULT 'P.TD chưa liên hệ',
  highlight_color TEXT DEFAULT '',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index để tăng tốc tìm kiếm
CREATE INDEX IF NOT EXISTS idx_candidates_group_type ON public.candidates(group_type);
CREATE INDEX IF NOT EXISTS idx_candidates_full_name  ON public.candidates(full_name);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON public.candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_recruitment_status ON public.candidates(recruitment_status);

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_candidates_updated_at ON public.candidates;
CREATE TRIGGER trigger_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.settings_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_statuses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON public.settings_groups    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.settings_statuses  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.settings_referrers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.settings_recruiters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.candidates         FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- ⚡ REALTIME – BẮT BUỘC ĐỂ ĐỒNG BỘ NHIỀU NGƯỜI DÙNG
-- Chạy riêng từng lệnh nếu bị lỗi "already member"
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings_referrers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings_recruiters;

-- HOẶC bật qua Supabase Dashboard (không cần SQL):
-- Database → Replication → supabase_realtime → tick các bảng trên → Save

-- ============================================================
-- DỮ LIỆU MẪU
-- ============================================================

INSERT INTO public.settings_groups (code, name) VALUES
('I', 'Nhóm I – UV đi làm ngay'),
('II', 'Nhóm II – UV tiềm năng')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.settings_statuses (name, color_bg, color_text, sort_order) VALUES
('P.TD chưa liên hệ',              '#e2e8f0', '#475569', 1),
('Đang liên hệ',                   '#bfdbfe', '#1e3a8a', 2),
('Đang phỏng vấn',                 '#fde68a', '#78350f', 3),
('Chờ kết quả',                    '#fed7aa', '#9a3412', 4),
('Đã ký hợp đồng',                 '#a5f3fc', '#164e63', 5),
('Đang đi làm',                    '#bbf7d0', '#14532d', 6),
('Đang đi làm ở DA KCN Thanh Hoá', '#bbf7d0', '#14532d', 7),
('Không phù hợp',                  '#fecaca', '#7f1d1d', 8),
('Hủy / Từ chối',                  '#fecaca', '#7f1d1d', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT COUNT(*) as total_candidates FROM public.candidates;
SELECT group_type, COUNT(*) as count FROM public.candidates GROUP BY group_type;

-- ============================================================
-- BẢNG TÀI LIỆU ĐÍNH KÈM (documents)
-- Chạy phần này để bật tính năng "Tài liệu đính kèm"
-- ============================================================

-- 1. Tạo bảng documents
CREATE TABLE IF NOT EXISTS public.documents (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL,
  file_size    BIGINT,
  storage_path TEXT NOT NULL,
  public_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger auto-update updated_at
DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS Policy
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON public.documents FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- ============================================================
-- STORAGE BUCKET (chạy trong Supabase Dashboard → Storage)
-- Tạo bucket tên "documents" với cài đặt:
--   - Public bucket: BẬT (để đọc file không cần xác thực)
--   - File size limit: 50MB (hoặc tùy nhu cầu)
--   - Allowed MIME types: application/pdf, application/msword,
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- HOẶC chạy SQL dưới đây trong SQL Editor:
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800,  -- 50MB
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Allow public read on documents bucket"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'documents');

CREATE POLICY "Allow anon upload to documents bucket"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow anon delete from documents bucket"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'documents');
