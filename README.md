# SGC | Quản Lý Thủ Kho Dự Án

Webapp quản lý **toàn bộ đội ngũ thủ kho của công ty (300–500 người)**, được phân công trên nhiều công trình xây dựng đang thi công cùng lúc. Xây dựng theo cùng ngôn ngữ thiết kế (font Roboto, tông xanh SGC #0f58a7, sidebar trượt có thể ghim, bảng dữ liệu sticky-header, badge trạng thái...) với webapp "SGC | Báo Cáo Giao Nhận" đã có.

## Tính năng

- **Dashboard tổng quan**: KPI thẻ số liệu (tổng thủ kho, đang làm việc, sắp hết hạn hợp đồng, tuổi/kinh nghiệm trung bình, giá trị tồn kho quản lý...) và các biểu đồ: phân bổ theo dự án, trạng thái làm việc, trình độ học vấn, độ tuổi, chức vụ, top thủ kho quản lý giá trị tồn kho lớn nhất.
- **Danh sách thủ kho**: bảng chi tiết đầy đủ thông tin nhân sự (thông tin cá nhân, chức vụ, dự án phụ trách, kho phụ trách, hợp đồng, hiệu suất...), tìm kiếm, lọc theo dự án/chức vụ/trạng thái, xem chi tiết từng người, xuất Excel.
- **Theo dự án / công trình**: nhóm thủ kho theo từng công trình, thống kê nhanh (số thủ kho, số kho vận hành, giá trị tồn kho).
- **Cảnh báo hợp đồng**: danh sách hợp đồng đã quá hạn / sắp hết hạn (15, 30, 60 ngày) để chủ động gia hạn.

## Dữ liệu mẫu

`src/mockData.js` sinh ra **420 hồ sơ thủ kho mẫu** (trong khoảng 300–500 người theo yêu cầu), phân bổ trên **15 công trình xây dựng** đang thi công của công ty. Có thể đổi số lượng bằng cách sửa tham số `generateThuKhoData(420)`, hoặc thay bằng dữ liệu thật (import Excel/CSV hoặc kết nối Supabase/API) — cấu trúc field xem trong `THU_KHO_DATA`.

Bảng danh sách có **phân trang** (25/50/100 dòng/trang) để thao tác mượt với quy mô vài trăm nhân sự; tab "Theo dự án" cũng có nút "Xem thêm" để không hiển thị quá dài khi 1 công trình có nhiều thủ kho.

## Cài đặt & chạy

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```

Deploy thư mục `dist/` lên Cloudflare Pages / Vercel / Netlify tương tự webapp gốc.

## Cấu trúc field Danh sách Thủ kho

| Field | Ý nghĩa |
|---|---|
| maNV | Mã nhân viên (TK001...) |
| hoTen, gioiTinh, ngaySinh, tuoi | Thông tin cá nhân |
| soDienThoai, cccd, queQuan | Liên hệ / định danh |
| ngayVaoLam, soNamKinhNghiem | Thâm niên |
| trinhDo, chuyenNganh | Học vấn |
| chucVu | Thủ kho trưởng / Thủ kho / Phụ kho |
| duAn, khoPhuTrach, soLuongKhoQuanLy | Phân công công trình |
| loaiHopDong, ngayHetHanHD, trangThai | Hợp đồng lao động |
| luongCoBan, giaTriTonKhoQuanLy | Lương & quy mô quản lý |
| chungChiNghiepVuKho, chungChiATLD | Chứng chỉ chuyên môn |
| danhGiaHieuSuat, ghiChu | Đánh giá |

## Bước tiếp theo gợi ý

- Kết nối Supabase/Google Sheets để đồng bộ dữ liệu thật thay vì mock data.
- Thêm màn hình import Excel danh sách thủ kho (tương tự tab Đơn Giao/Đơn Nhận ở app gốc).
- Thêm phân quyền đăng nhập (Admin / Quản lý dự án / Xem) như `QuanLyTaiKhoanTab` ở app gốc.
