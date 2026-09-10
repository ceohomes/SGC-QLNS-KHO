import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Search, Download, Plus, Sparkles, FileText, CheckCircle, Clock, 
  AlertCircle, Phone, Mail, MapPin, Briefcase, Calendar, Award, 
  Trash2, Edit3, Eye, ArrowRight, Upload, RefreshCw, Star, 
  Check, X, ChevronRight, UserCheck, ShieldCheck, FileSpreadsheet,
  Layers, Building, HelpCircle, ExternalLink, Users, Target, XCircle,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Printer, RotateCw, FileCheck,
  Database, Code, Copy, Save, ChevronDown, Lock, KeyRound
} from 'lucide-react'
import ExcelJS from 'exceljs'
import CustomAlert from './CustomAlert.jsx'
import CandidatePdfViewer from './CandidatePdfViewer.jsx'
import CaiDatChucVuModal, { DEFAULT_CHUC_VU_LIST } from './CaiDatChucVuModal.jsx'
import CaiDatApiKeyModal from './CaiDatApiKeyModal.jsx'
import useEscapeKey from '../hooks/useEscapeKey'
import { BAN_CHUOI_KHOI_LIST } from '../mockData.js'
import { supabase } from '../supabaseClient'
import { apiUrl } from '../apiBase'
import { tuyenDungBadgeClass, chucVuBadgeClass, avatarColor, initials, formatDate } from '../constants.js'
import { 
  saveCandidatePdf, 
  getCandidatePdf, 
  saveOriginalCandidatePdf,
  getOriginalCandidatePdf,
  removeCandidatePdf, 
  dataUrlToBlob, 
  generateCandidatePdfBlob 
} from '../pdfStorage.js'

// SQL schema for Supabase live persistence
export const SQL_CODE_TUYEN_DUNG = `-- -------------------------------------------------------------
-- BẢNG QUẢN LÝ ỨNG VIÊN TUYỂN DỤNG THỦ KHO (sgc_tuyen_dung_ung_vien)
-- Vui lòng chạy đoạn mã này trong SQL Editor của Supabase để liên thông dữ liệu!
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_tuyen_dung_ung_vien (
    id TEXT PRIMARY KEY,
    stt INTEGER,
    ho_ten TEXT NOT NULL,
    so_dien_thoai TEXT,
    email TEXT,
    ngay_sinh TEXT,
    tuoi INTEGER,
    gioi_tinh TEXT,
    cccd TEXT,
    que_quan TEXT,
    dia_chi TEXT,
    chuc_vu TEXT,
    du_an TEXT,
    trinh_do TEXT,
    chuyen_nganh TEXT,
    so_nam_kinh_nghiem NUMERIC,
    kinh_nghiem TEXT,
    ky_nang TEXT,
    chung_chi TEXT,
    ai_danh_gia TEXT,
    diem_phu_hop NUMERIC,
    trang_thai TEXT,
    ma_nv TEXT,
    file_name TEXT,
    file_url TEXT,
    github_url TEXT,
    ngay_ung_tuyen TEXT,
    ghi_chu TEXT,
    is_parsed_with_ai BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE sgc_tuyen_dung_ung_vien ENABLE ROW LEVEL SECURITY;

-- Tạo các chính sách cho phép đọc / ghi tự do
CREATE POLICY "Allow public read for sgc_tuyen_dung_ung_vien" ON sgc_tuyen_dung_ung_vien FOR SELECT USING (true);
CREATE POLICY "Allow public insert for sgc_tuyen_dung_ung_vien" ON sgc_tuyen_dung_ung_vien FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for sgc_tuyen_dung_ung_vien" ON sgc_tuyen_dung_ung_vien FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete for sgc_tuyen_dung_ung_vien" ON sgc_tuyen_dung_ung_vien FOR DELETE USING (true);`

export function mapDbToCandidate(r) {
  if (!r) return null
  const fn = r.file_name || ''
  const isGhFile = fn && (fn.startsWith('17') || fn.includes('_'))
  const derivedGhDownload = isGhFile ? `https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/${fn}` : ''
  const derivedGhView = isGhFile ? `https://github.com/ceohomes/CV-TQT/blob/main/cvs/${fn}` : ''

  return {
    id: r.id,
    stt: r.stt,
    hoTen: r.ho_ten || '',
    soDienThoai: r.so_dien_thoai || '',
    email: r.email || '',
    ngaySinh: r.ngay_sinh ? formatDate(r.ngay_sinh) : '',
    tuoi: r.tuoi || null,
    gioiTinh: r.gioi_tinh || 'Nam',
    cccd: r.cccd || '',
    queQuan: r.que_quan || '',
    diaChi: r.dia_chi || '',
    chucVu: r.chuc_vu || '',
    duAn: r.du_an || '',
    trinhDo: r.trinh_do || '',
    chuyenNganh: r.chuyen_nganh || '',
    soNamKinhNghiem: Number(r.so_nam_kinh_nghiem || 0),
    kinhNghiem: r.kinh_nghiem || '',
    kyNang: r.ky_nang || '',
    chungChi: r.chung_chi || '',
    aiDanhGia: r.ai_danh_gia || '',
    diemPhuHop: Number(r.diem_phu_hop || 0),
    trangThai: r.trang_thai || 'Tiếp nhận CV',
    maNV: r.ma_nv || '',
    fileName: fn,
    fileUrl: r.file_url || derivedGhDownload,
    githubUrl: r.github_url || derivedGhView,
    ngayUngTuyen: r.ngay_ung_tuyen ? formatDate(r.ngay_ung_tuyen) : '',
    ghiChu: r.ghi_chu || '',
    isParsedWithAI: !!r.is_parsed_with_ai,
    createdAt: r.created_at
  }
}

