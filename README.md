# SGC – Quản lý Ứng viên Phòng TQT

Ứng dụng quản lý danh sách ứng viên giới thiệu cho Phòng TQT, xây dựng bằng React + Vite + Supabase.

## 🚀 Cài đặt & Chạy

### 1. Cài dependencies
```bash
npm install
```

### 2. Cấu hình Supabase
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Điền thông tin Supabase vào file `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Tạo bảng database
Vào **Supabase Dashboard → SQL Editor → New Query**, copy toàn bộ nội dung file `SUPABASE_SQL.sql` và chạy.

### 4. Chạy development
```bash
npm run dev
```

### 5. Build production
```bash
npm run build
```

## ☁️ Deploy lên Cloudflare Pages

1. Push code lên GitHub (đảm bảo file `.env` **không** được commit)
2. Vào Cloudflare Pages → Create application → Connect to Git
3. Chọn repo → Build settings:
   - **Build command**: `npm run build`
   - **Build output**: `dist`
4. Thêm **Environment variables** trong Cloudflare:
   - `VITE_SUPABASE_URL` = URL của bạn
   - `VITE_SUPABASE_ANON_KEY` = Key của bạn
5. Deploy!

## 📋 Tính năng

- ✅ **Thêm / Sửa / Xóa** ứng viên
- ✅ **Phân nhóm**: Nhóm I (UV đi làm ngay), Nhóm II (UV tiềm năng)
- ✅ **Tìm kiếm** nhanh theo tên, SĐT, vị trí, người giới thiệu
- ✅ **Bộ lọc** theo nhóm và tình trạng tuyển dụng
- ✅ **Màu highlight** dòng theo tình trạng
- ✅ **Xuất Excel** danh sách đang lọc
- ✅ **Realtime sync** — nhiều người dùng cùng lúc tự cập nhật
- ✅ **Dashboard thống kê** tổng quan
- ✅ **Responsive** — dùng được trên mobile
- ✅ **Tài liệu đính kèm** — tải lên, xem, đổi tên và xóa file PDF/Word

## 📁 Tính năng Tài liệu đính kèm

Để bật tính năng này, bạn cần thực hiện thêm 2 bước trong Supabase:

### Bước 1: Tạo bảng `documents`
Vào **Supabase Dashboard → SQL Editor**, chạy phần SQL **"BẢNG TÀI LIỆU ĐÍNH KÈM"** trong file `SUPABASE_SQL.sql`.

### Bước 2: Tạo Storage Bucket
Vào **Supabase Dashboard → Storage → New Bucket**:
- **Name**: `documents`
- **Public bucket**: ✅ BẬT
- **File size limit**: 50MB

Hoặc chạy phần SQL **"STORAGE BUCKET"** trong file `SUPABASE_SQL.sql`.

### Tính năng:
- 📤 **Tải lên** file PDF và Word (kéo thả hoặc chọn file)
- 👁️ **Xem trực tiếp** file PDF trong trình duyệt
- 👁️ **Xem file Word** qua Google Docs Viewer
- ✏️ **Đổi tên** file sau khi tải lên
- 🗑️ **Xóa** file (xóa cả trên Storage)

## 🗃️ Cấu trúc bảng

Xem file `SUPABASE_SQL.sql` để biết đầy đủ schema.

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID | Khóa chính |
| group_type | TEXT | 'I' hoặc 'II' |
| full_name | TEXT | Tên ứng viên |
| birth_year | TEXT | Năm sinh |
| phone | TEXT | Số điện thoại |
| experience | TEXT | Kinh nghiệm/Năng lực |
| position | TEXT | Vị trí ứng tuyển |
| desired_location | TEXT | Địa điểm mong muốn |
| referral_date | TEXT | Ngày giới thiệu |
| referrer | TEXT | Người giới thiệu |
| ptd_received | BOOLEAN | PTD đã nhận HS chưa |
| recruitment_status | TEXT | Tình trạng tuyển dụng |
| highlight_color | TEXT | Màu nổi bật dòng |
| notes | TEXT | Ghi chú |
