import React, { useEffect, useState, useMemo } from 'react'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import DashboardTab from './components/DashboardTab.jsx'
import DanhSachTab from './components/DanhSachTab.jsx'
import ThongTinDuAnTab from './components/ThongTinDuAnTab.jsx'
import DuAnTab from './components/DuAnTab.jsx'
import { THU_KHO_DATA } from './mockData.js'
import { supabase } from './supabaseClient'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbStatus, setDbStatus] = useState('loading') // 'loading' | 'connected' | 'empty' | 'error'
  const [isPinned, setIsPinned] = useState(false)

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
        // Ánh xạ ngược các tên cột Snake Case từ DB sang Camel Case của React
        const mapped = dbRows.map(r => ({
          stt: r.stt,
          maNV: r.ma_nv,
          hoTen: r.ho_ten,
          gioiTinh: r.gioi_tinh,
          ngaySinh: r.ngay_sinh,
          tuoi: r.tuoi,
          soDienThoai: r.dien_thoai || r.so_dien_thoai || '',
          emailCongTy: r.email || r.email_cong_ty || '',
          banChuoiKhoi: r.khoi_thi_cong || r.ban_chuoi_khoi || '',
          phongVungMien: r.phong_vung_mien,
          cccd: r.cccd,
          queQuan: r.que_quan,
          ngayVaoLam: r.ngay_vao_lam,
          soNamKinhNghiem: r.so_nam_kinh_nghiem,
          trinhDo: r.trinh_do,
          chuyenNganh: r.chuyen_nganh,
          chucVu: r.chuc_danh || r.chuc_vu || '',
          duAnId: r.du_an_id,
          duAn: r.du_an_cong_trinh || r.du_an || '',
          khoPhuTrach: r.kho_phu_trach,
          soLuongKhoQuanLy: r.so_luong_kho_quan_ly,
          giaTriTonKhoQuanLy: Number(r.gia_tri_ton_kho_quan_ly || 0),
          loaiHopDong: r.loai_hop_dong,
          ngayHetHanHD: r.ngay_het_han_hd,
          trangThai: r.trang_thai,
          luongCoBan: Number(r.luong_co_ban || 0),
          chungChiNghiepVuKho: r.chung_chi_nghiep_vu_kho,
          chungChiATLD: r.chung_chi_atld,
          danhGiaHieuSuat: r.danh_gia || r.danh_gia_hieu_suat || '',
          soDienThoaiKhanCap: r.so_dien_thoai_khan_cap,
          ghiChu: r.ghi_chu
        }))
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

  const [initialDuAnFilter, setInitialDuAnFilter] = useState('')

  // Đếm số lượng để hiển thị badge số lượng trong Sidebar
  const counts = useMemo(() => {
    return {
      dashboard: 0,
      danhsach: data.length
    }
  }, [data])

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
              {tab === 'danhsach' && (
                <DanhSachTab 
                  data={data} 
                  onUpdateData={setData} 
                  dbStatus={dbStatus} 
                  onReload={loadData} 
                  initialDuAnFilter={initialDuAnFilter}
                  setInitialDuAnFilter={setInitialDuAnFilter}
                />
              )}
              {tab === 'thongtinduan' && <ThongTinDuAnTab data={data} onReload={loadData} />}
              {tab === 'duan' && <DuAnTab data={data} onUpdateData={setData} onReload={loadData} />}
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