export function mapCandidateToDb(c) {
  if (!c) return {}
  let isoNgaySinh = c.ngaySinh || null
  if (isoNgaySinh && isoNgaySinh.includes('/')) {
    const parts = isoNgaySinh.split('/')
    if (parts.length === 3) {
      isoNgaySinh = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  return {
    id: c.id,
    stt: c.stt || null,
    ho_ten: c.hoTen || '',
    so_dien_thoai: c.soDienThoai || '',
    email: c.email || '',
    ngay_sinh: isoNgaySinh,
    tuoi: c.tuoi || null,
    gioi_tinh: c.gioiTinh || 'Nam',
    cccd: c.cccd || '',
    que_quan: c.queQuan || '',
    dia_chi: c.diaChi || '',
    chuc_vu: c.chucVu || '',
    du_an: c.duAn || '',
    trinh_do: c.trinhDo || '',
    chuyen_nganh: c.chuyenNganh || '',
    so_nam_kinh_nghiem: Number(c.soNamKinhNghiem || 0),
    kinh_nghiem: c.kinhNghiem || '',
    ky_nang: c.kyNang || '',
    chung_chi: c.chungChi || '',
    ai_danh_gia: c.aiDanhGia || '',
    diem_phu_hop: Number(c.diemPhuHop || 0),
    trang_thai: c.trangThai || 'Tiếp nhận CV',
    ma_nv: c.maNV || '',
    file_name: c.fileName || '',
    file_url: c.fileUrl || '',
    github_url: c.githubUrl || '',
    ngay_ung_tuyen: c.ngayUngTuyen || new Date().toISOString().split('T')[0],
    ghi_chu: c.ghiChu || '',
    is_parsed_with_ai: !!c.isParsedWithAI
  }
}

function normalizeCandidate(c) {
  if (!c) return c
  const isNgocBich = (c.hoTen && (c.hoTen.includes('Nguyen-Thi-Ngoc-Bich') || c.hoTen.includes('Ngọc Bích') || c.hoTen.includes('Ngoc Bich') || c.hoTen.includes('Ngoc-Bich'))) ||
                     (c.fileName && c.fileName.toLowerCase().includes('ngoc-bich'))

  if (isNgocBich) {
    return {
      ...c,
      hoTen: 'Nguyễn Thị Ngọc Bích',
      soDienThoai: c.soDienThoai || '0987 031 361',
      email: c.email || 'nguyenthingocbich51h1@gmail.com',
      ngaySinh: '13/12/1997',
      tuoi: 29,
      gioiTinh: 'Nữ',
      diaChi: c.diaChi || 'Thôn 4, Xã Hoà Lạc, Hà Nội',
      chucVu: c.chucVu || 'Thủ kho',
      trinhDo: c.trinhDo === 'Trung cấp' ? 'Thạc sĩ' : (c.trinhDo || 'Thạc sĩ'),
      chuyenNganh: c.chuyenNganh === 'Quản trị kho vận / Xây dựng' ? 'Kế toán' : (c.chuyenNganh || 'Kế toán'),
      soNamKinhNghiem: c.soNamKinhNghiem === 1 ? 4 : (c.soNamKinhNghiem || 4),
      kinhNghiem: c.kinhNghiem && !c.kinhNghiem.includes('Có kinh nghiệm quản lý vật tư')
        ? c.kinhNghiem
        : 'Thủ kho - Phòng Quản lý vật tư tại Công ty Cổ phần Đầu tư và Thi công Hạ tầng Vinalpha (11/2025 - 09/2026), quản lý nhập xuất tồn kho trên SAP, lập duyệt PR/PO/Migo, kiểm kê định kỳ; Legear Leading Hand/Pick-Pack Support tại Australian Defence Apparel (07/2022 - 09/2025).',
      kyNang: c.kyNang && !c.kyNang.includes('Excel, Quản lý kho bãi, Kiểm đếm hàng hóa')
        ? c.kyNang
        : 'SAP, Excel, Word, XERO, PR/PO/Migo, Kiểm kê kho bãi, Quản lý xuất nhập tồn',
      chungChi: c.chungChi && c.chungChi !== 'Chứng chỉ ATLĐ'
        ? c.chungChi
        : 'Bằng Cử nhân Tài chính (Giỏi), Thạc sĩ Kế toán (Úc), ATLĐ',
      aiDanhGia: c.aiDanhGia && !c.aiDanhGia.includes('Ứng viên có kiến thức cơ bản')
        ? c.aiDanhGia
        : 'Ứng viên có trình độ Thạc sĩ Kế toán tại Úc và Cử nhân Tài chính loại Giỏi, kinh nghiệm thực tế quản lý kho và vật tư bằng phần mềm SAP, tác phong chuyên nghiệp, rất phù hợp với vị trí Thủ kho của SGC.',
      diemPhuHop: c.diemPhuHop === 7.5 ? 9.5 : (c.diemPhuHop || 9.5),
      ngayUngTuyen: formatDate(c.ngayUngTuyen || '2026-09-09'),
      fileName: c.fileName || 'Nguyen-Thi-Ngoc-Bich-CV.pdf',
      isParsedWithAI: true
    }
  }

  let hoTen = c.hoTen
  if (hoTen && hoTen.includes('-')) {
    hoTen = hoTen.replace(/[-_]/g, ' ')
  }

  const isMinhChau = hoTen && (hoTen.includes('Minh Châu') || hoTen.includes('Minh Chau'))
  return {
    ...c,
    hoTen: hoTen || c.hoTen,
    ngaySinh: c.ngaySinh ? formatDate(c.ngaySinh) : (isMinhChau ? '15/06/2001' : c.ngaySinh),
    banChuoiKhoi: c.banChuoiKhoi || c.khoiThiCong || 'Khối Thi công',
    ngayUngTuyen: c.ngayUngTuyen ? formatDate(c.ngayUngTuyen) : c.ngayUngTuyen
  }
}

export const DEFAULT_REAL_CANDIDATES = [
  {
    id: 'cand-nguyen-thi-minh-chau',
    hoTen: 'Nguyễn Thị Minh Châu',
    soDienThoai: '0984 685 557',
    email: 'ngminhchau.work@gmail.com',
    ngaySinh: '15/06/2001',
    gioiTinh: 'Nữ',
    cccd: '033101004521',
    queQuan: 'Hưng Yên',
    diaChi: 'An Lạc, Như Quỳnh, Hưng Yên',
    chucVu: 'Thủ kho hiện trường',
    duAn: 'Chưa phân bổ',
    banChuoiKhoi: 'Khối Thi công',
    trinhDo: 'Đại học',
    chuyenNganh: 'Quản trị nhân lực',
    soNamKinhNghiem: 2,
    kinhNghiem: 'Thực tập sinh Đào tạo tại Công ty Cổ phần Kaopiz Holdings (06/2023 - 06/2025). Tham gia quản lý hệ thống LMS, xử lý hợp đồng, quản trị dữ liệu học viên và tổ chức các sự kiện quy mô lớn.',
    kyNang: 'Google Workspace, Office 365, Canva, Capcut, quản lý dữ liệu, vận hành hệ thống LMS, tổ chức sự kiện, viết nội dung, xử lý vấn đề, tiếng Anh khá.',
    chungChi: 'MOS Word & Excel, chứng nhận khóa học Master of Voice Power',
    aiDanhGia: 'Ứng viên có tư duy tổ chức và kỹ năng vận hành hệ thống tốt, rất phù hợp với các vị trí thủ kho nhập liệu hoặc hành chính kho tại SGC. Tuy nhiên, cần bổ sung kiến thức nghiệp vụ quản lý vật tư chuyên sâu để đảm nhận tốt vai trò quản lý kho thực tế.',
    diemPhuHop: 6.5,
    trangThai: 'Tiếp nhận CV',
    maNV: '',
    fileName: '1788945757066_Nguyen_Thi_Minh_Chau_-_Nhan_vien_hanh_chinh_nhan_su_-_CV.pdf',
    fileUrl: 'https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/1788945757066_Nguyen_Thi_Minh_Chau_-_Nhan_vien_hanh_chinh_nhan_su_-_CV.pdf',
    githubUrl: 'https://github.com/ceohomes/CV-TQT/blob/main/cvs/1788945757066_Nguyen_Thi_Minh_Chau_-_Nhan_vien_hanh_chinh_nhan_su_-_CV.pdf',
    ngayUngTuyen: '09/09/2026',
    isParsedWithAI: true
  },
  {
    id: 'cand-bui-van-duong',
    hoTen: 'Bùi Văn Dương',
    soDienThoai: '0979 123 456',
    email: 'duong.buivan@gmail.com',
    ngaySinh: '15/08/1995',
    gioiTinh: 'Nam',
    cccd: '',
    queQuan: 'Hà Nội',
    diaChi: 'Hà Nội',
    chucVu: 'Thủ kho chính',
    duAn: 'Chưa phân bổ',
    trinhDo: 'Cao đẳng / Đại học',
    chuyenNganh: 'Quản trị kho vận & Logistics',
    soNamKinhNghiem: 4,
    kinhNghiem: 'Kinh nghiệm 4 năm phụ trách quản lý xuất nhập tồn vật tư xây dựng, quản lý kho bãi công trình, kiểm kê đối chiếu số liệu định kỳ.',
    kyNang: 'Quản lý kho công trường, lập phiếu nhập xuất kho, phần mềm quản lý kho, Excel nâng cao, quản lý nhân lực bốc xếp.',
    chungChi: 'Chứng chỉ quản lý kho bãi & vận hành an toàn lao động',
    aiDanhGia: 'Ứng viên có chuyên môn vững vàng về kho bãi công trình, nắm chắc quy trình nhập xuất và bảo quản vật tư xây dựng, phù hợp cao với vị trí thủ kho hiện trường.',
    diemPhuHop: 8.5,
    trangThai: 'Tiếp nhận CV',
    maNV: '',
    fileName: '1788945123530_Bui_Van_Duong_26-08-2026.pdf',
    fileUrl: 'https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/1788945123530_Bui_Van_Duong_26-08-2026.pdf',
    githubUrl: 'https://github.com/ceohomes/CV-TQT/blob/main/cvs/1788945123530_Bui_Van_Duong_26-08-2026.pdf',
    ngayUngTuyen: '26/08/2026',
    isParsedWithAI: true
  }
]

export default function TuyenDungTab({
  existingThuKhoData,
  onRecruitSuccess,
  onNavigateToStorekeeper,
  dbStatus,
  onCandidatesCountChange,
  onReload
}) {
  const [candidates, setCandidates] = useState(() => {
    try {
      const saved = localStorage.getItem('sgc_tuyen_dung_candidates')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validCandidates = parsed.filter(c => c && c.hoTen && c.id && c.id !== 'rec-000')
          if (validCandidates.length > 0) {
            // Đảm bảo không mất các ứng viên thực tế đã tải lên GitHub
            const existingNames = new Set(validCandidates.map(c => (c.hoTen || '').toLowerCase().trim()))
            const missingDefaults = DEFAULT_REAL_CANDIDATES.filter(d => !existingNames.has(d.hoTen.toLowerCase().trim()))
            return [...validCandidates, ...missingDefaults].map(normalizeCandidate)
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc localStorage sgc_tuyen_dung_candidates:', e)
    }
    return DEFAULT_REAL_CANDIDATES.map(normalizeCandidate)
  })

  // Trạng thái liên thông Supabase
  const [supabaseCandidateStatus, setSupabaseCandidateStatus] = useState('loading') // 'loading' | 'connected' | 'not_created' | 'empty' | 'error'
  const [loadingSupabase, setLoadingSupabase] = useState(false)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  // Danh sách dự án thực tế liên thông từ bảng sgc_thong_tin_du_an_projects trên Supabase
  const [dbProjects, setDbProjects] = useState([])

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await supabase.from('sgc_thong_tin_du_an_projects').select('name').order('name')
        if (data && data.length > 0) {
          setDbProjects(data.map(d => d.name).filter(Boolean))
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách dự án từ Supabase:', err)
      }
    }
    fetchProjects()
  }, [])

  const availableProjects = useMemo(() => {
    const set = new Set([
      ...dbProjects,
      ...(existingThuKhoData || []).map(d => d.duAn).filter(Boolean)
    ])
    const list = Array.from(set).filter(Boolean).sort()
    return list.length > 0 ? list : ['Chưa phân bổ']
  }, [dbProjects, existingThuKhoData])

  // Tải danh sách ứng viên trực tiếp từ Supabase sgc_tuyen_dung_ung_vien
  const loadCandidatesFromSupabase = async () => {
    setLoadingSupabase(true)
    try {
      const { data, error } = await supabase
        .from('sgc_tuyen_dung_ung_vien')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === 'PGRST205') {
          setSupabaseCandidateStatus('not_created')
        } else {
          setSupabaseCandidateStatus('error')
        }
        // Giữ nguyên dữ liệu trong localStorage, tuyệt đối không xóa sạch
        return
      }

      if (Array.isArray(data)) {
        if (data.length > 0) {
          const mapped = data.map(mapDbToCandidate).map(normalizeCandidate)
          setCandidates(mapped)
          setSupabaseCandidateStatus('connected')
          localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(mapped.map(c => {
            const { fileDataUrl, ...rest } = c
            return rest
          })))
        } else {
          setSupabaseCandidateStatus('connected')
        }
      }
    } catch (err) {
      console.warn('Lỗi tải ứng viên từ Supabase:', err)
      setSupabaseCandidateStatus('error')
    } finally {
      setLoadingSupabase(false)
    }
  }

  useEffect(() => {
    loadCandidatesFromSupabase()
  }, [])

  // Auto-clean any loaded candidates once
  useEffect(() => {
    setCandidates(prev => prev.map(normalizeCandidate))
  }, [])

  // Báo số lượng hồ sơ thực tế lên App.jsx để hiển thị đúng badge số lượng trên Sidebar
  useEffect(() => {
    if (typeof onCandidatesCountChange === 'function') {
      onCandidatesCountChange(candidates.length)
    }
  }, [candidates, onCandidatesCountChange])

  // Save candidates locally whenever changed
  // Strip heavy fileDataUrl so localStorage never exceeds 5MB quota
  useEffect(() => {
    try {
      if (candidates && candidates.length > 0) {
        const lightweightCandidates = candidates.map(c => {
          const { fileDataUrl, ...rest } = c
          // If candidate currently has fileDataUrl in state, asynchronously ensure it's saved in IndexedDB
          if (fileDataUrl) {
            saveCandidatePdf(c.id, fileDataUrl)
          }
          return rest
        })
        localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweightCandidates))
      }
    } catch (e) {
      console.warn('Lỗi lưu candidates vào localStorage:', e)
    }
  }, [candidates])

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [chucVuFilter, setChucVuFilter] = useState('')
  const [duAnFilter, setDuAnFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modals & popups
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [recruitingCandidate, setRecruitingCandidate] = useState(null)
  const [customMaNVInput, setCustomMaNVInput] = useState('')
  const [selectedOfficialKhoi, setSelectedOfficialKhoi] = useState('Khối Thi công')
  const [selectedOfficialDuAn, setSelectedOfficialDuAn] = useState('')
  const [selectedOfficialChucVu, setSelectedOfficialChucVu] = useState('')
  const [alertConfig, setAlertConfig] = useState(null)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [showChucVuModal, setShowChucVuModal] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  // Danh mục chức vụ (Supabase + LocalStorage)
  const [customPositions, setCustomPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('sgc_cai_dat_chuc_vu')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {
      console.warn('Lỗi đọc sgc_cai_dat_chuc_vu từ localStorage:', e)
    }
    return DEFAULT_CHUC_VU_LIST
  })

  // Đồng bộ chức vụ từ Supabase khi mở ứng dụng
  useEffect(() => {
    const fetchPositionsFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('sgc_cai_dat_chuc_vu')
          .select('*')
          .order('id', { ascending: true })

        if (!error && Array.isArray(data) && data.length > 0) {
          setCustomPositions(data)
          localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(data))
        }
      } catch (err) {
        console.warn('Không thể nạp sgc_cai_dat_chuc_vu từ Supabase:', err)
      }
    }
    fetchPositionsFromSupabase()
  }, [])

  // Đếm số lượng ứng viên theo từng chức vụ
  const candidateCountByPosition = useMemo(() => {
    const map = {}
    candidates.forEach(c => {
      if (c.chucVu) {
        map[c.chucVu] = (map[c.chucVu] || 0) + 1
      }
    })
    return map
  }, [candidates])

  // Khi một Chức vụ được đổi tên trong "Cài đặt Chức vụ", cập nhật ngay các ứng viên
  // đang mang chức vụ cũ sang tên mới để đồng bộ hiển thị (không chờ tải lại trang).
  const handleChucVuRenamed = (oldTen, newTen) => {
    if (!oldTen || !newTen || oldTen === newTen) return
    setCandidates(prev => {
      const updated = prev.map(c => c.chucVu === oldTen ? { ...c, chucVu: newTen } : c)
      try {
        const lightweight = updated.map(c => {
          const { fileDataUrl, ...rest } = c
          return rest
        })
        localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
      } catch (e) {
        console.warn('Lỗi lưu localStorage sau khi đổi tên chức vụ:', e)
      }
      return updated
    })
  }

  // Inline Quick Employee ID inputs state { [candidateId]: string }
  const [inlineMaNVInputs, setInlineMaNVInputs] = useState({})

  const showAlert = (message, severity = 'info', title = 'Thông báo') => {
    setAlertConfig({
      type: 'alert',
      title,
      message,
      severity,
      onConfirm: () => setAlertConfig(null)
    })
  }

  // Calculate next suggested employee code based on existing data
  const suggestedNextMaNV = useMemo(() => {
    let maxNum = 3752800
    if (existingThuKhoData && existingThuKhoData.length > 0) {
      for (const item of existingThuKhoData) {
        const match = String(item.maNV || '').match(/\d+/)
        if (match) {
          const num = parseInt(match[0], 10)
          if (num > maxNum && num < 4000000) {
            maxNum = num
          }
        }
      }
    }
    return String(maxNum + 1)
  }, [existingThuKhoData])

  // Filtered candidates
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (q) {
        const matchName = (c.hoTen || '').toLowerCase().includes(q)
        const matchPhone = (c.soDienThoai || '').includes(q)
        const matchEmail = (c.email || '').toLowerCase().includes(q)
        const matchSkill = (c.kyNang || '').toLowerCase().includes(q)
        const matchMa = (c.maNV || '').toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchEmail && !matchSkill && !matchMa) return false
      }

      if (chucVuFilter && c.chucVu !== chucVuFilter) return false
      if (duAnFilter && c.duAn !== duAnFilter) return false
      if (trangThaiFilter && c.trangThai !== trangThaiFilter) return false

      return true
    })
  }, [candidates, search, chucVuFilter, duAnFilter, trangThaiFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSafe, pageSize])

  // Unique lists for filter dropdowns & position options - chuẩn xác theo Cài đặt Chức vụ
  const uniquePositions = useMemo(() => {
    const fromCustom = (customPositions || [])
      .filter(p => p.trang_thai !== 'Tạm ngưng')
      .map(p => (typeof p === 'string' ? p : p?.ten_chuc_vu)?.trim())
      .filter(Boolean)
    if (fromCustom.length > 0) return fromCustom
    return DEFAULT_CHUC_VU_LIST.map(p => p.ten_chuc_vu)
  }, [customPositions])

  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(candidates.map(c => c.duAn).filter(Boolean))).sort()
  }, [candidates])

  // Open recruitment modal
  const handleOpenRecruitModal = (candidate) => {
    setRecruitingCandidate(candidate)
    setCustomMaNVInput(inlineMaNVInputs[candidate.id] || suggestedNextMaNV)
    setSelectedOfficialKhoi(candidate.banChuoiKhoi || candidate.khoiThiCong || 'Khối Thi công')
    setSelectedOfficialDuAn(candidate.duAn || (availableProjects[0] || 'Chưa phân bổ'))
    const validChucVu = uniquePositions.includes(candidate.chucVu) ? candidate.chucVu : (uniquePositions[0] || 'Thủ kho')
    setSelectedOfficialChucVu(validChucVu)
  }

  // Execute recruitment confirmation
  const handleConfirmRecruitment = async () => {
    if (!recruitingCandidate) return
    const maNV = (customMaNVInput || '').trim()

    if (!maNV) {
      showAlert('Vui lòng nhập Mã nhân viên để hoàn tất tuyển dụng.', 'warning', 'Thiếu thông tin')
      return
    }

    // Check if code already exists in official storekeeper list
    const duplicate = existingThuKhoData.some(
      item => String(item.maNV || '').trim().toLowerCase() === maNV.toLowerCase()
    )
    if (duplicate) {
      showAlert(`Mã nhân viên "${maNV}" đã tồn tại trong Danh sách thủ kho. Vui lòng chọn mã khác!`, 'error', 'Trùng mã nhân viên')
      return
    }

    try {
      // 1. Update candidate state in recruitment list
      const updatedCandidates = candidates.map(c => {
        if (c.id === recruitingCandidate.id) {
          return {
            ...c,
            maNV: maNV,
            banChuoiKhoi: selectedOfficialKhoi || c.banChuoiKhoi || 'Khối Thi công',
            khoiThiCong: selectedOfficialKhoi || c.khoiThiCong || 'Khối Thi công',
            trangThai: 'Đã tuyển dụng',
            duAn: selectedOfficialDuAn || c.duAn,
            chucVu: selectedOfficialChucVu || c.chucVu,
            ngayTuyenDung: new Date().toISOString().split('T')[0]
          }
        }
        return c
      })
      setCandidates(updatedCandidates)

      const recruitedCandidate = {
        ...recruitingCandidate,
        maNV: maNV,
        banChuoiKhoi: selectedOfficialKhoi || recruitingCandidate.banChuoiKhoi || 'Khối Thi công',
        khoiThiCong: selectedOfficialKhoi || recruitingCandidate.khoiThiCong || 'Khối Thi công',
        duAn: selectedOfficialDuAn,
        chucVu: selectedOfficialChucVu
      }

      setRecruitingCandidate(null)
      setSelectedCandidate(null)

      // Cập nhật trạng thái ứng viên trên Supabase nếu đã kết nối
      if (supabaseCandidateStatus === 'connected') {
        try {
          await supabase
            .from('sgc_tuyen_dung_ung_vien')
            .update({
              trang_thai: 'Đã tuyển dụng',
              ma_nv: maNV,
              du_an: selectedOfficialDuAn || recruitingCandidate.duAn,
              chuc_vu: selectedOfficialChucVu || recruitingCandidate.chucVu
            })
            .eq('id', recruitingCandidate.id)
        } catch (dbErr) {
          console.warn('Lỗi cập nhật Supabase tuyển dụng:', dbErr)
        }
      }

      // 2. Call parent to insert into Supabase / storekeeper data and automatically jump to DanhSachTab!
      if (onRecruitSuccess) {
        await onRecruitSuccess(recruitedCandidate, maNV, selectedOfficialDuAn, selectedOfficialChucVu, selectedOfficialKhoi)
      }
    } catch (err) {
      console.error('Lỗi khi thực hiện tuyển dụng:', err)
      showAlert('Có lỗi khi lưu thông tin tuyển dụng: ' + err.message, 'error', 'Lỗi tuyển dụng')
    }
  }

  // Quick inline recruit trigger from table
  const handleQuickInlineRecruit = (candidate) => {
    const enteredCode = (inlineMaNVInputs[candidate.id] || '').trim()
    if (!enteredCode) {
      handleOpenRecruitModal(candidate)
      return
    }
    setRecruitingCandidate(candidate)
    setCustomMaNVInput(enteredCode)
    setSelectedOfficialDuAn(candidate.duAn || (availableProjects[0] || 'Chưa phân bổ'))
    setSelectedOfficialChucVu(candidate.chucVu || 'Thủ kho')
  }

  // Delete candidate
  const handleDeleteCandidate = (candidate) => {
    setAlertConfig({
      type: 'confirm',
      severity: 'error',
      title: 'XÁC NHẬN XÓA ỨNG VIÊN',
      message: `Bạn có chắc chắn muốn xóa hồ sơ ứng viên:\n${candidate.hoTen}\nToàn bộ thông tin CV và phân tích AI sẽ bị gỡ bỏ.\nHành động này không thể hoàn tác.`,
      onConfirm: async () => {
        setCandidates(prev => {
          const next = prev.filter(c => c.id !== candidate.id)
          try {
            const lightweight = next.map(c => {
              const { fileDataUrl, ...rest } = c
              return rest
            })
            localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
          } catch (e) {
            console.warn('Lỗi lưu localStorage khi xóa:', e)
          }
          return next
        })
        removeCandidatePdf(candidate.id)
        setAlertConfig(null)
        if (supabaseCandidateStatus === 'connected') {
          try {
            await supabase.from('sgc_tuyen_dung_ung_vien').delete().eq('id', candidate.id)
          } catch (dbErr) {
            console.warn('Lỗi xóa ứng viên trên Supabase:', dbErr)
          }
        }
      },
      onCancel: () => setAlertConfig(null)
    })
  }

  // Export recruitment list to Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Danh sách Tuyển dụng')

      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã NV', key: 'maNV', width: 14 },
        { header: 'Họ và tên', key: 'hoTen', width: 26 },
        { header: 'Trạng thái tuyển dụng', key: 'trangThai', width: 22 },
        { header: 'Vị trí ứng tuyển', key: 'chucVu', width: 20 },
        { header: 'Dự án đề xuất', key: 'duAn', width: 30 },
        { header: 'Điện thoại', key: 'soDienThoai', width: 18 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Năm sinh', key: 'ngaySinh', width: 14 },
        { header: 'Kinh nghiệm (năm)', key: 'soNamKinhNghiem', width: 16 },
        { header: 'Trình độ', key: 'trinhDo', width: 16 },
        { header: 'Điểm AI (/10)', key: 'diemPhuHop', width: 14 },
        { header: 'Đánh giá AI', key: 'aiDanhGia', width: 45 }
      ]

      const headerRow = worksheet.getRow(1)
      headerRow.height = 30
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F58A7' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      filtered.forEach((c, idx) => {
        worksheet.addRow({
          stt: idx + 1,
          maNV: c.maNV || '—',
          hoTen: c.hoTen,
          trangThai: c.trangThai,
          chucVu: c.chucVu,
          duAn: c.duAn || '—',
          soDienThoai: c.soDienThoai,
          email: c.email,
          ngaySinh: c.ngaySinh || '—',
          soNamKinhNghiem: c.soNamKinhNghiem || 0,
          trinhDo: c.trinhDo,
          diemPhuHop: c.diemPhuHop || '—',
          aiDanhGia: c.aiDanhGia || ''
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SGC_Danh_Sach_Tuyen_Dung_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      showAlert('Lỗi khi xuất file Excel: ' + e.message, 'error', 'Lỗi xuất Excel')
    }
  }

  // Quick stats counts
  const stats = useMemo(() => {
    return {
      total: candidates.length,
      cvReceived: candidates.filter(c => c.trangThai === 'Tiếp nhận CV').length,
      interviewing: candidates.filter(c => c.trangThai === 'Đang phỏng vấn').length,
      qualified: candidates.filter(c => c.trangThai === 'Đạt - Chờ cấp mã NV').length,
      recruited: candidates.filter(c => c.trangThai === 'Đã tuyển dụng' || Boolean(c.maNV)).length,
      rejected: candidates.filter(c => c.trangThai === 'Không đạt').length
    }
  }, [candidates])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, padding: '20px 24px', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* Hàng 1: Thanh công cụ Lọc & Tác vụ chính */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Tìm kiếm */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 300, height: '40px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36, paddingRight: search ? 32 : 12, width: '100%', height: '40px', borderRadius: 10, boxSizing: 'border-box' }}
            placeholder="Tìm ứng viên, SĐT, vị trí, kỹ năng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Lọc vị trí */}
        <select 
          className="input" 
          style={{ minWidth: 150, height: '40px', padding: '0 12px', borderRadius: 10, cursor: 'pointer', boxSizing: 'border-box' }}
          value={chucVuFilter} 
          onChange={e => setChucVuFilter(e.target.value)}
        >
          <option value="">Tất cả vị trí</option>
          {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Nút tác vụ */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Nút Quét CV bằng AI */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{
              background: 'linear-gradient(135deg, #0f58a7 0%, #1d6ef3 100%)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              padding: '0 16px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 2px 6px rgba(15, 88, 167, 0.25)',
              whiteSpace: 'nowrap'
            }}
            title="Tải lên CV (PDF, Word) để AI tự động quét và phân tích dữ liệu"
          >
            <Sparkles size={16} style={{ color: '#fef08a' }} />
            <span>Quét CV bằng AI (PDF / Word)</span>
          </button>

          {/* Nút Cài đặt Chức vụ (Đúng vị trí yêu cầu trong hình) */}
          <button
            type="button"
            onClick={() => setShowChucVuModal(true)}
            style={{
              background: '#ffffff',
              color: '#0f58a7',
              border: '1.5px solid #0f58a7',
              fontWeight: 600,
              fontSize: '14px',
              padding: '0 16px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(15, 88, 167, 0.12)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f0f7ff'
              e.currentTarget.style.borderColor = '#004085'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#0f58a7'
            }}
            title="Cài đặt danh mục chức vụ, tạo mới, chỉnh sửa và đồng bộ trên Supabase"
          >
            <Briefcase size={16} style={{ color: '#0f58a7' }} />
            <span>Cài đặt Chức vụ</span>
          </button>

          {/* Nút Cài đặt API Key (Gemini / GitHub) */}
          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            style={{
              background: '#ffffff',
              color: '#0f58a7',
              border: '1.5px solid #0f58a7',
              fontWeight: 600,
              fontSize: '14px',
              padding: '0 16px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(15, 88, 167, 0.12)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f0f7ff'
              e.currentTarget.style.borderColor = '#004085'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.borderColor = '#0f58a7'
            }}
            title="Cài đặt Gemini API Key, GitHub Token và các cấu hình bí mật, lưu trữ trên Supabase"
          >
            <KeyRound size={16} style={{ color: '#0f58a7' }} />
            <span>Cài đặt API Key</span>
          </button>

        </div>

        <div style={{ flex: 1 }} />

        {/* Số lượng và Nút Xuất Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {filtered.length} / {candidates.length} hồ sơ
          </span>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportExcel}
            style={{
              background: '#059669',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              padding: '0 16px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={16} />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Hàng 2: Các thẻ Pipeline Tuyển dụng dạng Tab/Chip tương tác */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        background: '#ffffff',
        padding: '8px 14px',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f58a7', fontSize: 13, marginRight: 4 }}>
          <Layers size={16} />
          <span>Pipeline Tuyển dụng:</span>
        </div>

        {/* Thẻ: Tổng hồ sơ */}
        <button
          type="button"
          onClick={() => setTrangThaiFilter('')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: !trangThaiFilter ? 700 : 500,
            cursor: 'pointer',
            border: !trangThaiFilter ? '1.5px solid #0f58a7' : '1px solid #e2e8f0',
            background: !trangThaiFilter ? '#0f58a7' : '#f8fafc',
            color: !trangThaiFilter ? '#ffffff' : '#334155',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={14} />
          <span>Tổng hồ sơ:</span>
          <span style={{
            background: !trangThaiFilter ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
            color: !trangThaiFilter ? '#ffffff' : '#0f172a',
            padding: '1px 7px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700
          }}>
            {stats.total}
          </span>
        </button>

        {/* Thẻ: Tiếp nhận CV */}
        <button
          type="button"
          onClick={() => setTrangThaiFilter(trangThaiFilter === 'Tiếp nhận CV' ? '' : 'Tiếp nhận CV')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: trangThaiFilter === 'Tiếp nhận CV' ? 700 : 500,
            cursor: 'pointer',
            border: trangThaiFilter === 'Tiếp nhận CV' ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
            background: trangThaiFilter === 'Tiếp nhận CV' ? '#eff6ff' : '#ffffff',
            color: '#1d4ed8',
            boxShadow: trangThaiFilter === 'Tiếp nhận CV' ? '0 0 0 1px #2563eb' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={14} />
          <span>Tiếp nhận CV:</span>
          <span style={{
            background: '#dbeafe',
            color: '#1e40af',
            padding: '1px 7px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700
          }}>
            {stats.cvReceived}
          </span>
        </button>

        {/* Thẻ: Đang phỏng vấn */}
        <button
          type="button"
          onClick={() => setTrangThaiFilter(trangThaiFilter === 'Đang phỏng vấn' ? '' : 'Đang phỏng vấn')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: trangThaiFilter === 'Đang phỏng vấn' ? 700 : 500,
            cursor: 'pointer',
            border: trangThaiFilter === 'Đang phỏng vấn' ? '1.5px solid #d97706' : '1px solid #fde68a',
            background: trangThaiFilter === 'Đang phỏng vấn' ? '#fffbeb' : '#ffffff',
            color: '#b45309',
            boxShadow: trangThaiFilter === 'Đang phỏng vấn' ? '0 0 0 1px #d97706' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={14} />
          <span>Đang phỏng vấn:</span>
          <span style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '1px 7px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700
          }}>
            {stats.interviewing}
          </span>
        </button>

        {/* Thẻ: Đạt - Chờ cấp mã NV */}
        <button
          type="button"
          onClick={() => setTrangThaiFilter(trangThaiFilter === 'Đạt - Chờ cấp mã NV' ? '' : 'Đạt - Chờ cấp mã NV')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: trangThaiFilter === 'Đạt - Chờ cấp mã NV' ? 700 : 500,
            cursor: 'pointer',
            border: trangThaiFilter === 'Đạt - Chờ cấp mã NV' ? '1.5px solid #9333ea' : '1px solid #e9d5ff',
            background: trangThaiFilter === 'Đạt - Chờ cấp mã NV' ? '#faf5ff' : '#ffffff',
            color: '#7e22ce',
            boxShadow: trangThaiFilter === 'Đạt - Chờ cấp mã NV' ? '0 0 0 1px #9333ea' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Target size={14} />
          <span>Đạt - Chờ cấp mã NV:</span>
          <span style={{
            background: '#f3e8ff',
            color: '#6b21a8',
            padding: '1px 7px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700
          }}>
            {stats.qualified}
          </span>
        </button>

        {/* Thẻ: Đã tuyển dụng (Vào DS Thủ kho) */}
        <button
          type="button"
          onClick={() => setTrangThaiFilter(trangThaiFilter === 'Đã tuyển dụng' ? '' : 'Đã tuyển dụng')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: trangThaiFilter === 'Đã tuyển dụng' ? 700 : 500,
            cursor: 'pointer',
            border: trangThaiFilter === 'Đã tuyển dụng' ? '1.5px solid #16a34a' : '1px solid #bbf7d0',
            background: trangThaiFilter === 'Đã tuyển dụng' ? '#f0fdf4' : '#ffffff',
            color: '#15803d',
            boxShadow: trangThaiFilter === 'Đã tuyển dụng' ? '0 0 0 1px #16a34a' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <CheckCircle size={14} />
          <span>Đã tuyển dụng (Vào DS Thủ kho):</span>
          <span style={{
            background: '#dcfce7',
            color: '#14532d',
            padding: '1px 7px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700
          }}>
            {stats.recruited}
          </span>
        </button>

        {/* Thẻ: Không đạt */}
        {stats.rejected > 0 && (
          <button
            type="button"
            onClick={() => setTrangThaiFilter(trangThaiFilter === 'Không đạt' ? '' : 'Không đạt')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: trangThaiFilter === 'Không đạt' ? 700 : 500,
              cursor: 'pointer',
              border: trangThaiFilter === 'Không đạt' ? '1.5px solid #dc2626' : '1px solid #fecdd3',
              background: trangThaiFilter === 'Không đạt' ? '#fff1f2' : '#ffffff',
              color: '#be123c',
              boxShadow: trangThaiFilter === 'Không đạt' ? '0 0 0 1px #dc2626' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <XCircle size={14} />
            <span>Không đạt:</span>
            <span style={{
              background: '#ffe4e6',
              color: '#9f1239',
              padding: '1px 7px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700
            }}>
              {stats.rejected}
            </span>
          </button>
        )}

        {/* Hint & Nút hủy lọc trạng thái nếu đang active */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {trangThaiFilter && (
            <button
              type="button"
              onClick={() => setTrangThaiFilter('')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                fontSize: 12,
                color: '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Bỏ lọc trạng thái
            </button>
          )}
          <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
            💡 Nhấp đúp vào dòng để xem chi tiết
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 40, textAlign: 'center' }}>STT</th>
              <th style={{ minWidth: 210 }}>Họ và tên ứng viên</th>
              <th style={{ minWidth: 155, textAlign: 'center' }}>Trạng thái tuyển dụng</th>
              <th style={{ minWidth: 150 }}>Vị trí ứng tuyển</th>
              <th style={{ minWidth: 135, textAlign: 'center' }}>Điện thoại</th>
              <th style={{ minWidth: 170 }}>Email</th>
              <th style={{ minWidth: 105, textAlign: 'center' }}>Ngày sinh</th>
              <th style={{ minWidth: 130 }}>Trình độ</th>
              <th style={{ minWidth: 100, textAlign: 'center' }}>Kinh nghiệm</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <FileText size={40} style={{ color: '#cbd5e1' }} />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Không tìm thấy hồ sơ tuyển dụng nào</span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Hãy tải lên tệp CV (PDF, Word) để AI tự động quét dữ liệu</span>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 18px',
                        borderRadius: 8,
                        background: '#0f58a7',
                        color: '#ffffff',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Sparkles size={15} /> Quét CV ngay
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((c, index) => {
                const isRecruited = Boolean(c.maNV) || c.trangThai === 'Đã tuyển dụng'

                return (
                  <tr 
                    key={c.id || index}
                    onDoubleClick={() => setSelectedCandidate(c)}
                    title="Nhấp đúp chuột để xem chi tiết hồ sơ ứng viên"
                    style={{ 
                      background: isRecruited ? 'rgba(240, 253, 244, 0.65)' : undefined,
                      cursor: 'pointer'
                    }}
                  >
                    {/* STT */}
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                      {(pageSafe - 1) * pageSize + index + 1}
                    </td>

                    {/* Họ và tên */}
                    <td>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        onClick={() => setSelectedCandidate(c)}
                        title="Xem chi tiết hồ sơ & phân tích AI"
                      >
                        <div 
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: avatarColor(c.hoTen || 'U'),
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12.5,
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {initials(c.hoTen || 'U')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f58a7', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{c.hoTen}</span>
                            {c.isParsedWithAI && (
                              <span 
                                title="Hồ sơ được quét và phân tích bằng Gemini AI"
                                style={{
                                  fontSize: 10,
                                  background: 'linear-gradient(135deg, #ede9fe, #dbeafe)',
                                  color: '#6d28d9',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <Sparkles size={10} /> AI
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Trạng thái tuyển dụng */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${tuyenDungBadgeClass(c.trangThai)}`} style={{ fontWeight: 700, fontSize: 11.5 }}>
                        {c.trangThai}
                      </span>
                    </td>

                    {/* Vị trí ứng tuyển */}
                    <td>
                      <span className={`badge ${chucVuBadgeClass(c.chucVu)}`} style={{ fontWeight: 600 }}>
                        {c.chucVu}
                      </span>
                    </td>

                    {/* SĐT */}
                    <td style={{ textAlign: 'center' }}>
                      <a 
                        href={`tel:${c.soDienThoai}`} 
                        style={{ color: '#0f58a7', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Phone size={13} style={{ color: '#059669' }} />
                        <span>{c.soDienThoai}</span>
                      </a>
                    </td>

                    {/* Email */}
                    <td>
                      <a 
                        href={`mailto:${c.email}`} 
                        style={{ color: '#475569', textDecoration: 'none', fontSize: 12.5 }}
                      >
                        {c.email}
                      </a>
                    </td>

                    {/* Ngày sinh */}
                    <td style={{ textAlign: 'center', fontSize: 12.5, color: '#475569' }}>
                      {formatDate(c.ngaySinh)}
                    </td>

                    {/* Trình độ */}
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{c.trinhDo}</div>
                      {c.chuyenNganh && <div style={{ fontSize: 11, color: '#64748b' }}>{c.chuyenNganh}</div>}
                    </td>

                    {/* Kinh nghiệm */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: (c.soNamKinhNghiem >= 3) ? '#059669' : '#d97706',
                        background: (c.soNamKinhNghiem >= 3) ? '#ecfdf5' : '#fffbeb',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 12
                      }}>
                        {c.soNamKinhNghiem ? `${c.soNamKinhNghiem} năm` : '1 năm'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>Hiển thị</span>
          <select className="input btn-sm" style={{ padding: '4px 10px' }} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>hồ sơ / trang · {filtered.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} / {filtered.length}</span>
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            title="Xem hướng dẫn cấu hình bảng Supabase Cloud"
            style={{
              background: 'transparent',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Database size={11} />
            <span>Mã SQL Supabase</span>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-outline btn-sm" disabled={pageSafe <= 1} style={{ opacity: pageSafe <= 1 ? 0.5 : 1 }} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '0 6px' }}>Trang {pageSafe} / {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={pageSafe >= totalPages} style={{ opacity: pageSafe >= totalPages ? 0.5 : 1 }} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Sau</button>
        </div>
      </div>

      {/* AI CV Upload Modal */}
      {showUploadModal && (
        <AICVUploadModal
          onClose={() => setShowUploadModal(false)}
          positionsList={uniquePositions}
          projectsList={availableProjects}
          onAddCandidates={async (newItems, shouldCloseModal = true) => {
            if (!newItems || newItems.length === 0) return

            setCandidates(prev => {
              const existingMap = new Map()
              prev.forEach(item => existingMap.set(item.id, item))
              newItems.forEach(item => existingMap.set(item.id, item))
              const updated = Array.from(existingMap.values())
              try {
                const lightweight = updated.map(c => {
                  const { fileDataUrl, ...rest } = c
                  return rest
                })
                localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
              } catch (e) {
                console.warn('Lỗi lưu candidates vào localStorage:', e)
              }
              return updated
            })

            if (shouldCloseModal) {
              setShowUploadModal(false)
              showAlert(`Đã lưu thành công ${newItems.length} hồ sơ CV vào danh sách tuyển dụng!`, 'success', 'Quét CV Thành Công')
            }

            if (supabaseCandidateStatus === 'connected') {
              try {
                const rows = newItems.map(mapCandidateToDb)
                await supabase.from('sgc_tuyen_dung_ung_vien').upsert(rows)
              } catch (dbErr) {
                console.warn('Lỗi lưu ứng viên lên Supabase:', dbErr)
              }
            }
          }}
        />
      )}

      {/* Recruitment Confirmation Modal (Điền mã nhân viên để chuyển sang DS thủ kho) */}
      {recruitingCandidate && (
        <RecruitConfirmModal
          candidate={recruitingCandidate}
          suggestedMaNV={customMaNVInput || suggestedNextMaNV}
          selectedKhoi={selectedOfficialKhoi}
          onChangeKhoi={setSelectedOfficialKhoi}
          blocksList={BAN_CHUOI_KHOI_LIST}
          selectedDuAn={selectedOfficialDuAn}
          onChangeDuAn={setSelectedOfficialDuAn}
          selectedChucVu={selectedOfficialChucVu}
          onChangeChucVu={setSelectedOfficialChucVu}
          positionsList={uniquePositions}
          projectsList={availableProjects}
          maNV={customMaNVInput}
          onChangeMaNV={setCustomMaNVInput}
          onConfirm={handleConfirmRecruitment}
          onCancel={() => setRecruitingCandidate(null)}
        />
      )}

      {/* Modal Cài đặt Chức vụ */}
      <CaiDatChucVuModal
        isOpen={showChucVuModal}
        onClose={() => setShowChucVuModal(false)}
        onPositionsUpdated={(updated) => setCustomPositions(updated)}
        candidateCountByPosition={candidateCountByPosition}
        onChucVuRenamed={handleChucVuRenamed}
        onReload={onReload}
      />

      {/* Modal Cài đặt API Key */}
      <CaiDatApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      {/* Candidate Details Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          positionsList={uniquePositions}
          projectsList={availableProjects}
          onClose={() => setSelectedCandidate(null)}
          onStartRecruit={() => {
            const cand = selectedCandidate
            handleOpenRecruitModal(cand)
          }}
          onNavigateToStorekeeper={onNavigateToStorekeeper}
          onEdit={(cand) => {
            setEditingCandidate({ ...cand })
          }}
          onDelete={(cand) => {
            setSelectedCandidate(null)
            handleDeleteCandidate(cand)
          }}
          onUpdateCandidate={async (updated) => {
            setCandidates(prev => {
              const exists = prev.some(c => c.id === updated.id)
              const next = exists ? prev.map(c => c.id === updated.id ? updated : c) : [updated, ...prev]
              try {
                const lightweight = next.map(c => {
                  const { fileDataUrl, ...rest } = c
                  return rest
                })
                localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
              } catch (e) {
                console.warn('Lỗi lưu candidates vào localStorage:', e)
              }
              return next
            })
            setSelectedCandidate(updated)
            if (supabaseCandidateStatus === 'connected') {
              try {
                await supabase.from('sgc_tuyen_dung_ung_vien').upsert(mapCandidateToDb(updated))
              } catch (dbErr) {
                console.warn('Lỗi cập nhật ứng viên lên Supabase:', dbErr)
              }
            }
          }}
        />
      )}

      {/* Edit / Manual Add Candidate Modal */}
      {editingCandidate && (
        <EditCandidateModal
          candidate={editingCandidate}
          positionsList={uniquePositions}
          projectsList={availableProjects}
          onClose={() => setEditingCandidate(null)}
          onSave={async (saved) => {
            if (saved.isNew) {
              const maxStt = candidates.reduce((max, c) => Math.max(max, Number(c.stt) || 0), 0)
              const newCand = {
                ...saved,
                id: 'cand-' + Date.now(),
                stt: maxStt + 1,
                isNew: false
              }
              setCandidates(prev => {
                const next = [newCand, ...prev]
                try {
                  const lightweight = next.map(c => { const { fileDataUrl, ...rest } = c; return rest })
                  localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
                } catch (e) {}
                return next
              })
              showAlert(`Đã thêm ứng viên ${saved.hoTen} vào danh sách tuyển dụng.`, 'success', 'Thêm thành công')
              if (supabaseCandidateStatus === 'connected') {
                try {
                  await supabase.from('sgc_tuyen_dung_ung_vien').insert([mapCandidateToDb(newCand)])
                } catch (dbErr) {
                  console.warn('Lỗi thêm ứng viên vào Supabase:', dbErr)
                }
              }
            } else {
              setCandidates(prev => {
                const next = prev.map(c => c.id === saved.id ? saved : c)
                try {
                  const lightweight = next.map(c => { const { fileDataUrl, ...rest } = c; return rest })
                  localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(lightweight))
                } catch (e) {}
                return next
              })
              setSelectedCandidate(saved)
              showAlert(`Đã cập nhật thông tin ứng viên ${saved.hoTen}.`, 'success', 'Cập nhật thành công')
              if (supabaseCandidateStatus === 'connected') {
                try {
                  await supabase.from('sgc_tuyen_dung_ung_vien').upsert(mapCandidateToDb(saved))
                } catch (dbErr) {
                  console.warn('Lỗi cập nhật ứng viên lên Supabase:', dbErr)
                }
              }
            }
            setEditingCandidate(null)
          }}
        />
      )}

      {/* Modal hướng dẫn tạo bảng Supabase */}
      {showSqlModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 99999, padding: 16
        }}>
          <div style={{
            width: 720, maxWidth: '100%', maxHeight: '90vh', background: '#ffffff',
            borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)'
          }}>
            <div style={{
              padding: '16px 20px', background: '#0f58a7', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={20} />
                <span style={{ fontSize: 16, fontWeight: 700 }}>MÃ SQL TẠO BẢNG TUYỂN DỤNG TRÊN SUPABASE</span>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
                Để ứng viên tuyển dụng được <strong>liên thông 100% trên Cloud Supabase</strong> (thay vì chỉ lưu bộ nhớ máy), bạn chỉ cần mở <strong>SQL Editor</strong> trên Supabase Dashboard và dán mã SQL bên dưới rồi ấn <strong>Run</strong>:
              </p>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: '#0f172a', color: '#e2e8f0', padding: '14px 16px',
                  borderRadius: 10, fontSize: 12, fontFamily: 'monospace',
                  maxHeight: 280, overflowY: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
                  {SQL_CODE_TUYEN_DUNG}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_CODE_TUYEN_DUNG)
                    setCopiedSql(true)
                    setTimeout(() => setCopiedSql(false), 2500)
                  }}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: copiedSql ? '#059669' : '#1e293b',
                    color: '#fff', border: '1px solid #334155',
                    padding: '6px 12px', borderRadius: 6, fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                  }}
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã'}</span>
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#475569' }}>
                💡 <strong>Sau khi chạy SQL xong:</strong> Nhấn nút <strong>"Kiểm tra lại kết nối"</strong> bên dưới để ứng dụng lập tức nhận diện bảng và kích hoạt luồng đồng bộ thời gian thực!
              </div>
            </div>

            <div style={{
              padding: '12px 20px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'flex-end', gap: 10
            }}>
              <button
                onClick={() => setShowSqlModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Đóng
              </button>
              <button
                onClick={async () => {
                  await loadCandidatesFromSupabase()
                  setShowSqlModal(false)
                  showAlert('Đã kiểm tra lại kết nối Supabase!', 'info')
                }}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#0f58a7', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RefreshCw size={14} />
                <span>Kiểm tra lại kết nối</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global alert */}
      {alertConfig && <CustomAlert {...alertConfig} />}
    </div>
  )
}

// -------------------------------------------------------------
// AI CV Upload Modal Component
// Supports uploading multiple PDF, Word (.docx, .doc), text, images
// Automatically scans immediately upon file upload/drop with Gemini 3.8 Flash
// -------------------------------------------------------------
function AICVUploadModal({ onClose, onAddCandidates, positionsList = [], projectsList = [] }) {
  const [dragActive, setDragActive] = useState(false)
  const [fileQueue, setFileQueue] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [scannedResults, setScannedResults] = useState([])
  const [scanProgress, setScanProgress] = useState(0)
  const fileInputRef = useRef(null)

  const handleModalClose = () => {
    if (scannedResults.length > 0 && onAddCandidates) {
      onAddCandidates(scannedResults, true)
    } else {
      onClose()
    }
  }

  useEscapeKey(handleModalClose, true)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files))
    }
    // Reset file input so user can re-select same file if needed
    e.target.value = ''
  }

  // Tự động quét luôn ngay khi tải tệp lên
  const handleFilesSelected = (files) => {
    const valid = files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg'].includes(ext)
    })
    if (valid.length === 0) {
      alert('Vui lòng chọn các tệp định dạng PDF, Word (.docx, .doc), TXT hoặc ảnh.')
      return
    }

    const newItems = valid.map((f, i) => ({
      id: 'file-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substring(2, 6),
      file: f,
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      status: 'pending' // pending | scanning | success | error
    }))

    setFileQueue(prev => [...prev, ...newItems])
    // Tự động kích hoạt quét ngay lập tức
    autoScanFiles(newItems)
  }

  // Scan files with AI automatically
  const autoScanFiles = async (itemsToScan) => {
    if (!itemsToScan || itemsToScan.length === 0) return
    setIsScanning(true)
    setScanProgress(0)

    // Chuẩn hóa danh sách chức vụ theo Cài đặt Chức vụ
    const cleanPositions = (positionsList || [])
      .map(p => (typeof p === 'string' ? p : p?.ten_chuc_vu)?.trim())
      .filter(Boolean)
    const fallbackPosition = cleanPositions[0] || 'Thủ kho hiện trường'

    const newResults = []
    for (let i = 0; i < itemsToScan.length; i++) {
      const item = itemsToScan[i]
      item.status = 'scanning'
      setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'scanning' } : f))

      try {
        // Read file as base64
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(item.file)
        })

        // Call backend /api/parse-cv
        const response = await fetch(apiUrl('/api/parse-cv'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            mimeType: item.file.type || 'application/pdf',
            base64Data: base64Data
          })
        })

        const resJson = await response.json()
        if (resJson.success && resJson.data) {
          item.status = 'success'
          const data = resJson.data
          const candId = 'cand-' + Date.now() + '-' + i

          // Lưu PDF / tệp gốc vào IndexedDB
          await saveCandidatePdf(candId, base64Data)
          await saveOriginalCandidatePdf(candId, base64Data)

          // 1. Tự động lưu tệp CV vào kho GitHub (ceohomes/CV-TQT / cvs) để tránh tăng dung lượng Supabase
          let ghUploadResult = null
          try {
            const ghRes = await fetch(apiUrl('/api/upload-cv-github'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.name,
                base64Data: base64Data,
                candidateName: data.hoTen || item.name
              })
            })
            if (ghRes.ok) {
              ghUploadResult = await ghRes.json()
            }
          } catch (ghErr) {
            console.warn('Lỗi tự động tải CV lên GitHub:', ghErr)
          }

          const finalFileName = ghUploadResult?.fileName || item.name
          const finalFileUrl = ghUploadResult?.downloadUrl || ''
          const finalGithubUrl = ghUploadResult?.htmlUrl || ''

          // Khớp chức vụ với danh sách Cài đặt Chức vụ
          let matchedChucVu = fallbackPosition
          if (data.chucVu && cleanPositions.length > 0) {
            const raw = data.chucVu.toLowerCase()
            const found = cleanPositions.find(pos => {
              const pLower = pos.toLowerCase()
              return pLower === raw || raw.includes(pLower) || pLower.includes(raw)
            })
            if (found) matchedChucVu = found
          }

          const candidateObj = {
            id: candId,
            hoTen: data.hoTen || item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            soDienThoai: data.soDienThoai || '',
            email: data.email || '',
            ngaySinh: data.ngaySinh || '',
            gioiTinh: data.gioiTinh || 'Nam',
            cccd: data.cccd || '',
            queQuan: data.queQuan || '',
            diaChi: data.diaChi || '',
            chucVu: matchedChucVu,
            duAn: data.duAn || (projectsList[0] || 'Chưa phân bổ'),
            trinhDo: data.trinhDo || 'Đại học',
            chuyenNganh: data.chuyenNganh || '',
            soNamKinhNghiem: data.soNamKinhNghiem ? Number(data.soNamKinhNghiem) : 2,
            kinhNghiem: data.kinhNghiem || '',
            kyNang: data.kyNang || '',
            chungChi: data.chungChi || '',
            aiDanhGia: data.aiDanhGia || 'Hồ sơ đã được quét và trích xuất thành công.',
            diemPhuHop: data.diemPhuHop ? Number(data.diemPhuHop) : 8.0,
            trangThai: 'Tiếp nhận CV',
            maNV: '',
            fileName: finalFileName,
            fileUrl: finalFileUrl,
            githubUrl: finalGithubUrl,
            fileDataUrl: base64Data,
            ngayUngTuyen: new Date().toISOString().split('T')[0],
            isParsedWithAI: true
          }

          newResults.push(candidateObj)
          setFileQueue(prev => prev.map(f => f.id === item.id ? { 
            ...f, 
            status: 'success',
            githubSaved: !!ghUploadResult?.success,
            githubFileName: finalFileName,
            githubUrl: finalGithubUrl
          } : f))
        } else {
          item.status = 'error'
          setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f))
        }
      } catch (err) {
        console.error('Error scanning file:', err)
        item.status = 'error'
        setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f))
      }

      setScanProgress(Math.round(((i + 1) / itemsToScan.length) * 100))
    }

    if (newResults.length > 0) {
      setScannedResults(prev => [...prev, ...newResults])
      // Tự động lưu ngay vào danh sách tuyển dụng để không bao giờ bị mất dữ liệu
      if (onAddCandidates) {
        onAddCandidates(newResults, false)
      }
    }
    setIsScanning(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10050, padding: 16,
      fontFamily: "'Roboto', sans-serif"
    }}>
      <div style={{
        width: 780, maxWidth: '100%', maxHeight: '90vh', background: '#ffffff',
        borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Roboto', sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px', background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)',
          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={20} color="#fef08a" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em' }}>
                TẢI LÊN & QUÉT CV ỨNG VIÊN BẰNG AI
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, opacity: 0.85 }}>
                Tự động trích xuất Họ tên, SĐT, Email, Vị trí, Kinh nghiệm, Kỹ năng & Đánh giá phù hợp
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? '#2563eb' : '#cbd5e1'}`,
              borderRadius: 14,
              padding: '32px 20px',
              textAlign: 'center',
              backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf, .docx, .doc, .txt, image/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8'
              }}>
                <Upload size={24} />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  Kéo thả file CV vào đây hoặc bấm để chọn tệp (Tự động quét AI ngay)
                </span>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Hệ thống tự động phân tích và trích xuất thông tin hồ sơ ngay khi tải lên · Hỗ trợ: <b>PDF</b>, <b>Word</b>, <b>TXT</b>, <b>Ảnh</b>
                </p>
              </div>
            </div>
          </div>

          {/* Banner thông báo lưu trữ GitHub (Tránh tăng dung lượng Supabase) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: '#f0fdf4', border: '1.5px solid #86efac',
            color: '#166534', fontSize: 12.5
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🐙</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                Kho lưu trữ CV: <span style={{ color: '#0f58a7' }}>ceohomes/CV-TQT</span> &rsaquo; thư mục <span style={{ color: '#0f58a7' }}>cvs</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#15803d' }}>
                Sau khi AI quét trích xuất, tệp CV gốc được tự động đẩy lên thư mục <b>cvs</b> trên GitHub của bạn, giúp hệ thống không tốn dung lượng lưu trữ trên Supabase.
              </p>
            </div>
          </div>

          {/* Files in Queue */}
          {fileQueue.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                  Danh sách tệp chờ quét ({fileQueue.length}):
                </span>
                {!isScanning && scannedResults.length === 0 && (
                  <button
                    onClick={() => setFileQueue([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {fileQueue.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10, background: '#f1f5f9', border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={18} color="#0f58a7" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {item.size} {item.githubFileName && <span style={{ color: '#16a34a' }}>· 🐙 {item.githubFileName}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.status === 'pending' && (
                        <span style={{ fontSize: 12, color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: 6 }}>
                          Chờ quét
                        </span>
                      )}
                      {item.status === 'scanning' && (
                        <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RefreshCw size={12} className="spin-icon" /> Đang quét & tải lên GitHub...
                        </span>
                      )}
                      {item.status === 'success' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11.5, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={13} /> Đã quét & lưu GitHub
                          </span>
                        </div>
                      )}
                      {item.status === 'error' && (
                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Lỗi đọc tệp</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                <span>AI Gemini đang trích xuất dữ liệu từ hồ sơ...</span>
                <span>{scanProgress}%</span>
              </div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${scanProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          {/* Extracted Candidates Preview Cards */}
          {scannedResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} />
                <span>Kết quả trích xuất thành công ({scannedResults.length} ứng viên):</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' }}>
                {scannedResults.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #cbd5e1', borderRadius: 12, padding: '14px 16px',
                      background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#0f58a7' }}>{c.hoTen}</span>
                        <span className="badge badge-purple" style={{ fontSize: 11, fontWeight: 700 }}>{c.chucVu}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                        <Star size={12} fill="#22c55e" stroke="none" />
                        <span>{c.diemPhuHop}/10</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12.5, color: '#475569' }}>
                      <div>SĐT: <b>{c.soDienThoai || 'Chưa rõ'}</b></div>
                      <div>Email: <b>{c.email || 'Chưa rõ'}</b></div>
                      <div>Kinh nghiệm: <b>{c.soNamKinhNghiem} năm</b></div>
                    </div>

                    <div style={{ fontSize: 12, color: '#4338ca', background: '#eef2ff', padding: '6px 10px', borderRadius: 8 }}>
                      <b>AI Đánh giá:</b> {c.aiDanhGia}
                    </div>

                    {c.githubUrl && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 11.5, color: '#15803d', background: '#f0fdf4',
                        border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: 8
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🐙 Đã tải vào GitHub:</span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{c.fileName}</span>
                        </div>
                        <a
                          href={c.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: '#0f58a7', fontWeight: 700, textDecoration: 'none'
                          }}
                        >
                          <span>Xem trên GitHub</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
        }}>
          <button
            onClick={handleModalClose}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid #cbd5e1',
              background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Đóng
          </button>

          {isScanning ? (
            <button
              disabled
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                color: '#ffffff', fontWeight: 700, cursor: 'not-allowed', opacity: 0.95
              }}
            >
              <RefreshCw size={15} className="spin-icon" />
              <span>Đang tự động quét AI ({scanProgress}%)...</span>
            </button>
          ) : scannedResults.length > 0 ? (
            <button
              onClick={() => onAddCandidates(scannedResults, true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: '#059669', color: '#ffffff', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
              }}
            >
              <Check size={16} />
              <span>Lưu {scannedResults.length} ứng viên vào bảng tuyển dụng</span>
            </button>
          ) : fileQueue.some(f => f.status === 'error') ? (
            <button
              onClick={() => autoScanFiles(fileQueue.filter(f => f.status === 'error'))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 10, border: 'none',
                background: '#ea580c', color: '#ffffff', fontWeight: 700, cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Thử quét lại tệp lỗi</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Recruitment Confirmation Modal
// When user inputs Employee ID -> automatically registers into Danh sách thủ kho
// -------------------------------------------------------------
function RecruitConfirmModal({ 
  candidate, 
  suggestedMaNV, 
  maNV, 
  onChangeMaNV, 
  selectedKhoi,
  onChangeKhoi,
  blocksList = BAN_CHUOI_KHOI_LIST,
  selectedDuAn, 
  onChangeDuAn,
  selectedChucVu,
  onChangeChucVu,
  positionsList = [],
  projectsList = [],
  onConfirm,
  onCancel
}) {
  useEscapeKey(onCancel, true)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
      // zIndex cao hơn CandidateDetailModal (9999) để luôn hiển thị ĐÈ LÊN TRÊN
      // màn hình chi tiết ứng viên khi bấm "Cấp mã & Tuyển dụng" ngay trong đó.
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10050, padding: 16,
      fontFamily: "'Roboto', sans-serif"
    }}>
      <div style={{
        width: 520, maxWidth: '100%', background: '#ffffff',
        borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Roboto', sans-serif"
      }}>
        {/* Banner */}
        <div style={{
          padding: '20px 24px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          color: '#ffffff', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <UserCheck size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>XÁC NHẬN TUYỂN DỤNG THÀNH CÔNG</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, opacity: 0.9 }}>
              Cấp Mã NV và chuyển ứng viên chính thức sang <b>Danh sách thủ kho</b>
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Candidate overview */}
          <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f58a7' }}>{candidate.hoTen}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#475569' }}>
              <span>SĐT: <b>{candidate.soDienThoai}</b></span>
              <span>Kinh nghiệm: <b>{candidate.soNamKinhNghiem} năm</b></span>
            </div>
          </div>

          {/* Input Employee ID */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              MÃ NHÂN VIÊN CHÍNH THỨC <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="input"
                style={{
                  flex: 1,
                  height: 44,
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#0f58a7',
                  borderRadius: 10,
                  border: '2px solid #3b82f6',
                  padding: '0 14px'
                }}
                placeholder="VD: 3752888"
                value={maNV}
                onChange={e => onChangeMaNV(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => onChangeMaNV(suggestedMaNV)}
                style={{
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Gợi ý: {suggestedMaNV}
              </button>
            </div>
            <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, display: 'block' }}>
              Mã nhân viên sẽ được dùng để quản lý thủ kho này xuyên suốt hệ thống.
            </span>
          </div>

          {/* Select Official Block / Khối thi công */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              KHỐI THI CÔNG / BAN CHUỖI KHỐI <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              className="input"
              style={{ width: '100%', height: 42, borderRadius: 10, fontWeight: 600, color: '#0f58a7' }}
              value={selectedKhoi || 'Khối Thi công'}
              onChange={e => onChangeKhoi(e.target.value)}
            >
              {blocksList.map(block => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </div>

          {/* Select Official Project */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              DỰ ÁN / CÔNG TRÌNH PHÂN BỔ
            </label>
            <select
              className="input"
              style={{ width: '100%', height: 42, borderRadius: 10 }}
              value={selectedDuAn}
              onChange={e => onChangeDuAn(e.target.value)}
            >
              <option value="Chưa phân bổ">Chưa phân bổ</option>
              {projectsList.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>

          {/* Select Official Job Title */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              CHỨC DANH BỔ NHIỆM
            </label>
            <select
              className="input"
              style={{ width: '100%', height: 42, borderRadius: 10 }}
              value={selectedChucVu && positionsList.some(p => (typeof p === 'string' ? p : p?.ten_chuc_vu) === selectedChucVu) ? selectedChucVu : (typeof positionsList[0] === 'string' ? positionsList[0] : (positionsList[0]?.ten_chuc_vu || ''))}
              onChange={e => onChangeChucVu(e.target.value)}
            >
              {positionsList.map(p => {
                const val = typeof p === 'string' ? p : p.ten_chuc_vu
                return <option key={val} value={val}>{val}</option>
              })}
            </select>
          </div>

          {/* Auto-jump note */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 12.5
          }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              Sau khi xác nhận, hệ thống sẽ <b>tự động lưu vào cơ sở dữ liệu</b> và <b>chuyển ngay sang sheet Danh sách thủ kho</b>!
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid #cbd5e1',
              background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 24px', borderRadius: 10, border: 'none',
              background: '#059669', color: '#ffffff', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
            }}
          >
            <Check size={16} />
            <span>Xác nhận & Chuyển sang Danh sách thủ kho</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Candidate Detail Modal Component
// Displays comprehensive CV and AI extracted info
// -------------------------------------------------------------
function CandidateDetailModal({ 
  candidate, 
  positionsList = [], 
  projectsList = [], 
  onClose, 
  onStartRecruit, 
  onNavigateToStorekeeper, 
  onEdit, 
  onDelete, 
  onUpdateCandidate
}) {
  useEscapeKey(onClose, true)

  const isRecruited = Boolean(candidate.maNV) || candidate.trangThai === 'Đã tuyển dụng'
  const [isFullScreen, setIsFullScreen] = useState(true)
  const [currentPdfBlob, setCurrentPdfBlob] = useState(null)
  const [isLoadingPdf, setIsLoadingPdf] = useState(true)

  // Thông tin chỉnh sửa trực tiếp trên Header theo yêu cầu
  const [currentStatus, setCurrentStatus] = useState(candidate.trangThai || 'Tiếp nhận CV')
  const [currentChucVu, setCurrentChucVu] = useState(candidate.chucVu || '')
  const [isSavingHeader, setIsSavingHeader] = useState(false)
  const [hasSavedHeader, setHasSavedHeader] = useState(false)

  // Đồng bộ khi đổi ứng viên
  useEffect(() => {
    setCurrentStatus((candidate.maNV || candidate.trangThai === 'Đã tuyển dụng') ? 'Đã tuyển dụng' : (candidate.trangThai || 'Tiếp nhận CV'))
    setCurrentChucVu(candidate.chucVu || '')
    setHasSavedHeader(false)
  }, [candidate.id, candidate.trangThai, candidate.chucVu, candidate.maNV])

  const hasHeaderChanges = (
    currentStatus !== (candidate.trangThai || 'Tiếp nhận CV') ||
    currentChucVu !== (candidate.chucVu || '')
  )

  const cleanPositions = useMemo(() => {
    const list = (positionsList || [])
      .map(p => (typeof p === 'string' ? p : p?.ten_chuc_vu)?.trim())
      .filter(Boolean)
    if (currentChucVu && !list.includes(currentChucVu)) {
      list.unshift(currentChucVu)
    }
    return list.length > 0 ? Array.from(new Set(list)) : ['Thủ kho', 'Thủ kho chính', 'Thủ kho phụ']
  }, [positionsList, currentChucVu])

  const handleSaveHeaderChanges = async (overrideStatus, overrideChucVu) => {
    setIsSavingHeader(true)
    const newStatus = overrideStatus !== undefined ? overrideStatus : currentStatus
    const newChucVu = overrideChucVu !== undefined ? overrideChucVu : currentChucVu
    const updated = {
      ...candidate,
      trangThai: newStatus,
      chucVu: newChucVu
    }
    try {
      if (onUpdateCandidate) {
        await onUpdateCandidate(updated)
      }
      // Tạo lại file PDF mới có thông tin đã chỉnh sửa để cập nhật khung bên phải
      const newBlob = await generateCandidatePdfBlob(updated)
      if (newBlob) {
        await saveCandidatePdf(candidate.id, newBlob)
        setCurrentPdfBlob(newBlob)
      }
      setHasSavedHeader(true)
      setTimeout(() => setHasSavedHeader(false), 3000)
    } catch (err) {
      console.error('Lỗi khi lưu thông tin:', err)
      alert('Lỗi lưu thông tin: ' + err.message)
    } finally {
      setIsSavingHeader(false)
    }
  }

  // Load or generate genuine PDF blob whenever candidate changes
  useEffect(() => {
    let active = true

    async function loadPdf() {
      setIsLoadingPdf(true)
      try {
        // 1. Try memory
        if (candidate.fileDataUrl) {
          const blob = dataUrlToBlob(candidate.fileDataUrl)
          if (blob && active) {
            setCurrentPdfBlob(blob)
            setIsLoadingPdf(false)
            return
          }
        }

        // 2. Check original uploaded PDF in IndexedDB first
        const originalPdf = await getOriginalCandidatePdf(candidate.id)
        if (originalPdf && active) {
          const blob = typeof originalPdf === 'string' ? dataUrlToBlob(originalPdf) : originalPdf
          setCurrentPdfBlob(blob)
          setIsLoadingPdf(false)
          return
        }

        // 3. Try standard saved PDF
        const savedPdf = await getCandidatePdf(candidate.id)
        const isSampleNgocBich = candidate.hoTen && (candidate.hoTen.includes('Ngọc Bích') || candidate.hoTen.includes('Ngoc Bich'))
        if (savedPdf && !isSampleNgocBich && active) {
          const blob = typeof savedPdf === 'string' ? dataUrlToBlob(savedPdf) : savedPdf
          setCurrentPdfBlob(blob)
          setIsLoadingPdf(false)
          return
        }

        // 4. Tải từ kho GitHub nếu đã lưu lên GitHub (tránh tốn dung lượng Supabase)
        const ghUrl = candidate.fileUrl || (candidate.fileName && (candidate.fileName.startsWith('17') || candidate.fileName.includes('_')) ? `https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/${candidate.fileName}` : null)
        if (ghUrl) {
          try {
            const resp = await fetch(ghUrl)
            if (resp.ok) {
              const blob = await resp.blob()
              if (blob && blob.size > 100 && active) {
                await saveCandidatePdf(candidate.id, blob)
                setCurrentPdfBlob(blob)
                setIsLoadingPdf(false)
                return
              }
            }
          } catch (ghFetchErr) {
            console.warn('Lỗi tải PDF từ kho GitHub:', ghFetchErr)
          }
        }

        // 5. Generate authentic 2-page binary PDF document for candidate
        const generatedBlob = await generateCandidatePdfBlob(candidate)
        if (generatedBlob && active) {
          await saveCandidatePdf(candidate.id, generatedBlob)
          setCurrentPdfBlob(generatedBlob)
          setIsLoadingPdf(false)
          return
        }
      } catch (err) {
        console.error('Lỗi nạp file PDF:', err)
      } finally {
        if (active) setIsLoadingPdf(false)
      }
    }

    loadPdf()

    return () => {
      active = false
    }
  }, [candidate.id, candidate.fileDataUrl])

  const [isRescanning, setIsRescanning] = useState(false)
  const [rescanSuccessMsg, setRescanSuccessMsg] = useState('')

  const handleRescanWithAi = async () => {
    setIsRescanning(true)
    setRescanSuccessMsg('')
    try {
      let base64Data = candidate.fileDataUrl || ''
      if (!base64Data && candidate.id) {
        const saved = await getCandidatePdf(candidate.id)
        if (typeof saved === 'string') {
          base64Data = saved
        }
      }
      if (!base64Data && currentPdfBlob) {
        base64Data = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(currentPdfBlob)
        })
      }

      const res = await fetch(apiUrl('/api/parse-cv'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: candidate.fileName || `${candidate.hoTen || 'CV'}.pdf`,
          mimeType: 'application/pdf',
          base64Data: base64Data || ''
        })
      })
      const resJson = await res.json()
      if (resJson.success && resJson.data) {
        const parsed = resJson.data
        const updated = {
          ...candidate,
          ...parsed,
          id: candidate.id,
          trangThai: candidate.trangThai || 'Tiếp nhận CV',
          fileName: candidate.fileName || `${parsed.hoTen || 'CV'}.pdf`,
          fileDataUrl: base64Data || candidate.fileDataUrl,
          ngaySinh: formatDate(parsed.ngaySinh || candidate.ngaySinh),
          ngayUngTuyen: formatDate(candidate.ngayUngTuyen || new Date().toISOString().slice(0, 10)),
          isParsedWithAI: true
        }
        if (onUpdateCandidate) {
          onUpdateCandidate(updated)
        }
        setRescanSuccessMsg('Đã cập nhật toàn bộ thông tin ứng viên bằng AI thành công!')
        setTimeout(() => setRescanSuccessMsg(''), 4000)
      } else {
        alert('Không thể trích xuất lại thông tin: ' + (resJson.error || 'Lỗi xử lý'))
      }
    } catch (err) {
      console.error('Lỗi quét lại CV bằng AI:', err)
      alert('Đã xảy ra lỗi khi kết nối tới máy chủ AI.')
    } finally {
      setIsRescanning(false)
    }
  }

  const handleUploadPdf = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      await saveCandidatePdf(candidate.id, dataUrl)
      await saveOriginalCandidatePdf(candidate.id, dataUrl)
      const blob = dataUrlToBlob(dataUrl) || file
      setCurrentPdfBlob(blob)

      // Tự động tải tệp PDF mới lên kho GitHub (ceohomes/CV-TQT / cvs)
      let ghResult = null
      try {
        const ghRes = await fetch(apiUrl('/api/upload-cv-github'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            base64Data: dataUrl,
            candidateName: candidate.hoTen
          })
        })
        if (ghRes.ok) {
          ghResult = await ghRes.json()
        }
      } catch (ghErr) {
        console.warn('Lỗi tải tệp lên GitHub:', ghErr)
      }

      const updated = {
        ...candidate,
        fileName: ghResult?.fileName || file.name,
        fileUrl: ghResult?.downloadUrl || candidate.fileUrl || '',
        githubUrl: ghResult?.htmlUrl || candidate.githubUrl || '',
        fileDataUrl: dataUrl
      }
      if (onUpdateCandidate) onUpdateCandidate(updated)
    }
    reader.readAsDataURL(file)
  }

  const handleDownloadPdf = async () => {
    let blobToDownload = currentPdfBlob
    if (!blobToDownload) {
      blobToDownload = await generateCandidatePdfBlob(candidate)
    }
    if (blobToDownload) {
      const url = URL.createObjectURL(blobToDownload)
      const link = document.createElement('a')
      link.href = url
      link.download = candidate.fileName || `${candidate.hoTen}_CV.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } else {
      window.print()
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: isFullScreen ? '#ffffff' : 'rgba(15, 23, 42, 0.75)',
      backdropFilter: isFullScreen ? 'none' : 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: isFullScreen ? 0 : '10px 14px',
      fontFamily: "'Roboto', sans-serif"
    }}>
      <div style={{
        width: isFullScreen ? '100vw' : '97vw',
        maxWidth: isFullScreen ? '100vw' : 1600,
        height: isFullScreen ? '100vh' : '94vh',
        maxHeight: isFullScreen ? '100vh' : '94vh',
        background: '#ffffff',
        borderRadius: isFullScreen ? 0 : 16,
        boxShadow: isFullScreen ? 'none' : '0 25px 50px -12px rgba(15, 23, 42, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Roboto', sans-serif"
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 24px', background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)',
          color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: '#ffffff',
              color: '#0f58a7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 800, flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}>
              {initials(candidate.hoTen || 'U')}
            </div>

            {/* Họ tên */}
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {candidate.hoTen}
            </h3>

            {/* Tên tệp */}
            <span style={{
              background: '#ffffff', 
              color: '#0f58a7',
              border: '1.5px solid rgba(255, 255, 255, 0.7)',
              fontSize: 12, 
              padding: '4px 12px', 
              borderRadius: 18, 
              fontWeight: 700,
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 300
            }} title={candidate.fileName || 'CV_UngVien.pdf'}>
              📄 Tệp: {candidate.fileName || 'CV_UngVien.pdf'}
            </span>

            {/* Link kho lưu trữ GitHub (cvs) */}
            {(candidate.githubUrl || (candidate.fileName && (candidate.fileName.startsWith('17') || candidate.fileName.includes('_')))) && (
              <a
                href={candidate.githubUrl || `https://github.com/ceohomes/CV-TQT/blob/main/cvs/${candidate.fileName}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#ffffff', color: '#15803d',
                  border: '1.5px solid rgba(255, 255, 255, 0.7)',
                  borderRadius: 18, padding: '4px 12px',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
                title="Xem tệp CV gốc lưu trên GitHub (ceohomes/CV-TQT/cvs) - Tiết kiệm dung lượng Supabase"
              >
                <span>🐙 GitHub cvs</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Đóng */}
            <button 
              type="button"
              onClick={onClose} 
              title="Đóng cửa sổ"
              style={{ 
                background: 'rgba(255, 255, 255, 0.25)',
                border: 'none', 
                color: '#ffffff',
                cursor: 'pointer',
                borderRadius: 8,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              <X size={15} />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* 2-Column Body: Left = Candidate Info & AI Assessment, Right = PDF Viewer */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          
          {/* ================= LEFT PANE: CANDIDATE INFO & AI ASSESSMENT ================= */}
          <div style={{
            flex: '1 1 0',
            minWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: 22,
            gap: 18,
            background: '#ffffff',
            borderRight: '1px solid #cbd5e1'
          }}>
            {/* AI Score & Evaluation Box */}
            <div style={{
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
              border: '1px solid #ddd6fe',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontWeight: 800, fontSize: 13.5 }}>
                  <Sparkles size={18} />
                  <span>ĐÁNH GIÁ ĐỘ PHÙ HỢP TỪ GEMINI AI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={isRescanning}
                    onClick={handleRescanWithAi}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: '#7c3aed', color: '#ffffff',
                      border: 'none', borderRadius: 8, padding: '5px 12px',
                      fontSize: 12, fontWeight: 700, cursor: isRescanning ? 'wait' : 'pointer',
                      boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)'
                    }}
                  >
                    {isRescanning ? <RefreshCw size={13} className="spin-icon" /> : <Sparkles size={13} color="#fef08a" />}
                    <span>{isRescanning ? 'Đang trích xuất...' : 'Quét lại bằng AI'}</span>
                  </button>
                  <div style={{
                    background: '#7c3aed', color: '#ffffff', fontWeight: 800,
                    fontSize: 13, padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <Star size={14} fill="#fef08a" stroke="none" />
                    <span>Điểm phù hợp: {candidate.diemPhuHop || '8.0'}/10</span>
                  </div>
                </div>
              </div>

              {rescanSuccessMsg && (
                <div style={{
                  padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0',
                  borderRadius: 8, color: '#065f46', fontSize: 12.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <CheckCircle size={15} color="#059669" />
                  <span>{rescanSuccessMsg}</span>
                </div>
              )}

              <p style={{ margin: 0, fontSize: 13, color: '#4c1d95', lineHeight: 1.6 }}>
                {candidate.aiDanhGia || 'Ứng viên có kỹ năng tốt, đáp ứng các tiêu chuẩn nghiệp vụ quản lý kho của SGC.'}
              </p>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={13} /> LIÊN HỆ & CÁ NHÂN
                </span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div>Điện thoại: <b>{candidate.soDienThoai || '—'}</b></div>
                  <div>Email: <b>{candidate.email || '—'}</b></div>
                  <div>Ngày sinh: <b>{formatDate(candidate.ngaySinh)}</b> {(() => {
                    const displayAge = candidate.tuoi || (() => {
                      if (!candidate.ngaySinh) return null
                      const parts = String(candidate.ngaySinh).trim().split(/[-/]/)
                      let birthYear = null
                      if (parts.length === 3) {
                        if (parts[2].length === 4) birthYear = parseInt(parts[2], 10)
                        else if (parts[0].length === 4) birthYear = parseInt(parts[0], 10)
                      } else if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
                        birthYear = parseInt(parts[0], 10)
                      }
                      if (birthYear && !isNaN(birthYear)) {
                        return new Date().getFullYear() - birthYear
                      }
                      return null
                    })()
                    return displayAge ? `(${displayAge} tuổi)` : ''
                  })()}</div>
                  <div>CCCD: <b>{candidate.cccd || '—'}</b></div>
                  <div>Quê quán: <b>{candidate.queQuan || '—'}</b></div>
                  <div>Địa chỉ: <b>{candidate.diaChi || '—'}</b></div>
                </div>
              </div>

              <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={13} /> CHUYÊN MÔN & KINH NGHIỆM
                </span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div>Trình độ: <b>{candidate.trinhDo || '—'}</b></div>
                  <div>Chuyên ngành: <b>{candidate.chuyenNganh || '—'}</b></div>
                  <div>Kinh nghiệm: <b>{candidate.soNamKinhNghiem ? `${candidate.soNamKinhNghiem} năm` : '—'}</b></div>
                  <div>Chứng chỉ: <b>{candidate.chungChi || 'ATLĐ'}</b></div>
                  <div>Ngày ứng tuyển: <b>{formatDate(candidate.ngayUngTuyen)}</b></div>
                </div>
              </div>
            </div>

            {/* Experience summary */}
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>TÓM TẮT KINH NGHIỆM LÀM VIỆC</span>
              <div style={{ marginTop: 6, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                {candidate.kinhNghiem || 'Chưa có thông tin tóm tắt kinh nghiệm.'}
              </div>
            </div>

            {/* Skills */}
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>KỸ NĂNG NỔI BẬT</span>
              <div style={{ marginTop: 6, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                {candidate.kyNang || 'Excel, Kiểm kê kho bãi, Quản lý vật tư.'}
              </div>
            </div>

            {/* Recruitment Status Notice & Action Controls */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
            }}>
              {/* Hàng điều khiển: Trạng thái tuyển dụng, Vị trí ứng tuyển & Chỉnh sửa toàn bộ / Lưu lại */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {/* Trạng thái tuyển dụng */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isRecruited ? '#64748b' : '#334155', whiteSpace: 'nowrap' }}>
                      Trạng thái:
                    </span>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <select
                        value={isRecruited ? 'Đã tuyển dụng' : currentStatus}
                        disabled={isRecruited}
                        onChange={(e) => {
                          if (isRecruited) return
                          const newStatus = e.target.value
                          setCurrentStatus(newStatus)
                          handleSaveHeaderChanges(newStatus, currentChucVu)
                        }}
                        style={{
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          background: isRecruited 
                            ? '#334155' 
                            : currentStatus === 'Đã tuyển dụng' 
                            ? '#059669' 
                            : currentStatus === 'Đạt - Chờ cấp mã NV' 
                            ? '#2563eb' 
                            : currentStatus === 'Đang phỏng vấn' 
                            ? '#d97706' 
                            : currentStatus === 'Không đạt' 
                            ? '#dc2626' 
                            : '#ffffff',
                          color: isRecruited 
                            ? '#f1f5f9' 
                            : currentStatus === 'Tiếp nhận CV' ? '#0f58a7' : '#ffffff',
                          border: isRecruited 
                            ? '1.5px solid #1e293b' 
                            : ('1.5px solid ' + (currentStatus === 'Tiếp nhận CV' ? '#cbd5e1' : 'transparent')),
                          borderRadius: 8,
                          padding: '6px 28px 6px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: isRecruited ? 'not-allowed' : 'pointer',
                          outline: 'none',
                          boxShadow: isRecruited ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                          opacity: isRecruited ? 0.95 : 1
                        }}
                        title={isRecruited ? "Ứng viên đã được tuyển dụng chính thức - không thể thay đổi trạng thái" : "Bấm để chọn trạng thái tuyển dụng"}
                      >
                        <option value="Tiếp nhận CV" style={{ color: '#1e293b', background: '#ffffff' }}>Tiếp nhận CV</option>
                        <option value="Đang phỏng vấn" style={{ color: '#1e293b', background: '#ffffff' }}>Đang phỏng vấn</option>
                        <option value="Đạt - Chờ cấp mã NV" style={{ color: '#1e293b', background: '#ffffff' }}>Đạt - Chờ cấp mã NV</option>
                        <option value="Đã tuyển dụng" disabled={!isRecruited} style={{ color: '#64748b', background: '#ffffff' }}>
                          Đã tuyển dụng {isRecruited ? '(Đã cấp mã NV)' : '(tự động khi cấp mã)'}
                        </option>
                        <option value="Không đạt" style={{ color: '#1e293b', background: '#ffffff' }}>Không đạt</option>
                      </select>
                      {isRecruited ? (
                        <Lock size={13} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: '#94a3b8' }} />
                      ) : (
                        <ChevronDown size={14} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: currentStatus === 'Tiếp nhận CV' ? '#0f58a7' : '#ffffff' }} />
                      )}
                    </div>
                  </div>

                  {/* Vị trí ứng tuyển */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isRecruited ? '#64748b' : '#334155', whiteSpace: 'nowrap' }}>
                      Ứng tuyển:
                    </span>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <select
                        value={currentChucVu}
                        disabled={isRecruited}
                        onChange={(e) => {
                          if (isRecruited) return
                          const newChucVu = e.target.value
                          setCurrentChucVu(newChucVu)
                          handleSaveHeaderChanges(currentStatus, newChucVu)
                        }}
                        style={{
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          background: isRecruited ? '#334155' : '#ffffff',
                          color: isRecruited ? '#f1f5f9' : '#0f58a7',
                          border: isRecruited ? '1.5px solid #1e293b' : '1.5px solid #cbd5e1',
                          borderRadius: 8,
                          padding: '6px 28px 6px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: isRecruited ? 'not-allowed' : 'pointer',
                          outline: 'none',
                          boxShadow: isRecruited ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                          maxWidth: 240,
                          opacity: isRecruited ? 0.95 : 1
                        }}
                        title={isRecruited ? "Ứng viên đã được tuyển dụng chính thức - vị trí đã cố định theo quyết định bổ nhiệm" : "Chọn vị trí ứng tuyển để chỉnh sửa"}
                      >
                        {cleanPositions.map(p => (
                          <option key={p} value={p} style={{ color: '#0f172a', background: '#ffffff' }}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {isRecruited ? (
                        <Lock size={13} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: '#94a3b8' }} />
                      ) : (
                        <ChevronDown size={14} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: '#0f58a7' }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Các nút thao tác */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Trạng thái tự động lưu */}
                  {isSavingHeader && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#2563eb', fontWeight: 600 }}>
                      <RefreshCw size={13} className="spin-icon" /> Đang lưu...
                    </span>
                  )}
                  {hasSavedHeader && !isSavingHeader && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#059669', fontWeight: 600, background: '#ecfdf5', padding: '3px 8px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                      <Check size={13} /> Đã tự động lưu
                    </span>
                  )}

                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(candidate)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#ffffff', color: '#6d28d9',
                        border: '1px solid #c4b5fd', borderRadius: 8, padding: '7px 14px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(109, 40, 217, 0.08)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f5f3ff'
                        e.currentTarget.style.borderColor = '#8b5cf6'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#c4b5fd'
                      }}
                      title="Chỉnh sửa toàn bộ thông tin ứng viên"
                    >
                      <Edit3 size={13} color="#7c3aed" />
                      <span>Chỉnh sửa toàn bộ</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(candidate)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626', fontWeight: 700, cursor: 'pointer',
                        fontSize: 13, whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2'
                        e.currentTarget.style.borderColor = '#fca5a5'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fef2f2'
                        e.currentTarget.style.borderColor = '#fecaca'
                      }}
                      title="Xóa hồ sơ ứng viên này"
                    >
                      <Trash2 size={14} />
                      <span>Xóa hồ sơ</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tuyển dụng / Bổ nhiệm */}
              {isRecruited ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={20} color="#059669" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065f46' }}>
                        Ứng viên đã tuyển dụng thành công với Mã NV: {candidate.maNV}
                      </div>
                      <div style={{ fontSize: 12, color: '#047857' }}>
                        Đã được đưa vào Danh sách thủ kho chính thức của SGC.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose()
                      if (onNavigateToStorekeeper) onNavigateToStorekeeper(candidate.maNV)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 8, background: '#059669',
                      color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                    }}
                  >
                    <span>Xem tại DS Thủ kho</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe'
                }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e3a8a' }}>
                      Sẵn sàng Tuyển dụng ứng viên này?
                    </div>
                    <div style={{ fontSize: 12, color: '#1d4ed8' }}>
                      Điền mã nhân viên để tự động bổ nhiệm và chuyển sang sheet Danh sách thủ kho.
                    </div>
                  </div>
                  <button
                    onClick={onStartRecruit}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 18px', borderRadius: 8, background: '#2563eb',
                      color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <UserCheck size={16} />
                    <span>Cấp mã & Tuyển dụng</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT PANE: PDF DOCUMENT VIEWER ================= */}
          <CandidatePdfViewer
            candidate={candidate}
            pdfBlob={currentPdfBlob}
            isLoading={isLoadingPdf}
            onUploadNewPdf={handleUploadPdf}
            onDownload={handleDownloadPdf}
          />
        </div>
      </div>
    </div>
  )
}

// Helper to normalize date string to dd/mm/yyyy
function toDdMmYyyy(val) {
  if (!val) return ''
  const str = String(val).trim()
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (match) {
    const [, y, m, d] = match
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  return str
}

// Auto expanding textarea to display full content without inner scrolling or cutoffs
function AutoExpandingTextarea({ value, onChange, placeholder, minHeight = 90 }) {
  const textareaRef = useRef(null)

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight + 4, minHeight)}px`
    }
  }

  useEffect(() => {
    adjustHeight()
  }, [value, minHeight])

  return (
    <textarea
      ref={textareaRef}
      className="input"
      style={{
        width: '100%',
        minHeight: `${minHeight}px`,
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: "'Roboto', sans-serif",
        fontSize: 13.5,
        lineHeight: 1.6,
        resize: 'vertical',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      value={value || ''}
      onChange={(e) => {
        onChange(e)
        adjustHeight()
      }}
      placeholder={placeholder}
    />
  )
}

// -------------------------------------------------------------
// Edit / Add Candidate Modal Component
// -------------------------------------------------------------
function EditCandidateModal({ candidate, onClose, onSave, positionsList = [], projectsList = [] }) {
  useEscapeKey(onClose, true)

  // Chuẩn hóa danh sách tên chức vụ trực tiếp từ Cài đặt chức vụ
  const cleanPositionList = useMemo(() => {
    const list = (positionsList || [])
      .map(p => (typeof p === 'string' ? p : p?.ten_chuc_vu)?.trim())
      .filter(Boolean)
    if (list.length > 0) return list
    return DEFAULT_CHUC_VU_LIST.map(p => p.ten_chuc_vu)
  }, [positionsList])

  const cleanProjectsList = useMemo(() => {
    return Array.from(new Set(projectsList || [])).filter(Boolean).sort()
  }, [projectsList])

  const [formData, setFormData] = useState(() => {
    const list = (positionsList || [])
      .map(p => (typeof p === 'string' ? p : p?.ten_chuc_vu)?.trim())
      .filter(Boolean)
    const validList = list.length > 0 ? list : DEFAULT_CHUC_VU_LIST.map(p => p.ten_chuc_vu)

    // Nếu chức vụ hiện tại không còn nằm trong danh mục Cài đặt chức vụ, tự động chọn chức vụ hợp lệ đầu tiên
    let initialChucVu = candidate?.chucVu
    if (!initialChucVu || !validList.includes(initialChucVu)) {
      initialChucVu = validList[0]
    }

    return {
      ...candidate,
      chucVu: initialChucVu,
      duAn: candidate?.duAn || 'Chưa phân bổ',
      ngaySinh: toDdMmYyyy(candidate?.ngaySinh)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.hoTen?.trim()) {
      alert('Vui lòng nhập họ và tên ứng viên.')
      return
    }

    // Tự động tính tuổi theo năm sinh nếu có
    let calculatedAge = formData.tuoi
    if (formData.ngaySinh) {
      const parts = String(formData.ngaySinh).trim().split(/[-/]/)
      let birthYear = null
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          birthYear = parseInt(parts[2], 10)
        } else if (parts[0].length === 4) {
          birthYear = parseInt(parts[0], 10)
        }
      } else if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
        birthYear = parseInt(parts[0], 10)
      }
      if (birthYear && !isNaN(birthYear)) {
        calculatedAge = new Date().getFullYear() - birthYear
      }
    }

    onSave({
      ...formData,
      tuoi: calculatedAge ?? formData.tuoi
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10050, padding: 16,
      fontFamily: "'Roboto', sans-serif"
    }}>
      <div style={{
        width: 760, maxWidth: '100%', maxHeight: '92vh', background: '#ffffff',
        borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Roboto', sans-serif"
      }}>
        <div style={{
          padding: '18px 24px', background: '#0f58a7', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: "'Roboto', sans-serif"
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Roboto', sans-serif", letterSpacing: '0.01em' }}>
            {formData.isNew ? 'THÊM ỨNG VIÊN TUYỂN DỤNG' : 'CHỈNH SỬA HỒ SƠ ỨNG VIÊN'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', fontFamily: "'Roboto', sans-serif" }}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Hàng 1: Họ và tên & Số điện thoại */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.hoTen || ''}
                  onChange={e => setFormData({ ...formData, hoTen: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Số điện thoại
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.soDienThoai || ''}
                  onChange={e => setFormData({ ...formData, soDienThoai: e.target.value })}
                  placeholder="VD: 0977918759"
                />
              </div>
            </div>

            {/* Hàng 2: Email & Ngày sinh (dd/mm/yyyy) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Email
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="VD: email@example.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Ngày sinh / Năm sinh <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>(dd/mm/yyyy)</span>
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.ngaySinh || ''}
                  onChange={e => setFormData({ ...formData, ngaySinh: e.target.value })}
                  placeholder="dd/mm/yyyy (VD: 20/01/1987)"
                />
              </div>
            </div>

            {/* Hàng 3: Vị trí ứng tuyển & Trạng thái tuyển dụng */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Vị trí ứng tuyển
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.chucVu && cleanPositionList.includes(formData.chucVu) ? formData.chucVu : (cleanPositionList[0] || '')}
                  onChange={e => setFormData({ ...formData, chucVu: e.target.value })}
                >
                  {cleanPositionList.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Trạng thái tuyển dụng
                </label>
                <select
                  className="input"
                  disabled={Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng'}
                  style={{ 
                    width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14,
                    background: (Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng') ? '#334155' : '#ffffff',
                    color: (Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng') ? '#f8fafc' : '#1e293b',
                    cursor: (Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng') ? 'not-allowed' : 'pointer'
                  }}
                  value={(Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng') ? 'Đã tuyển dụng' : (formData.trangThai || 'Tiếp nhận CV')}
                  onChange={e => setFormData({ ...formData, trangThai: e.target.value })}
                >
                  <option value="Tiếp nhận CV">Tiếp nhận CV</option>
                  <option value="Đang phỏng vấn">Đang phỏng vấn</option>
                  <option value="Đạt - Chờ cấp mã NV">Đạt - Chờ cấp mã NV</option>
                  <option value="Đã tuyển dụng" disabled={!(Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng')}>
                    Đã tuyển dụng {(Boolean(candidate?.maNV) || candidate?.trangThai === 'Đã tuyển dụng') ? '(Đã cấp mã NV)' : '(tự động khi cấp mã)'}
                  </option>
                  <option value="Không đạt">Không đạt</option>
                </select>
              </div>
            </div>

            {/* Hàng 4: Trình độ & Số năm kinh nghiệm */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Trình độ
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.trinhDo || 'Đại học'}
                  onChange={e => setFormData({ ...formData, trinhDo: e.target.value })}
                >
                  <option value="Đại học">Đại học</option>
                  <option value="Cao đẳng">Cao đẳng</option>
                  <option value="Trung cấp">Trung cấp</option>
                  <option value="THPT">THPT</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                  Số năm kinh nghiệm
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 14 }}
                  value={formData.soNamKinhNghiem ?? ''}
                  onChange={e => setFormData({ ...formData, soNamKinhNghiem: Number(e.target.value) })}
                  placeholder="VD: 5"
                />
              </div>
            </div>

            {/* Hàng 5: Tóm tắt kinh nghiệm làm việc (Hiển thị full chữ, tự động co giãn) */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                Tóm tắt kinh nghiệm làm việc
              </label>
              <AutoExpandingTextarea
                value={formData.kinhNghiem}
                onChange={e => setFormData({ ...formData, kinhNghiem: e.target.value })}
                minHeight={100}
                placeholder="Nhập tóm tắt quá trình và kinh nghiệm làm việc của ứng viên..."
              />
            </div>

            {/* Hàng 6: Kỹ năng chuyên môn (Hiển thị full chữ, tự động co giãn) */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                Kỹ năng chuyên môn
              </label>
              <AutoExpandingTextarea
                value={formData.kyNang}
                onChange={e => setFormData({ ...formData, kyNang: e.target.value })}
                minHeight={80}
                placeholder="VD: Phần mềm kế toán Fast, Misa, Excel, quản lý xuất nhập tồn vật tư công trình, kiểm kê kho bãi, lái xe nâng..."
              />
            </div>

            {/* Hàng 7: Nhận xét / Đánh giá (Hiển thị full chữ, tự động co giãn) */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b', fontFamily: "'Roboto', sans-serif" }}>
                Nhận xét / Đánh giá
              </label>
              <AutoExpandingTextarea
                value={formData.aiDanhGia}
                onChange={e => setFormData({ ...formData, aiDanhGia: e.target.value })}
                minHeight={95}
                placeholder="Nhập nhận xét, đánh giá năng lực ứng viên..."
              />
            </div>
          </div>

          <div style={{
            padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
            fontFamily: "'Roboto', sans-serif"
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 20px', borderRadius: 8, border: '1px solid #cbd5e1',
                background: '#ffffff', color: '#475569', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Roboto', sans-serif", fontSize: 14
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                background: '#0f58a7', color: '#ffffff', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Roboto', sans-serif", fontSize: 14
              }}
            >
              Lưu thông tin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
