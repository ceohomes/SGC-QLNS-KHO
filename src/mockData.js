// ─── Danh sách Dự án / Công trình đang thi công của công ty ───
// Công ty quản lý nhiều công trình xây dựng cùng lúc; mỗi công trình có quy mô
// công nhân riêng (300-500 người/công trình là quy mô THI CÔNG, không phải số thủ kho).
// Tổng số THỦ KHO của toàn công ty (đối tượng quản lý của app này) là 300-500 người,
// phân bổ trên các công trình bên dưới.
export const DU_AN_LIST = [
  { id: 'DA01', ten: 'KĐT Ecopark Complex – Giai đoạn 2', diaDiem: 'Văn Giang, Hưng Yên', quyMo: 480, nhaThau: 'Coteccons', khoiCongThang: '03/2025' },
  { id: 'DA02', ten: 'Vinhomes Ocean Park 3 – Phân khu The Rainbow', diaDiem: 'Gia Lâm, Hà Nội', quyMo: 420, nhaThau: 'Central Group', khoiCongThang: '06/2025' },
  { id: 'DA03', ten: 'Nhà máy Samsung Bắc Ninh – Mở rộng GĐ3', diaDiem: 'Yên Phong, Bắc Ninh', quyMo: 500, nhaThau: 'Hòa Bình Corp', khoiCongThang: '01/2025' },
  { id: 'DA04', ten: 'Landmark 81 Tower B – Cao ốc Văn phòng', diaDiem: 'Bình Thạnh, TP.HCM', quyMo: 350, nhaThau: 'Coteccons', khoiCongThang: '09/2024' },
  { id: 'DA05', ten: 'Cầu Vàm Cống 2 – Gói thầu XL03', diaDiem: 'Lấp Vò, Đồng Tháp', quyMo: 300, nhaThau: 'Cienco4', khoiCongThang: '11/2024' },
  { id: 'DA06', ten: 'KCN VSIP Bắc Ninh – Nhà xưởng 07-09', diaDiem: 'Từ Sơn, Bắc Ninh', quyMo: 380, nhaThau: 'Hòa Bình Corp', khoiCongThang: '04/2025' },
  { id: 'DA07', ten: 'Chung cư Sun Grand City – Tòa S1-S3', diaDiem: 'Thanh Xuân, Hà Nội', quyMo: 340, nhaThau: 'Sun Construction', khoiCongThang: '02/2025' },
  { id: 'DA08', ten: 'KCN Deep C – Nhà máy LG Display GĐ2', diaDiem: 'Hải Phòng', quyMo: 460, nhaThau: 'Hòa Bình Corp', khoiCongThang: '05/2025' },
  { id: 'DA09', ten: 'Cao tốc Biên Hòa – Vũng Tàu, Gói XL02', diaDiem: 'Long Thành, Đồng Nai', quyMo: 400, nhaThau: 'Cienco4', khoiCongThang: '08/2024' },
  { id: 'DA10', ten: 'Aqua City – Phân khu Aqua Riva', diaDiem: 'Biên Hòa, Đồng Nai', quyMo: 310, nhaThau: 'Central Group', khoiCongThang: '07/2025' },
  { id: 'DA11', ten: 'Bệnh viện Đa khoa Quốc tế Vinmec Cần Thơ', diaDiem: 'Ninh Kiều, Cần Thơ', quyMo: 320, nhaThau: 'Coteccons', khoiCongThang: '10/2024' },
  { id: 'DA12', ten: 'KCN Sông Hậu 2 – Nhà máy chế biến', diaDiem: 'Châu Thành, Hậu Giang', quyMo: 300, nhaThau: 'Cienco4', khoiCongThang: '12/2024' },
  { id: 'DA13', ten: 'Tòa nhà Văn phòng Techcombank Tower', diaDiem: 'Cầu Giấy, Hà Nội', quyMo: 330, nhaThau: 'Sun Construction', khoiCongThang: '01/2025' },
  { id: 'DA14', ten: 'KĐT Waterpoint – Phân khu The Pier', diaDiem: 'Bến Lức, Long An', quyMo: 390, nhaThau: 'Central Group', khoiCongThang: '03/2025' },
  { id: 'DA15', ten: 'Nhà ga T3 Sân bay Tân Sơn Nhất – Gói phụ trợ', diaDiem: 'Tân Bình, TP.HCM', quyMo: 500, nhaThau: 'Hòa Bình Corp', khoiCongThang: '06/2024' },
]

