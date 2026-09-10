import React, { useEffect, useState, useMemo } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import DashboardTab from './components/DashboardTab.jsx'
import DanhSachTab from './components/DanhSachTab.jsx'
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
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbStatus, setDbStatus] = useState('loading') // 'loading' | 'connected' | 'empty' | 'error'
  const [isPinned, setIsPinned] = useState(false)
  const [initialSearch, setInitialSearch] = useState('')
  const [initialDuAnFilter, setInitialDuAnFilter] = useState('')
  const [initialDuAnSearch, setInitialDuAnSearch] = useState('')

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

  // Hàm xử lý khi ứng viên được tuyển dụng thành công -> chuyển sang Danh sách thủ kho
  const handleRecruitSuccess = async (candidate, officialMaNV, officialDuAn, officialChucVu, officialKhoi) => {
    try {
      const maxStt = data.reduce((max, item) => Math.max(max, Number(item.stt) || 0), 0)
      
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

      // Ghi nhận vào Supabase với cơ chế loại bỏ cột lỗi (column pruning)
      let success = false
      let attempts = 0
      const maxAttempts = 40
      let currentPayload = { ...payload }

      while (!success && attempts < maxAttempts) {
        attempts++
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

      // Tải lại dữ liệu chính thức
      await loadData()

      // Tự động chuyển ngay sang tab Danh sách thủ kho và lọc theo Mã nhân viên vừa tuyển
      setInitialSearch(officialMaNV)
      setTab('danhsach')

    } catch (err) {
      console.error('Lỗi khi thực hiện lưu vào Danh sách thủ kho:', err)
      // Vẫn điều hướng để người dùng thấy
      setInitialSearch(officialMaNV)
      setTab('danhsach')
    }
  }

  const handleNavigateToStorekeeper = (maNV) => {
    setInitialDuAnSearch(maNV)
    setTab('duan')
  }

  // Đếm số lượng để hiển thị badge số lượng trong Sidebar
  const counts = useMemo(() => {
    return {
      dashboard: 0,
      tuyendung: recruitmentCount,
      danhsach: data.length
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
              {tab === 'dashboard' && (
                <DashboardTab 
                  data={data} 
                  onNavigateToTab={(nextTab, filterVal) => {
                    if (filterVal !== undefined) {
                      setInitialDuAnFilter(filterVal)
                    }
                    setTab(nextTab)
                  }} 
                />
              )}
              {tab === 'tuyendung' && (
                <TuyenDungTab
                  existingThuKhoData={data}
                  onRecruitSuccess={handleRecruitSuccess}
                  onNavigateToStorekeeper={handleNavigateToStorekeeper}
                  dbStatus={dbStatus}
                  onCandidatesCountChange={setRecruitmentCount}
                  onReload={loadData}
                />
              )}
              {tab === 'danhsach' && (
                <DanhSachTab 
                  data={data} 
                  onUpdateData={setData} 
                  dbStatus={dbStatus} 
                  onReload={loadData} 
                  initialDuAnFilter={initialDuAnFilter}
                  setInitialDuAnFilter={setInitialDuAnFilter}
                  initialSearch={initialSearch}
                  setInitialSearch={setInitialSearch}
                />
              )}
              {tab === 'thongtinduan' && <ThongTinDuAnTab data={data} onReload={loadData} />}
              {tab === 'duan' && (
                <DuAnTab
                  data={data}
                  onUpdateData={setData}
                  onReload={loadData}
                  initialSearch={initialDuAnSearch}
                  setInitialSearch={setInitialDuAnSearch}
                />
              )}
              {tab === 'dinhbien' && <DinhBienTab data={data} onReload={loadData} />}
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
