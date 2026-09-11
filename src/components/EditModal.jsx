import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  X, Award, Info, Briefcase, Trash2, Check, Phone, Mail, 
  Building, Layers, MapPin, Calendar, Warehouse, ShieldCheck, 
  Pencil, Sparkles, Star, CheckCircle, Download, ExternalLink, 
  FileText, RefreshCw, Upload, Maximize2, Minimize2, ChevronDown, 
  Save, AlertCircle, Eye, User, Edit3, Lock
} from 'lucide-react'
import CandidatePdfViewer from './CandidatePdfViewer.jsx'
import useEscapeKey from '../hooks/useEscapeKey'
import { DEFAULT_REAL_CANDIDATES } from './TuyenDungTab.jsx'
import { 
  DU_AN_LIST, 
  BAN_CHUOI_KHOI_LIST, 
  CHUC_VU_LIST, 
  TRINH_DO_LIST, 
  LOAI_HD_LIST, 
  TRANG_THAI_LIST, 
  DANH_GIA_LIST 
} from '../mockData.js'
import { 
  saveCandidatePdf, 
  getCandidatePdf, 
  saveOriginalCandidatePdf, 
  getOriginalCandidatePdf, 
  dataUrlToBlob, 
  generateCandidatePdfBlob 
} from '../pdfStorage.js'
import { initials, formatDate, trangThaiBadgeClass, danhGiaBadgeClass } from '../constants.js'
import { apiUrl } from '../apiBase'

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
      onChange={onChange}
      placeholder={placeholder}
    />
  )
}