export const KHO_TYPES = ['Kho vật tư xây dựng', 'Kho sắt thép', 'Kho xi măng', 'Kho thiết bị – máy móc', 'Kho nhiên liệu', 'Kho cốp pha – giàn giáo']
export const CHUC_VU_LIST = ['Thủ kho trưởng hiện trường', 'Thủ kho hiện trường', 'Trưởng nhóm kho']
export const TRINH_DO_LIST = ['Trung cấp', 'Cao đẳng', 'Đại học']
export const CHUYEN_NGANH_LIST = ['Quản trị kho vận', 'Kế toán – Kho', 'Xây dựng dân dụng', 'Quản trị kinh doanh', 'Logistics']
export const LOAI_HD_LIST = ['Chính thức (không xác định thời hạn)', 'Xác định thời hạn 1 năm', 'Thời vụ / Theo công trình', 'Thử việc']
export const TRANG_THAI_LIST = ['Đang làm việc', 'Nghỉ phép', 'Đã nghỉ việc']
export const DANH_GIA_LIST = ['Xuất sắc', 'Tốt', 'Khá', 'Trung bình']

export const BAN_CHUOI_KHOI_LIST = ['Khối Thi công', 'Khối Kỹ thuật', 'Khối Dự án', 'Ban QLDA', 'Khối Vận hành']
export const PHONG_VUNG_MIEN_LIST = ['Phòng Vật tư', 'Phòng Kho vận', 'Vùng Miền Bắc', 'Vùng Miền Nam', 'Vùng Miền Trung']

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô', 'Dương', 'Lý']
const TEN_DEM_NAM = ['Văn', 'Hữu', 'Đức', 'Minh', 'Thành', 'Công', 'Quang', 'Xuân', 'Trọng', 'Anh']
const TEN_DEM_NU = ['Thị', 'Thu', 'Ngọc', 'Kim', 'Hồng', 'Thanh', 'Mai', 'Diệu']
const TEN_NAM = ['Hùng', 'Dũng', 'Sơn', 'Tuấn', 'Nam', 'Hải', 'Long', 'Đạt', 'Phong', 'Khoa', 'Bình', 'Vinh', 'Trường', 'Hiếu', 'Đông', 'Kiên', 'Tâm', 'Việt', 'Cường', 'Toàn', 'Quân', 'Lâm', 'Duy', 'Phúc']
const TEN_NU = ['Hoa', 'Lan', 'Hương', 'Huyền', 'Trang', 'Linh', 'Nga', 'Yến', 'Thảo', 'Vân', 'Nhung', 'Phương', 'Anh', 'Chi', 'Dung', 'Nhi']

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// PRNG có seed để dữ liệu ổn định giữa các lần render
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260707)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min

function genName(gioiTinh) {
  const ho = pick(HO)
  if (gioiTinh === 'Nam') {
    return `${ho} ${pick(TEN_DEM_NAM)} ${pick(TEN_NAM)}`
  }
  return `${ho} ${pick(TEN_DEM_NU)} ${pick(TEN_NU)}`
}

function genPhone() {
  const heads = ['090', '091', '093', '094', '096', '097', '098', '032', '033', '035', '037', '038', '039']
  return `${pick(heads)}${randInt(1000000, 9999999)}`
}

function genCCCD() {
  return `0${randInt(10, 99)}${randInt(100000000, 999999999)}`.slice(0, 12)
}

const TINH_LIST = ['Hà Nội', 'Nam Định', 'Thái Bình', 'Thanh Hóa', 'Nghệ An', 'Hưng Yên', 'Bắc Ninh', 'Hải Dương', 'Vĩnh Phúc', 'Ninh Bình', 'Đồng Tháp', 'An Giang', 'TP.HCM']

