import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, Search, Filter, X, Save, Settings,
  Download, RotateCw, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, Users, Menu, Database, FileDown, RefreshCw,
  ChevronLeft, ChevronRight, Eye, EyeOff, Key,
  Paperclip, FileText, File, Upload, Pencil, ExternalLink, QrCode,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase as supabaseInit, reinitSupabase } from './supabase';
import type { Candidate, Group, RecruitmentStatus, Referrer, Recruiter, Toast, Document as DocumentType } from './types';
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

const isLinkValid = (url: any): boolean => {
  if (!url) return false;
  const str = String(url).trim();
  if (
    str === '' || 
    str.toLowerCase() === 'chưa có cv' || 
    str.toLowerCase() === 'null' || 
    str.toLowerCase() === 'undefined'
  ) {
    return false;
  }
  return true;
};

const formatLinkCV = (url: string): string => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
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
  send_bch_date: '',
  referrer: '',
  recruiter: '',
  tqt_interview: '',
  recruitment_status: '',
  highlight_color: '',
  notes: '',
  cv_url: '',
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
  const [activeTab, setActiveTab] = useState<'supabase' | 'github'>('supabase');

  // Supabase state
  const [url, setUrl] = useState(localStorage.getItem('sb_url') || '');
  const [key, setKey] = useState(localStorage.getItem('sb_key') || '');
  const [showKey, setShowKey] = useState(false);

  // GitHub state
  const [ghToken, setGhToken] = useState(() => {
    return localStorage.getItem('gh_token') || import.meta.env.VITE_GITHUB_TOKEN || '';
  });
  const [ghOwner, setGhOwner] = useState(() => {
    const localOwner = localStorage.getItem('gh_owner');
    if (localOwner) return localOwner;
    const envRepo = import.meta.env.VITE_GITHUB_REPO || '';
    if (envRepo && envRepo.includes('/')) {
      return envRepo.split('/')[0]?.trim() || '';
    }
    return '';
  });
  const [ghRepo, setGhRepo] = useState(() => {
    const localRepo = localStorage.getItem('gh_repo');
    if (localRepo) return localRepo;
    const envRepo = import.meta.env.VITE_GITHUB_REPO || '';
    if (envRepo && envRepo.includes('/')) {
      return envRepo.split('/')[1]?.trim() || '';
    }
    return envRepo || '';
  });
  const [ghBranch, setGhBranch] = useState(localStorage.getItem('gh_branch') || 'main');
  const [ghPath, setGhPath] = useState(localStorage.getItem('gh_path') || 'cvs');
  const [showGhToken, setShowGhToken] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const validateSupabase = () => {
    const u = url.trim();
    const k = key.trim();
    if (!u) return 'Vui lòng nhập Supabase Project URL';
    if (!u.startsWith('https://')) return 'URL phải bắt đầu bằng https://';
    if (!u.includes('.supabase.co')) return 'URL không đúng định dạng (phải chứa .supabase.co)';
    if (!k) return 'Vui lòng nhập Anon Key';
    if (!k.startsWith('eyJ')) return 'Anon Key không đúng định dạng (phải bắt đầu bằng eyJ...)';
    return null;
  };

  const handleTestSupabase = async () => {
    const err = validateSupabase();
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

  const handleTestGithub = async () => {
    const token = ghToken.trim();
    const owner = ghOwner.trim();
    const repo = ghRepo.trim();
    if (!token || !owner || !repo) {
      setTestResult({ ok: false, msg: '⚠️ Vui lòng nhập đủ Token, Tài khoản và Tên kho!' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // Chuẩn hóa token: loại bỏ các tiền tố "token" hoặc "bearer" nếu người dùng copy nhầm
      const cleanToken = token.replace(/^(token|bearer)\s+/i, '').trim();
      
      let res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Nếu 401 với Bearer, thử fallback sang kiểu 'token <token>' cho PAT classic
      if (res.status === 401) {
        const fallbackRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: {
            'Authorization': `token ${cleanToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (fallbackRes.ok || fallbackRes.status !== 401) {
          res = fallbackRes;
        }
      }
      
      if (res.ok) {
        setTestResult({ ok: true, msg: '✅ Kết nối GitHub thành công! Kho tồn tại và Token có quyền thao tác.' });
      } else {
        const data = await res.json();
        let customMsg = `❌ Lỗi kết nối GitHub (Mã lỗi ${res.status}): ${data.message || 'Không thể xác thực'}`;
        
        if (res.status === 401) {
          customMsg = `❌ Lỗi 401: Sai Token (Bad credentials)

👉 NGUYÊN NHÂN CHÍNH:
1. Token này đã HẾT HẠN hoặc bị THU HỒI trên GitHub.
   • LƯU Ý: GitHub tự động quét và thu hồi (hủy bỏ) token NGAY LẬP TỨC nếu nó bị lộ qua ảnh chụp màn hình, đoạn chat công khai hoặc file code public. Do bạn đã gửi ảnh chụp màn hình có chứa mã token này, khả năng cực kỳ cao là GitHub đã phát hiện và tự động vô hiệu hóa token này để bảo mật!
   • Hãy vào github.com -> Settings -> Developer Settings -> Personal Access Tokens (classic) để tạo một token mới hoàn chỉnh.
2. Token bị thiếu quyền 'repo' (thao tác với kho lưu trữ).
3. Bạn đang nhập MẬT KHẨU tài khoản GitHub cá nhân thay vì Personal Access Token (PAT). GitHub bắt buộc dùng PAT!`;
        } else if (res.status === 404) {
          customMsg = `❌ Lỗi 404: Không tìm thấy Kho lưu trữ (Not Found)

👉 NGUYÊN NHÂN PHỔ BIẾN:
1. Viết sai chính tả Tên tài khoản ("${owner}") hoặc Tên kho ("${repo}"). Lưu ý: Hai trường này có phân biệt chữ HOA và chữ thường chính xác tuyệt đối.
2. Kho lưu trữ đang ở chế độ Riêng tư (Private) nhưng Token của bạn không có đủ quyền 'repo' để xem kho đó.

💡 Cách khắc phục: Kiểm tra lại tên kho trên GitHub (Ví dụ link là github.com/ceohomes/CV-TQT thì Tài khoản là: "ceohomes", Tên kho là: "CV-TQT").`;
        }
        
        setTestResult({ ok: false, msg: customMsg });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: `❌ Không thể kiểm tra: Do lỗi mạng hoặc thiết lập CORS chặn yêu cầu: ${e?.message || 'Lỗi mạng'}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveClick = () => {
    // 1. Luôn lưu cấu hình GitHub
    localStorage.setItem('gh_token', ghToken.trim());
    localStorage.setItem('gh_owner', ghOwner.trim());
    localStorage.setItem('gh_repo', ghRepo.trim());
    localStorage.setItem('gh_branch', ghBranch.trim() || 'main');
    localStorage.setItem('gh_path', ghPath.trim() || 'cvs');

    // 2. Kiểm tra nếu có nhập Supabase thì validate
    const u = url.trim();
    const k = key.trim();
    if (u || k) {
      const err = validateSupabase();
      if (err) {
        setActiveTab('supabase');
        setTestResult({ ok: false, msg: err });
        return;
      }
    }
    
    onSave(url, key);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-gradient-to-br from-[#1a3a6b] to-[#1e4480] rounded-2xl w-full max-w-lg p-0 overflow-hidden shadow-2xl border border-blue-800" onClick={e => e.stopPropagation()}>
        <div className="px-7 py-5 border-b border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl"><Settings size={18} className="text-sky-300" /></div>
            <div>
              <h3 className="text-white font-black text-base uppercase tracking-tight">Cấu hình Hệ thống</h3>
              <p className="text-blue-300 text-xs mt-0.5">Quản lý database & kho lưu trữ CV ứng viên</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-blue-300 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-blue-800 bg-black/10">
          <button
            type="button"
            onClick={() => { setActiveTab('supabase'); setTestResult(null); }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 text-center",
              activeTab === 'supabase' ? "border-sky-400 text-sky-300 bg-white/5" : "border-transparent text-blue-300/70 hover:text-white"
            )}
          >
            ⚙️ Database Supabase
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('github'); setTestResult(null); }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 text-center",
              activeTab === 'github' ? "border-sky-400 text-sky-300 bg-white/5" : "border-transparent text-blue-300/70 hover:text-white"
            )}
          >
            📂 Storage GitHub (Lưu CV)
          </button>
        </div>

        <div className="p-7 space-y-5">
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div>
                <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-2">Supabase Project URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                  placeholder="https://abcdefghij.supabase.co"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
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
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 pr-12 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
                  />
                  <button type="button" onClick={() => setShowKey(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors">
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-blue-300/60 text-[10px] mt-1 ml-1">Lấy từ: Supabase → Project Settings → API → anon public</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-blue-200 space-y-1.5">
                <p className="font-black text-white text-[11px] uppercase tracking-widest mb-1.5">📋 Hướng dẫn lấy thông tin Supabase:</p>
                <p>1. Đăng nhập <span className="text-sky-300 font-semibold font-sans">supabase.com</span> → chọn Project</p>
                <p>2. Vào <span className="text-sky-300 font-semibold font-sans">Project Settings → API</span></p>
                <p>3. Copy <span className="text-sky-300 font-semibold font-sans">Project URL</span> và <span className="text-sky-300 font-semibold">anon public</span> key</p>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div>
                <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-1">GitHub Personal Access Token (PAT)</label>
                <div className="relative">
                  <input
                    type={showGhToken ? 'text' : 'password'}
                    value={ghToken}
                    onChange={e => { setGhToken(e.target.value); setTestResult(null); }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 pr-12 text-sm font-medium outline-none focus:border-sky-400 transition-all font-mono"
                  />
                  <button type="button" onClick={() => setShowGhToken(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white transition-colors">
                    {showGhToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-blue-300/60 text-[10px] mt-1 ml-1">Token có quyền ghi (write) cho kho lưu trữ của bạn</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-1">GitHub Tài khoản</label>
                  <input
                    type="text"
                    value={ghOwner}
                    onChange={e => { setGhOwner(e.target.value); setTestResult(null); }}
                    placeholder="Ví dụ: congchung0992"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-1">Tên repository (Tên kho)</label>
                  <input
                    type="text"
                    value={ghRepo}
                    onChange={e => { setGhRepo(e.target.value); setTestResult(null); }}
                    placeholder="Ví dụ: candidates-cv"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-1">Nhánh (Branch)</label>
                  <input
                    type="text"
                    value={ghBranch}
                    onChange={e => { setGhBranch(e.target.value); setTestResult(null); }}
                    placeholder="mặc định: main"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="text-blue-200 text-xs font-bold uppercase tracking-widest block mb-1">Thư mục lưu (Folder)</label>
                  <input
                    type="text"
                    value={ghPath}
                    onChange={e => { setGhPath(e.target.value); setTestResult(null); }}
                    placeholder="mặc định: cvs"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-400 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-blue-200 space-y-1.5 font-sans">
                <p className="font-semibold text-white text-[11px] uppercase tracking-widest mb-1.5">🔌 Cấu hình từ Cloudflare (Dưới nền):</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span>Token từ Cloudflare:</span>
                    {import.meta.env.VITE_GITHUB_TOKEN ? (
                      <span className="text-emerald-400 font-bold">✅ Đã tải thành công</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">Chưa có (hãy dán trực tiếp để test)</span>
                    )}
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Tên Repo từ Cloudflare:</span>
                    {import.meta.env.VITE_GITHUB_REPO ? (
                      <span className="text-emerald-400 font-bold">✅ {import.meta.env.VITE_GITHUB_REPO}</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">Chưa có (hãy dán trực tiếp để test)</span>
                    )}
                  </div>
                </div>
                {!import.meta.env.VITE_GITHUB_TOKEN && (
                  <p className="text-amber-200/80 text-[10px] mt-2 leading-relaxed bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    💡 <b>MÔI TRƯỜNG KIỂM THỬ (AIS Preview)</b>: Do đây là cửa sổ thử nghiệm của AI Studio, app không có quyền truy cập vào biến môi trường của Cloudflare của bạn. Bạn hãy dán trực tiếp Token và Tên tài khoản, Repo vào các ô phía trên rổi bấm Lưu để test ngay nhé!
                  </p>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-blue-200 space-y-1.5 font-sans">
                <p className="font-black text-white text-[11px] uppercase tracking-widest mb-1.5">📋 Hướng dẫn tạo Kho lưu trữ GitHub:</p>
                <p>1. Đăng nhập <span className="text-sky-300 font-semibold font-sans">github.com</span> &rarr; tạo repository mới ở chế độ <b>Public</b> để lấy link xem PDF trực tiếp dễ dàng.</p>
                <p>2. Vào <span className="text-sky-300 font-semibold font-sans">Settings &rarr; Developer Settings &rarr; Personal access tokens &rarr; Tokens (classic)</span>.</p>
                <p>3. Tạo token mới (Generate new token) tích chọn quyền <span className="text-sky-300 font-semibold font-sans font-sans">repo</span>.</p>
              </div>
            </div>
          )}

          {/* Test result display */}
          {testResult && (
            <div className={cn(
              'rounded-xl px-4 py-3 text-sm font-semibold whitespace-pre-line',
              testResult.ok ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-red-900/50 text-red-300 border border-red-700'
            )}>
              {testResult.msg}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 font-bold text-sm transition-all">Hủy</button>
            <button
              onClick={activeTab === 'supabase' ? handleTestSupabase : handleTestGithub}
              disabled={testing}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : null}
              {testing ? 'Đang kiểm tra...' : '🔍 Thử kết nối'}
            </button>
            <button
              onClick={handleSaveClick}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm transition-all shadow-lg text-center"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Candidate Form Modal ─────────────────────────────────────────────────────

const formatReferralDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  
  // Try splitting by '/'
  let parts = trimmed.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }
  
  // Try splitting by '-'
  parts = trimmed.split('-');
  if (parts.length === 3) {
    // Check if it's yyyy-mm-dd
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    } else {
      // Assume dd-mm-yyyy
      const [d, m, y] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  // Fallback to trying to parse as a Date
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {}

  return trimmed;
};

const formatDateInput = (value: string) => {
  if (!value) return '';
  
  // If the value contains slashes or dashes and has parts, try to normalize it (e.g. pasted strings like "4/6/2026")
  if (value.includes('/') || value.includes('-')) {
    const sep = value.includes('/') ? '/' : '-';
    const parts = value.split(sep);
    if (parts.length === 3) {
      const d = parts[0].trim().padStart(2, '0');
      const m = parts[1].trim().padStart(2, '0');
      const y = parts[2].trim();
      if (d.length <= 2 && m.length <= 2 && (y.length === 4 || y.length === 2)) {
        return `${d}/${m}/${y}`;
      }
    }
  }

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

const convertToYYYYMMDD = (dateStr?: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  
  // Check if it's already yyyy-mm-dd
  const partsDash = trimmed.split('-');
  if (partsDash.length === 3 && partsDash[0].length === 4) {
    return trimmed;
  }

  // Try dd/mm/yyyy
  const partsSlash = trimmed.split('/');
  if (partsSlash.length === 3) {
    const [d, m, y] = partsSlash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Try dd-mm-yyyy
  if (partsDash.length === 3) {
    const [d, m, y] = partsDash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  
  return '';
};

const convertToDDMMYYYY = (yyyyMMDD: string): string => {
  if (!yyyyMMDD) return '';
  const parts = yyyyMMDD.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return yyyyMMDD;
};

const isValidPhone = (phone: string) => {
  if (!phone) return true;
  const cleanPhone = phone.replace(/\s/g, '');
  return /^(0[3|5|7|8|9])[0-9]{8}$/.test(cleanPhone);
};

function CandidateModal({
  candidate, onClose, onSave, mode, groups, statuses, referrers, recruiters, onViewCV
}: {
  candidate: Partial<Candidate>;
  onClose: () => void;
  onSave: (data: Partial<Candidate> | Partial<Candidate>[]) => void;
  mode: 'add' | 'edit';
  groups: Group[];
  statuses: RecruitmentStatus[];
  referrers: Referrer[];
  recruiters: Recruiter[];
  onViewCV?: (url: string, name: string) => void;
}) {
  const [rows, setRows] = useState<Partial<Candidate>[]>(
    mode === 'add' ? [candidate] : [candidate]
  );

  // For single edit mode
  const [form, setForm] = useState<Partial<Candidate>>(candidate);
  const set = (key: keyof Candidate, val: any) => setForm(p => ({ ...p, [key]: val }));

  const [cvUploading, setCvUploading] = useState(false);
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Vui lòng chọn file định dạng PDF (.pdf)');
      return;
    }

    setCvUploading(true);
    try {
      let ghToken = localStorage.getItem('gh_token') || import.meta.env.VITE_GITHUB_TOKEN || '';
      let ghOwner = localStorage.getItem('gh_owner') || '';
      let ghRepo = localStorage.getItem('gh_repo') || '';

      const envRepo = import.meta.env.VITE_GITHUB_REPO || '';
      if (envRepo && envRepo.includes('/')) {
        const parts = envRepo.split('/');
        if (!ghOwner) ghOwner = parts[0]?.trim();
        if (!ghRepo) ghRepo = parts[1]?.trim();
      } else if (envRepo) {
        ghRepo = envRepo;
      }

      const ghBranch = localStorage.getItem('gh_branch') || 'main';
      const ghPath = localStorage.getItem('gh_path') || 'cvs';

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      // 1. Check if GitHub is configured
      if (ghToken && ghOwner && ghRepo) {
        // Convert to Base64
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = err => reject(err);
        });

        const finalPath = ghPath ? `${ghPath}/${safeName}` : safeName;
        const uploadUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${finalPath}`;

        // Chuẩn hóa token
        const cleanToken = ghToken.trim().replace(/^(token|bearer)\s+/i, '').trim();

        let response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Upload CV: ${file.name} - ${new Date().toLocaleString('vi-VN')}`,
            content: base64Content,
            branch: ghBranch
          }),
        });

        // Nếu 401 với Bearer, thử fallback sang kiểu 'token <token>' cho PAT classic
        if (response.status === 401) {
          const fallbackResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${cleanToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              message: `Upload CV: ${file.name} - ${new Date().toLocaleString('vi-VN')}`,
              content: base64Content,
              branch: ghBranch
            }),
          });
          if (fallbackResponse.ok || fallbackResponse.status !== 401) {
            response = fallbackResponse;
          }
        }

        if (!response.ok) {
          const errData = await response.json();
          let customMsg = errData.message || 'Lỗi tải lên kho';
          
          if (response.status === 401) {
            customMsg = `Lỗi 401: Sai Token (Bad Credentials). Token này có thể đã hết hạn, hoặc bị GitHub tự động THU HỒI/HỦY BỎ do bị lộ trong ảnh chụp màn hình / chat công khai! Hãy tạo một token mới nhé.`;
          } else if (response.status === 404) {
            customMsg = `Lỗi 404: Không tìm thấy Kho lưu trữ "${ghRepo}" thuộc tài khoản "${ghOwner}". Hãy kiểm tra chính tả chữ Hoa/thường hoặc chế độ Public/Private của kho!`;
          }
          throw new Error(`GitHub API: ${customMsg}`);
        }

        // Successfully uploaded to GitHub. Compute public URL to raw file.
        const publicUrl = `https://raw.githubusercontent.com/${ghOwner}/${ghRepo}/${ghBranch}/${finalPath}`;
        set('cv_url', publicUrl);
        alert('🎉 Đã tự động lưu CV thành công vào kho GitHub của bạn!');
      } 
      // 2. Fallback to Supabase
      else if (supabaseInit) {
        const storagePath = `cv/${safeName}`;
        const { error: uploadError } = await supabaseInit.storage.from('documents').upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseInit.storage.from('documents').getPublicUrl(storagePath);
        const publicUrl = urlData?.publicUrl || '';
        if (publicUrl) {
          set('cv_url', publicUrl);
          alert('⚠️ Hệ thống chưa nhận được cấu hình GitHub từ Cloudflare hoặc từ Cài đặt.\n\n👉 CV này tạm thời đã được lưu lên Supabase Storage độc lập.\n👉 Cách khắc phục: Bạn hãy vào Cài đặt (Biểu tượng Bánh răng ở góc trên bên phải) -> Chọn tab "GitHub" -> Điền Token và Tài khoản/Tên kho rồi bấm "Lưu cấu hình" là có thể sử dụng được ngay lập tức mà không cần đợi Cloudflare Re-deploy nhé!');
        }
      } 
      // 3. No storage configured
      else {
        throw new Error('Bạn chưa cấu hình kho GitHub hoặc Supabase đễ lưu trữ file. Hãy bấm vào biểu tượng bánh răng Cấu hình Hệ thống ở góc màn hình.');
      }
    } catch (err: any) {
      alert(`⚠️ Lỗi tải file lên: ${err?.message || 'Có lỗi xảy ra'}`);
    } finally {
      setCvUploading(false);
      if (cvFileInputRef.current) cvFileInputRef.current.value = '';
    }
  };

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
      'referral_date', 'full_name', 'send_bch_date', 'birth_year', 'phone', 
      'experience', 'position', 'desired_location', 'referrer', 'recruiter', 
      'tqt_interview', 'recruitment_status', 'notes'
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
            if (fieldKey === 'referral_date' || fieldKey === 'send_bch_date') {
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ngày giới thiệu</label>
                <input 
                  type="date"
                  value={convertToYYYYMMDD(form.referral_date)} 
                  onChange={e => set('referral_date', convertToDDMMYYYY(e.target.value))}
                  onClick={e => {
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  onFocus={e => {
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  onKeyDown={e => {
                    e.preventDefault();
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Ngày gửi BCH/ Phòng Nhân sự</label>
                <input 
                  type="date"
                  value={convertToYYYYMMDD(form.send_bch_date)} 
                  onChange={e => set('send_bch_date', convertToDDMMYYYY(e.target.value))}
                  onClick={e => {
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  onFocus={e => {
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  onKeyDown={e => {
                    e.preventDefault();
                    try { e.currentTarget.showPicker(); } catch (err) {}
                  }}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all cursor-pointer" />
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

            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">TQT Phỏng vấn</label>
                <select 
                  value={form.tqt_interview || ''} 
                  onChange={e => set('tqt_interview', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 bg-white transition-all"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {referrers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <FileText size={13} className="text-blue-500" /> CV Ứng viên (File PDF / Link Github / Drive)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={form.cv_url || ''} 
                    onChange={e => set('cv_url', e.target.value)}
                    placeholder="Dán link PDF (hoặc bấm tải PDF lên bên phải) ví dụ: https://raw.githubusercontent.com/..."
                    className="w-full border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {form.cv_url && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (onViewCV) {
                          onViewCV(form.cv_url!, form.full_name || 'Ứng viên');
                        } else {
                          window.open(formatLinkCV(form.cv_url!), '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition cursor-pointer"
                      title="Xem thử CV trực tuyến"
                    >
                      <ExternalLink size={15} />
                    </button>
                  )}
                </div>
                
                <input 
                  type="file" 
                  ref={cvFileInputRef} 
                  onChange={handleCVUpload} 
                  accept=".pdf" 
                  className="hidden" 
                />
                
                <button
                  type="button"
                  onClick={() => cvFileInputRef.current?.click()}
                  disabled={cvUploading}
                  className="px-5 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {cvUploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-blue-500" />
                      Tải lên...
                    </>
                  ) : (
                    <>
                      <Upload size={15} />
                      Tải PDF lên
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium ml-1">
                Lưu ý: Hệ thống hỗ trợ tự động lưu CV lên GitHub nếu đã cấu hình, hoặc lưu tạm lên Supabase Storage độc lập. Bạn có thể dán link trực tiếp nếu muốn.
              </p>
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
            <table className="data-table min-w-[1800px] font-roboto">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>STT</th>
                  <th style={{ width: 90, minWidth: 90, maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>Ngày giới thiệu</th>
                  <th style={{ width: 90, minWidth: 90, maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>Ngày gửi BCH/ Phòng Nhân sự</th>
                  <th style={{ minWidth: 140 }}>Tên ứng viên</th>
                  <th style={{ width: 80 }}>Năm sinh</th>
                  <th style={{ width: 120 }}>SĐT</th>
                  <th style={{ minWidth: 200 }}>Kinh nghiệm/Năng lực</th>
                  <th style={{ minWidth: 200 }}>Vị trí ứng tuyển</th>
                  <th style={{ minWidth: 220 }}>Địa điểm mong muốn làm việc</th>
                  <th style={{ minWidth: 120 }}>Người giới thiệu</th>
                  <th style={{ minWidth: 120 }}>NS P.TD nhận</th>
                  <th style={{ minWidth: 120 }}>TQT Phỏng vấn</th>
                  <th style={{ width: 140, minWidth: 140, maxWidth: 140 }}>Tình trạng</th>
                  <th style={{ minWidth: 200 }}>Ghi chú</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody onPaste={handlePaste}>
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors group border-b border-slate-300">
                    <td className="p-1 border-r border-slate-300 text-center text-slate-500 font-bold bg-slate-50/50">{idx + 1}</td>
                    <td className="p-1 border-r border-slate-300" style={{ width: 90, minWidth: 90, maxWidth: 90 }}>
                      <input 
                        type="date"
                        value={convertToYYYYMMDD(row.referral_date)} 
                        onChange={e => updateRow(idx, 'referral_date', convertToDDMMYYYY(e.target.value))}
                        onClick={e => {
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        onFocus={e => {
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        onKeyDown={e => {
                          e.preventDefault();
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        data-field="referral_date" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 text-center focus:bg-white focus:shadow-inner rounded text-[12px] cursor-pointer" />
                    </td>
                    <td className="p-1 border-r border-slate-300" style={{ width: 90, minWidth: 90, maxWidth: 90 }}>
                      <input 
                        type="date"
                        value={convertToYYYYMMDD(row.send_bch_date)} 
                        onChange={e => updateRow(idx, 'send_bch_date', convertToDDMMYYYY(e.target.value))}
                        onClick={e => {
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        onFocus={e => {
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        onKeyDown={e => {
                          e.preventDefault();
                          try { e.currentTarget.showPicker(); } catch (err) {}
                        }}
                        data-field="send_bch_date" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 text-center focus:bg-white focus:shadow-inner rounded text-[12px] cursor-pointer" />
                    </td>
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
                        value={row.tqt_interview || ''} 
                        onChange={e => updateRow(idx, 'tqt_interview', e.target.value)}
                        data-field="tqt_interview" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 focus:bg-white focus:shadow-inner rounded text-[12px]"
                      >
                        <option value="">-- Chọn --</option>
                        {referrers.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1 border-r border-slate-300" style={{ width: 140, minWidth: 140, maxWidth: 140 }}>
                      <select
                        value={row.recruitment_status || ''}
                        onChange={e => updateRow(idx, 'recruitment_status', e.target.value)}
                        data-field="recruitment_status" data-row-idx={idx}
                        className="w-full outline-none px-2 py-1.5 rounded text-[12px] font-semibold transition-all cursor-pointer border"
                        style={row.recruitment_status ? {
                          backgroundColor: statuses.find(s => s.name === row.recruitment_status)?.color_bg || getAutoBgColor(row.recruitment_status),
                          color: '#000',
                          borderColor: statuses.find(s => s.name === row.recruitment_status)?.color_bg || getAutoBgColor(row.recruitment_status),
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
                    <td className="p-1">
                      <input value={row.notes || ''} onChange={e => updateRow(idx, 'notes', e.target.value)}
                        data-field="notes" data-row-idx={idx}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded text-[12px]" placeholder="..." />
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

// ─── CV Viewer Modal ─────────────────────────────────────────────────────────

function CVViewerModal({
  url,
  candidateName,
  onClose,
}: {
  url: string;
  candidateName: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'google' | 'direct'>('google');
  const [loading, setLoading] = useState(true);
  const safeUrl = formatLinkCV(url);

  useEffect(() => {
    setLoading(true);
  }, [activeTab]);

  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(safeUrl)}&embedded=true`;

  return (
    <div className="modal-overlay z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div 
        className="modal-content bg-white rounded-2xl w-[96vw] max-w-[850px] h-[96vh] flex flex-col overflow-hidden shadow-2xl transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-wider select-none">
                Bản xem trực tiếp CV Ứng viên
              </h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">
                Ứng viên: <span className="text-blue-400 font-bold">{candidateName}</span>
              </p>
            </div>
          </div>

          {/* Quick Tabs to toggle view modes */}
          <div className="flex bg-slate-850 p-1 rounded-xl text-xs font-semibold text-slate-300 border border-slate-800">
            <button
              onClick={() => setActiveTab('google')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                activeTab === 'google' ? 'bg-blue-650 text-white font-black shadow' : 'hover:text-white'
              )}
            >
              Xem trực tiếp (Web Viewer)
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg transition-all cursor-pointer',
                activeTab === 'direct' ? 'bg-blue-650 text-white font-black shadow' : 'hover:text-white'
              )}
            >
              Mở trực tiếp (Iframe)
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
              title="Mở trong tab mới"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Mở tab mới</span>
            </a>
            
            <a
              href={safeUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl border border-blue-500/20 font-bold text-xs flex items-center gap-1.5 transition-all"
              title="Tải tệp xuống máy"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Tải về</span>
            </a>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all ml-1 cursor-pointer"
              title="Đóng bản xem trước"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Info Banner when view may not load */}
        {activeTab === 'google' && (
          <div className="bg-amber-500/10 border-b border-amber-500/15 py-2 px-6 flex justify-between items-center text-[11px] text-amber-700 select-none">
            <span>
              💡 <b>Mẹo:</b> Bộ đọc trực tiếp hỗ trợ xem, thu nhỏ/phóng to mọi định dạng PDF ngay trong ứng dụng mà không cần tự động tải file về điện thoại/máy tính của bạn!
            </span>
            <button 
              onClick={() => {
                setLoading(true);
              }}
              className="text-amber-800 underline font-bold hover:text-amber-950 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} className="animate-spin" /> Tải lại bộ xem
            </button>
          </div>
        )}

        {/* Body Viewer */}
        <div className="flex-1 bg-slate-100 relative">
          {loading && (
            <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none z-10 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-200/50 rounded-2xl flex items-center justify-center text-blue-500 mb-4 shadow-sm">
                <RefreshCw size={24} className="animate-spin text-blue-600" />
              </div>
              <p className="text-slate-700 font-bold text-sm">Đang tải bản xem trực tuyến CV...</p>
              <p className="text-slate-400 text-xs mt-1.5 max-w-sm">
                Nếu bản xem trực tuyến tải quá lâu, bạn có thể nhấn nút <span className="font-bold text-blue-600">"Mở tab mới"</span> hoặc <span className="font-bold text-blue-600">"Tải về"</span> ở góc trên cùng bên phải.
              </p>
            </div>
          )}

          <iframe
            src={activeTab === 'google' ? googleViewerUrl : safeUrl}
            className="w-full h-full border-none"
            onLoad={() => setLoading(false)}
            title={`CV Viewer - ${candidateName}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

// Hàm lấy màu nền tự động dựa trên nội dung (phù hợp với nội dung)
const getAutoBgColor = (name: string) => {
  const n = name.toLowerCase();

  // Specific keyword matches — mỗi trạng thái 1 màu riêng biệt, sặc sỡ
  if (n.includes('đi làm') || n.includes('nhận việc')) return '#4ade80';         // Xanh lá đậm
  if (n.includes('thành công') || n.includes('hợp đồng') || n.includes('ký hđ')) return '#22d3ee'; // Cyan đậm
  if (n.includes('chuyển hồ sơ') || n.includes('đào tạo nghề')) return '#fb923c'; // Cam đậm
  if (n.includes('chờ pv') || n.includes('chờ/test') || n.includes('test tay') || n.includes('chờ')) return '#facc15'; // Vàng đậm
  if (n.includes('phỏng vấn đạt') || n.includes('pv đạt') || n.includes('đạt pv')) return '#a78bfa'; // Tím đậm
  if (n.includes('thủ tục') || n.includes('đang làm thủ tục')) return '#f472b6';  // Hồng đậm
  if (n.includes('chưa có kq') || n.includes('chờ kq') || n.includes('kết quả')) return '#60a5fa'; // Xanh dương đậm
  if (n.includes('liên hệ')) return '#93c5fd';                                    // Xanh dương nhạt hơn
  if (n.includes('không phù hợp') || n.includes('hủy') || n.includes('từ chối') || n.includes('loại') || n.includes('không đạt')) return '#f87171'; // Đỏ đậm

  // Fallback palette — màu sặc sỡ, khác hẳn nhau, không bị nhạt
  const palette = [
    '#34d399', // emerald
    '#f59e0b', // amber
    '#818cf8', // indigo
    '#f43f5e', // rose
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#e879f9', // fuchsia
    '#fb7185', // pink
    '#2dd4bf', // teal
    '#a3e635', // lime-400
    '#c084fc', // purple-400
    '#fbbf24', // yellow-400
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

function StatusBadge({ status, statuses }: { status: string; statuses?: RecruitmentStatus[] }) {
  const textColor = '#000000';
  // Ưu tiên màu từ DB (color_bg), fallback về auto color
  const dbStatus = statuses?.find(s => s.name === status);
  const bgColor = dbStatus?.color_bg || getAutoBgColor(status);

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
          sort_order: editingStatus.sort_order,
          color_bg: editingStatus.color_bg || null
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
          sort_order: editingStatus.sort_order,
          color_bg: editingStatus.color_bg || null
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
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cấu hình Danh mục</h2>
          <p className="text-sm text-slate-500">Quản lý nhóm và tình trạng tuyển dụng</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
              <div key={g.id} className="group flex items-center justify-between p-4 bg-slate-200 rounded-xl border border-slate-400 hover:border-blue-200 transition-all">
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
              <div key={r.id} className="group flex items-center justify-between p-4 bg-slate-200 rounded-xl border border-slate-400 hover:border-orange-200 transition-all">
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
              <div key={s.id} className="group flex items-center justify-between p-4 bg-slate-200 rounded-xl border border-slate-400 hover:border-emerald-200 transition-all">
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

                  {/* Color Picker */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Màu nền badge</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        '#93c5fd','#60a5fa','#4ade80','#34d399','#22d3ee',
                        '#facc15','#fb923c','#f87171','#f472b6','#e879f9',
                        '#a78bfa','#818cf8','#2dd4bf','#84cc16','#fbbf24',
                        '#cbd5e1','#fca5a5','#c084fc','#86efac','#67e8f9',
                      ].map(color => (
                        <button key={color} type="button"
                          onClick={() => setEditingStatus({ ...editingStatus, color_bg: color })}
                          className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: editingStatus.color_bg === color ? '#1e3a8a' : 'transparent',
                            boxShadow: editingStatus.color_bg === color ? '0 0 0 2px #1e3a8a' : 'none'
                          }}
                        />
                      ))}
                      {/* Custom color input */}
                      <label className="w-7 h-7 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-emerald-400 transition-all relative overflow-hidden" title="Chọn màu tùy chỉnh">
                        <span className="text-[10px] text-slate-400 font-bold">+</span>
                        <input type="color"
                          value={editingStatus.color_bg || '#ffffff'}
                          onChange={e => setEditingStatus({ ...editingStatus, color_bg: e.target.value })}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      </label>
                    </div>
                    {editingStatus.color_bg && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-5 h-5 rounded-md border border-slate-200" style={{ backgroundColor: editingStatus.color_bg }} />
                        <span className="text-xs text-slate-500 font-mono">{editingStatus.color_bg}</span>
                        <button type="button" onClick={() => setEditingStatus({ ...editingStatus, color_bg: undefined })}
                          className="text-xs text-red-400 hover:text-red-600 font-bold ml-1">✕ Xóa màu</button>
                      </div>
                    )}
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
              <div key={r.id} className="group flex items-center justify-between p-4 bg-slate-200 rounded-xl border border-slate-400 hover:border-purple-200 transition-all">
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

// ─── Documents View ───────────────────────────────────────────────────────────

function DocumentsView({ sb, showToast }: { sb: any; showToast: (msg: string, type: Toast['type']) => void }) {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<DocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const BUCKET = 'documents';

  const loadDocuments = useCallback(async () => {
    if (!sb) return;
    setLoading(true);
    try {
      const { data, error } = await sb.from('documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (e: any) {
      showToast(`Lỗi tải tài liệu: ${e?.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [sb, showToast]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !sb) return;
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        showToast(`❌ File "${file.name}" không hợp lệ. Chỉ chấp nhận PDF và Word.`, 'error');
        continue;
      }
      try {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storagePath = `uploads/${safeName}`;
        const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
        const { error: dbError } = await sb.from('documents').insert({
          name: file.name.replace(/\.[^.]+$/, ''),
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          public_url: urlData?.publicUrl || '',
        });
        if (dbError) throw dbError;
        successCount++;
      } catch (e: any) {
        showToast(`❌ Lỗi upload "${file.name}": ${e?.message}`, 'error');
      }
    }
    if (successCount > 0) {
      showToast(`✅ Đã tải lên ${successCount} file`, 'success');
      await loadDocuments();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRename = async (doc: DocumentType) => {
    if (!sb || !editingName.trim()) { showToast('Tên file không được để trống', 'error'); return; }
    try {
      const { error } = await sb.from('documents').update({ name: editingName.trim(), updated_at: new Date().toISOString() }).eq('id', doc.id);
      if (error) throw error;
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, name: editingName.trim() } : d));
      setEditingId(null);
      showToast('✅ Đã đổi tên file', 'success');
    } catch (e: any) {
      showToast(`Lỗi: ${e?.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!sb || !deleteDocId) return;
    const doc = documents.find(d => d.id === deleteDocId);
    if (!doc) return;
    try {
      showToast('Đang xóa...', 'loading');
      await sb.storage.from(BUCKET).remove([doc.storage_path]);
      const { error } = await sb.from('documents').delete().eq('id', deleteDocId);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== deleteDocId));
      setDeleteDocId(null);
      showToast('✅ Đã xóa tài liệu', 'success');
    } catch (e: any) {
      showToast(`Lỗi: ${e?.message}`, 'error');
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <FileText size={20} className="text-red-500" />;
    return <File size={20} className="text-blue-500" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!sb) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Database size={48} className="mx-auto mb-4 text-slate-200" />
        <p className="font-black uppercase tracking-widest text-sm">Chưa kết nối Supabase</p>
        <p className="text-xs mt-1">Vui lòng cấu hình Supabase để sử dụng tính năng này</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-600 rounded-full" />
          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            Tài liệu đính kèm
            <span className="text-xs font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full normal-case shadow-sm">{documents.length}</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow transition-all disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Đang tải lên...' : 'Tải file lên'}
          </button>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx" className="hidden"
            onChange={e => handleUpload(e.target.files)} />
          <button onClick={loadDocuments} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all" title="Làm mới">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Upload hint */}
      <div
        className="border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center bg-blue-50/50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
      >
        <Upload size={32} className="mx-auto text-blue-300 mb-2" />
        <p className="text-sm font-bold text-blue-600">Kéo & thả file vào đây hoặc nhấn để chọn file</p>
        <p className="text-xs text-slate-400 mt-1">Hỗ trợ: PDF (.pdf) và Word (.doc, .docx)</p>
      </div>

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={36} className="animate-spin text-blue-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Paperclip size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Chưa có tài liệu nào</p>
          <p className="text-slate-400 text-xs mt-1">Tải file lên để lưu trữ tại đây</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a3a6b] text-white">
                <th className="text-left px-4 py-3 font-black text-[11px] uppercase tracking-widest w-10">STT</th>
                <th className="text-left px-4 py-3 font-black text-[11px] uppercase tracking-widest">Tên file</th>
                <th className="text-left px-4 py-3 font-black text-[11px] uppercase tracking-widest w-32">Loại</th>
                <th className="text-left px-4 py-3 font-black text-[11px] uppercase tracking-widest w-24">Kích thước</th>
                <th className="text-left px-4 py-3 font-black text-[11px] uppercase tracking-widest w-40">Ngày tải lên</th>
                <th className="text-center px-4 py-3 font-black text-[11px] uppercase tracking-widest w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => (
                <tr key={doc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="px-4 py-3 text-center font-bold text-blue-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-full">
                      {getFileIcon(doc.file_type)}
                      {editingId === doc.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(doc); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 border border-blue-400 rounded-lg px-2 py-1 text-sm outline-none font-medium"
                          />
                          <button onClick={() => handleRename(doc)} className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Save size={12} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-800 break-all leading-snug">{doc.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-7 break-all">{doc.file_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                      doc.file_type === 'application/pdf' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {doc.file_type === 'application/pdf' ? 'PDF' : 'Word'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatSize(doc.file_size)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewerDoc(doc)}
                        className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all" title="Xem file">
                        <Eye size={12} />
                      </button>
                      <button onClick={() => { setEditingId(doc.id); setEditingName(doc.name); }}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all" title="Đổi tên">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeleteDocId(doc.id)}
                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-all" title="Xóa">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewerDoc && (
        <div className="modal-overlay" onClick={() => setViewerDoc(null)}>
          <div className="modal-content bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-[#1a3a6b]">
              <div className="flex items-center gap-3">
                {getFileIcon(viewerDoc.file_type)}
                <div>
                  <p className="text-white font-black text-sm">{viewerDoc.name}</p>
                  <p className="text-blue-300 text-[10px]">{viewerDoc.file_name} · {formatSize(viewerDoc.file_size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={viewerDoc.public_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all">
                  <ExternalLink size={12} /> Mở tab mới
                </a>
                <button onClick={() => setViewerDoc(null)} className="p-2 text-blue-300 hover:text-white transition-colors"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {viewerDoc.file_type === 'application/pdf' ? (
                <iframe src={viewerDoc.public_url} className="w-full h-full min-h-[75vh]" title={viewerDoc.name} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center h-full">
                  <File size={64} className="text-blue-200 mb-4" />
                  <p className="font-black text-slate-600 text-base mb-2">File Word không thể xem trực tiếp trong trình duyệt</p>
                  <p className="text-slate-400 text-sm mb-6">Nhấn nút bên dưới để mở bằng Google Docs Viewer hoặc tải xuống</p>
                  <div className="flex gap-3">
                    <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(viewerDoc.public_url || '')}&embedded=true`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 flex items-center gap-2 transition-all">
                      <Eye size={14} /> Xem qua Google Docs
                    </a>
                    <a href={viewerDoc.public_url} download={viewerDoc.file_name}
                      className="px-5 py-2.5 bg-slate-600 text-white rounded-xl font-bold text-sm hover:bg-slate-700 flex items-center gap-2 transition-all">
                      <Download size={14} /> Tải xuống
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteDocId && (
        <div className="modal-overlay" onClick={() => setDeleteDocId(null)}>
          <div className="modal-content bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 text-lg mb-1">Xác nhận xóa</h3>
            <p className="text-slate-500 text-sm mb-6">Bạn có chắc muốn xóa tài liệu <span className="font-bold text-slate-700">"{documents.find(d => d.id === deleteDocId)?.name}"</span>? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDocId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Hủy</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all shadow-lg">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────

function QRModal({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Tự động tìm nhóm "Thông tin ứng viên (Điền theo Form)"
  const formGroup = groups.find(g =>
    g.name.toLowerCase().includes('thông tin ứng viên') ||
    g.name.toLowerCase().includes('điền theo form') ||
    g.code.toLowerCase().includes('form')
  );

  const getFormUrl = () => {
    if (!formGroup) return '';
    const base = window.location.origin + '/form';
    const params = new URLSearchParams();
    const sbUrl = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || '';
    const sbKey = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (sbUrl) params.set('sb_url', sbUrl);
    if (sbKey) params.set('sb_key', sbKey);
    params.set('group', formGroup.code);
    params.set('group_name', formGroup.name);
    return `${base}?${params.toString()}`;
  };

  const formUrl = getFormUrl();

  React.useEffect(() => {
    if (!formUrl) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formUrl)}&bgcolor=ffffff&color=1a3a6b&margin=12&ecc=M`;
    setQrDataUrl(qrUrl);
  }, [formUrl]);

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'QR_UngVien_DienTheoForm.png';
    link.click();
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a3a6b] to-[#1e4480] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-black text-base">Mã QR ứng tuyển</h3>
            <p className="text-blue-300 text-[11px] mt-0.5">Ứng viên quét → điền form → lưu tự động</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!formGroup ? (
            /* Chưa có nhóm phù hợp */
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 font-bold text-sm mb-1">Chưa tìm thấy nhóm phù hợp</p>
              <p className="text-amber-600 text-[12px]">Vào <strong>Cấu hình → Nhóm</strong>, tạo nhóm có tên chứa <strong>"Thông tin ứng viên"</strong> hoặc <strong>"Điền theo Form"</strong> rồi quay lại đây.</p>
            </div>
          ) : (
            <>
              {/* Nhóm đang dùng */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Nhóm lưu ứng viên</p>
                  <p className="text-sm font-black text-emerald-800">{formGroup.name}</p>
                </div>
              </div>

              {/* QR */}
              <div className="flex flex-col items-center bg-slate-50 rounded-2xl p-5 border border-slate-100">
                {qrDataUrl ? (
                  <>
                    <img src={qrDataUrl} alt="QR Code" className="w-[220px] h-[220px] rounded-xl" />
                    <p className="text-[11px] text-slate-500 mt-3 font-medium text-center">Quét mã để mở form ứng tuyển</p>
                  </>
                ) : (
                  <div className="w-[220px] h-[220px] flex items-center justify-center">
                    <Loader2 className="animate-spin text-slate-300" size={32} />
                  </div>
                )}
              </div>

              {/* Link */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hoặc chia sẻ link trực tiếp</label>
                <div className="flex gap-2">
                  <input readOnly value={formUrl}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-500 bg-slate-50 outline-none min-w-0 truncate" />
                  <button onClick={copyUrl}
                    className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                    {copied ? '✓ Đã copy' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={downloadQR} disabled={!qrDataUrl}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#1a3a6b] to-[#1e4480] hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5">
                  <Download size={13} /> Tải QR về
                </button>
                <button onClick={() => window.open(formUrl, '_blank')}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5">
                  <ExternalLink size={13} /> Mở form
                </button>
              </div>
            </>
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
  const [showQRModal, setShowQRModal] = useState(false);
  const [cvViewer, setCvViewer] = useState<{ url: string; title: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'config' | 'documents'>('list');
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
        c.tqt_interview?.toLowerCase().includes(q) ||
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
    const formatted = formatReferralDate(dateStr);
    if (!formatted) return Number.MAX_SAFE_INTEGER;
    // Hỗ trợ định dạng dd/mm/yyyy
    const parts = formatted.trim().split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return new Date(`${y}-${m}-${d}`).getTime() || Number.MAX_SAFE_INTEGER;
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
    if (filterGroup && c.group_type !== filterGroup) return;
    if (filterReferrer && c.referrer !== filterReferrer) return;
    if (filterRecruiter && c.recruiter !== filterRecruiter) return;
    if (search) {
      const q = search.toLowerCase();
      const match = (
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.position?.toLowerCase().includes(q) ||
        c.referrer?.toLowerCase().includes(q) ||
        c.tqt_interview?.toLowerCase().includes(q) ||
        c.recruitment_status?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
      if (!match) return;
    }
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
        { header: 'Ngày giới thiệu', key: 'referral_date', width: 15 },
        { header: 'Ngày gửi BCH/ Phòng Nhân sự', key: 'send_bch_date', width: 20 },
        { header: 'Tên ứng viên', key: 'full_name', width: 25 },
        { header: 'Năm sinh', key: 'birth_year', width: 10 },
        { header: 'SĐT', key: 'phone', width: 15 },
        { header: 'Kinh nghiệm/Năng lực', key: 'experience', width: 25 },
        { header: 'Vị trí ứng tuyển', key: 'position', width: 25 },
        { header: 'Địa điểm mong muốn làm việc', key: 'desired_location', width: 25 },
        { header: 'Người giới thiệu', key: 'referrer', width: 20 },
        { header: 'NS P.TD nhận', key: 'recruiter', width: 20 },
        { header: 'TQT Phỏng vấn', key: 'tqt_interview', width: 20 },
        { header: 'Tình trạng', key: 'recruitment_status', width: 22 },
        { header: 'CV Ứng viên', key: 'cv_url', width: 25 },
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
          worksheet.mergeCells(`B${groupRow.number}:O${groupRow.number}`);
          
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
          referral_date: formatReferralDate(c.referral_date),
          full_name: c.full_name || '',
          send_bch_date: formatReferralDate(c.send_bch_date),
          birth_year: c.birth_year || '',
          phone: c.phone || '',
          experience: c.experience || '',
          position: c.position || '',
          desired_location: c.desired_location || '',
          referrer: c.referrer || '',
          recruiter: c.recruiter || '',
          tqt_interview: c.tqt_interview || '',
          recruitment_status: c.recruitment_status || '',
          cv_url: c.cv_url ? 'Xem CV' : '',
          notes: c.notes || ''
        };

        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 40;
        
        // Style data row
        dataRow.eachCell((cell, colNumber) => {
          cell.font = { size: 11, name: 'Arial', color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };

          if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 13 || colNumber === 14) { // STT, Ngày giới thiệu, Ngày gửi BCH, Năm sinh, SĐT, Tình trạng, CV
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
          
          if (colNumber === 1) { // STT
            cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
          }
          if (colNumber === 4) { // Tên ứng viên
            cell.font = { bold: true, color: { argb: 'FF1E293B' } };
          }
          if (colNumber === 14 && c.cv_url) { // CV Ứng viên
            cell.value = { text: 'Xem CV', hyperlink: c.cv_url };
            cell.font = { size: 11, name: 'Arial', color: { argb: 'FF2563EB' }, underline: true };
          }

          // Style status cell
          if (colNumber === 13 && c.recruitment_status) {
            const dbColor = statuses.find(s => s.name === c.recruitment_status)?.color_bg;
            const rawColor = dbColor || getAutoBgColor(c.recruitment_status);
            // Normalize hex: expand 3-digit (#abc -> #aabbcc) and strip #
            let hex = rawColor.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            const hexColor = hex.toUpperCase().padEnd(6, '0').slice(0, 6);
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

      // ── Sheet 2: Tổng hợp thống kê ──────────────────────────────────────────
      const summarySheet = workbook.addWorksheet('Tổng hợp');

      // Title
      summarySheet.mergeCells('A1:C1');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'THỐNG KÊ ỨNG VIÊN THEO TÌNH TRẠNG';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.getRow(1).height = 36;

      // Date
      summarySheet.mergeCells('A2:C2');
      const dateCell = summarySheet.getCell('A2');
      dateCell.value = `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}  |  Tổng ứng viên: ${sorted.length}`;
      dateCell.font = { italic: true, size: 11, color: { argb: 'FF000000' } };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.getRow(2).height = 22;

      // Header row
      const summaryHeader = summarySheet.getRow(4);
      summaryHeader.height = 28;
      [
        { col: 1, label: 'STT' },
        { col: 2, label: 'TÌNH TRẠNG' },
        { col: 3, label: 'SỐ LƯỢNG' },
      ].forEach(({ col, label }) => {
        const cell = summaryHeader.getCell(col);
        cell.value = label;
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4480' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } },
        };
      });

      // Status rows — sorted by sort_order (already in statuses array order)
      let totalCount = 0;
      statuses.forEach((s, idx) => {
        const count = statusCounts[s.name] || 0;
        if (count === 0) return;
        totalCount += count;
        const row = summarySheet.getRow(5 + idx);
        row.height = 28;

        // STT
        const sttCell = row.getCell(1);
        sttCell.value = idx + 1;
        sttCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Tên tình trạng
        const nameCell = row.getCell(2);
        nameCell.value = s.name;
        nameCell.font = { bold: true, size: 11 };
        nameCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Màu nền theo color_bg từ DB
        const rawColor = s.color_bg || getAutoBgColor(s.name);
        let hex = rawColor.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map((c: string) => c + c).join('');
        hex = hex.toUpperCase().padEnd(6, '0').slice(0, 6);

        [sttCell, nameCell].forEach(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });

        // Số lượng
        const countCell = row.getCell(3);
        countCell.value = count;
        countCell.font = { bold: true, size: 13 };
        countCell.alignment = { horizontal: 'center', vertical: 'middle' };
        countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
        countCell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });

      // Total row
      const totalRowIdx = 5 + statuses.length;
      const totalRow = summarySheet.getRow(totalRowIdx);
      totalRow.height = 28;
      summarySheet.mergeCells(`A${totalRowIdx}:B${totalRowIdx}`);
      const totalLabelCell = totalRow.getCell(1);
      totalLabelCell.value = 'TỔNG CỘNG';
      totalLabelCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
      totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      const totalCountCell = totalRow.getCell(3);
      totalCountCell.value = sorted.length;
      totalCountCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      totalCountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } };
      totalCountCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Column widths
      summarySheet.getColumn(1).width = 8;
      summarySheet.getColumn(2).width = 40;
      summarySheet.getColumn(3).width = 14;

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

            <button onClick={() => { setActiveView('documents'); setIsSidebarOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                activeView === 'documents' ? 'bg-orange-500 text-white' : 'text-blue-200 hover:bg-white/10')}>
              <Paperclip size={16} /> Tài liệu đính kèm
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
      <header className="sticky top-0 z-30 border-b border-[#0c3040] px-5 py-0 flex items-center justify-between min-h-[60px]"
        style={{ background: '#164e63' }}>
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

      <main className="flex-1 overflow-auto w-full bg-[#f0f4fa]">

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

        {/* ── Documents View ── */}
        {activeView === 'documents' && (
          <DocumentsView sb={sb} showToast={showToast} />
        )}


        {/* ── List View ── */}
        {activeView === 'list' && (
          <div className="p-4 md:p-6 space-y-3">
            {/* Row 1: Title + Filters + Toolbar combined */}
            <div className="bg-[#fffdf0] border border-orange-100 rounded-2xl px-5 py-3 flex flex-wrap gap-3 items-center justify-between shadow-sm font-roboto">
              {/* Left: Title */}
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 shrink-0">
                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                Danh sách ứng viên
                <span className="text-xs font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full normal-case shadow-sm">{sorted.length}/{candidates.length}</span>
              </h2>

              {/* Middle: Dropdown Filters */}
              <div className="flex flex-wrap gap-2 items-end">
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
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Tìm kiếm..."
                    className="pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400 bg-white transition-all w-40 shadow-sm" />
                  {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"><X size={13} /></button>}
                </div>
                {/* Clear filters - chỉ hiện khi đang có bộ lọc */}
                {(filterGroup || filterStatus || filterReferrer || filterRecruiter || search) && (
                  <button onClick={() => { setFilterGroup(''); setFilterStatus(''); setFilterReferrer(''); setFilterRecruiter(''); setSearch(''); setPage(1); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 border border-orange-300 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500 rounded-xl text-[12px] font-bold transition-all">
                    <X size={13} /> Xóa bộ lọc
                  </button>
                )}
                {/* Export */}
                <button onClick={exportExcel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold transition-all shadow-sm">
                  <FileDown size={13} /> Xuất Excel
                </button>
                {/* QR Code */}
                <button onClick={() => setShowQRModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1a3a6b] hover:bg-[#1e4480] text-white rounded-xl text-[12px] font-bold transition-all shadow-sm">
                  <QrCode size={13} /> Tạo mã QR
                </button>
                {/* Add */}
                <button onClick={() => setModal({ type: 'add', candidate: { ...EMPTY_CANDIDATE } })}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-[12px] font-black transition-all shadow-lg shadow-orange-500/30">
                  <Plus size={14} /> Thêm ứng viên
                </button>
              </div>
            </div>

            {/* Row 2: Status Summary Bar */}
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {statuses.map(s => {
                  const count = statusCounts[s.name] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={s.id} className="flex items-center whitespace-nowrap">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 border border-black/5" style={{ backgroundColor: s.color_bg || getAutoBgColor(s.name) }}>
                        {s.name}
                        <span className="text-xs font-black text-black bg-white/60 px-2 py-0.5 rounded-full">{count}</span>
                      </span>
                    </div>
                  );
                })}
                {statusCounts['Chưa xác định'] > 0 && (
                  <div className="flex items-center whitespace-nowrap">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-3 py-1.5 rounded-lg bg-slate-200 shadow-sm flex items-center gap-2 border border-black/5">
                      Chưa xác định
                      <span className="text-xs font-black text-black bg-white/60 px-2 py-0.5 rounded-full">{statusCounts['Chưa xác định']}</span>
                    </span>
                  </div>
                )}
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
                          <th style={{ width: 50 }}>STT</th>
                          <th style={{ width: 90, minWidth: 90, maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>Ngày giới thiệu</th>
                          <th style={{ width: 90, minWidth: 90, maxWidth: 90, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2' }}>Ngày gửi BCH/ Phòng Nhân sự</th>
                          <th style={{ minWidth: 140 }}>Tên ứng viên</th>
                          <th style={{ width: 80 }}>Năm sinh</th>
                          <th style={{ width: 120 }}>SĐT</th>
                          <th style={{ minWidth: 200 }}>Kinh nghiệm/Năng lực</th>
                          <th style={{ minWidth: 200 }}>Vị trí ứng tuyển</th>
                          <th style={{ minWidth: 220 }}>Địa điểm mong muốn làm việc</th>
                          <th style={{ minWidth: 120 }}>Người giới thiệu</th>
                          <th style={{ minWidth: 120 }}>NS P.TD Nhận</th>
                          <th style={{ minWidth: 120 }}>TQT Phỏng vấn</th>
                          <th style={{ width: 140, minWidth: 140, maxWidth: 140 }}>Tình trạng</th>
                          <th style={{ width: 100, minWidth: 100, maxWidth: 100 }}>CV Ứng viên</th>
                          <th style={{ minWidth: 200 }}>Ghi chú</th>
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
                                    <td colSpan={15} style={{ color: color.text }} className="py-2.5 px-4 font-black text-sm uppercase tracking-tight">
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.border, display: 'inline-block', flexShrink: 0 }} />
                                        {groupName}
                                      </span>
                                    </td>
                                  </tr>
                                )}
                                <tr style={hl?.key ? { background: hl.bg, color: hl.text } : {}}>
                                  <td className="text-center font-bold text-blue-700 text-xs">{(c as any).sttInGroup}</td>
                                  <td className="text-center text-xs" style={{ width: 90, minWidth: 90, maxWidth: 90 }}>{formatReferralDate(c.referral_date)}</td>
                                  <td className="text-center text-xs" style={{ width: 90, minWidth: 90, maxWidth: 90 }}>{formatReferralDate(c.send_bch_date)}</td>
                                  <td className="font-semibold">{c.full_name}</td>
                                  <td className="text-center">{c.birth_year}</td>
                                  <td className="text-center">{c.phone}</td>
                                  <td>{c.experience}</td>
                                  <td>{c.position}</td>
                                  <td>{c.desired_location}</td>
                                  <td>{c.referrer}</td>
                                  <td>{c.recruiter}</td>
                                  <td>{c.tqt_interview}</td>
                                  <td className="text-center" style={{ width: 140, minWidth: 140, maxWidth: 140 }}>
                                    {c.recruitment_status ? <StatusBadge status={c.recruitment_status} statuses={statuses} /> : null}
                                  </td>
                                  <td className="text-center" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                                    {isLinkValid(c.cv_url) ? (
                                      <a 
                                        href={formatLinkCV(c.cv_url!)} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold transition-all border border-blue-200/40 cursor-pointer"
                                        title={c.cv_url}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setCvViewer({ url: c.cv_url!, title: c.full_name || 'Ứng viên' });
                                        }}
                                      >
                                        <FileText size={12} className="shrink-0" /> Xem CV
                                      </a>
                                    ) : (
                                      <span className="text-slate-300 text-[11px] italic">Chưa có CV</span>
                                    )}
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
      {showQRModal && <QRModal groups={groups} onClose={() => setShowQRModal(false)} />}
      {modal && <CandidateModal candidate={modal.candidate} mode={modal.type} onClose={() => setModal(null)} onSave={handleSave} groups={groups} statuses={statuses} referrers={referrers} recruiters={recruiters} onViewCV={(url, name) => setCvViewer({ url, title: name })} />}
      {deleteId && <ConfirmDeleteModal name={deleteTarget?.full_name || ''} onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
      {cvViewer && <CVViewerModal url={cvViewer.url} candidateName={cvViewer.title} onClose={() => setCvViewer(null)} />}

      {/* Toast */}
      <ToastDisplay toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
