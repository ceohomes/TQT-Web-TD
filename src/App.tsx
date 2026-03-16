import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, Search, Filter, X, Save, Settings,
  Download, RotateCw, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, Users, Menu, Database, FileDown, RefreshCw,
  ChevronLeft, ChevronRight, Eye, EyeOff, Key,
} from 'lucide-react';
import { supabase as supabaseInit, reinitSupabase } from './supabase';
import type { Candidate, Group, RecruitmentStatus, Toast } from './types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS: { key: string; label: string; bg: string; text: string; border: string }[] = [
  { key: '', label: 'Mặc định', bg: '', text: '', border: '' },
  { key: 'green', label: 'Xanh lá (Đang làm)', bg: '#bbf7d0', text: '#14532d', border: '#86efac' },
  { key: 'yellow', label: 'Vàng (Chú ý)', bg: '#fef9c3', text: '#78350f', border: '#fde047' },
  { key: 'blue', label: 'Xanh dương', bg: '#bfdbfe', text: '#1e3a8a', border: '#93c5fd' },
  { key: 'orange', label: 'Cam (Ưu tiên)', bg: '#fed7aa', text: '#9a3412', border: '#fb923c' },
  { key: 'red', label: 'Đỏ (Chú ý cao)', bg: '#fecaca', text: '#7f1d1d', border: '#f87171' },
  { key: 'purple', label: 'Tím', bg: '#ddd6fe', text: '#4c1d95', border: '#a78bfa' },
  { key: 'pink', label: 'Hồng', bg: '#fbcfe8', text: '#831843', border: '#f9a8d4' },
];

const RECRUITMENT_STATUSES = [
  'P.TD chưa liên hệ',
  'Đang liên hệ',
  'Đã ký hợp đồng',
  'Đang đi làm',
  'Đang đi làm ở DA KCN Thanh Hoá',
  'Không phù hợp',
  'Hủy / Từ chối',
  'Đang phỏng vấn',
  'Chờ kết quả',
];

const EMPTY_CANDIDATE: Omit<Candidate, 'id'> = {
  group_type: '',
  full_name: '',
  birth_year: '',
  phone: '',
  experience: '',
  position: '',
  desired_location: '',
  referral_date: '',
  referrer: '',
  ptd_received: false,
  ptd_received_date: '',
  recruitment_status: '',
  highlight_color: '',
  notes: '',
};

// ─── Toast Component ──────────────────────────────────────────────────────────

