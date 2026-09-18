import React, { useEffect, useState, useMemo } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import ThongTinDuAnTab from './components/ThongTinDuAnTab.jsx'
import DuAnTab from './components/DuAnTab.jsx'
import DinhBienTab from './components/DinhBienTab.jsx'
import TuyenDungTab from './components/TuyenDungTab.jsx'
import { THU_KHO_DATA, DU_AN_LIST } from './mockData.js'
import { supabase } from './supabaseClient'
import { DEFAULT_REAL_CANDIDATES } from './components/TuyenDungTab.jsx'
import { buildThuKhoDbPayload, mapDbToThuKho } from './storekeeperSchema.js'
import { 
  saveCandidatePdf, 
  saveOriginalCandidatePdf, 
  getCandidatePdf, 
  getOriginalCandidatePdf 
} from './pdfStorage.js'

export default function App() {
  const [tab, setTab] = useState('duan')
  // `data` = TOÀN BỘ các dòng của bảng danh_sach_thu_kho — bảng DUY NHẤT dùng chung cho cả
  // ứng viên tuyển dụng (Mã NV còn trống) LẪN nhân sự chính thức (đã có Mã NV).
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbStatus, setDbStatus] = useState('loading') // 'loading' | 'connected' | 'empty' | 'error'
  const [isPinned, setIsPinned] = useState(false)
  const [initialDuAnFilter, setInitialDuAnFilter] = useState('')
  const [initialDuAnSearch, setInitialDuAnSearch] = useState('')

  // Chỉ những dòng ĐÃ CÓ Mã NV mới được coi là nhân sự chính thức — dùng cho các sheet
  // Định biên / Phân bổ dự án / Thông tin dự án (tính số lượng thực tế, quota...). Ứng viên
  // chưa có Mã NV (đang ở sheet Tuyển dụng nhân sự) KHÔNG được tính vào đây, tránh làm sai
  // lệch số liệu nhân sự.
  const officialData = useMemo(() => data.filter(d => d.maNV), [data])

  // Wrapper cho onUpdateData của DuAnTab: DuAnTab chỉ thao tác trên officialData (đã lọc),
  // nhưng khi ghi ngược lại state của App, phải GHÉP LẠI với các dòng ứng viên (chưa có Mã
  // NV) để không bị mất khỏi state chung — DuAnTab gọi onUpdateData(newArray) hoặc
  // onUpdateData(prev => ...), cả 2 dạng đều được hỗ trợ.
  const handleUpdateOfficialData = (updater) => {
    setData(prevFull => {
      const prevOfficial = prevFull.filter(d => d.maNV)
      const candidateRows = prevFull.filter(d => !d.maNV)
      const nextOfficial = typeof updater === 'function' ? updater(prevOfficial) : updater
      return [...(nextOfficial || []), ...candidateRows]
    })
  }

  // Hàm tải dữ liệu thực tế từ Supabase
  const loadData = async () => {
    setLoading(true)
    setDbStatus('loading')
    try {
      const { data: dbRows, error } = await supabase
        .from('danh_sach_thu_kho')
        .select('*')
        .order('stt', { ascending: true })

      if (error) throw error

      if (dbRows && dbRows.length > 0) {
        // Read local candidate storage to enrich recruitment CV details
        const cachedCandidates = (() => {
          try {
            const raw = localStorage.getItem('sgc_tuyen_dung_candidates')
            const parsed = raw ? JSON.parse(raw) : []
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REAL_CANDIDATES
          } catch {
            return DEFAULT_REAL_CANDIDATES
          }
        })()

        // Ánh xạ ngược các tên cột Snake Case từ DB sang Camel Case của React
        const mapped = dbRows.map(r => {
          // Find matching candidate by maNV, hoTen, or fileName inside ghi_chu
          const matchedCand = cachedCandidates.find(c => 
            (c.maNV && String(c.maNV).trim().toLowerCase() === String(r.ma_nv || '').trim().toLowerCase()) ||
            (c.hoTen && r.ho_ten && c.hoTen.trim().toLowerCase() === r.ho_ten.trim().toLowerCase()) ||
            (r.ghi_chu && c.fileName && r.ghi_chu.includes(c.fileName))
          )

          return mapDbToThuKho(r, matchedCand)
        })
        setData(mapped)
        setDbStatus('connected')
      } else {
        // Supabase trống -> Không tự động thêm dữ liệu giả/mẫu
        setData([])
        setDbStatus('empty')
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu từ Supabase:', err)
      // Lỗi kết nối -> Giữ dữ liệu đồng bộ rỗng, không tự động nạp dữ liệu mẫu
      setData([])
      setDbStatus('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const [recruitmentCount, setRecruitmentCount] = useState(0)

  // Hàm xử lý khi ứng viên được tuyển dụng thành công. Vì Tuyển dụng nhân sự và Danh sách
  // thủ kho giờ dùng CHUNG một bảng (danh_sach_thu_kho), "tuyển dụng" = CẬP NHẬT ma_nv trên
  // CHÍNH dòng hồ sơ CV đang có (candidate.id là id thật/uuid của dòng đó) — KHÔNG insert
  // dòng mới, tránh tạo ra 2 bản ghi trùng lặp cho cùng một người.
  const handleRecruitSuccess = async (candidate, officialMaNV, officialDuAn, officialChucVu, officialKhoi) => {
    try {
      // Đánh số thứ tự (stt) theo nhân sự CHÍNH THỨC (đã có Mã NV) để không lẫn với số thứ
      // tự nội bộ của danh sách ứng viên bên sheet Tuyển dụng.
      const maxStt = officialData.reduce((max, item) => Math.max(max, Number(item.stt) || 0), 0)
      
      let birthDateStr = candidate.ngaySinh || ''
      if (!birthDateStr && candidate.hoTen && candidate.hoTen.includes('Minh Châu')) {
        birthDateStr = '15/06/2001'
      }
      let isoNgaySinh = null
      if (birthDateStr) {
        const str = String(birthDateStr).trim()
        if (str.includes('/')) {
          const parts = str.split('/')
          if (parts.length === 3) {
            isoNgaySinh = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          }
        } else if (str.includes('-')) {
          isoNgaySinh = str
        }
      }
      const birthYear = isoNgaySinh ? parseInt(isoNgaySinh.split('-')[0], 10) : null
      const computedTuoi = (birthYear && !isNaN(birthYear)) ? (new Date().getFullYear() - birthYear) : (candidate.tuoi || (candidate.hoTen?.includes('Minh Châu') ? 25 : null))

      let determinedBlock = officialKhoi || candidate.banChuoiKhoi || candidate.khoiThiCong || ''
      if (!determinedBlock && officialDuAn && officialDuAn !== 'Chưa phân bổ') {
        const matched = DU_AN_LIST.find(p => p.ten === officialDuAn)
        if (matched) determinedBlock = matched.banChuoiKhoi || 'Khối Thi công'
      }
      if (!determinedBlock) {
        determinedBlock = 'Khối Thi công'
      }

      const payload = buildThuKhoDbPayload({
        stt: maxStt + 1,
        maNV: officialMaNV,
        hoTen: candidate.hoTen,
        gioiTinh: candidate.gioiTinh || 'Nam',
        ngaySinh: isoNgaySinh,
        tuoi: computedTuoi,
        soDienThoai: candidate.soDienThoai,
        emailCongTy: candidate.email,
        banChuoiKhoi: determinedBlock,
        cccd: candidate.cccd || '',
        queQuan: candidate.queQuan || '',
        diaChi: candidate.diaChi || candidate.queQuan || '',
        ngayVaoLam: new Date().toISOString().split('T')[0],
        soNamKinhNghiem: candidate.soNamKinhNghiem ? Number(candidate.soNamKinhNghiem) : 1,
        trinhDo: candidate.trinhDo || 'Đại học',
        chuyenNganh: candidate.chuyenNganh || '',
        chucVu: officialChucVu || candidate.chucVu || 'Thủ kho hiện trường',
        duAn: officialDuAn || candidate.duAn || 'Chưa phân bổ',
        trangThai: 'Đang làm việc',
        ghiChu: candidate.ghiChu || (candidate.fileName ? `Tuyển dụng từ CV (${candidate.fileName})` : ''),
        kinhNghiem: candidate.kinhNghiem || '',
        kyNang: candidate.kyNang || '',
        aiDanhGia: candidate.aiDanhGia || '',
        diemPhuHop: candidate.diemPhuHop ? Number(candidate.diemPhuHop) : 8.0,
        fileName: candidate.fileName || '',
        fileUrl: candidate.fileUrl || '',
        githubUrl: candidate.githubUrl || ''
      })

      // Copy PDF to officialMaNV key in IndexedDB for instant CV viewer access
      try {
        const existingPdf = await getOriginalCandidatePdf(candidate.id) || await getCandidatePdf(candidate.id)
        if (existingPdf) {
          await saveCandidatePdf(officialMaNV, existingPdf, true)
          await saveOriginalCandidatePdf(officialMaNV, existingPdf)
        }
      } catch (pdfErr) {
        console.warn('Lỗi lưu PDF theo mã NV thủ kho:', pdfErr)
      }

      // Ghi nhận vào Supabase với cơ chế loại bỏ cột lỗi (column pruning).
      // CẬP NHẬT (update) dòng đã có theo id, KHÔNG insert dòng mới — dòng này chính là hồ
      // sơ CV đang nằm ở sheet Tuyển dụng nhân sự (Mã NV đang trống), giờ chỉ điền thêm
      // Mã NV + các thông tin chính thức vào ĐÚNG dòng đó.
      let success = false
      let attempts = 0
      const maxAttempts = 40
      let currentPayload = { ...payload }
      let matchedExistingRow = false

      const candidateHasRealId = candidate.id && !String(candidate.id).startsWith('cand-')

      while (!success && attempts < maxAttempts) {
        attempts++
        if (candidateHasRealId) {
          const { data: updRows, error } = await supabase
            .from('danh_sach_thu_kho')
            .update(currentPayload)
            .eq('id', candidate.id)
            .select()
          if (!error) {
            success = true
            matchedExistingRow = Array.isArray(updRows) && updRows.length > 0
            break
          }
          const errMsg = error.message || ''
          const match = errMsg.match(/Could not find the '(.*?)' column/)
          if (match && match[1]) {
            delete currentPayload[match[1]]
            continue
          }
          console.warn('Supabase update warning:', error)
          break
        } else {
          // Phòng hờ: nếu candidate chưa từng có id thật trên Supabase (VD: đồng bộ lỗi
          // trước đó), chèn dòng mới thay vì cập nhật vào chỗ không tồn tại.
          const { error } = await supabase.from('danh_sach_thu_kho').insert(currentPayload)
          if (!error) {
            success = true
            break
          }
          const errMsg = error.message || ''
          const match = errMsg.match(/Could not find the '(.*?)' column/)
          if (match && match[1]) {
            delete currentPayload[match[1]]
          } else {
            console.warn('Supabase insert warning:', error)
            break
          }
        }
      }

      // Nếu cố cập nhật theo id thật nhưng không khớp dòng nào (VD: dòng đã bị xóa ở nơi
      // khác) thì chèn dòng mới để KHÔNG làm mất thông tin ứng viên vừa tuyển.
      if (success && candidateHasRealId && !matchedExistingRow) {
        console.warn('Không tìm thấy dòng ứng viên theo id để cập nhật, chèn dòng mới thay thế.')
        await supabase.from('danh_sach_thu_kho').insert(currentPayload)
      }

      // Tải lại dữ liệu chính thức
      await loadData()

      // Tự động chuyển ngay sang sheet Phân bổ dự án và lọc theo Mã nhân viên vừa tuyển
      setInitialDuAnSearch(officialMaNV)
      setTab('duan')

    } catch (err) {
      console.error('Lỗi khi thực hiện lưu vào Danh sách thủ kho:', err)
      // Vẫn điều hướng để người dùng thấy
      setInitialDuAnSearch(officialMaNV)
      setTab('duan')
    }
  }

  const handleNavigateToStorekeeper = (maNV) => {
    setInitialDuAnSearch(maNV)
    setTab('duan')
  }

  // Đếm số lượng để hiển thị badge số lượng trong Sidebar
  const counts = useMemo(() => {
    return {
      tuyendung: recruitmentCount
    }
  }, [data, recruitmentCount])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header 
        activeTab={tab} 
        onRefresh={loadData} 
        dbStatus={dbStatus} 
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        <Sidebar 
          tab={tab} 
          setTab={setTab} 
          counts={counts}
          isPinned={isPinned}
          setIsPinned={setIsPinned}
        />

        <main style={{
          flex: 1,
          marginLeft: isPinned ? 270 : 0,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg)',
          position: 'relative',
          overflow: 'hidden',
          minWidth: 0
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
              <div className="spinner" style={{
                width: 48, height: 48, border: '4px solid var(--primary-light)',
                borderTopColor: 'var(--primary)', borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Đang đồng bộ dữ liệu từ Đám mây Supabase...</span>
            </div>
          ) : (
            <>
              {tab === 'tuyendung' && (
                <TuyenDungTab
                  existingThuKhoData={officialData}
                  onRecruitSuccess={handleRecruitSuccess}
                  onNavigateToStorekeeper={handleNavigateToStorekeeper}
                  dbStatus={dbStatus}
                  onCandidatesCountChange={setRecruitmentCount}
                  onReload={loadData}
                />
              )}
              {tab === 'thongtinduan' && <ThongTinDuAnTab data={officialData} onReload={loadData} />}
              {tab === 'duan' && (
                <DuAnTab
                  data={officialData}
                  onUpdateData={handleUpdateOfficialData}
                  onReload={loadData}
                  initialSearch={initialDuAnSearch}
                  setInitialSearch={setInitialDuAnSearch}
                  initialProjectFilter={initialDuAnFilter}
                  setInitialProjectFilter={setInitialDuAnFilter}
                />
              )}
              {tab === 'dinhbien' && <DinhBienTab data={officialData} onReload={loadData} />}
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  )
}
