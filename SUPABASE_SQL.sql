-- ============================================================
-- SQL TẠO BẢNG SUPABASE CHO ỨNG DỤNG QUẢN LÝ ỨNG VIÊN PHÒNG TQT
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tạo bảng candidates
CREATE TABLE IF NOT EXISTS public.candidates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stt             INTEGER,                   -- Số thứ tự (tùy chọn, tự điền)
  group_type      TEXT NOT NULL DEFAULT 'I'  -- 'I' = UV đi làm ngay, 'II' = UV tiềm năng
                  CHECK (group_type IN ('I', 'II')),
  full_name       TEXT NOT NULL,             -- Tên ứng viên
  birth_year      TEXT,                      -- Năm sinh (lưu dạng text để linh hoạt)
  phone           TEXT,                      -- Số điện thoại
  experience      TEXT,                      -- Kinh nghiệm / Năng lực
  position        TEXT,                      -- Vị trí ứng tuyển
  desired_location TEXT,                     -- Địa điểm mong muốn làm việc
  referral_date   TEXT,                      -- Ngày giới thiệu (text để lưu "04/03/2026" hoặc "T1/2026")
  referrer        TEXT,                      -- Người giới thiệu
  ptd_received    BOOLEAN DEFAULT FALSE,     -- PTD đã nhận hồ sơ giới thiệu chưa
  ptd_received_date TEXT,                    -- Ngày PTD nhận HS
  recruitment_status TEXT DEFAULT 'P.TD chưa liên hệ', -- Tình trạng tuyển dụng
  highlight_color TEXT DEFAULT '',           -- Màu highlight dòng: 'green', 'yellow', 'blue', 'orange', 'red', 'purple', 'pink', ''
  notes           TEXT,                      -- Ghi chú
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
-- ROW LEVEL SECURITY (RLS) - Bật bảo mật theo người dùng
-- Nếu muốn app PUBLIC (không cần đăng nhập): chạy phần bên dưới
-- Nếu muốn có xác thực: thiết lập Auth trong Supabase
-- ============================================================

-- Bật RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Policy: Cho phép tất cả với anon key (phù hợp app nội bộ, không cần đăng nhập)
-- XÓA policy này nếu muốn yêu cầu đăng nhập
CREATE POLICY "Allow all for anon"
  ON public.candidates
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy cho authenticated users (nếu sau này thêm auth)
CREATE POLICY "Allow all for authenticated"
  ON public.candidates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- DỮ LIỆU MẪU (tùy chọn, xóa nếu không cần)
-- ============================================================

INSERT INTO public.candidates (group_type, stt, full_name, birth_year, phone, experience, position, desired_location, referral_date, referrer, ptd_received, recruitment_status, highlight_color, notes) VALUES
('I', 1, 'Đinh Quang Sáng', '2001', '0969961951', 'Đã có KN', 'Thợ hàn', NULL, '04/03/2026', 'Trần Thư Trường', TRUE, 'Đang đi làm ở DA KCN Thanh Hoá', 'green', NULL),
('I', 2, 'Trần Trí Mỹ', '1975', '0343657467', 'Đã có KN', 'Thợ hàn', NULL, '04/03/2026', 'Trần Thư Trường', FALSE, 'P.TD chưa liên hệ', '', NULL),
('I', 3, 'Nguyễn Đức Thái', '1985', '0989783870', 'Đã có KN', 'Thợ hàn/Lái xe có bằng C', NULL, '04/03/2026', 'Trần Thư Trường', FALSE, 'P.TD chưa liên hệ', '', NULL),
('I', 4, 'Lê Ngọc Tú', '1969', '0379189671', 'Lđpt, đã có KN', 'Thợ Btông, CP, cốt thép', 'Hà Nội, Thanh Hóa', '11/03/2026', 'Lê Thanh Tùng', FALSE, 'Đã ký hợp đồng', '', 'Đang làm DA Thanh Hóa'),
('I', 5, 'Bùi Văn Hưng', '1978', '0364762003', 'Lđpt, đã có KN', 'Thợ Btông, CP, cốt thép', 'Hà Nội, Thanh Hóa', '11/03/2026', 'Lê Thanh Tùng', FALSE, 'Đã ký hợp đồng', '', 'Đang làm DA Thanh Hóa'),
('II', 1, 'Phan Văn Mạnh', '1986', '0775 258 525', 'Đã có KN', 'Giám sát ĐS TĐC, GS các DA khác', 'Miền Bắc', '05/03/2026', 'Phan Đức Long', FALSE, 'P.TD chưa liên hệ', '', NULL),
('II', 2, 'Nguyễn Huy Vương', '1992', '0888 181 138', 'Đã có KN', 'Chuyên viên kế hoạch, kỹ thuật, QS', 'Hạ Long, Quảng Ninh', '05/03/2026', 'Phan Đức Long', FALSE, 'P.TD chưa liên hệ', '', NULL);

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT COUNT(*) as total_candidates FROM public.candidates;
SELECT group_type, COUNT(*) as count FROM public.candidates GROUP BY group_type;