function ToastDisplay({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null;
  const colors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    loading: 'bg-[#1a3a6b]',
    info: 'bg-slate-700',
  };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm toast ${colors[toast.type]}`}>
      {toast.type === 'loading' && <Loader2 className="animate-spin w-5 h-5 shrink-0" />}
      {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────

function SettingsModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (url: string, key: string) => void;
}) {
  const [url, setUrl] = useState(localStorage.getItem('sb_url') || '');
  const [key, setKey] = useState(localStorage.getItem('sb_key') || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const validateInputs = () => {
    const u = url.trim();
    const k = key.trim();
    if (!u) return 'Vui lòng nhập Supabase Project URL';
    if (!u.startsWith('https://')) return 'URL phải bắt đầu bằng https://';
    if (!u.includes('.supabase.co')) return 'URL không đúng định dạng (phải chứa .supabase.co)';
    if (!k) return 'Vui lòng nhập Anon Key';
    if (!k.startsWith('eyJ')) return 'Anon Key không đúng định dạng (phải bắt đầu bằng eyJ...)';
    return null;
  };

  const handleTest = async () => {
    const err = validateInputs();
    if (err) { setTestResult({ ok: false, msg: err }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(url.trim(), key.trim());
      const { error } = await testClient.from('candidates').select('id').limit(1);
      if (error) {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          setTestResult({ ok: false, msg: '⚠️ Kết nối OK nhưng chưa tạo bảng! Hãy chạy SQL tạo bảng trong Supabase.' });
        } else if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
          setTestResult({ ok: false, msg: '❌ Anon Key không hợp lệ. Kiểm tra lại key trong Supabase → Settings → API.' });
        } else {
          setTestResult({ ok: false, msg: `❌ Lỗi: ${error.message}` });
        }
      } else {
        setTestResult({ ok: true, msg: '✅ Kết nối thành công! Bảng candidates tồn tại.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: `❌ Không thể kết nối: ${e?.message || 'Kiểm tra lại URL'}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveClick = () => {
    const err = validateInputs();
    if (err) { setTestResult({ ok: false, msg: err }); return; }
    onSave(url, key);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-gradient-to-br from-[#1a3a6b] to-[#1e4480] rounded-2xl w-full max-w-lg p-0 overflow-hidden shadow-2xl border border-blue-800" onClick={e => e.stopPropagation()}>
        <div className="px-7 py-5 border-b border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl"><Settings size={18} className="text-sky-300" /></div>
            <div>
              <h3 className="text-white font-black text-base uppercase tracking-tight">Cấu hình Supabase</h3>
              <p className="text-blue-300 text-xs mt-0.5">Điền thông tin kết nối database</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-blue-300 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-7 space-y-5">
          <div>
            <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-2">Supabase Project URL</label>
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setTestResult(null); }}
              placeholder="https://abcdefghij.supabase.co"
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all"
            />
            <p className="text-blue-300/60 text-[10px] mt-1 ml-1">Lấy từ: Supabase → Project Settings → API → Project URL</p>
          </div>
          <div>
            <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-2">Anon Key (public)</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={e => { setKey(e.target.value); setTestResult(null); }}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 pr-12 text-sm font-medium outline-none focus:border-sky-400 transition-all"
              />
              <button onClick={() => setShowKey(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-blue-300/60 text-[10px] mt-1 ml-1">Lấy từ: Supabase → Project Settings → API → anon public</p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold',
              testResult.ok ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-red-900/50 text-red-300 border border-red-700'
            )}>
              {testResult.msg}
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-blue-200 space-y-1.5">
            <p className="font-black text-white text-[11px] uppercase tracking-widest mb-2">📋 Hướng dẫn lấy thông tin:</p>
            <p>1. Đăng nhập <span className="text-sky-300 font-semibold">supabase.com</span> → chọn Project</p>
            <p>2. Vào <span className="text-sky-300 font-semibold">Project Settings → API</span></p>
            <p>3. Copy <span className="text-sky-300 font-semibold">Project URL</span> (dạng https://xxx.supabase.co)</p>
            <p>4. Copy <span className="text-sky-300 font-semibold">anon public</span> key (bắt đầu bằng eyJ...)</p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 font-bold text-sm transition-all">Hủy</button>
            <button onClick={handleTest} disabled={testing}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {testing ? <Loader2 size={14} className="animate-spin" /> : null}
              {testing ? 'Đang kiểm tra...' : '🔍 Kiểm tra kết nối'}
            </button>
            <button onClick={handleSaveClick}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm transition-all shadow-lg">
              Lưu & Kết nối
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Candidate Form Modal ─────────────────────────────────────────────────────

function CandidateModal({
  candidate, onClose, onSave, mode, groups, statuses
}: {
  candidate: Partial<Candidate>;
  onClose: () => void;
  onSave: (data: Partial<Candidate>) => void;
  mode: 'add' | 'edit';
  groups: Group[];
  statuses: RecruitmentStatus[];
}) {
  const [form, setForm] = useState<Partial<Candidate>>(candidate);

  const set = (key: keyof Candidate, val: any) => setForm(p => ({ ...p, [key]: val }));

  const highlight = HIGHLIGHT_COLORS.find(c => c.key === form.highlight_color) || HIGHLIGHT_COLORS[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #1e4480 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              {mode === 'add' ? <Plus size={18} className="text-white" /> : <Edit2 size={18} className="text-white" />}
            </div>
            <div>
              <h3 className="text-white font-black text-base uppercase tracking-tight">
                {mode === 'add' ? 'Thêm ứng viên mới' : 'Chỉnh sửa ứng viên'}
              </h3>
              <p className="text-blue-200 text-xs mt-0.5">{form.full_name || 'Điền thông tin bên dưới'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-blue-200 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-140px)] space-y-5">
          {/* Nhóm & Tên */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Nhóm</label>
              <select value={form.group_type} onChange={e => set('group_type', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all">
                <option value="">-- Chọn nhóm --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.code}>{g.code} – {g.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tên ứng viên <span className="text-red-500">*</span></label>
              <input value={form.full_name || ''} onChange={e => set('full_name', e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>

          {/* Năm sinh & SĐT & Kinh nghiệm */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Năm sinh</label>
              <input value={form.birth_year || ''} onChange={e => set('birth_year', e.target.value)}
                placeholder="1990"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Số điện thoại</label>
              <input value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                placeholder="0900 000 000"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Kinh nghiệm/Năng lực</label>
              <input value={form.experience || ''} onChange={e => set('experience', e.target.value)}
                placeholder="Đã có KN, Lđpt..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>

          {/* Vị trí & Địa điểm */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Vị trí ứng tuyển</label>
              <input value={form.position || ''} onChange={e => set('position', e.target.value)}
                placeholder="Thợ hàn, Giám sát..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Địa điểm mong muốn</label>
              <input value={form.desired_location || ''} onChange={e => set('desired_location', e.target.value)}
                placeholder="Hà Nội, Thanh Hoá..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>

          {/* Ngày giới thiệu & Người giới thiệu */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ngày giới thiệu</label>
              <input value={form.referral_date || ''} onChange={e => set('referral_date', e.target.value)}
                placeholder="dd/mm/yyyy hoặc T1/2026"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Người giới thiệu</label>
              <input value={form.referrer || ''} onChange={e => set('referrer', e.target.value)}
                placeholder="Trần Văn B"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>

          {/* PTD & Tình trạng */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">PTD nhận HS</label>
              <div className="flex items-center gap-3 h-[42px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.ptd_received || false} onChange={e => set('ptd_received', e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Đã nhận</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ngày PTD nhận</label>
              <input value={form.ptd_received_date || ''} onChange={e => set('ptd_received_date', e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tình trạng tuyển dụng</label>
              <select value={form.recruitment_status || ''} onChange={e => set('recruitment_status', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all">
                <option value="">-- Chọn trạng thái --</option>
                {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Màu highlight & Ghi chú */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Màu nổi bật</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.key || '_none'}
                    type="button"
                    onClick={() => set('highlight_color', c.key)}
                    title={c.label}
                    className={cn(
                      'w-7 h-7 rounded-lg border-2 transition-all',
                      form.highlight_color === c.key ? 'border-blue-600 scale-110 shadow-md' : 'border-slate-200 hover:border-slate-400'
                    )}
                    style={c.bg ? { background: c.bg } : { background: 'white', backgroundImage: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, white 3px, white 6px)' }}
                  />
                ))}
              </div>
              {highlight.key && <p className="text-xs text-slate-500 font-medium">{highlight.label}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ghi chú</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Thông tin bổ sung..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all resize-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all">Hủy</button>
          <button onClick={() => onSave(form)}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white font-black text-sm hover:from-blue-700 hover:to-blue-900 transition-all shadow-lg flex items-center gap-2">
            <Save size={15} />
            {mode === 'add' ? 'Thêm ứng viên' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ────────────────────────────────────────────────────

function ConfirmDeleteModal({ name, onConfirm, onClose }: {
  name: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Trash2 size={18} className="text-white" />
          </div>
          <h3 className="text-white font-black text-base">Xác nhận xóa</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-700 font-semibold">Xóa ứng viên:</p>
          <p className="text-red-700 font-black text-lg mt-1">{name}</p>
          <p className="text-slate-500 text-sm mt-3">Hành động này không thể hoàn tác.</p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">Hủy</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black transition-all">Xóa</button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, statuses = [] }: { status: string; statuses?: RecruitmentStatus[] }) {
  const dynamicStatus = statuses.find(s => s.name === status);
  const colorMap: Record<string, { bg: string; color: string }> = {
    'Đang đi làm': { bg: '#bbf7d0', color: '#14532d' },
    'Đang đi làm ở DA KCN Thanh Hoá': { bg: '#bbf7d0', color: '#14532d' },
    'Đã ký hợp đồng': { bg: '#a5f3fc', color: '#164e63' },
    'Đang phỏng vấn': { bg: '#fde68a', color: '#78350f' },
    'Chờ kết quả': { bg: '#fed7aa', color: '#9a3412' },
    'P.TD chưa liên hệ': { bg: '#e2e8f0', color: '#475569' },
    'Đang liên hệ': { bg: '#bfdbfe', color: '#1e3a8a' },
    'Không phù hợp': { bg: '#fecaca', color: '#7f1d1d' },
    'Hủy / Từ chối': { bg: '#fecaca', color: '#7f1d1d' },
  };

  let style = colorMap[status] || { bg: '#f1f5f9', color: '#475569' };

  if (dynamicStatus && dynamicStatus.color_bg) {
    style = { bg: dynamicStatus.color_bg, color: dynamicStatus.color_text || '#000000' };
  }

  return (
    <span className="status-badge" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  );
}

// ─── Quick Status Update Tool ─────────────────────────────────────────────────

function QuickStatusUpdateTool({
  candidates, sb, onUpdated, showToast, statuses
}: {
  candidates: Candidate[];
  sb: any;
  onUpdated: () => void;
  showToast: (msg: string, type: Toast['type']) => void;
  statuses: RecruitmentStatus[];
}) {
  const [selectedId, setSelectedId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = candidates.find(c => c.id === selectedId);

  const handleUpdate = async () => {
    if (!sb || !selectedId || !newStatus) {
      showToast('Vui lòng chọn ứng viên và tình trạng', 'error');
      return;
    }
    setSaving(true);
    showToast('Đang cập nhật...', 'loading');
    try {
      const { error } = await sb
        .from('candidates')
        .update({ recruitment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', selectedId);
      if (error) throw error;
      showToast(`✅ Đã cập nhật tình trạng: ${selected?.full_name}`, 'success');
      setSelectedId('');
      setNewStatus('');
      await onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e?.message || 'Không xác định'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
          <Edit2 size={14} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Cập nhật nhanh tình trạng tuyển dụng</h3>
          <p className="text-xs text-slate-400 mt-0.5">Chọn ứng viên và cập nhật tình trạng trực tiếp</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Chọn ứng viên */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Ứng viên</label>
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setNewStatus(''); }}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-orange-400 bg-white transition-all"
          >
            <option value="">-- Chọn ứng viên --</option>
            {[...candidates]
              .sort((a, b) => (a.group_type + a.full_name).localeCompare(b.group_type + b.full_name))
              .map(c => (
                <option key={c.id} value={c.id}>
                  [{c.group_type}] {c.full_name}
                </option>
              ))}
          </select>
        </div>

        {/* Tình trạng hiện tại (readonly) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Tình trạng mới</label>
          <select
            value={newStatus}
            onChange={e => setNewStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-orange-400 bg-white transition-all"
          >
            <option value="">-- Chọn tình trạng --</option>
            {statuses.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Nút cập nhật */}
        <div>
          <button
            onClick={handleUpdate}
            disabled={saving || !selectedId || !newStatus}
            className="w-full py-2.5 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-all flex items-center justify-center gap-2 shadow"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Cập nhật
          </button>
        </div>
      </div>

      {/* Preview tình trạng hiện tại */}
      {selected && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 font-semibold">Tình trạng hiện tại của <span className="text-slate-700 font-black">{selected.full_name}</span>:</span>
          {selected.recruitment_status
            ? <StatusBadge status={selected.recruitment_status} statuses={statuses} />
            : <span className="text-xs text-slate-300 italic">Chưa có</span>}
          {newStatus && newStatus !== selected.recruitment_status && (
            <>
              <span className="text-slate-300 text-xs">→</span>
              <StatusBadge status={newStatus} statuses={statuses} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Config View Component ───────────────────────────────────────────────────

function ConfigView({
  sb, groups, statuses, showToast, onUpdated
}: {
  sb: any;
  groups: Group[];
  statuses: RecruitmentStatus[];
  showToast: (msg: string, type: Toast['type']) => void;
  onUpdated: () => void;
}) {
  const [editingGroup, setEditingGroup] = useState<Partial<Group> | null>(null);
  const [editingStatus, setEditingStatus] = useState<Partial<RecruitmentStatus> | null>(null);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup?.code || !editingGroup?.name) return;
    try {
      if (editingGroup.id) {
        const { error } = await sb.from('settings_groups').update({
          code: editingGroup.code,
          name: editingGroup.name,
          description: editingGroup.description
        }).eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('settings_groups').insert([{
          code: editingGroup.code,
          name: editingGroup.name,
          description: editingGroup.description
        }]);
        if (error) throw error;
      }
      showToast('✅ Đã lưu nhóm', 'success');
      setEditingGroup(null);
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatus?.name) return;
    try {
      if (editingStatus.id) {
        const { error } = await sb.from('settings_statuses').update({
          name: editingStatus.name,
          color_bg: editingStatus.color_bg,
          color_text: editingStatus.color_text,
          sort_order: editingStatus.sort_order
        }).eq('id', editingStatus.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('settings_statuses').insert([{
          name: editingStatus.name,
          color_bg: editingStatus.color_bg,
          color_text: editingStatus.color_text,
          sort_order: editingStatus.sort_order
        }]);
        if (error) throw error;
      }
      showToast('✅ Đã lưu tình trạng', 'success');
      setEditingStatus(null);
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhóm này?')) return;
    try {
      const { error } = await sb.from('settings_groups').delete().eq('id', id);
      if (error) throw error;
      showToast('✅ Đã xóa nhóm', 'success');
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  const deleteStatus = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tình trạng này?')) return;
    try {
      const { error } = await sb.from('settings_statuses').delete().eq('id', id);
      if (error) throw error;
      showToast('✅ Đã xóa tình trạng', 'success');
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cấu hình Danh mục</h2>
          <p className="text-sm text-slate-500">Quản lý mã nhóm và tình trạng tuyển dụng</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Groups Management */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-blue-500" /> Danh sách Nhóm
            </h3>
            <button onClick={() => setEditingGroup({ code: '', name: '', description: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">
              <Plus size={14} /> Thêm nhóm
            </button>
          </div>

          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">{g.code}</span>
                    <span className="font-bold text-slate-800">{g.name}</span>
                  </div>
                  {g.description && <p className="text-xs text-slate-500 mt-1">{g.description}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingGroup(g)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => deleteGroup(g.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {editingGroup && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <form onSubmit={handleSaveGroup} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-black text-base uppercase tracking-tight">{editingGroup.id ? 'Sửa nhóm' : 'Thêm nhóm mới'}</h3>
                  <button type="button" onClick={() => setEditingGroup(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Mã nhóm (VD: I, II, III)</label>
                    <input required value={editingGroup.code} onChange={e => setEditingGroup({ ...editingGroup, code: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tên nhóm</label>
                    <input required value={editingGroup.name} onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Mô tả</label>
                    <textarea value={editingGroup.description || ''} onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                      rows={2} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 resize-none" />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingGroup(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg">Lưu</button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Statuses Management */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" /> Tình trạng Tuyển dụng
            </h3>
            <button onClick={() => setEditingStatus({ name: '', color_bg: '#f1f5f9', color_text: '#475569', sort_order: statuses.length + 1 })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all">
              <Plus size={14} /> Thêm tình trạng
            </button>
          </div>

          <div className="space-y-3">
            {statuses.map(s => (
              <div key={s.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black bg-white border border-slate-200 text-slate-400">
                    {s.sort_order}
                  </div>
                  <StatusBadge status={s.name} statuses={statuses} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingStatus(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => deleteStatus(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {editingStatus && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <form onSubmit={handleSaveStatus} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-black text-base uppercase tracking-tight">{editingStatus.id ? 'Sửa tình trạng' : 'Thêm tình trạng mới'}</h3>
                  <button type="button" onClick={() => setEditingStatus(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tên tình trạng</label>
                    <input required value={editingStatus.name} onChange={e => setEditingStatus({ ...editingStatus, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Màu nền (HEX)</label>
                      <div className="flex gap-2">
                        <input type="color" value={editingStatus.color_bg} onChange={e => setEditingStatus({ ...editingStatus, color_bg: e.target.value })}
                          className="w-10 h-10 p-0 border-none bg-transparent cursor-pointer" />
                        <input value={editingStatus.color_bg} onChange={e => setEditingStatus({ ...editingStatus, color_bg: e.target.value })}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Màu chữ (HEX)</label>
                      <div className="flex gap-2">
                        <input type="color" value={editingStatus.color_text} onChange={e => setEditingStatus({ ...editingStatus, color_text: e.target.value })}
                          className="w-10 h-10 p-0 border-none bg-transparent cursor-pointer" />
                        <input value={editingStatus.color_text} onChange={e => setEditingStatus({ ...editingStatus, color_text: e.target.value })}
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Thứ tự sắp xếp</label>
                    <input type="number" value={editingStatus.sort_order} onChange={e => setEditingStatus({ ...editingStatus, sort_order: parseInt(e.target.value) })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-500" />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Xem trước:</span>
                    <StatusBadge status={editingStatus.name || 'Tên mẫu'} statuses={[editingStatus as RecruitmentStatus]} />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingStatus(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg">Lưu</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [statuses, setStatuses] = useState<RecruitmentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; candidate: Partial<Candidate> } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'stats' | 'config'>('list');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // supabase client — có thể được reinit sau khi user lưu settings
  const [sb, setSb] = useState(() => supabaseInit);

  const PER_PAGE = 50;

  // ── Show Toast ──
  const showToast = useCallback((message: string, type: Toast['type'], duration = 3500) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    if (type !== 'loading') {
      toastTimer.current = setTimeout(() => setToast(null), duration);
    }
  }, []);

  // ── Load candidates ──
  const loadData = useCallback(async () => {
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch candidates
      const { data: candData, error: candError } = await sb
        .from('candidates')
        .select('*')
        .order('group_type', { ascending: true })
        .order('stt', { ascending: true })
        .order('created_at', { ascending: false });
      if (candError) throw candError;
      setCandidates(candData || []);

      // Fetch groups
      const { data: groupData, error: groupError } = await sb
        .from('settings_groups')
        .select('*')
        .order('code', { ascending: true });
      if (groupError) throw groupError;
      setGroups(groupData || []);

      // Fetch statuses
      const { data: statusData, error: statusError } = await sb
        .from('settings_statuses')
        .select('*')
        .order('sort_order', { ascending: true });
      if (statusError) throw statusError;
      setStatuses(statusData || []);

      setIsConnected(true);
    } catch (e: any) {
      showToast(`Lỗi kết nối Supabase: ${e?.message || 'Không xác định'}`, 'error');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [sb, showToast]);

  useEffect(() => {
    if (!sb) {
      setLoading(false);
      const url = localStorage.getItem('sb_url');
      if (!url) setShowSettings(true);
      return;
    }
    loadData();

    // Realtime subscription
    const channel = sb.channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_groups' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_statuses' }, () => {
        loadData();
      })
      .subscribe();

    return () => { sb?.removeChannel(channel); };
  }, [sb, loadData]);

  // ── Save settings ──
  const handleSaveSettings = (url: string, key: string) => {
    localStorage.setItem('sb_url', url.trim());
    localStorage.setItem('sb_key', key.trim());
    const newClient = reinitSupabase();
    setSb(newClient);
    setShowSettings(false);
    if (newClient) {
      showToast('✅ Đã kết nối Supabase thành công!', 'success');
    } else {
      showToast('❌ URL hoặc Key không hợp lệ', 'error');
    }
  };

  // ── CRUD ──
  const handleSave = async (data: Partial<Candidate>) => {
    if (!sb) { showToast('Chưa kết nối Supabase', 'error'); return; }
    if (!data.full_name?.trim()) { showToast('Vui lòng nhập tên ứng viên', 'error'); return; }

    showToast('Đang lưu...', 'loading');
    try {
      if (modal?.type === 'add') {
        const { id, ...rest } = data as Candidate;
        const { error } = await sb.from('candidates').insert([{ ...rest }]);
        if (error) throw error;
        showToast(`✅ Đã thêm: ${data.full_name}`, 'success');
      } else {
        const { id, created_at, ...rest } = data as Candidate;
        const { error } = await sb.from('candidates').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id!);
        if (error) throw error;
        showToast(`✅ Đã cập nhật: ${data.full_name}`, 'success');
      }
      setModal(null);
      await loadData();
    } catch (e: any) {
      showToast(`Lỗi: ${e?.message || 'Không xác định'}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!sb || !deleteId) return;
    showToast('Đang xóa...', 'loading');
    try {
      const { error } = await sb.from('candidates').delete().eq('id', deleteId);
      if (error) throw error;
      setDeleteId(null);
      showToast('✅ Đã xóa ứng viên', 'success');
      await loadData();
    } catch (e: any) {
      showToast(`Lỗi: ${e?.message || 'Không xác định'}`, 'error');
    }
  };

  // ── Filter & Search ──
  const filtered = candidates.filter(c => {
    if (filterGroup && c.group_type !== filterGroup) return false;
    if (filterStatus && c.recruitment_status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.position?.toLowerCase().includes(q) ||
        c.referrer?.toLowerCase().includes(q) ||
        c.recruitment_status?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const grouped = {
    I: filtered.filter(c => c.group_type === 'I'),
    II: filtered.filter(c => c.group_type === 'II'),
  };

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Stats ──
  const stats = {
    total: candidates.length,
    byGroup: groups.reduce((acc, g) => {
      acc[g.code] = candidates.filter(c => c.group_type === g.code).length;
      return acc;
    }, {} as Record<string, number>),
    working: candidates.filter(c => c.recruitment_status?.includes('Đang đi làm')).length,
    contacted: candidates.filter(c => c.recruitment_status === 'Đang liên hệ').length,
    notContacted: candidates.filter(c => c.recruitment_status === 'P.TD chưa liên hệ').length,
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['STT', 'Nhóm', 'Tên ứng viên', 'Năm sinh', 'SĐT', 'KN/Năng lực', 'Vị trí ứng tuyển', 'Địa điểm', 'Ngày GT', 'Người GT', 'PTD nhận', 'Tình trạng', 'Ghi chú'];
    const rows = filtered.map((c, i) => [
      i + 1, c.group_type === 'I' ? 'Nhóm I' : 'Nhóm II',
      c.full_name, c.birth_year, c.phone, c.experience,
      c.position, c.desired_location, c.referral_date, c.referrer,
      c.ptd_received ? 'Đã nhận' : 'Chưa', c.recruitment_status, c.notes
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UV_TQT_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Đã xuất CSV', 'success');
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const deleteTarget = candidates.find(c => c.id === deleteId);

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4fa]">

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 z-50 shadow-2xl transition-transform duration-300 border-r border-[#1e3a5f]',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: 'linear-gradient(160deg, #1a3a6b 0%, #1e4480 50%, #163570 100%)' }}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-white font-black text-lg uppercase tracking-tight">SGC – TQT</p>
              <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">Quản lý ứng viên</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-blue-300 hover:text-white"><X size={16} /></button>
          </div>
          <nav className="space-y-1">
            <button onClick={() => { setActiveView('list'); setIsSidebarOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeView === 'list' ? 'bg-orange-500 text-white' : 'text-blue-200 hover:bg-white/10')}>
              <Users size={16} /> Danh sách ứng viên
            </button>
            <button onClick={() => { setActiveView('stats'); setIsSidebarOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeView === 'stats' ? 'bg-orange-500 text-white' : 'text-blue-200 hover:bg-white/10')}>
              <Database size={16} /> Thống kê tổng quan
            </button>
            <button onClick={() => { setActiveView('config'); setIsSidebarOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeView === 'config' ? 'bg-orange-500 text-white' : 'text-blue-200 hover:bg-white/10')}>
              <Settings size={16} /> Cấu hình Danh mục
            </button>
          </nav>
          <div className="mt-auto pt-6 border-t border-white/10">
            <button onClick={() => { setShowSettings(true); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-200 hover:bg-white/10 transition-all">
              <Settings size={16} /> Cấu hình Supabase
            </button>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#1e3a5f] px-5 py-0 flex items-center justify-between min-h-[60px]"
        style={{ background: '#1a3a6b' }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
          <div className="p-1.5 bg-white/10 rounded-lg text-blue-200 hover:text-white transition-colors">
            <Menu size={18} />
          </div>
          <div>
            <h1 className="text-white font-black text-base uppercase tracking-tight leading-none">SGC – TQT</h1>
            <p className="text-blue-300 text-[9px] font-bold uppercase tracking-widest">Quản lý ứng viên</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border',
            isConnected ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700' : 'bg-red-900/50 text-red-300 border-red-700')}>
            <span className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-red-400')} />
            {isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
            <Settings size={15} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 w-full">

        {/* ── Config View ── */}
        {activeView === 'config' && (
          <ConfigView
            sb={sb}
            groups={groups}
            statuses={statuses}
            showToast={showToast}
            onUpdated={loadData}
          />
        )}

        {/* ── Stats View ── */}
        {activeView === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thống kê tổng quan</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Tổng ứng viên', value: stats.total, color: 'bg-blue-600' },
                ...groups.map(g => ({
                  label: g.name,
                  value: candidates.filter(c => c.group_type === g.code).length,
                  color: 'bg-indigo-500'
                })),
                { label: 'Đang đi làm', value: stats.working, color: 'bg-emerald-600' },
              ].slice(0, 6).map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                    <Users size={18} className="text-white" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.label}</p>
                  <p className="text-3xl font-black text-slate-800 mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Status distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Phân bổ theo tình trạng</h3>
              <div className="space-y-3">
                {statuses.map(status => {
                  const count = candidates.filter(c => c.recruitment_status === status.name).length;
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={status.id} className="flex items-center gap-3">
                      <div className="w-40 shrink-0">
                        <StatusBadge status={status.name} statuses={statuses} />
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-black text-slate-600 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Cập nhật nhanh tình trạng tuyển dụng ── */}
            <QuickStatusUpdateTool
              candidates={candidates}
              sb={sb}
              onUpdated={loadData}
              showToast={showToast}
              statuses={statuses}
            />
          </div>
        )}

        {/* ── List View ── */}
        {activeView === 'list' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <div className="w-1 h-5 bg-orange-500 rounded-full" />
                  Danh sách ứng viên
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full normal-case">{filtered.length}/{candidates.length}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Tìm kiếm..."
                    className="pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-400 bg-white transition-all w-48" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"><X size={13} /></button>}
                </div>
                {/* Filter toggle */}
                <button onClick={() => setShowFilters(p => !p)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border',
                    showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400')}>
                  <Filter size={14} /> Bộ lọc
                  {(filterGroup || filterStatus) && <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">!</span>}
                </button>
                {/* Refresh */}
                <button onClick={loadData} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-blue-400 transition-all disabled:opacity-50">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm mới
                </button>
                {/* Export */}
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
                  <FileDown size={13} /> Xuất CSV
                </button>
                {/* Add */}
                <button onClick={() => setModal({ type: 'add', candidate: { ...EMPTY_CANDIDATE } })}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-orange-500/30">
                  <Plus size={14} /> Thêm ứng viên
                </button>
              </div>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="bg-[#f5f2e1] border border-slate-300/50 rounded-2xl px-5 py-4 flex flex-wrap gap-4 items-end shadow-sm">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nhóm</label>
                  <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 bg-white">
                    <option value="">Tất cả</option>
                    {groups.map(g => <option key={g.id} value={g.code}>{g.code} – {g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Tình trạng</label>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 bg-white">
                    <option value="">Tất cả tình trạng</option>
                    {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                {(filterGroup || filterStatus) && (
                  <button onClick={() => { setFilterGroup(''); setFilterStatus(''); setPage(1); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-black hover:bg-red-100 transition-all">
                    <RotateCw size={11} /> Xóa lọc
                  </button>
                )}
              </div>
            )}

            {/* ── No connection warning ── */}
            {!sb && !loading && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 flex items-center gap-4">
                <Key size={32} className="text-amber-500 shrink-0" />
                <div>
                  <p className="font-black text-amber-800 text-base">Chưa cấu hình Supabase</p>
                  <p className="text-amber-600 text-sm mt-1">Vui lòng cấu hình URL và API key để kết nối database.</p>
                  <button onClick={() => setShowSettings(true)}
                    className="mt-3 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black transition-all">
                    Cấu hình ngay
                  </button>
                </div>
              </div>
            )}

            {/* ── Loading ── */}
            {loading && (
              <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Loader2 size={40} className="animate-spin text-blue-500" />
              </div>
            )}

            {/* ── Table ── */}
            {!loading && sb && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 45 }}>STT</th>
                          <th style={{ width: 80 }}>Nhóm</th>
                          <th style={{ minWidth: 140 }}>Tên ứng viên</th>
                          <th style={{ width: 65 }}>Năm sinh</th>
                          <th style={{ width: 110 }}>SĐT</th>
                          <th style={{ minWidth: 130 }}>KN/Năng lực</th>
                          <th style={{ minWidth: 140 }}>Vị trí ứng tuyển</th>
                          <th style={{ minWidth: 140 }}>Địa điểm mong muốn</th>
                          <th style={{ width: 100 }}>Ngày GT</th>
                          <th style={{ minWidth: 120 }}>Người GT</th>
                          <th style={{ width: 80 }}>PTD nhận HS</th>
                          <th style={{ minWidth: 160 }}>Tình trạng tuyển dụng</th>
                          <th style={{ minWidth: 120 }}>Ghi chú</th>
                          <th style={{ width: 80 }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((c, i) => {
                          const hl = HIGHLIGHT_COLORS.find(h => h.key === c.highlight_color);
                          const rowStyle = hl?.key ? { background: hl.bg, color: hl.text } : {};
                          return (
                            <tr key={c.id} style={rowStyle}>
                              <td className="text-center font-bold text-blue-700 text-xs">{c.stt || ((page - 1) * PER_PAGE + i + 1)}</td>
                              <td className="text-center"><span className="bg-slate-100 text-slate-600 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">{c.group_type}</span></td>
                              <td className="font-semibold">{c.full_name}</td>
                              <td className="text-center">{c.birth_year}</td>
                              <td className="text-center">{c.phone}</td>
                              <td>{c.experience}</td>
                              <td>{c.position}</td>
                              <td>{c.desired_location}</td>
                              <td className="text-center text-xs">{c.referral_date}</td>
                              <td>{c.referrer}</td>
                              <td className="text-center">
                                {c.ptd_received
                                  ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-100 px-2 py-0.5 rounded-full">✓ Nhận</span>
                                  : <span className="text-slate-300 text-xs">–</span>}
                              </td>
                              <td>
                                {c.recruitment_status ? <StatusBadge status={c.recruitment_status} statuses={statuses} /> : null}
                              </td>
                              <td className="text-xs text-slate-500 italic">{c.notes}</td>
                              <td>
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => setModal({ type: 'edit', candidate: { ...c } })}
                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all" title="Sửa">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => setDeleteId(c.id)}
                                    className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all" title="Xóa">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Empty */}
                    {filtered.length === 0 && !loading && (
                      <div className="py-20 text-center">
                        <Users size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Không có dữ liệu</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {candidates.length === 0 ? 'Nhấn "Thêm ứng viên" để bắt đầu' : 'Không có kết quả phù hợp bộ lọc'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3 border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">
                      Hiển thị {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-sm font-black text-slate-700 px-2">Trang {page}/{totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="bg-sky-50 border-t border-sky-200 px-6 py-3 text-center">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">SGC – Phòng TQT · Quản lý ứng viên · {new Date().getFullYear()}</p>
      </footer>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />}
      {modal && <CandidateModal candidate={modal.candidate} mode={modal.type} onClose={() => setModal(null)} onSave={handleSave} groups={groups} statuses={statuses} />}
      {deleteId && <ConfirmDeleteModal name={deleteTarget?.full_name || ''} onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}

      {/* Toast */}
      <ToastDisplay toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