function addYears(dateStr, years) {
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function fmt(d) {
  return d.toISOString().slice(0, 10)
}

function genRecord(idx) {
  const gioiTinh = rand() < 0.82 ? 'Nam' : 'Nữ' // đặc thù ngành thủ kho công trình đa số là Nam
  const hoTen = genName(gioiTinh)
  const tuoi = randInt(23, 55)
  const namSinh = 2026 - tuoi
  const ngaySinh = `${namSinh}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`

  const soNamKinhNghiem = Math.min(randInt(0, tuoi - 22), 25)
  const namVaoLam = 2026 - randInt(0, Math.min(soNamKinhNghiem, 8) || 1)
  const ngayVaoLam = `${namVaoLam}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`

  const duAn = pick(DU_AN_LIST)
  const chucVu = rand() < 0.12 ? 'Thủ kho trưởng hiện trường' : (rand() < 0.7 ? 'Thủ kho hiện trường' : 'Trưởng nhóm kho')
  const trinhDo = pick(TRINH_DO_LIST)
  const loaiHopDong = pick(LOAI_HD_LIST)

  // Trạng thái: đa số đang làm việc, số ít nghỉ phép / đã nghỉ
  let trangThai = 'Đang làm việc'
  const r = rand()
  if (r < 0.06) trangThai = 'Đã nghỉ việc'
  else if (r < 0.13) trangThai = 'Nghỉ phép'

  // Ngày hết hạn hợp đồng (nếu không phải chính thức)
  let ngayHetHanHD = null
  if (loaiHopDong !== 'Chính thức (không xác định thời hạn)') {
    const base = new Date('2026-07-07')
    base.setDate(base.getDate() + randInt(-20, 150))
    ngayHetHanHD = fmt(base)
  }

  const luongCoBan = (chucVu === 'Thủ kho trưởng hiện trường' || chucVu === 'Thủ kho trưởng') ? randInt(18, 25) : (chucVu === 'Thủ kho hiện trường' || chucVu === 'Thủ kho') ? randInt(12, 17) : randInt(8, 11)
  const soLuongKhoQuanLy = (chucVu === 'Thủ kho trưởng hiện trường' || chucVu === 'Thủ kho trưởng') ? randInt(2, 4) : 1
  const giaTriTonKhoQuanLy = Math.round(((chucVu === 'Thủ kho trưởng hiện trường' || chucVu === 'Thủ kho trưởng') ? randInt(15, 40) : randInt(3, 15)) * (0.8 + rand() * 0.6) * 10) / 10

  const nameParts = hoTen.split(' ')
  const emailPrefix = removeAccents(nameParts[nameParts.length - 1] + '.' + nameParts[0])
  const emailCongTy = `${emailPrefix}${idx + 1}@sgc.com.vn`

  return {
    stt: idx + 1,
    maNV: `TK${String(idx + 1).padStart(3, '0')}`,
    hoTen,
    gioiTinh,
    ngaySinh,
    tuoi,
    soDienThoai: genPhone(),
    emailCongTy,
    banChuoiKhoi: pick(BAN_CHUOI_KHOI_LIST),
    phongVungMien: pick(PHONG_VUNG_MIEN_LIST),
    cccd: genCCCD(),
    queQuan: pick(TINH_LIST),
    ngayVaoLam,
    soNamKinhNghiem,
    trinhDo,
    chuyenNganh: pick(CHUYEN_NGANH_LIST),
    chucVu,
    duAnId: duAn.id,
    duAn: duAn.ten,
    khoPhuTrach: pick(KHO_TYPES),
    soLuongKhoQuanLy,
    giaTriTonKhoQuanLy,
    loaiHopDong,
    ngayHetHanHD,
    trangThai,
    luongCoBan,
    chungChiNghiepVuKho: rand() < 0.78 ? 'Có' : 'Không',
    chungChiATLD: rand() < 0.85 ? 'Có' : 'Không',
    danhGiaHieuSuat: pick(DANH_GIA_LIST),
    soDienThoaiKhanCap: genPhone(),
    ghiChu: rand() < 0.15 ? 'Kiêm nhiệm thêm kho phụ trong giai đoạn cao điểm' : ''
  }
}

export function generateThuKhoData(count = 420) {
  return Array.from({ length: count }, (_, i) => genRecord(i))
}

// Tổng số thủ kho của TOÀN CÔNG TY (không phải của 1 công trình) — trong khoảng 300-500 người.
export const THU_KHO_DATA = generateThuKhoData(420)
