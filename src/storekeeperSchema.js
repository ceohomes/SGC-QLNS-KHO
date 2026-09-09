/**
 * storekeeperSchema.js
 * Quản lý cấu trúc chuẩn hóa cho bảng danh_sach_thu_kho và dữ liệu tuyển dụng
 * Chỉ lưu và hiển thị đúng 34 trường thông tin cột của bảng Supabase danh_sach_thu_kho
 */

export const STOREKEEPER_DB_COLUMNS = [
  'id',
  'stt',
  'khoi_thi_cong',
  'du_an_cong_trinh',
  'ma_nv',
  'ho_ten',
  'chuc_danh',
  'dien_thoai',
  'email',
  'ngay_sinh',
  'trinh_do',
  'trang_thai',
  'created_at',
  'ghi_chu',
  'so_nam_kinh_nghiem',
  'kinh_nghiem',
  'ky_nang',
  'ai_danh_gia',
  'diem_phu_hop',
  'gioi_tinh',
  'tuoi',
  'cccd',
  'que_quan',
  'dia_chi',
  'chuyen_nganh',
  'ngay_vao_lam',
  'file_name',
  'file_url',
  'github_url',
  'chuc_vu',
  'du_an',
  'ban_chuoi_khoi',
  'so_dien_thoai',
  'email_cong_ty'
]

/**
 * Chuẩn hóa ngày về định dạng ISO YYYY-MM-DD cho cột date trong PostgreSQL
 */
export function normalizeIsoDate(d) {
  if (!d) return null
  const str = String(d).trim()
  if (!str) return null
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      let year = parts[2]
      if (year.length === 2) year = '19' + year
      return `${year}-${month}-${day}`
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0]
  }
  return null
}

/**
 * Xây dựng payload CHỈ gồm các cột có trong bảng danh_sach_thu_kho, loại bỏ mọi cột thừa
 */
export function buildThuKhoDbPayload(item) {
  if (!item) return {}

  const banChuoiKhoi = item.banChuoiKhoi || item.khoi_thi_cong || item.khoiThiCong || ''
  const duAn = item.duAn || item.du_an_cong_trinh || item.duAnCongTrinh || ''
  const chucVu = item.chucVu || item.chuc_danh || item.chucDanh || 'Thủ kho hiện trường'
  const phone = item.soDienThoai || item.dien_thoai || item.dienThoai || ''
  const email = item.emailCongTy || item.email || item.email_cong_ty || ''
  const ngaySinh = normalizeIsoDate(item.ngaySinh || item.ngay_sinh)

  let computedTuoi = (item.tuoi != null && item.tuoi !== '') ? Number(item.tuoi) : null
  if (!computedTuoi && ngaySinh) {
    const y = parseInt(ngaySinh.split('-')[0], 10)
    if (y > 1900 && y < 2100) computedTuoi = new Date().getFullYear() - y
  }

  const payload = {
    stt: (item.stt != null && item.stt !== '') ? Number(item.stt) : null,
    khoi_thi_cong: banChuoiKhoi,
    du_an_cong_trinh: duAn,
    ma_nv: item.maNV || item.ma_nv || '',
    ho_ten: item.hoTen || item.ho_ten || '',
    chuc_danh: chucVu,
    dien_thoai: phone,
    email: email,
    ngay_sinh: ngaySinh,
    trinh_do: item.trinhDo || item.trinh_do || '',
    trang_thai: item.trangThai || item.trang_thai || 'Đang làm việc',
    ghi_chu: item.ghiChu || item.ghi_chu || '',
    so_nam_kinh_nghiem: (item.soNamKinhNghiem != null && item.soNamKinhNghiem !== '') ? Number(item.soNamKinhNghiem) : null,
    kinh_nghiem: item.kinhNghiem || item.kinh_nghiem || '',
    ky_nang: item.kyNang || item.ky_nang || '',
    ai_danh_gia: item.aiDanhGia || item.ai_danh_gia || '',
    diem_phu_hop: (item.diemPhuHop != null && item.diemPhuHop !== '') ? Number(item.diemPhuHop) : null,
    gioi_tinh: item.gioiTinh || item.gioi_tinh || 'Nam',
    tuoi: computedTuoi,
    cccd: item.cccd || item.cccd || '',
    que_quan: item.queQuan || item.que_quan || '',
    dia_chi: item.diaChi || item.dia_chi || item.queQuan || item.que_quan || '',
    chuyen_nganh: item.chuyenNganh || item.chuyen_nganh || '',
    ngay_vao_lam: normalizeIsoDate(item.ngayVaoLam || item.ngay_vao_lam),
    file_name: item.fileName || item.file_name || '',
    file_url: item.fileUrl || item.file_url || '',
    github_url: item.githubUrl || item.github_url || '',
    chuc_vu: chucVu,
    du_an: duAn,
    ban_chuoi_khoi: banChuoiKhoi,
    so_dien_thoai: phone,
    email_cong_ty: email
  }

  return payload
}

/**
 * Map từ dòng dữ liệu Supabase về object thủ kho trong app, chỉ giữ các trường hợp lệ
 */
export function mapDbToThuKho(r, matchedCand = null) {
  let computedTuoi = r.tuoi
  if (!computedTuoi && r.ngay_sinh) {
    const y = parseInt(String(r.ngay_sinh).split('-')[0], 10)
    if (y > 1900 && y < 2100) computedTuoi = new Date().getFullYear() - y
  }

  const banChuoiKhoi = r.ban_chuoi_khoi || r.khoi_thi_cong || ''
  const duAn = r.du_an || r.du_an_cong_trinh || ''
  const chucVu = r.chuc_vu || r.chuc_danh || 'Thủ kho hiện trường'
  const soDienThoai = r.so_dien_thoai || r.dien_thoai || ''
  const emailCongTy = r.email_cong_ty || r.email || ''

  return {
    id: r.id,
    stt: r.stt,
    khoiThiCong: banChuoiKhoi,
    banChuoiKhoi: banChuoiKhoi,
    duAnCongTrinh: duAn,
    duAn: duAn,
    maNV: r.ma_nv || '',
    hoTen: r.ho_ten || '',
    chucDanh: chucVu,
    chucVu: chucVu,
    dienThoai: soDienThoai,
    soDienThoai: soDienThoai,
    email: emailCongTy,
    emailCongTy: emailCongTy,
    ngaySinh: r.ngay_sinh || '',
    tuoi: computedTuoi || null,
    trinhDo: r.trinh_do || '',
    trangThai: r.trang_thai || 'Đang làm việc',
    createdAt: r.created_at || '',
    ghiChu: r.ghi_chu || '',
    soNamKinhNghiem: r.so_nam_kinh_nghiem != null ? Number(r.so_nam_kinh_nghiem) : null,
    kinhNghiem: r.kinh_nghiem || '',
    kyNang: r.ky_nang || '',
    aiDanhGia: r.ai_danh_gia || '',
    diemPhuHop: r.diem_phu_hop != null ? Number(r.diem_phu_hop) : null,
    gioiTinh: r.gioi_tinh || 'Nam',
    cccd: r.cccd || '',
    queQuan: r.que_quan || '',
    diaChi: r.dia_chi || r.que_quan || '',
    chuyenNganh: r.chuyen_nganh || '',
    ngayVaoLam: r.ngay_vao_lam || '',
    fileName: r.file_name || matchedCand?.fileName || '',
    fileUrl: r.file_url || matchedCand?.fileUrl || '',
    githubUrl: r.github_url || matchedCand?.githubUrl || '',
    candidateId: matchedCand?.id || '',
    fileDataUrl: matchedCand?.fileDataUrl || ''
  }
}
