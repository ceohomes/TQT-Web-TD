import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Đọc Supabase config từ URL query params hoặc localStorage
function getSupabaseClient() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('sb_url') || localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = params.get('sb_key') || localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (url && key) return createClient(url, key);
  return null;
}

// Lấy group_code từ URL query
function getGroupCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('group') || '';
}

function getGroupName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('group_name') || 'Thông tin ứng viên';
}

const POSITIONS = [
  'Công nhân sản xuất',
  'Kỹ thuật viên',
  'Kỹ sư',
  'Quản lý / Giám sát',
  'Văn phòng / Hành chính',
  'Kế toán / Tài chính',
  'Bán hàng / Kinh doanh',
  'Lái xe / Vận chuyển',
  'Bảo vệ / An ninh',
  'Vệ sinh công nghiệp',
  'Khác',
];

const LOCATIONS = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Thanh Hóa',
  'Nghệ An',
  'Hà Tĩnh',
  'Khác',
];

type FormState = {
  full_name: string;
  birth_year: string;
  phone: string;
  position: string;
  desired_location: string;
  notes: string; // Hồ sơ cá nhân / ghi chú
};

type Step = 'form' | 'success' | 'error' | 'no_config';

export default function PublicForm() {
  const [form, setForm] = useState<FormState>({
    full_name: '',
    birth_year: '',
    phone: '',
    position: '',
    desired_location: '',
    notes: '',
  });
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const groupCode = getGroupCode();
  const groupName = getGroupName();

  // Kiểm tra config
  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb || !groupCode) {
      setStep('no_config');
    }
  }, []);

  const set = (key: keyof FormState, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { setErrorMsg('Vui lòng nhập họ tên'); return; }
    if (!form.phone.trim()) { setErrorMsg('Vui lòng nhập số điện thoại'); return; }
    setErrorMsg('');
    setLoading(true);

    try {
      const sb = getSupabaseClient();
      if (!sb) throw new Error('Chưa cấu hình kết nối database');

      const now = new Date();
      const rDay = String(now.getDate()).padStart(2, '0');
      const rMonth = String(now.getMonth() + 1).padStart(2, '0');
      const rYear = now.getFullYear();
      const referralDate = `${rDay}/${rMonth}/${rYear}`;

      const { error } = await sb.from('candidates').insert([{
        group_type: groupCode,
        full_name: form.full_name.trim(),
        birth_year: form.birth_year.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        desired_location: form.desired_location.trim(),
        notes: form.notes.trim(),
        recruitment_status: 'P.TD chưa liên hệ',
        referral_date: referralDate,
      }]);

      if (error) throw error;
      setStep('success');
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white placeholder:text-slate-400";
  const labelClass = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

  if (step === 'no_config') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-black text-slate-800 mb-2">Liên kết không hợp lệ</h2>
          <p className="text-sm text-slate-500">Form này chưa được cấu hình đúng. Vui lòng liên hệ bộ phận nhân sự.</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Đã gửi thành công!</h2>
          <p className="text-sm text-slate-500 mb-6">Thông tin của bạn đã được ghi nhận. Phòng nhân sự sẽ liên hệ với bạn sớm nhất có thể.</p>
          <button
            onClick={() => { setForm({ full_name: '', birth_year: '', phone: '', position: '', desired_location: '', notes: '' }); setStep('form'); }}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all text-sm"
          >
            Điền thêm thông tin khác
          </button>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Có lỗi xảy ra</h2>
          <p className="text-sm text-red-500 mb-6">{errorMsg}</p>
          <button
            onClick={() => setStep('form')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2c5e] via-[#1a3a6b] to-[#1e4480] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a3a6b] to-[#1e4480] px-6 py-5">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">SGC – Phòng TQT</p>
          <h1 className="text-white text-xl font-black leading-tight">Đăng ký ứng tuyển</h1>
          <p className="text-blue-200 text-xs mt-1 font-medium">{groupName}</p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Họ tên */}
          <div>
            <label className={labelClass}>Họ và tên <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Nhập họ và tên đầy đủ"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Năm sinh */}
          <div>
            <label className={labelClass}>Năm sinh</label>
            <input
              type="number"
              placeholder="VD: 1995"
              value={form.birth_year}
              onChange={e => set('birth_year', e.target.value)}
              className={inputClass}
              min="1950"
              max={new Date().getFullYear()}
            />
          </div>

          {/* SĐT */}
          <div>
            <label className={labelClass}>Số điện thoại <span className="text-red-500">*</span></label>
            <input
              type="tel"
              placeholder="VD: 0912 345 678"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Vị trí ứng tuyển */}
          <div>
            <label className={labelClass}>Vị trí ứng tuyển</label>
            <select
              value={form.position}
              onChange={e => set('position', e.target.value)}
              className={inputClass}
            >
              <option value="">-- Chọn vị trí --</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Địa điểm */}
          <div>
            <label className={labelClass}>Địa điểm mong muốn làm việc</label>
            <select
              value={form.desired_location}
              onChange={e => set('desired_location', e.target.value)}
              className={inputClass}
            >
              <option value="">-- Chọn địa điểm --</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Hồ sơ cá nhân / Ghi chú */}
          <div>
            <label className={labelClass}>Hồ sơ cá nhân / Ghi chú thêm</label>
            <textarea
              placeholder="Mô tả kinh nghiệm, bằng cấp, hoặc thông tin muốn chia sẻ..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className={inputClass + ' resize-none'}
              rows={3}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-black rounded-xl transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang gửi...
              </>
            ) : 'Gửi thông tin ứng tuyển'}
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Thông tin của bạn được bảo mật và chỉ dùng cho mục đích tuyển dụng
          </p>
        </div>
      </div>
    </div>
  );
}
