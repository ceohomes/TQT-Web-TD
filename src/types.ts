export type CandidateGroup = 'I' | 'II';

export interface Candidate {
  id: string;
  stt?: number;           // Số thứ tự (tự động từ DB hoặc tính toán)
  group_type: CandidateGroup; // Nhóm: I = UV đi làm ngay, II = UV tiềm năng
  full_name: string;      // Tên ứng viên
  birth_year?: string;    // Năm sinh
  phone?: string;         // Số điện thoại
  experience?: string;    // Kinh nghiệm/năng lực
  position?: string;      // Vị trí ứng tuyển
  desired_location?: string; // Địa điểm mong muốn làm việc
  referral_date?: string; // Ngày giới thiệu
  referrer?: string;      // Người giới thiệu
  ptd_received?: boolean; // PTD nhận HS giới thiệu
  ptd_received_date?: string; // Ngày PTD nhận HS
  recruitment_status?: string; // Tình trạng tuyển dụng
  highlight_color?: string; // Màu highlight (green, blue, yellow, red, orange)
  notes?: string;         // Ghi chú
  created_at?: string;
  updated_at?: string;
}

export type ToastType = 'success' | 'error' | 'loading' | 'info';

export interface Toast {
  message: string;
  type: ToastType;
}