// Modal chỉnh sửa thông tin nhân sự / thủ kho chuẩn như sheet Tuyển dụng
function EditThuKhoPopupModal({ data, formData, onClose, onSave, availableBlocks = [] }) {
  useEscapeKey(onClose, true)

  const currentData = formData || data || {}
  const [modalForm, setModalForm] = useState(() => ({
    ...currentData,
    ngaySinh: toDdMmYyyy(currentData?.ngaySinh)
  }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!modalForm.hoTen?.trim()) {
      alert('Vui lòng nhập họ và tên.')
      return
    }

    let calculatedAge = modalForm.tuoi
    if (modalForm.ngaySinh) {
      const parts = String(modalForm.ngaySinh).trim().split(/[-/]/)
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

    // Convert dd/mm/yyyy to standard yyyy-mm-dd if valid for DB
    let stdNgaySinh = modalForm.ngaySinh
    if (modalForm.ngaySinh) {
      const parts = String(modalForm.ngaySinh).trim().split(/[-/]/)
      if (parts.length === 3 && parts[2].length === 4) {
        stdNgaySinh = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      }
    }

    const payload = {
      ...modalForm,
      ngaySinh: stdNgaySinh,
      tuoi: calculatedAge ?? null,
      luongCoBan: modalForm.luongCoBan ? Number(modalForm.luongCoBan) : null,
      soNamKinhNghiem: modalForm.soNamKinhNghiem != null && modalForm.soNamKinhNghiem !== '' ? Number(modalForm.soNamKinhNghiem) : null
    }

    onSave(payload)
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
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
        {/* Header */}
        <div style={{
          padding: '18px 24px', background: '#0f58a7', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: "'Roboto', sans-serif"
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Roboto', sans-serif", letterSpacing: '0.01em' }}>
            CHỈNH SỬA HỒ SƠ THỦ KHO / NHÂN SỰ
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Ngăn bấm Enter khi đang gõ trong ô input/select làm submit/đóng form sớm
            // ngoài ý muốn (trình duyệt mặc định submit form khi Enter trong các ô này).
            if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
              e.preventDefault()
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', fontFamily: "'Roboto', sans-serif" }}
        >
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Hàng 1: Họ và tên & Số điện thoại */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.hoTen || ''}
                  onChange={e => setModalForm({ ...modalForm, hoTen: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Số điện thoại
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.soDienThoai || ''}
                  onChange={e => setModalForm({ ...modalForm, soDienThoai: e.target.value })}
                  placeholder="VD: 0935996912"
                />
              </div>
            </div>

            {/* Hàng 2: Email & Ngày sinh (dd/mm/yyyy) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Email
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.emailCongTy || modalForm.email || ''}
                  onChange={e => setModalForm({ ...modalForm, emailCongTy: e.target.value, email: e.target.value })}
                  placeholder="VD: email@example.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Ngày sinh / Năm sinh <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>(dd/mm/yyyy)</span>
                </label>
                <input
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.ngaySinh || ''}
                  onChange={e => setModalForm({ ...modalForm, ngaySinh: e.target.value })}
                  placeholder="dd/mm/yyyy (VD: 20/01/1987)"
                />
              </div>
            </div>

            {/* Hàng 4: Trình độ & Số năm kinh nghiệm */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Trình độ
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.trinhDo || ''}
                  onChange={e => setModalForm({ ...modalForm, trinhDo: e.target.value })}
                >
                  <option value="">— Để trống —</option>
                  <option value="Đại học">Đại học</option>
                  <option value="Cao đẳng">Cao đẳng</option>
                  <option value="Trung cấp">Trung cấp</option>
                  <option value="THPT">THPT</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                  Số năm kinh nghiệm
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', height: 40, borderRadius: 8, fontSize: 14 }}
                  value={modalForm.soNamKinhNghiem ?? ''}
                  onChange={e => setModalForm({ ...modalForm, soNamKinhNghiem: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="VD: 3"
                />
              </div>
            </div>

            {/* Hàng 7: Tóm tắt kinh nghiệm làm việc */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                Tóm tắt kinh nghiệm làm việc
              </label>
              <AutoExpandingTextarea
                value={modalForm.kinhNghiem}
                onChange={e => setModalForm({ ...modalForm, kinhNghiem: e.target.value })}
                minHeight={90}
                placeholder="Nhập tóm tắt quá trình và kinh nghiệm làm việc thực tế..."
              />
            </div>

            {/* Hàng 8: Kỹ năng chuyên môn */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                Kỹ năng chuyên môn
              </label>
              <AutoExpandingTextarea
                value={modalForm.kyNang}
                onChange={e => setModalForm({ ...modalForm, kyNang: e.target.value })}
                minHeight={80}
                placeholder="Nhập các kỹ năng chuyên môn, phần mềm, thiết bị..."
              />
            </div>

            {/* Hàng 9: Nhận xét / Đánh giá */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 5, color: '#1e293b' }}>
                Nhận xét / Đánh giá
              </label>
              <AutoExpandingTextarea
                value={modalForm.aiDanhGia}
                onChange={e => setModalForm({ ...modalForm, aiDanhGia: e.target.value })}
                minHeight={90}
                placeholder="Nhận xét hoặc đánh giá năng lực..."
              />
            </div>

          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid #cbd5e1',
                background: '#ffffff', color: '#475569', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 24px', borderRadius: 8, border: 'none',
                background: '#0f58a7', color: '#ffffff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(15, 88, 167, 0.25)'
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

export default function EditModal({ 
  row, 
  onClose, 
  onSave, 
  onDelete, 
  showConfirm, 
  blocksConfig = [],
  defaultFullScreen = true
}) {
  // 1. Enrich row with candidate recruitment information if available
  const initialData = useMemo(() => {
    if (!row) return {}

    // Lookup matching recruitment candidate
    let matchedCand = null
    try {
      const raw = localStorage.getItem('sgc_tuyen_dung_candidates')
      const candidates = raw ? JSON.parse(raw) : DEFAULT_REAL_CANDIDATES
      const list = Array.isArray(candidates) && candidates.length > 0 ? candidates : DEFAULT_REAL_CANDIDATES

      matchedCand = list.find(c => 
        (c.maNV && row.maNV && String(c.maNV).trim().toLowerCase() === String(row.maNV).trim().toLowerCase()) ||
        (c.hoTen && row.hoTen && c.hoTen.trim().toLowerCase() === row.hoTen.trim().toLowerCase()) ||
        (row.ghiChu && c.fileName && row.ghiChu.includes(c.fileName)) ||
        (row.candidateId && c.id === row.candidateId)
      )
    } catch {
      matchedCand = null
    }

    if (!matchedCand && DEFAULT_REAL_CANDIDATES) {
      matchedCand = DEFAULT_REAL_CANDIDATES.find(c => 
        (c.maNV && row.maNV && String(c.maNV).trim().toLowerCase() === String(row.maNV).trim().toLowerCase()) ||
        (c.hoTen && row.hoTen && c.hoTen.trim().toLowerCase() === row.hoTen.trim().toLowerCase()) ||
        (row.ghiChu && c.fileName && row.ghiChu.includes(c.fileName))
      )
    }

    let banChuoiKhoi = row.banChuoiKhoi || row.khoi_thi_cong || ''
    if (!banChuoiKhoi && matchedCand?.banChuoiKhoi) banChuoiKhoi = matchedCand.banChuoiKhoi
    if (!banChuoiKhoi && row.duAn) {
      const p = DU_AN_LIST.find(item => item.ten === row.duAn)
      if (p?.banChuoiKhoi) banChuoiKhoi = p.banChuoiKhoi
    }

    let ngaySinh = row.ngaySinh || matchedCand?.ngaySinh || ''

    let tuoi = row.tuoi || null
    if (!tuoi && ngaySinh) {
      const parts = String(ngaySinh).split(/[-/]/)
      const yearStr = parts.length === 3 ? (parts[0].length === 4 ? parts[0] : parts[2]) : parts[0]
      const y = parseInt(yearStr, 10)
      if (y > 1900 && y < 2100) tuoi = new Date().getFullYear() - y
    }

    return {
      isNew: Boolean(row.isNew),
      stt: row.stt,
      maNV: row.maNV || '',
      hoTen: row.hoTen || matchedCand?.hoTen || '',
      gioiTinh: row.gioiTinh || matchedCand?.gioiTinh || 'Nam',
      ngaySinh: ngaySinh,
      tuoi: tuoi || null,
      soDienThoai: row.soDienThoai || matchedCand?.soDienThoai || '',
      emailCongTy: row.emailCongTy || row.email || matchedCand?.email || '',
      banChuoiKhoi: banChuoiKhoi,
      phongVungMien: row.phongVungMien || matchedCand?.phongVungMien || '',
      cccd: row.cccd || matchedCand?.cccd || '',
      queQuan: row.queQuan || matchedCand?.queQuan || '',
      diaChi: row.diaChi || matchedCand?.diaChi || row.queQuan || '',
      ngayVaoLam: row.ngayVaoLam || '',
      soNamKinhNghiem: (row.soNamKinhNghiem != null && row.soNamKinhNghiem !== '') ? Number(row.soNamKinhNghiem) : (matchedCand?.soNamKinhNghiem ?? null),
      trinhDo: row.trinhDo || matchedCand?.trinhDo || '',
      chuyenNganh: row.chuyenNganh || matchedCand?.chuyenNganh || '',
      chucVu: row.chucVu || matchedCand?.chucVu || 'Thủ kho hiện trường',
      duAn: row.duAn || matchedCand?.duAn || 'Chưa phân bổ',
      khoPhuTrach: row.khoPhuTrach || '',
      soLuongKhoQuanLy: row.soLuongKhoQuanLy || 1,
      giaTriTonKhoQuanLy: Number(row.giaTriTonKhoQuanLy || 0),
      loaiHopDong: row.loaiHopDong || 'Chính thức (không xác định thời hạn)',
      ngayHetHanHD: row.ngayHetHanHD || '',
      trangThai: row.trangThai || 'Đang làm việc',
      luongCoBan: (row.luongCoBan != null && Number(row.luongCoBan) > 0) ? Number(row.luongCoBan) : null,
      chungChiNghiepVuKho: row.chungChiNghiepVuKho || matchedCand?.chungChi || '',
      chungChiATLD: row.chungChiATLD || '',
      danhGiaHieuSuat: row.danhGiaHieuSuat || matchedCand?.danhGia || '',
      soDienThoaiKhanCap: row.soDienThoaiKhanCap || '',
      ghiChu: row.ghiChu || (matchedCand?.fileName ? `Tuyển dụng từ CV (${matchedCand.fileName}).` : ''),
      // CV / Recruitment attachments - Dữ liệu thực từ Supabase hoặc CV
      candidateId: row.candidateId || matchedCand?.id || '',
      fileName: row.fileName || matchedCand?.fileName || '',
      fileUrl: row.fileUrl || matchedCand?.fileUrl || '',
      githubUrl: row.githubUrl || matchedCand?.githubUrl || '',
      fileDataUrl: row.fileDataUrl || matchedCand?.fileDataUrl || '',
      kinhNghiem: row.kinhNghiem || matchedCand?.kinhNghiem || '',
      kyNang: row.kyNang || matchedCand?.kyNang || '',
      aiDanhGia: row.aiDanhGia || matchedCand?.aiDanhGia || '',
      diemPhuHop: (row.diemPhuHop != null && Number(row.diemPhuHop) > 0) ? Number(row.diemPhuHop) : (matchedCand?.diemPhuHop != null ? Number(matchedCand.diemPhuHop) : null)
    }
  }, [row])

  const [formData, setFormData] = useState(initialData)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showEditCandidateModal, setShowEditCandidateModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [currentPdfBlob, setCurrentPdfBlob] = useState(null)
  const [isLoadingPdf, setIsLoadingPdf] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(defaultFullScreen !== undefined ? defaultFullScreen : true)
  const [isRescanning, setIsRescanning] = useState(false)
  const [rescanSuccessMsg, setRescanSuccessMsg] = useState('')

  useEscapeKey(onClose, Boolean(row))

  const displayAge = useMemo(() => {
    if (formData.tuoi) return formData.tuoi
    if (formData.ngaySinh) {
      const parts = String(formData.ngaySinh).split(/[-/]/)
      const yearStr = parts.length === 3 ? (parts[0].length === 4 ? parts[0] : parts[2]) : parts[0]
      const y = parseInt(yearStr, 10)
      if (y > 1900 && y < 2100) return new Date().getFullYear() - y
    }
    return null
  }, [formData.tuoi, formData.ngaySinh])

  // Danh sách các Khối thi công
  const availableBlocks = useMemo(() => {
    if (blocksConfig && blocksConfig.length > 0) {
      return blocksConfig.map(b => typeof b === 'string' ? b : (b.name || b.ten)).filter(Boolean)
    }
    return BAN_CHUOI_KHOI_LIST
  }, [blocksConfig])

  // Lọc danh sách Dự án theo Khối đã chọn
  const filteredProjects = useMemo(() => {
    if (!formData.banChuoiKhoi) return DU_AN_LIST.map(p => p.ten)
    const list = DU_AN_LIST.filter(p => p.banChuoiKhoi === formData.banChuoiKhoi).map(p => p.ten)
    return list.length > 0 ? list : DU_AN_LIST.map(p => p.ten)
  }, [formData.banChuoiKhoi])

  // Cập nhật trường dữ liệu
  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'ngaySinh' && value) {
        const parts = String(value).split(/[-/]/)
        const yearStr = parts.length === 3 ? (parts[0].length === 4 ? parts[0] : parts[2]) : parts[0]
        const y = parseInt(yearStr, 10)
        if (y > 1900 && y < 2100) {
          updated.tuoi = new Date().getFullYear() - y
        }
      }
      return updated
    })
  }

  // Nạp CV PDF
  useEffect(() => {
    let active = true

    async function loadPdf() {
      setIsLoadingPdf(true)
      try {
        // 1. Thử fileDataUrl trong bộ nhớ
        if (formData.fileDataUrl) {
          const blob = dataUrlToBlob(formData.fileDataUrl)
          if (blob && active) {
            setCurrentPdfBlob(blob)
            setIsLoadingPdf(false)
            return
          }
        }

        // 2. Thử IndexedDB theo maNV hoặc candidateId
        const idList = [formData.maNV, formData.candidateId, row?.maNV, row?.candidateId].filter(Boolean)
        for (const id of idList) {
          const original = await getOriginalCandidatePdf(id)
          if (original && active) {
            const blob = typeof original === 'string' ? dataUrlToBlob(original) : original
            setCurrentPdfBlob(blob)
            setIsLoadingPdf(false)
            return
          }

          const saved = await getCandidatePdf(id)
          if (saved && active) {
            const blob = typeof saved === 'string' ? dataUrlToBlob(saved) : saved
            setCurrentPdfBlob(blob)
            setIsLoadingPdf(false)
            return
          }
        }

        // 3. Thử tải tệp gốc từ GitHub cvs
        const fn = formData.fileName || ''
        const ghUrl = formData.fileUrl || (fn && (fn.startsWith('17') || fn.includes('_') || fn.endsWith('.pdf')) ? `https://raw.githubusercontent.com/ceohomes/CV-TQT/main/cvs/${fn}` : null)
        if (ghUrl) {
          try {
            const resp = await fetch(ghUrl)
            if (resp.ok) {
              const blob = await resp.blob()
              if (blob && blob.size > 100 && active) {
                if (formData.maNV) await saveCandidatePdf(formData.maNV, blob)
                setCurrentPdfBlob(blob)
                setIsLoadingPdf(false)
                return
              }
            }
          } catch (ghErr) {
            console.warn('Lỗi nạp CV từ GitHub raw:', ghErr)
          }
        }

        // 4. Trường hợp không có CV thì để trống theo yêu cầu
        if (active) {
          setCurrentPdfBlob(null)
          setIsLoadingPdf(false)
        }
      } catch (err) {
        console.error('Lỗi khi nạp PDF trong EditModal:', err)
      } finally {
        if (active) setIsLoadingPdf(false)
      }
    }

    loadPdf()

    return () => {
      active = false
    }
  }, [formData.maNV, formData.candidateId, formData.fileName])

  // Quét lại CV bằng AI Gemini
  const handleRescanWithAi = async () => {
    setIsRescanning(true)
    setRescanSuccessMsg('')
    try {
      let base64Data = formData.fileDataUrl || ''
      if (!base64Data && (formData.maNV || formData.candidateId)) {
        const id = formData.maNV || formData.candidateId
        const saved = await getCandidatePdf(id)
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
          fileName: formData.fileName || `${formData.hoTen || 'CV'}.pdf`,
          mimeType: 'application/pdf',
          base64Data: base64Data || ''
        })
      })
      const resJson = await res.json()
      if (resJson.success && resJson.data) {
        const parsed = resJson.data
        setFormData(prev => ({
          ...prev,
          ...parsed,
          fileDataUrl: base64Data || prev.fileDataUrl,
          ngaySinh: parsed.ngaySinh || prev.ngaySinh,
          diemPhuHop: parsed.diemPhuHop || prev.diemPhuHop || 8.5,
          aiDanhGia: parsed.aiDanhGia || prev.aiDanhGia
        }))
        setRescanSuccessMsg('Đã quét lại và cập nhật thông tin ứng viên bằng AI thành công!')
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

  // Tải lên tệp PDF mới
  const handleUploadPdf = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      const idToSave = formData.maNV || formData.candidateId || 'temp'
      await saveCandidatePdf(idToSave, dataUrl)
      await saveOriginalCandidatePdf(idToSave, dataUrl)
      const blob = dataUrlToBlob(dataUrl) || file
      setCurrentPdfBlob(blob)

      // Đẩy lên GitHub repository
      let ghResult = null
      try {
        const ghRes = await fetch(apiUrl('/api/upload-cv-github'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            base64Data: dataUrl,
            candidateName: formData.hoTen
          })
        })
        if (ghRes.ok) {
          ghResult = await ghRes.json()
        }
      } catch (ghErr) {
        console.warn('Lỗi tải tệp lên GitHub:', ghErr)
      }

      setFormData(prev => ({
        ...prev,
        fileName: ghResult?.fileName || file.name,
        fileUrl: ghResult?.downloadUrl || prev.fileUrl || '',
        githubUrl: ghResult?.htmlUrl || prev.githubUrl || '',
        fileDataUrl: dataUrl
      }))
    }
    reader.readAsDataURL(file)
  }

  // Tải về CV PDF
  const handleDownloadPdf = async () => {
    let blobToDownload = currentPdfBlob
    if (!blobToDownload) {
      alert('Hồ sơ này chưa có tệp CV đính kèm để tải về.')
      return
    }
    if (blobToDownload) {
      const url = URL.createObjectURL(blobToDownload)
      const link = document.createElement('a')
      link.href = url
      link.download = formData.fileName || `${formData.hoTen || 'HoSo'}_CV.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  }

  // Lưu thông tin
  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (formData.isNew && !String(formData.maNV || '').trim()) {
      alert('Vui lòng nhập Mã nhân viên (ID) trước khi lưu hồ sơ thủ kho mới.')
      return
    }
    setIsSaving(true)
    try {
      if (onSave) {
        await onSave(formData)
      }
      setSaveSuccessMsg('Đã lưu thành công!')
      setTimeout(() => {
        setSaveSuccessMsg('')
        onClose()
      }, 700)
    } catch (err) {
      console.error('Lỗi khi lưu thông tin thủ kho:', err)
      alert('Lỗi lưu thông tin: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Tự động lưu ngay khi chọn Chức vụ khác (không cần bấm nút Lưu thay đổi)
  const handleChucVuAutoSave = async (newValue) => {
    const updated = { ...formData, chucVu: newValue }
    setFormData(updated)
    setIsSaving(true)
    try {
      if (onSave) {
        await onSave(updated)
      }
      setSaveSuccessMsg('Đã lưu thành công!')
      setTimeout(() => setSaveSuccessMsg(''), 1500)
    } catch (err) {
      console.error('Lỗi khi lưu chức vụ:', err)
      alert('Lỗi lưu thông tin: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Xử lý lưu từ Modal chỉnh sửa popup chuẩn như sheet Tuyển dụng
  const handleSaveCandidateModal = async (updatedData) => {
    const merged = {
      ...formData,
      ...updatedData
    }
    setFormData(merged)
    setShowEditCandidateModal(false)

    // Đồng bộ vào localStorage sgc_tuyen_dung_candidates nếu có
    try {
      const raw = localStorage.getItem('sgc_tuyen_dung_candidates')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          const idx = list.findIndex(c => 
            (c.id && merged.candidateId && String(c.id) === String(merged.candidateId)) ||
            (c.maNV && merged.maNV && String(c.maNV).trim().toLowerCase() === String(merged.maNV).trim().toLowerCase()) ||
            (c.hoTen && merged.hoTen && c.hoTen.trim().toLowerCase() === merged.hoTen.trim().toLowerCase())
          )
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...merged }
            localStorage.setItem('sgc_tuyen_dung_candidates', JSON.stringify(list))
          }
        }
      }
    } catch (e) {
      console.warn('Could not sync recruitment localStorage:', e)
    }

    if (onSave) {
      try {
        setIsSaving(true)
        await onSave(merged)
        setSaveSuccessMsg('Đã cập nhật thông tin thành công!')
        setTimeout(() => setSaveSuccessMsg(''), 3500)
      } catch (err) {
        console.error('Lỗi khi lưu thông tin:', err)
        alert('Lỗi lưu thông tin: ' + err.message)
      } finally {
        setIsSaving(false)
      }
    }
  }

  // Xác nhận xóa
  const handleDeleteClick = () => {
    if (showConfirm && onDelete) {
      const message = `Xóa thông tin thủ kho:\n${formData.hoTen || ''} (Mã NV: ${formData.maNV || ''})\nBạn có chắc chắn muốn xóa thông tin thủ kho này khỏi hệ thống không?\nHành động này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.`
      showConfirm(
        message,
        async () => {
          setIsSaving(true)
          try {
            await onDelete(formData)
            onClose()
          } catch (err) {
            console.error('Lỗi xóa thủ kho:', err)
          } finally {
            setIsSaving(false)
          }
        },
        () => {},
        'XÁC NHẬN XÓA THỦ KHO',
        'error'
      )
    }
  }

  const isGitHubBacked = Boolean(
    formData.githubUrl || 
    formData.fileUrl || 
    (formData.fileName && (formData.fileName.startsWith('17') || formData.fileName.includes('_') || formData.fileName.endsWith('.pdf')))
  )

  const ghWebUrl = formData.githubUrl || (formData.fileName ? `https://github.com/ceohomes/CV-TQT/blob/main/cvs/${formData.fileName}` : 'https://github.com/ceohomes/CV-TQT/tree/main/cvs')

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13.5px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: 500
  }

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    display: 'block',
    marginBottom: '5px',
    textAlign: 'left'
  }

  const sectionCardStyle = {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  }

  const sectionHeaderStyle = {
    fontSize: '13px',
    fontWeight: 800,
    color: '#0f58a7',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: 8,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: isFullScreen ? '#ffffff' : 'rgba(15, 23, 42, 0.75)',
        backdropFilter: isFullScreen ? 'none' : 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: isFullScreen ? 0 : '12px 16px',
        fontFamily: "'Roboto', sans-serif"
      }}
      onClick={onClose}
    >
      <div 
        style={{
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
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header matching Recruitment View */}
        <div style={{
          padding: '12px 22px',
          background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 16
        }}>
          {/* Avatar & Title & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#ffffff',
              color: '#0f58a7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}>
              {initials(formData.hoTen || 'TK')}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap', color: '#ffffff' }}>
                  {formData.hoTen || (formData.isNew ? 'Thêm mới thủ kho' : 'Chi tiết thủ kho')}
                </h3>

                {formData.maNV && (
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    fontSize: 12,
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontWeight: 700
                  }}>
                    Mã NV: {formData.maNV}
                  </span>
                )}

                {formData.fileName && (currentPdfBlob || isGitHubBacked) ? (
                  <span style={{
                    background: '#ffffff',
                    color: '#0f58a7',
                    border: '1.5px solid rgba(255, 255, 255, 0.7)',
                    fontSize: 12,
                    padding: '3px 12px',
                    borderRadius: 18,
                    fontWeight: 700,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: 320
                  }} title={formData.fileName}>
                    📄 CV: {formData.fileName}
                  </span>
                ) : (
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#f1f5f9',
                    border: '1px dashed rgba(255, 255, 255, 0.4)',
                    fontSize: 12,
                    padding: '3px 12px',
                    borderRadius: 18,
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    Chưa có CV
                  </span>
                )}

                {isGitHubBacked && formData.fileName && (currentPdfBlob || ghWebUrl) && (
                  <a
                    href={ghWebUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#ffffff',
                      color: '#15803d',
                      border: '1.5px solid rgba(255, 255, 255, 0.7)',
                      borderRadius: 18,
                      padding: '3px 10px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer'
                    }}
                    title="Xem tệp CV gốc lưu trên GitHub (ceohomes/CV-TQT/cvs)"
                  >
                    <span>🐙 GitHub cvs</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              <div style={{ fontSize: 12.5, color: '#c7d2fe', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>{formData.banChuoiKhoi || 'Khối Thi công'}</span>
                <span>·</span>
                <span>{formData.duAn || 'Chưa phân bổ'}</span>
                <span>·</span>
                <span>{formData.chucVu || 'Thủ kho'}</span>
              </div>
            </div>
          </div>

          {/* Right Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {saveSuccessMsg && (
              <div style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '5px 12px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Check size={14} />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                borderRadius: 8,
                padding: '7px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13,
                fontWeight: 700
              }}
            >
              <X size={16} />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* 2-Pane Split Content Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Column: Profile View matching Sheet Tuyển dụng (with Edit Mode Toggle) */}
          <div style={{
            flex: '1 1 0',
            minWidth: 460,
            overflowY: 'auto',
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            borderRight: '1px solid #cbd5e1',
            background: '#ffffff'
          }}>

            {!isEditMode ? (
              /* ================= MODE 1: RECRUITMENT SHEET PROFILE VIEW (CHẾ ĐỘ XEM HỒ SƠ CHUẨN SHEET TUYỂN DỤNG) ================= */
              <>
                {/* 1. ĐÁNH GIÁ ĐỘ PHÙ HỢP TỪ GEMINI AI */}
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
                        title="Quét lại nội dung CV bằng AI Gemini để trích xuất đánh giá"
                      >
                        {isRescanning ? <RefreshCw size={13} className="spin-icon" /> : <Sparkles size={13} color="#fef08a" />}
                        <span>{isRescanning ? 'Đang trích xuất...' : 'Quét lại bằng AI'}</span>
                      </button>

                      {formData.diemPhuHop != null && Number(formData.diemPhuHop) > 0 && (
                        <div style={{
                          background: '#7c3aed', color: '#ffffff', fontWeight: 800,
                          fontSize: 13, padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <Star size={14} fill="#fef08a" stroke="none" />
                          <span>Điểm phù hợp: {formData.diemPhuHop}/10</span>
                        </div>
                      )}
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
                    {formData.aiDanhGia || 'Chưa có thông tin đánh giá từ AI.'}
                  </p>
                </div>

                {/* 2. INFO GRID: LIÊN HỆ & CHUYÊN MÔN */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {/* Cột 1: LIÊN HỆ & CÁ NHÂN */}
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={13} /> LIÊN HỆ & CÁ NHÂN
                    </span>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <div>Điện thoại: <b>{formData.soDienThoai || '—'}</b></div>
                      <div>Email: <b>{formData.emailCongTy || formData.email || '—'}</b></div>
                      <div>Ngày sinh: <b>{formData.ngaySinh ? formatDate(formData.ngaySinh) : '—'}</b> {displayAge ? `(${displayAge} tuổi)` : ''}</div>
                      <div>CCCD: <b>{formData.cccd || '—'}</b></div>
                      <div>Quê quán: <b>{formData.queQuan || '—'}</b></div>
                      <div>Địa chỉ: <b>{formData.diaChi || '—'}</b></div>
                    </div>
                  </div>

                  {/* Cột 2: CHUYÊN MÔN & KINH NGHIỆM */}
                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Briefcase size={13} /> CHUYÊN MÔN & KINH NGHIỆM
                    </span>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <div>Trình độ: <b>{formData.trinhDo || '—'}</b></div>
                      <div>Chuyên ngành: <b>{formData.chuyenNganh || '—'}</b></div>
                      <div>Kinh nghiệm: <b>{(formData.soNamKinhNghiem != null && Number(formData.soNamKinhNghiem) > 0) ? `${formData.soNamKinhNghiem} năm` : '—'}</b></div>
                      <div>Chứng chỉ: <b>{formData.chungChiATLD || formData.chungChiNghiepVuKho || '—'}</b></div>
                      <div>Ngày vào làm: <b>{formData.ngayVaoLam ? formatDate(formData.ngayVaoLam) : '—'}</b></div>
                      <div>Lương cơ bản: <b>{(formData.luongCoBan != null && Number(formData.luongCoBan) > 0) ? `${Number(formData.luongCoBan).toLocaleString('vi-VN')} đ` : '—'}</b></div>
                    </div>
                  </div>
                </div>

                {/* 3. TÓM TẮT KINH NGHIỆM LÀM VIỆC */}
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>TÓM TẮT KINH NGHIỆM LÀM VIỆC</span>
                  <div style={{ marginTop: 6, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                    {formData.kinhNghiem || 'Chưa có thông tin tóm tắt kinh nghiệm.'}
                  </div>
                </div>

                {/* 4. KỸ NĂNG NỔI BẬT */}
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>KỸ NĂNG NỔI BẬT</span>
                  <div style={{ marginTop: 6, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155' }}>
                    {formData.kyNang || 'Chưa có thông tin kỹ năng.'}
                  </div>
                </div>

                {/* 5. CÔNG VIỆC, PHÂN BỔ & ĐIỀU KHIỂN QUẢN LÝ (TRẠNG THÁI, CHỨC VỤ) */}
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
                  {/* Hàng điều khiển 1: Trạng thái & Chức vụ */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {/* Trạng thái làm việc */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                          Trạng thái:
                        </span>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                          <select
                            value={formData.trangThai || 'Đang làm việc'}
                            onChange={(e) => handleChange('trangThai', e.target.value)}
                            style={{
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              background: formData.trangThai === 'Đang làm việc' 
                                ? '#059669' 
                                : formData.trangThai === 'Đã nghỉ việc' 
                                ? '#dc2626' 
                                : formData.trangThai === 'Thử việc'
                                ? '#d97706' 
                                : '#2563eb',
                              color: '#ffffff',
                              border: '1.5px solid transparent',
                              borderRadius: 8,
                              padding: '6px 28px 6px 12px',
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            {TRANG_THAI_LIST.map(st => (
                              <option key={st} value={st} style={{ color: '#1e293b', background: '#ffffff' }}>{st}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: '#ffffff' }} />
                        </div>
                      </div>

                      {/* Chức vụ */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                          Chức vụ:
                        </span>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                          <select
                            value={formData.chucVu || 'Thủ kho hiện trường'}
                            onChange={(e) => handleChucVuAutoSave(e.target.value)}
                            style={{
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              background: '#ffffff',
                              color: '#0f58a7',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: 8,
                              padding: '6px 28px 6px 12px',
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              maxWidth: 240
                            }}
                          >
                            {CHUC_VU_LIST.map(pos => (
                              <option key={pos} value={pos} style={{ color: '#0f172a', background: '#ffffff' }}>{pos}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: '#0f58a7' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hàng thông báo nhân sự chính thức & Nút thao tác */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle size={20} color="#059669" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065f46' }}>
                          Hồ sơ nhân sự chính thức {formData.maNV ? `— Mã NV: ${formData.maNV}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: '#047857' }}>
                          {formData.banChuoiKhoi ? `${formData.banChuoiKhoi} · ` : ''}{formData.duAn || 'Chưa phân bổ'} · {formData.chucVu || 'Thủ kho'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowEditCandidateModal(true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '7px 14px', borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f58a7', fontWeight: 700, cursor: 'pointer',
                          fontSize: 13, whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f9ff'
                          e.currentTarget.style.borderColor = '#93c5fd'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff'
                          e.currentTarget.style.borderColor = '#cbd5e1'
                        }}
                        title="Chỉnh sửa chi tiết hồ sơ trong popup"
                      >
                        <Edit3 size={14} />
                        <span>Chỉnh sửa chi tiết</span>
                      </button>

                      {!formData.isNew && onDelete && (
                        <button
                          type="button"
                          onClick={handleDeleteClick}
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
                          title="Xóa thông tin thủ kho này"
                        >
                          <Trash2 size={14} />
                          <span>Xóa hồ sơ</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* ================= MODE 2: FULL EDIT FORM (CHẾ ĐỘ CHỈNH SỬA TOÀN BỘ FORM) ================= */
              <>
                {/* CARD 1: GEMINI AI ASSESSMENT */}
                <div style={{
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                  borderRadius: 14,
                  border: '1.5px solid #ddd6fe',
                  padding: 16,
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6d28d9', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                      <Sparkles size={16} />
                      <span>ĐÁNH GIÁ ĐỘ PHÙ HỢP TỪ GEMINI AI</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#7c3aed',
                      color: '#ffffff',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800
                    }}>
                      <Star size={13} fill="#ffffff" />
                      <span>Điểm phù hợp: {formData.diemPhuHop || '8.5'}/10</span>
                    </div>
                  </div>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: 68,
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: '#4c1d95',
                      backgroundColor: '#ffffff',
                      border: '1px solid #c4b5fd',
                      borderRadius: 8,
                      resize: 'vertical'
                    }}
                    value={formData.aiDanhGia || ''}
                    onChange={e => handleChange('aiDanhGia', e.target.value)}
                    placeholder="Nhận xét đánh giá năng lực ứng viên từ trí tuệ nhân tạo Gemini..."
                  />
                </div>

                {/* CARD 2: THÔNG TIN CÁ NHÂN & LIÊN HỆ */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <User size={15} />
                    <span>THÔNG TIN CÁ NHÂN & LIÊN HỆ</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                    <div>
                      <label style={labelStyle}>Họ và tên <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="text"
                        style={{ ...inputStyle, fontWeight: 700, color: '#0f58a7' }}
                        value={formData.hoTen || ''}
                        onChange={e => handleChange('hoTen', e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Mã nhân viên (ID) {formData.isNew && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <input
                        type="text"
                        style={{
                          ...inputStyle,
                          fontWeight: 700,
                          backgroundColor: formData.isNew ? '#ffffff' : '#f1f5f9',
                          color: '#0f58a7',
                          borderColor: (formData.isNew && !String(formData.maNV || '').trim()) ? '#fca5a5' : inputStyle.borderColor
                        }}
                        value={formData.maNV || ''}
                        onChange={e => handleChange('maNV', e.target.value)}
                        disabled={!formData.isNew}
                        required={formData.isNew}
                        placeholder={formData.isNew ? 'Bắt buộc nhập Mã NV' : ''}
                      />
                      {formData.isNew && !String(formData.maNV || '').trim() && (
                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                          Vui lòng nhập Mã NV trước khi lưu
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={labelStyle}>Số điện thoại di động</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.soDienThoai || ''}
                        onChange={e => handleChange('soDienThoai', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        style={inputStyle}
                        value={formData.emailCongTy || ''}
                        onChange={e => handleChange('emailCongTy', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Ngày sinh {formData.tuoi ? `(${formData.tuoi} tuổi)` : ''}
                      </label>
                      <input
                        type="text"
                        style={inputStyle}
                        placeholder="VD: 15/06/2001 hoặc 2001-06-15"
                        value={formData.ngaySinh || ''}
                        onChange={e => handleChange('ngaySinh', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Số CCCD / CMND</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.cccd || ''}
                        onChange={e => handleChange('cccd', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Quê quán</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.queQuan || ''}
                        onChange={e => handleChange('queQuan', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Địa chỉ thường trú</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.diaChi || ''}
                        onChange={e => handleChange('diaChi', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 3: CÔNG VIỆC, PHÂN BỔ & ĐÁNH GIÁ */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <Briefcase size={15} />
                    <span>CÔNG VIỆC, PHÂN BỔ & ĐÁNH GIÁ HIỆU SUẤT</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                    <div>
                      <label style={labelStyle}>Khối thi công / Ban chuỗi khối <span style={{ color: '#ef4444' }}>*</span></label>
                      <select
                        style={{ ...inputStyle, fontWeight: 700, color: '#0f58a7' }}
                        value={formData.banChuoiKhoi || 'Khối Thi công'}
                        onChange={e => handleChange('banChuoiKhoi', e.target.value)}
                      >
                        {availableBlocks.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Dự án / Công trình phân bổ</label>
                      <select
                        style={inputStyle}
                        value={formData.duAn || 'Chưa phân bổ'}
                        onChange={e => handleChange('duAn', e.target.value)}
                      >
                        <option value="Chưa phân bổ">Chưa phân bổ</option>
                        {filteredProjects.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Chức vụ / Chức danh</label>
                      <select
                        style={inputStyle}
                        value={formData.chucVu || 'Thủ kho hiện trường'}
                        onChange={e => handleChange('chucVu', e.target.value)}
                      >
                        {CHUC_VU_LIST.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Trạng thái làm việc</label>
                      <select
                        style={inputStyle}
                        value={formData.trangThai || 'Đang làm việc'}
                        onChange={e => handleChange('trangThai', e.target.value)}
                      >
                        {TRANG_THAI_LIST.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Đánh giá hiệu suất</label>
                      <select
                        style={inputStyle}
                        value={formData.danhGiaHieuSuat || 'Tốt'}
                        onChange={e => handleChange('danhGiaHieuSuat', e.target.value)}
                      >
                        {DANH_GIA_LIST.map(ev => (
                          <option key={ev} value={ev}>{ev}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Loại hợp đồng</label>
                      <select
                        style={inputStyle}
                        value={formData.loaiHopDong || 'Chính thức (không xác định thời hạn)'}
                        onChange={e => handleChange('loaiHopDong', e.target.value)}
                      >
                        {LOAI_HD_LIST.map(hd => (
                          <option key={hd} value={hd}>{hd}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Ngày vào làm</label>
                      <input
                        type="date"
                        style={inputStyle}
                        value={formData.ngayVaoLam ? formData.ngayVaoLam.split('T')[0] : ''}
                        onChange={e => handleChange('ngayVaoLam', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Lương cơ bản (VNĐ)</label>
                      <input
                        type="number"
                        style={inputStyle}
                        value={formData.luongCoBan || ''}
                        onChange={e => handleChange('luongCoBan', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 4: HỌC VẤN & KINH NGHIỆM */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <Award size={15} />
                    <span>CHUYÊN MÔN, HỌC VẤN & CHỨNG CHỈ</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px' }}>
                    <div>
                      <label style={labelStyle}>Trình độ đào tạo</label>
                      <select
                        style={inputStyle}
                        value={formData.trinhDo || 'Đại học'}
                        onChange={e => handleChange('trinhDo', e.target.value)}
                      >
                        {TRINH_DO_LIST.map(td => (
                          <option key={td} value={td}>{td}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Chuyên ngành</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.chuyenNganh || ''}
                        onChange={e => handleChange('chuyenNganh', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Số năm kinh nghiệm</label>
                      <input
                        type="number"
                        style={inputStyle}
                        value={formData.soNamKinhNghiem ?? ''}
                        onChange={e => handleChange('soNamKinhNghiem', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Chứng chỉ An toàn lao động (ATLĐ)</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.chungChiATLD || ''}
                        onChange={e => handleChange('chungChiATLD', e.target.value)}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>Chứng chỉ nghiệp vụ / Khác</label>
                      <input
                        type="text"
                        style={inputStyle}
                        value={formData.chungChiNghiepVuKho || ''}
                        onChange={e => handleChange('chungChiNghiepVuKho', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 5: TÓM TẮT KINH NGHIỆM */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <Calendar size={15} />
                    <span>TÓM TẮT KINH NGHIỆM LÀM VIỆC</span>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                    value={formData.kinhNghiem || ''}
                    onChange={e => handleChange('kinhNghiem', e.target.value)}
                    placeholder="Mô tả tóm tắt kinh nghiệm làm việc thực tế của thủ kho..."
                  />
                </div>

                {/* CARD 6: KỸ NĂNG NỔI BẬT */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <Sparkles size={15} />
                    <span>KỸ NĂNG NỔI BẬT</span>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                    value={formData.kyNang || ''}
                    onChange={e => handleChange('kyNang', e.target.value)}
                    placeholder="Các kỹ năng nổi bật (Excel, phần mềm kho, quản lý chứng từ...)"
                  />
                </div>

                {/* CARD 7: GHI CHÚ */}
                <div style={sectionCardStyle}>
                  <div style={sectionHeaderStyle}>
                    <Info size={15} />
                    <span>GHI CHÚ QUẢN LÝ</span>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                    value={formData.ghiChu || ''}
                    onChange={e => handleChange('ghiChu', e.target.value)}
                    placeholder="Ghi chú thêm về nhân sự thủ kho này..."
                  />
                </div>

                {/* BOTTOM ACTIONS */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0 6px',
                  borderTop: '1px solid #e2e8f0',
                  marginTop: 4
                }}>
                  <div>
                    {!formData.isNew && onDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteClick}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#e11d48',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Xóa thông tin thủ kho</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        borderRadius: 8,
                        padding: '8px 18px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSaving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#0f58a7',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: 8,
                        padding: '8px 22px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(15, 88, 167, 0.3)'
                      }}
                    >
                      <Check size={16} />
                      <span>{isSaving ? 'Đang lưu...' : 'Lưu thông tin'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Right Column: Dedicated PDF Viewer matching Recruitment View */}
          <div style={{
            flex: '1 1 0',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f172a',
            overflow: 'hidden'
          }}>
            <CandidatePdfViewer
              candidate={formData}
              pdfBlob={currentPdfBlob}
              isLoading={isLoadingPdf}
              onUploadNewPdf={handleUploadPdf}
              onDownload={handleDownloadPdf}
              onPrint={() => window.print()}
            />
          </div>

        </div>
      </div>

      {/* Popup chỉnh sửa chi tiết chuẩn sheet Tuyển dụng */}
      {showEditCandidateModal && (
        <EditThuKhoPopupModal
          formData={formData}
          onClose={() => setShowEditCandidateModal(false)}
          onSave={handleSaveCandidateModal}
          availableBlocks={availableBlocks}
        />
      )}
    </div>
  )
}
