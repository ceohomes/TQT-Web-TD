import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, Search, Filter, X, Save, Settings,
  Download, RotateCw, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, Users, Menu, Database, FileDown, RefreshCw,
  ChevronLeft, ChevronRight, Eye, EyeOff, Key,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase as supabaseInit, reinitSupabase } from './supabase';
import type { Candidate, Group, RecruitmentStatus, Referrer, Recruiter, Toast } from './types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ─── Constants ───────────────────────────────────────────────────────────────

const toRoman = (num: number) => {
  if (num <= 0) return '';
  const map: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  let n = num;
  for (const [val, char] of map) {
    while (n >= val) {
      result += char;
      n -= val;
    }
  }
  return result;
};

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
  recruiter: '',
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

const formatDateInput = (value: string) => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format as dd/mm/yyyy
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }
};

const isValidPhone = (phone: string) => {
  if (!phone) return true;
  const cleanPhone = phone.replace(/\s/g, '');
  return /^(0[3|5|7|8|9])[0-9]{8}$/.test(cleanPhone);
};

function CandidateModal({
  candidate, onClose, onSave, mode, groups, statuses, referrers, recruiters
}: {
  candidate: Partial<Candidate>;
  onClose: () => void;
  onSave: (data: Partial<Candidate> | Partial<Candidate>[]) => void;
  mode: 'add' | 'edit';
  groups: Group[];
  statuses: RecruitmentStatus[];
  referrers: Referrer[];
  recruiters: Recruiter[];
}) {
  const [rows, setRows] = useState<Partial<Candidate>[]>(
    mode === 'add' ? [candidate] : [candidate]
  );

  // For single edit mode
  const [form, setForm] = useState<Partial<Candidate>>(candidate);
  const set = (key: keyof Candidate, val: any) => setForm(p => ({ ...p, [key]: val }));

  const updateRow = (idx: number, key: keyof Candidate, val: any) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_CANDIDATE, group_type: prev[prev.length - 1]?.group_type || '' }]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const handlePaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    const focusedField = target.getAttribute('data-field') as keyof Candidate | null;
    const focusedRowIdx = parseInt(target.getAttribute('data-row-idx') || '0');

    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    e.preventDefault();

    const BULK_FIELDS: (keyof Candidate)[] = [
      'full_name', 'birth_year', 'phone', 'experience', 'position', 
      'desired_location', 'referral_date', 'referrer', 'recruiter', 
      'recruitment_status', 'notes'
    ];

    const startFieldIdx = focusedField ? BULK_FIELDS.indexOf(focusedField) : 0;
    if (startFieldIdx === -1) return;

    setRows(prev => {
      const nextRows = [...prev];
      
      lines.forEach((line, lineOffset) => {
        const cells = line.split('\t');
        const targetRowIdx = focusedRowIdx + lineOffset;
        
        // Add new row if needed
        if (targetRowIdx >= nextRows.length) {
          nextRows.push({ ...EMPTY_CANDIDATE, group_type: prev[0]?.group_type || '' });
        }
        
        const row = { ...nextRows[targetRowIdx] };
        
        cells.forEach((cellVal, cellOffset) => {
          const fieldIdx = startFieldIdx + cellOffset;
          if (fieldIdx < BULK_FIELDS.length) {
            const fieldKey = BULK_FIELDS[fieldIdx];
            let val = cellVal.trim();
            if (fieldKey === 'referral_date') {
              val = formatDateInput(val);
            }
            row[fieldKey] = val as any;
          }
        });
        
        nextRows[targetRowIdx] = row;
      });
      
      return nextRows;
    });
  };

  // ESC key to close edit modal
  React.useEffect(() => {
    if (mode !== 'edit') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onClose]);

  if (mode === 'edit') {
    const highlight = HIGHLIGHT_COLORS.find(c => c.key === form.highlight_color) || HIGHLIGHT_COLORS[0];
    return (
      <div className="modal-overlay">
        <div className="modal-content bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #1e4480 100%)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-xl">
                <Edit2 size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-black text-base uppercase tracking-tight">Chỉnh sửa ứng viên</h3>
                <p className="text-blue-200 text-xs mt-0.5">{form.full_name || 'Điền thông tin bên dưới'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-blue-200 hover:text-white transition-colors"><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(92vh-140px)] space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Nhóm <span className="text-red-500">*</span></label>
                <select value={form.group_type} onChange={e => set('group_type', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all">
                  <option value="">-- Chọn nhóm --</option>
                  {groups.map(g => <option key={g.id} value={g.code}>{g.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tên ứng viên <span className="text-red-500">*</span></label>
                <input value={form.full_name || ''} onChange={e => set('full_name', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Năm sinh</label>
                <input value={form.birth_year || ''} onChange={e => set('birth_year', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-1.5 relative group/phone">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Số điện thoại <span className="text-red-500">*</span></label>
                <input value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                  className={cn(
                    "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all",
                    form.phone && !isValidPhone(form.phone) && "border-red-400 text-red-600 bg-red-50"
                  )} />
                {form.phone && !isValidPhone(form.phone) && (
                  <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-red-600 text-white text-[10px] rounded shadow-lg z-20 whitespace-nowrap opacity-0 group-hover/phone:opacity-100 transition-opacity pointer-events-none flex items-center gap-1">
                    <AlertCircle size={10} /> SĐT không đúng định dạng (10 số)
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Kinh nghiệm/Năng lực</label>
                <input value={form.experience || ''} onChange={e => set('experience', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Vị trí ứng tuyển</label>
                <input value={form.position || ''} onChange={e => set('position', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Địa điểm mong muốn làm việc</label>
                <input value={form.desired_location || ''} onChange={e => set('desired_location', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ngày giới thiệu</label>
                <input value={form.referral_date || ''} onChange={e => set('referral_date', formatDateInput(e.target.value))}
                  placeholder="dd/mm/yyyy"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Người giới thiệu</label>
                <select 
                  value={form.referrer || ''} 
                  onChange={e => set('referrer', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all"
                >
                  <option value="">-- Chọn người giới thiệu --</option>
                  {referrers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tình trạng</label>
                <select value={form.recruitment_status || ''} onChange={e => set('recruitment_status', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all">
                  <option value="">-- Chọn --</option>
                  {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">NS P.TD nhận</label>
                <select 
                  value={form.recruiter || ''} 
                  onChange={e => set('recruiter', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ghi chú</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all">Hủy</button>
            <button 
              onClick={() => {
                if (form.phone && !isValidPhone(form.phone)) {
                  // Just prevent save or let it pass? 
                  // Usually it's better to prevent save if invalid.
                  return;
                }
                onSave(form);
              }} 
              disabled={form.phone ? !isValidPhone(form.phone) : false}
              className={cn(
                "px-8 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white font-black text-sm transition-all shadow-lg flex items-center gap-2",
                form.phone && !isValidPhone(form.phone) ? "opacity-50 cursor-not-allowed grayscale" : "hover:from-blue-700 hover:to-blue-900"
              )}
            >
              <Save size={15} /> Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bulk Add Mode
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-white rounded-2xl w-full max-w-[95vw] max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-7 py-4 border-b border-slate-100 flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #1e4480 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-base uppercase tracking-tight">Thêm ứng viên mới (Dạng bảng)</h3>
              <p className="text-blue-200 text-xs mt-0.5">Nhập liệu nhanh hoặc Copy/Paste từ Excel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-blue-200 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-auto flex-1">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nhóm mặc định <span className="text-red-500">*</span></label>
                <select 
                  value={rows[0]?.group_type || ''} 
                  onChange={e => setRows(prev => prev.map(r => ({ ...r, group_type: e.target.value })))}
                  className="block w-48 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-500 shadow-sm"
                >
                  <option value="">-- Chọn nhóm --</option>
                  {groups.map(g => <option key={g.id} value={g.code}>{g.name}</option>)}
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <Database size={14} className="text-blue-500" />
                <p className="text-xs text-blue-700 font-medium italic">Mẹo: Copy vùng dữ liệu từ Excel và nhấn Ctrl+V vào bảng bên dưới để nhập hàng loạt.</p>
              </div>
            </div>
            <button onClick={addRow} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-md">
              <Plus size={14} /> Thêm dòng mới
            </button>
          </div>

          <div className="border border-slate-400 rounded-xl overflow-hidden shadow-sm bg-white">
            <table className="w-full text-[12px] border-collapse min-w-[1800px] font-roboto">
              <thead className="bg-blue-50 sticky top-0 z-10">
                <tr className="text-blue-900 uppercase font-black tracking-tighter text-[12px]">
                  <th className="p-2 border-b-2 border-r border-blue-200 w-10 text-center bg-blue-50">STT</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-56 text-center bg-blue-50">Tên ứng viên *</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-20 text-center bg-blue-50">Năm sinh</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-32 text-center bg-blue-50">SĐT *</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-64 text-center bg-blue-50">Kinh nghiệm/Năng lực</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-64 text-center bg-blue-50">Vị trí ứng tuyển</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-64 text-center bg-blue-50">Địa điểm làm việc</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-32 text-center bg-blue-50">Ngày giới thiệu</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-48 text-center bg-blue-50">Người giới thiệu</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-48 text-center bg-blue-50">NS P.TD nhận</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-48 text-center bg-blue-50">Tình trạng</th>
                  <th className="p-2 border-b-2 border-r border-blue-200 w-64 text-center bg-blue-50">Ghi chú</th>
                  <th className="p-2 border-b-2 border-blue-200 w-10 bg-blue-50"></th>
                </tr>
              </thead>
              <tbody onPaste={handlePaste}>
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors group border-b border-slate-300">
                    <td className="p-1 border-r border-slate-300 text-center text-slate-500 font-bold bg-slate-50/50">{idx + 1}</td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.full_name || ''} onChange={e => updateRow(idx, 'full_name', e.target.value)}
                        data-field="full_name" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 font-bold text-slate-800 focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="Nhập tên..." />
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.birth_year || ''} onChange={e => updateRow(idx, 'birth_year', e.target.value)}
                        data-field="birth_year" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 text-center focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="19xx" />
                    </td>
                    <td className="p-1 border-r border-slate-300 relative group/phone">
                      <input value={row.phone || ''} onChange={e => updateRow(idx, 'phone', e.target.value)}
                        data-field="phone" data-row-idx={idx}
                        className={cn(
                          "w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]",
                          row.phone && !isValidPhone(row.phone) && "text-red-600 font-bold bg-red-50 border border-red-400 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]"
                        )} 
                        placeholder="09..." 
                      />
                      {row.phone && !isValidPhone(row.phone) && (
                        <div className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 px-2 py-1 bg-red-600 text-white text-[10px] rounded shadow-lg z-20 whitespace-nowrap opacity-0 group-hover/phone:opacity-100 transition-opacity pointer-events-none flex items-center gap-1">
                          <AlertCircle size={10} /> SĐT không đúng định dạng (10 số)
                        </div>
                      )}
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.experience || ''} onChange={e => updateRow(idx, 'experience', e.target.value)}
                        data-field="experience" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="..." />
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.position || ''} onChange={e => updateRow(idx, 'position', e.target.value)}
                        data-field="position" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="..." />
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.desired_location || ''} onChange={e => updateRow(idx, 'desired_location', e.target.value)}
                        data-field="desired_location" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="..." />
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.referral_date || ''} 
                        onChange={e => updateRow(idx, 'referral_date', formatDateInput(e.target.value))}
                        data-field="referral_date" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 text-center focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="dd/mm/yyyy" />
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <select 
                        value={row.referrer || ''} 
                        onChange={e => updateRow(idx, 'referrer', e.target.value)}
                        data-field="referrer" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]"
                      >
                        <option value="">-- Chọn --</option>
                        {referrers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <select 
                        value={row.recruiter || ''} 
                        onChange={e => updateRow(idx, 'recruiter', e.target.value)}
                        data-field="recruiter" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]"
                      >
                        <option value="">-- Chọn --</option>
                        {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <select
                        value={row.recruitment_status || ''}
                        onChange={e => updateRow(idx, 'recruitment_status', e.target.value)}
                        data-field="recruitment_status" data-row-idx={idx}
                        className="w-full outline-none px-2 py-1.5 rounded text-[12px] font-semibold transition-all cursor-pointer border"
                        style={row.recruitment_status ? {
                          backgroundColor: getAutoBgColor(row.recruitment_status),
                          color: '#000',
                          borderColor: getAutoBgColor(row.recruitment_status),
                        } : {
                          backgroundColor: 'transparent',
                          color: '#64748b',
                          borderColor: '#e2e8f0',
                        }}
                      >
                        <option value="">-- Chọn --</option>
                        {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1 border-r border-slate-300">
                      <input value={row.notes || ''} onChange={e => updateRow(idx, 'notes', e.target.value)}
                        data-field="notes" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]" placeholder="..." />
                    </td>
                    <td className="p-1 text-center">
                      <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Xóa dòng">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all">Hủy</button>
          <button 
            onClick={() => {
              const validRows = rows.filter(r => r.full_name?.trim());
              const hasInvalidPhone = validRows.some(r => r.phone && !isValidPhone(r.phone));
              if (hasInvalidPhone) return;
              onSave(validRows);
            }}
            disabled={rows.some(r => r.full_name?.trim() && r.phone && !isValidPhone(r.phone))}
            className={cn(
              "px-10 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white font-black text-sm transition-all shadow-lg flex items-center gap-2",
              rows.some(r => r.full_name?.trim() && r.phone && !isValidPhone(r.phone)) ? "opacity-50 cursor-not-allowed grayscale" : "hover:from-blue-700 hover:to-blue-900"
            )}
          >
            <Save size={16} /> Lưu tất cả ({rows.filter(r => r.full_name?.trim()).length} ứng viên)
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

// Hàm lấy màu nền tự động dựa trên nội dung (phù hợp với nội dung)
const getAutoBgColor = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('đi làm') || n.includes('thành công') || n.includes('nhận')) return '#bbf7d0'; // Xanh lá nhạt
  if (n.includes('hợp đồng') || n.includes('ký')) return '#a5f3fc'; // Xanh cyan nhạt
  if (n.includes('phỏng vấn') || n.includes('test')) return '#fef08a'; // Vàng nhạt (Chờ PV/Test)
  if (n.includes('thủ tục') || n.includes('pv đạt')) return '#e9d5ff'; // Tím nhạt (Cho PV Đạt/Đang làm thủ tục)
  if (n.includes('chờ') || n.includes('kết quả')) return '#bfdbfe'; // Xanh dương nhạt (Chờ kết quả)
  if (n.includes('liên hệ') || n.includes('đang')) return '#bfdbfe'; // Xanh dương nhạt (Chưa liên hệ)
  if (n.includes('không phù hợp') || n.includes('hủy') || n.includes('từ chối') || n.includes('loại')) return '#fecaca'; // Đỏ nhạt
  return '#f1f5f9'; // Xám nhạt mặc định
};

function StatusBadge({ status }: { status: string; statuses?: RecruitmentStatus[] }) {
  // Mặc định màu chữ là đen theo yêu cầu của người dùng
  const textColor = '#000000';

  const bgColor = getAutoBgColor(status);

  return (
    <span className="status-badge" style={{ background: bgColor, color: textColor }}>
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
                  {c.full_name}
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
  sb, groups, statuses, referrers, recruiters, showToast, onUpdated
}: {
  sb: any;
  groups: Group[];
  statuses: RecruitmentStatus[];
  referrers: Referrer[];
  recruiters: Recruiter[];
  showToast: (msg: string, type: Toast['type']) => void;
  onUpdated: () => void;
}) {
  const [editingGroup, setEditingGroup] = useState<Partial<Group> | null>(null);
  const [editingStatus, setEditingStatus] = useState<Partial<RecruitmentStatus> | null>(null);
  const [editingReferrer, setEditingReferrer] = useState<Partial<Referrer> | null>(null);
  const [editingRecruiter, setEditingRecruiter] = useState<Partial<Recruiter> | null>(null);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup?.name) return;
    
    const groupCode = editingGroup.code || editingGroup.name;

    try {
      if (editingGroup.id) {
        // Lấy code cũ để cascade update candidates
        const { data: oldData } = await sb.from('settings_groups').select('code').eq('id', editingGroup.id).single();
        const oldCode = oldData?.code;

        const { error } = await sb.from('settings_groups').update({
          code: groupCode,
          name: editingGroup.name,
          description: editingGroup.description || ''
        }).eq('id', editingGroup.id);
        if (error) throw error;

        // Cascade: cập nhật group_type trong candidates nếu code thay đổi
        if (oldCode && oldCode !== groupCode) {
          await sb.from('candidates')
            .update({ group_type: groupCode })
            .eq('group_type', oldCode);
        }
      } else {
        const { error } = await sb.from('settings_groups').insert([{
          code: groupCode,
          name: editingGroup.name,
          description: editingGroup.description || ''
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
        // Lấy tên cũ để cascade update candidates
        const { data: oldData } = await sb.from('settings_statuses').select('name').eq('id', editingStatus.id).single();
        const oldName = oldData?.name;

        const { error } = await sb.from('settings_statuses').update({
          name: editingStatus.name,
          sort_order: editingStatus.sort_order
        }).eq('id', editingStatus.id);
        if (error) throw error;

        // Cascade: cập nhật tất cả candidates đang dùng tên cũ
        if (oldName && oldName !== editingStatus.name) {
          await sb.from('candidates')
            .update({ recruitment_status: editingStatus.name })
            .eq('recruitment_status', oldName);
        }
      } else {
        const { error } = await sb.from('settings_statuses').insert([{
          name: editingStatus.name,
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

  const handleSaveReferrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReferrer?.name) return;
    try {
      if (editingReferrer.id) {
        const { data: oldData } = await sb.from('settings_referrers').select('name').eq('id', editingReferrer.id).single();
        const oldName = oldData?.name;

        const { error } = await sb.from('settings_referrers').update({
          name: editingReferrer.name
        }).eq('id', editingReferrer.id);
        if (error) throw error;

        if (oldName && oldName !== editingReferrer.name) {
          await sb.from('candidates')
            .update({ referrer: editingReferrer.name })
            .eq('referrer', oldName);
        }
      } else {
        const { error } = await sb.from('settings_referrers').insert([{
          name: editingReferrer.name
        }]);
        if (error) throw error;
      }
      showToast('✅ Đã lưu người giới thiệu', 'success');
      setEditingReferrer(null);
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}. Bạn đã tạo bảng settings_referrers chưa?`, 'error');
    }
  };

  const deleteReferrer = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người giới thiệu này?')) return;
    try {
      const { error } = await sb.from('settings_referrers').delete().eq('id', id);
      if (error) throw error;
      showToast('✅ Đã xóa người giới thiệu', 'success');
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    }
  };

  const handleSaveRecruiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecruiter?.name) return;
    try {
      if (editingRecruiter.id) {
        const { data: oldData } = await sb.from('settings_recruiters').select('name').eq('id', editingRecruiter.id).single();
        const oldName = oldData?.name;

        const { error } = await sb.from('settings_recruiters').update({
          name: editingRecruiter.name
        }).eq('id', editingRecruiter.id);
        if (error) throw error;

        if (oldName && oldName !== editingRecruiter.name) {
          await sb.from('candidates')
            .update({ recruiter: editingRecruiter.name })
            .eq('recruiter', oldName);
        }
      } else {
        const { error } = await sb.from('settings_recruiters').insert([{
          name: editingRecruiter.name
        }]);
        if (error) throw error;
      }
      showToast('✅ Đã lưu nhân sự P.TD', 'success');
      setEditingRecruiter(null);
      onUpdated();
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}. Bạn đã tạo bảng settings_recruiters chưa?`, 'error');
    }
  };

  const deleteRecruiter = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) return;
    try {
      const { error } = await sb.from('settings_recruiters').delete().eq('id', id);
      if (error) throw error;
      showToast('✅ Đã xóa nhân sự P.TD', 'success');
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
          <p className="text-sm text-slate-500">Quản lý nhóm và tình trạng tuyển dụng</p>
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
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                    <span className="font-bold text-slate-800">{g.name}</span>
                  </div>
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
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Tên nhóm</label>
                    <input required value={editingGroup.name} onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500" />
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

        {/* Referrers Management */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-orange-500" /> Người giới thiệu
            </h3>
            <button onClick={() => setEditingReferrer({ name: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-600 hover:text-white transition-all">
              <Plus size={14} /> Thêm người GT
            </button>
          </div>

          <div className="space-y-3">
            {referrers.map(r => (
              <div key={r.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-orange-200 transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-600 rounded-full" />
                    <span className="font-bold text-slate-800">{r.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingReferrer(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => deleteReferrer(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {referrers.length === 0 && (
              <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Chưa có người giới thiệu</p>
              </div>
            )}
          </div>

          {editingReferrer && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <form onSubmit={handleSaveReferrer} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="bg-orange-600 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-black text-base uppercase tracking-tight">{editingReferrer.id ? 'Sửa người GT' : 'Thêm người GT mới'}</h3>
                  <button type="button" onClick={() => setEditingReferrer(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Họ và tên</label>
                    <input required value={editingReferrer.name} onChange={e => setEditingReferrer({ ...editingReferrer, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-orange-500" />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingReferrer(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
                  <button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded-xl text-sm font-black shadow-lg">Lưu</button>
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

        {/* Recruiters Management */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-purple-500" /> Nhân sự P.TD nhận
            </h3>
            <button onClick={() => setEditingRecruiter({ name: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-600 hover:text-white transition-all">
              <Plus size={14} /> Thêm nhân sự
            </button>
          </div>

          <div className="space-y-3">
            {recruiters.map(r => (
              <div key={r.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 transition-all">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full" />
                    <span className="font-bold text-slate-800">{r.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => setEditingRecruiter(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => deleteRecruiter(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {recruiters.length === 0 && (
              <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Chưa có nhân sự P.TD</p>
              </div>
            )}
          </div>

          {editingRecruiter && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <form onSubmit={handleSaveRecruiter} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="bg-purple-600 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-white font-black text-base uppercase tracking-tight">{editingRecruiter.id ? 'Sửa nhân sự' : 'Thêm nhân sự mới'}</h3>
                  <button type="button" onClick={() => setEditingRecruiter(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Họ và tên</label>
                    <input required value={editingRecruiter.name} onChange={e => setEditingRecruiter({ ...editingRecruiter, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-purple-500" />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditingRecruiter(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Hủy</button>
                  <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-black shadow-lg">Lưu</button>
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
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReferrer, setFilterReferrer] = useState('');
  const [filterRecruiter, setFilterRecruiter] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; candidate: Partial<Candidate> } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'config'>('list');
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

      // Fetch referrers
      const { data: refData, error: refError } = await sb
        .from('settings_referrers')
        .select('*')
        .order('name', { ascending: true });
      if (refError) {
        // Nếu bảng chưa tồn tại, không crash app
        console.warn('Bảng settings_referrers chưa tồn tại');
        setReferrers([]);
      } else {
        setReferrers(refData || []);
      }

      // Fetch recruiters
      const { data: recData, error: recError } = await sb
        .from('settings_recruiters')
        .select('*')
        .order('name', { ascending: true });
      if (recError) {
        console.warn('Bảng settings_recruiters chưa tồn tại');
        setRecruiters([]);
      } else {
        setRecruiters(recData || []);
      }

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

    // Realtime subscription — cập nhật state trực tiếp từ payload, không reload toàn bộ
    const channel = sb.channel('db_changes')
      // ── Candidates: xử lý từng event riêng biệt ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'candidates' }, (payload) => {
        setCandidates(prev => {
          // Tránh thêm trùng (user hiện tại đã add qua handleSave)
          if (prev.find(c => c.id === payload.new.id)) return prev;
          return [...prev, payload.new as Candidate];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidates' }, (payload) => {
        setCandidates(prev =>
          prev.map(c => c.id === payload.new.id ? { ...c, ...(payload.new as Candidate) } : c)
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'candidates' }, (payload) => {
        setCandidates(prev => prev.filter(c => c.id !== payload.old.id));
      })
      // ── Settings: reload nhẹ chỉ bảng tương ứng ──
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_groups' }, async () => {
        const { data } = await sb.from('settings_groups').select('*').order('code', { ascending: true });
        if (data) setGroups(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_statuses' }, async () => {
        const { data } = await sb.from('settings_statuses').select('*').order('sort_order', { ascending: true });
        if (data) setStatuses(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_referrers' }, async () => {
        const { data } = await sb.from('settings_referrers').select('*').order('name', { ascending: true });
        if (data) setReferrers(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_recruiters' }, async () => {
        const { data } = await sb.from('settings_recruiters').select('*').order('name', { ascending: true });
        if (data) setRecruiters(data);
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
  const handleSave = async (data: Partial<Candidate> | Partial<Candidate>[]) => {
    if (!sb) { showToast('Chưa kết nối Supabase', 'error'); return; }
    
    const dataArray = Array.isArray(data) ? data : [data];
    if (dataArray.length === 0) return;

    // Validation
    if (!Array.isArray(data)) {
      // Single edit/add
      const single = data as Partial<Candidate>;
      if (!single.group_type) { showToast('Vui lòng chọn nhóm', 'error'); return; }
      if (!single.full_name?.trim()) { showToast('Vui lòng nhập tên ứng viên', 'error'); return; }
      if (!single.phone?.trim()) { showToast('Vui lòng nhập số điện thoại', 'error'); return; }
    } else {
      // Bulk add mode
      const rowsToSave = dataArray.filter(r => r.full_name?.trim() || r.phone?.trim() || r.group_type);
      if (rowsToSave.length === 0) {
        showToast('Vui lòng nhập thông tin ứng viên', 'error');
        return;
      }
      for (const row of rowsToSave) {
        if (!row.group_type) { showToast('Vui lòng chọn nhóm mặc định', 'error'); return; }
        if (!row.full_name?.trim()) { showToast('Vui lòng nhập tên ứng viên', 'error'); return; }
        if (!row.phone?.trim()) { showToast(`Vui lòng nhập SĐT cho ứng viên ${row.full_name || '(Chưa có tên)'}`, 'error'); return; }
      }
    }

    showToast('Đang lưu...', 'loading');
    try {
      if (modal?.type === 'add') {
        const toInsert = dataArray
          .filter(row => row.full_name?.trim())
          .map(row => {
            const { id, sttInGroup, ...rest } = row as any;
            return rest;
          });

        if (toInsert.length === 0) {
          showToast('Vui lòng nhập ít nhất một ứng viên có tên', 'error');
          return;
        }

        const { error } = await sb.from('candidates').insert(toInsert);
        if (error) throw error;
        showToast(`✅ Đã thêm ${toInsert.length} ứng viên`, 'success');
      } else {
        const singleData = data as any;
        const { id, created_at, sttInGroup, ...rest } = singleData;
        const { error } = await sb.from('candidates').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id!);
        if (error) throw error;
        showToast(`✅ Đã cập nhật: ${singleData.full_name}`, 'success');
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
    if (filterReferrer && c.referrer !== filterReferrer) return false;
    if (filterRecruiter && c.recruiter !== filterRecruiter) return false;
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

  // ── Sort 2 cấp trong mỗi nhóm ──
  // Level 1: Tình trạng (theo sort_order của settings_statuses)
  // Level 2: Ngày giới thiệu từ cũ → mới (dd/mm/yyyy)
  const parseReferralDate = (dateStr?: string): number => {
    if (!dateStr) return Number.MAX_SAFE_INTEGER;
    // Hỗ trợ định dạng dd/mm/yyyy
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`).getTime() || Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
  };

  const statusOrderMap: Record<string, number> = {};
  statuses.forEach((s, idx) => { statusOrderMap[s.name] = s.sort_order ?? idx; });

  const sorted = [...filtered].sort((a, b) => {
    // Sắp xếp theo nhóm trước
    if (a.group_type < b.group_type) return -1;
    if (a.group_type > b.group_type) return 1;
    // Level 1: Tình trạng
    const sa = statusOrderMap[a.recruitment_status || ''] ?? 9999;
    const sb2 = statusOrderMap[b.recruitment_status || ''] ?? 9999;
    if (sa !== sb2) return sa - sb2;
    // Level 2: Ngày giới thiệu cũ → mới
    return parseReferralDate(a.referral_date) - parseReferralDate(b.referral_date);
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  
  // Tính toán STT trong nhóm cho từng ứng viên
  const groupCounts: Record<string, number> = {};
  const candidatesWithGroupSTT = sorted.map(c => {
    groupCounts[c.group_type] = (groupCounts[c.group_type] || 0) + 1;
    return { ...c, sttInGroup: groupCounts[c.group_type] };
  });

  const paged = candidatesWithGroupSTT.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Status counts (dùng cho thanh tóm tắt header) ──
  const statusCounts: Record<string, number> = {};
  candidates.forEach(c => {
    const s = c.recruitment_status || 'Chưa xác định';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Export to Excel using exceljs for rich styling (matching web app)
  const exportExcel = async () => {
    try {
      showToast('Đang chuẩn bị file Excel...', 'loading');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Danh sách UV');

      // Define columns with widths matching web app proportions
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên ứng viên', key: 'full_name', width: 25 },
        { header: 'Năm sinh', key: 'birth_year', width: 10 },
        { header: 'SĐT', key: 'phone', width: 15 },
        { header: 'Kinh nghiệm/Năng lực', key: 'experience', width: 25 },
        { header: 'Vị trí ứng tuyển', key: 'position', width: 25 },
        { header: 'Địa điểm mong muốn làm việc', key: 'desired_location', width: 25 },
        { header: 'Ngày giới thiệu', key: 'referral_date', width: 15 },
        { header: 'Người giới thiệu', key: 'referrer', width: 20 },
        { header: 'NS P.TD nhận', key: 'recruiter', width: 20 },
        { header: 'Tình trạng', key: 'recruitment_status', width: 22 },
        { header: 'Ghi chú', key: 'notes', width: 45 },
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 35;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A3A6B' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 11,
          name: 'Arial'
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });

      let lastGroup = '';
      let sttInGroup = 0;

      // Group colors (matching web app logic)
      const groupBgColors = ['FFF3E0', 'E8F5E9', 'EDE9FE', 'FCE4EC', 'E0F2FE', 'FEF9C3'];
      const groupFgColors = ['E65100', '1B5E20', '4A148C', '880E4F', '01579B', 'F57F17'];

      for (const c of sorted) {
        if (c.group_type !== lastGroup) {
          lastGroup = c.group_type;
          sttInGroup = 0;
          const gIdx = groups.findIndex(g => g.code === c.group_type);
          const gName = groups.find(g => g.code === c.group_type)?.name || c.group_type;
          const roman = toRoman(gIdx + 1);
          const safeGIdx = gIdx >= 0 ? gIdx % groupBgColors.length : 0;

          // Add group header row
          const groupRow = worksheet.addRow({
            stt: roman,
            full_name: gName
          });
          
          // Merge cells for group header
          worksheet.mergeCells(`B${groupRow.number}:L${groupRow.number}`);
          
          groupRow.height = 28;
          groupRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF' + groupBgColors[safeGIdx] }
            };
            cell.font = {
              bold: true,
              color: { argb: 'FF' + groupFgColors[safeGIdx] },
              size: 11,
              name: 'Arial'
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = {
              bottom: { style: 'medium', color: { argb: 'FF' + groupFgColors[safeGIdx] } },
              top: { style: 'medium', color: { argb: 'FF' + groupFgColors[safeGIdx] } }
            };
          });
        }
        
        sttInGroup++;
        const rowData = {
          stt: sttInGroup,
          full_name: c.full_name || '',
          birth_year: c.birth_year || '',
          phone: c.phone || '',
          experience: c.experience || '',
          position: c.position || '',
          desired_location: c.desired_location || '',
          referral_date: c.referral_date || '',
          referrer: c.referrer || '',
          recruiter: c.recruiter || '',
          recruitment_status: c.recruitment_status || '',
          notes: c.notes || ''
        };

        const dataRow = worksheet.addRow(rowData);
        
        // Style data row
        dataRow.eachCell((cell, colNumber) => {
          cell.font = { size: 10, name: 'Arial', color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };

          if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 8 || colNumber === 11) { // STT, Năm sinh, SĐT, Ngày giới thiệu, Tình trạng
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
          
          if (colNumber === 1) { // STT
            cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
          }
          if (colNumber === 2) { // Tên ứng viên
            cell.font = { bold: true, color: { argb: 'FF1E293B' } };
          }

          // Style status cell
          if (colNumber === 11 && c.recruitment_status) {
            const hexColor = getAutoBgColor(c.recruitment_status).replace('#', '').toUpperCase();
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF' + hexColor }
            };
            cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
        });
      }

      // Freeze first row
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }
      ];

      // Write to buffer and save
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `UV_TQT_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      saveAs(new Blob([buffer]), fileName);

      showToast('✅ Đã xuất Excel thành công', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('❌ Lỗi khi xuất Excel', 'error');
    }
  };


  // ─── Render ──────────────────────────────────────────────────────────────────

  const deleteTarget = candidates.find(c => c.id === deleteId);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f0f4fa]">

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

      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">

        {/* ── Config View ── */}
        {activeView === 'config' && (
          <ConfigView
            sb={sb}
            groups={groups}
            statuses={statuses}
            referrers={referrers}
            recruiters={recruiters}
            showToast={showToast}
            onUpdated={loadData}
          />
        )}


        {/* ── List View ── */}
        {activeView === 'list' && (
          <div className="space-y-4">
            {/* Row 1: Title + Status Summary */}
            <div className="flex flex-wrap items-center gap-6 justify-between">
              <div className="flex items-center gap-6">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <div className="w-1 h-5 bg-orange-500 rounded-full" />
                  Danh sách ứng viên
                  <span className="text-xs font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full normal-case shadow-sm">{sorted.length}/{candidates.length}</span>
                </h2>

                {/* Compact Status Summary */}
                <div className="hidden xl:flex flex-wrap items-center gap-x-3 gap-y-1">
                  {statuses.map(s => {
                    const count = statusCounts[s.name] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={s.id} className="flex items-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider px-2 py-0.5 rounded shadow-sm flex items-center gap-2" style={{ backgroundColor: getAutoBgColor(s.name) }}>
                          {s.name}
                          <span className="text-xs font-black opacity-60 bg-white/40 px-1.5 rounded-full">{count}</span>
                        </span>
                      </div>
                    );
                  })}
                  {statusCounts['Chưa xác định'] > 0 && (
                    <div className="flex items-center whitespace-nowrap">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 shadow-sm flex items-center gap-2">
                        Chưa xác định
                        <span className="text-xs font-black opacity-60 bg-white/40 px-1.5 rounded-full">{statusCounts['Chưa xác định']}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Combined Filters + Toolbar in Yellow Box */}
            <div className="bg-[#fffdf0] border border-orange-100 rounded-2xl px-5 py-3 flex flex-wrap gap-4 items-end justify-between shadow-sm font-roboto">
              {/* Left: Dropdown Filters */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-orange-800/60 uppercase tracking-wider block ml-1">Nhóm</label>
                  <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1); }}
                    className="border border-orange-200/50 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-orange-400 bg-white transition-all min-w-[120px] shadow-sm cursor-pointer hover:border-orange-300">
                    <option value="">Tất cả</option>
                    {groups.map(g => <option key={g.id} value={g.code}>{g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-orange-800/60 uppercase tracking-wider block ml-1">Tình trạng</label>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="border border-orange-200/50 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-orange-400 bg-white transition-all min-w-[160px] shadow-sm cursor-pointer hover:border-orange-300">
                    <option value="">Tất cả tình trạng</option>
                    {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-orange-800/60 uppercase tracking-wider block ml-1">Người giới thiệu</label>
                  <select value={filterReferrer} onChange={e => { setFilterReferrer(e.target.value); setPage(1); }}
                    className="border border-orange-200/50 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-orange-400 bg-white transition-all min-w-[140px] shadow-sm cursor-pointer hover:border-orange-300">
                    <option value="">Tất cả người giới thiệu</option>
                    {referrers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-orange-800/60 uppercase tracking-wider block ml-1">NS P.TD Nhận</label>
                  <select value={filterRecruiter} onChange={e => { setFilterRecruiter(e.target.value); setPage(1); }}
                    className="border border-orange-200/50 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-orange-400 bg-white transition-all min-w-[140px] shadow-sm cursor-pointer hover:border-orange-300">
                    <option value="">Tất cả nhân sự</option>
                    {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Right: Toolbar Buttons */}
              <div className="flex items-center gap-2 flex-wrap pb-0.5">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Tìm kiếm..."
                    className="pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400 bg-white transition-all w-40 shadow-sm" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"><X size={13} /></button>}
                </div>
                {/* Filter toggle */}
                <button onClick={() => setShowFilters(p => !p)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all border',
                    showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400')}>
                  <Filter size={14} /> Bộ lọc
                  {(filterGroup || filterStatus || filterReferrer || filterRecruiter) && <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">!</span>}
                </button>
                {/* Refresh */}
                <button onClick={loadData} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-600 hover:border-blue-400 transition-all disabled:opacity-50">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm mới
                </button>
                {/* Export */}
                <button onClick={exportExcel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold transition-all shadow-sm">
                  <FileDown size={13} /> Xuất Excel
                </button>
                {/* Add */}
                <button onClick={() => setModal({ type: 'add', candidate: { ...EMPTY_CANDIDATE } })}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-[12px] font-black transition-all shadow-lg shadow-orange-500/30">
                  <Plus size={14} /> Thêm ứng viên
                </button>
              </div>
            </div>

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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-400">
                  <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 45 }}>STT</th>
                          <th style={{ minWidth: 160 }}>Tên ứng viên</th>
                          <th style={{ width: 70 }}>Năm sinh</th>
                          <th style={{ width: 110 }}>SĐT</th>
                          <th style={{ minWidth: 150 }}>Kinh nghiệm/năng lực</th>
                          <th style={{ minWidth: 150 }}>Vị trí ứng tuyển</th>
                          <th style={{ minWidth: 180 }}>Địa điểm mong muốn làm việc</th>
                          <th style={{ width: 100 }}>Ngày giới thiệu</th>
                          <th style={{ minWidth: 140 }}>Người giới thiệu</th>
                          <th style={{ minWidth: 140 }}>NS P.TD nhận</th>
                          <th style={{ minWidth: 160 }}>Tình trạng</th>
                          <th style={{ minWidth: 120 }}>Ghi chú</th>
                          <th style={{ width: 80 }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let lastGroup = '';
                          return paged.map((c, i) => {
                            const showHeader = c.group_type !== lastGroup;
                            lastGroup = c.group_type;
                            const group = groups.find(g => g.code === c.group_type);
                            const groupName = group?.name || 'Chưa phân nhóm';
                            const groupIndex = groups.findIndex(g => g.code === c.group_type) + 1;
                            
                            const groupColors = [
                              { bg: '#fff3e0', border: '#f97316', text: '#7c2d00', dot: '#f97316', stripe: 'rgba(249,115,22,0.08)' },
                              { bg: '#e8f5e9', border: '#22c55e', text: '#14532d', dot: '#22c55e', stripe: 'rgba(34,197,94,0.08)' },
                              { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95', dot: '#8b5cf6', stripe: 'rgba(139,92,246,0.08)' },
                              { bg: '#fce4ec', border: '#f43f5e', text: '#881337', dot: '#f43f5e', stripe: 'rgba(244,63,94,0.08)' },
                              { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e', dot: '#0ea5e9', stripe: 'rgba(14,165,233,0.08)' },
                              { bg: '#fef9c3', border: '#eab308', text: '#713f12', dot: '#eab308', stripe: 'rgba(234,179,8,0.08)' },
                            ];
                            const color = groupColors[(groupIndex - 1) % groupColors.length] || groupColors[0];
                            
                            const hl = HIGHLIGHT_COLORS.find(h => h.key === c.highlight_color);

                            return (
                              <React.Fragment key={c.id}>
                                {showHeader && (
                                  <tr style={{ background: color.bg, borderTop: `2px solid ${color.border}`, borderBottom: `2px solid ${color.border}` }}>
                                    <td className="text-center font-black text-slate-700" style={{ color: color.text }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: color.border, color: '#fff', fontSize: 11, fontWeight: 900 }}>
                                        {toRoman(groupIndex)}
                                      </span>
                                    </td>
                                    <td colSpan={12} style={{ color: color.text }} className="py-2.5 px-4 font-black text-sm uppercase tracking-tight">
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.border, display: 'inline-block', flexShrink: 0 }} />
                                        {groupName}
                                      </span>
                                    </td>
                                  </tr>
                                )}
                                <tr style={hl?.key ? { background: hl.bg, color: hl.text } : {}}>
                                  <td className="text-center font-bold text-blue-700 text-xs">{(c as any).sttInGroup}</td>
                                  <td className="font-semibold">{c.full_name}</td>
                                  <td className="text-center">{c.birth_year}</td>
                                  <td className="text-center">{c.phone}</td>
                                  <td>{c.experience}</td>
                                  <td>{c.position}</td>
                                  <td>{c.desired_location}</td>
                                  <td className="text-center text-xs">{c.referral_date}</td>
                                  <td>{c.referrer}</td>
                                  <td className="text-xs font-semibold text-slate-700">{c.recruiter}</td>
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
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    {/* Empty */}
                    {sorted.length === 0 && !loading && (
                      <div className="py-20 text-center">
                        <Users size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Không có dữ liệu</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {candidates.length === 0 ? 'Nhấn "Thêm ứng viên" để bắt đầu' : 'Không có kết quả phù hợp bộ lọc'}
                        </p>
                      </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3 border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium">
                      Hiển thị {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} / {sorted.length}
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
      {modal && <CandidateModal candidate={modal.candidate} mode={modal.type} onClose={() => setModal(null)} onSave={handleSave} groups={groups} statuses={statuses} referrers={referrers} recruiters={recruiters} />}
      {deleteId && <ConfirmDeleteModal name={deleteTarget?.full_name || ''} onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}

      {/* Toast */}
      <ToastDisplay toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
