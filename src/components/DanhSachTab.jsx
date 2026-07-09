import React, { useMemo, useState, useEffect } from 'react'
import { Search, Download, X, Phone, Mail, Building, Layers, Upload, Check, Database, Copy, AlertCircle, FileSpreadsheet, AlertTriangle, Info, MapPin, Calendar, Briefcase, Warehouse, Award, ShieldCheck, Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'
import { DU_AN_LIST } from '../mockData.js'
import { trangThaiBadgeClass, chucVuBadgeClass, danhGiaBadgeClass, formatDate, avatarColor, initials } from '../constants.js'
import { exportThuKhoExcel } from '../excelExporter.js'
import CustomAlert from './CustomAlert.jsx'
import ExcelJS from 'exceljs'
import EditModal from './EditModal.jsx'

const COLOR_PRESETS = [
  { color: '#64748b', bgColor: '#f8fafc', borderColor: '#cbd5e1', badgeBg: '#e2e8f0' },
  { color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fca5a5', badgeBg: '#fee2e2' },
  { color: '#f97316', bgColor: '#fff7ed', borderColor: '#fdb374', badgeBg: '#ffedd5' },
  { color: '#d97706', bgColor: '#fefbeb', borderColor: '#fcd34d', badgeBg: '#fef3c7' },
  { color: '#10b981', bgColor: '#f0fdf4', borderColor: '#86efac', badgeBg: '#dcfce7' },
  { color: '#0d9488', bgColor: '#f0fdfa', borderColor: '#99f6e4', badgeBg: '#ccfbf1' },
  { color: '#0ea5e9', bgColor: '#f0f9ff', borderColor: '#7dd3fc', badgeBg: '#e0f2fe' },
  { color: '#4f46e5', bgColor: '#f5f3ff', borderColor: '#c7d2fe', badgeBg: '#e0e7ff' },
  { color: '#a855f7', bgColor: '#faf5ff', borderColor: '#d8b4fe', badgeBg: '#f3e8ff' },
  { color: '#ec4899', bgColor: '#fdf2f8', borderColor: '#fbcfe8', badgeBg: '#fce7f3' }
]

const getModernColors = (colorHex) => {
  const hex = (colorHex || '#64748b').toLowerCase()
  const found = COLOR_PRESETS.find(p => p.color.toLowerCase() === hex)
  if (found) {
    return {
      color: found.color,
      bgColor: found.bgColor,
      borderColor: found.borderColor,
      badgeBg: found.badgeBg
    }
  }
  return {
    color: colorHex || '#64748b',
    bgColor: colorHex === '#64748b' ? '#f8fafc' : (colorHex + '15'),
    borderColor: colorHex === '#64748b' ? '#cbd5e1' : colorHex,
    badgeBg: colorHex === '#64748b' ? '#e2e8f0' : (colorHex + '25')
  }
}

export default function DanhSachTab({ data, onUpdateData, dbStatus, onReload, initialDuAnFilter, setInitialDuAnFilter }) {
  const [search, setSearch] = useState('')
  const [duAnFilter, setDuAnFilter] = useState('')
  const [chucVuFilter, setChucVuFilter] = useState('')
  const [trangThaiFilter, setTrangThaiFilter] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [initialImportedData, setInitialImportedData] = useState([])
  const [importedFileName, setImportedFileName] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [alertConfig, setAlertConfig] = useState(null)

  // Block/Project colors configurations from Supabase or LocalStorage
  const [blocksConfig, setBlocksConfig] = useState([])

  useEffect(() => {
    if (initialDuAnFilter) {
      setDuAnFilter(initialDuAnFilter)
      
      // Auto-open first storekeeper of this project
      const matched = data.filter(d => {
        if (initialDuAnFilter === 'Chưa phân bổ') {
          const proj = (d.duAn || '').trim().toLowerCase()
          return !proj || proj === 'none' || proj === '—'
        } else {
          return d.duAn === initialDuAnFilter
        }
      })
      
      if (matched.length > 0) {
        setEditingRow(matched[0])
      }
      
      // Clear parent trigger
      if (setInitialDuAnFilter) {
        setInitialDuAnFilter('')
      }
    }
  }, [initialDuAnFilter, data, setInitialDuAnFilter])

  useEffect(() => {
    const fetchBlocksConfig = async () => {
      try {
        const { data: dbBlocks, error: blocksErr } = await supabase
          .from('sgc_thong_tin_du_an_blocks')
          .select('*')
          .order('sort_order', { ascending: true })

        if (blocksErr) throw blocksErr

        const { data: dbProjects, error: projsErr } = await supabase
          .from('sgc_thong_tin_du_an_projects')
          .select('*')
          .order('sort_order', { ascending: true })

        if (projsErr) throw projsErr

        if (dbBlocks && dbBlocks.length > 0) {
          const formattedBlocks = dbBlocks.map(b => {
            const blockProjs = (dbProjects || [])
              .filter(p => p.block_id === b.id)
              .map(p => ({
                id: p.id,
                name: p.name,
                badge: p.badge
              }))
            return {
              id: b.id,
              name: b.name,
              badge: b.badge,
              color: b.color,
              bgColor: b.bg_color,
              borderColor: b.border_color,
              badgeBg: b.badge_bg,
              projects: blockProjs
            }
          })
          setBlocksConfig(formattedBlocks)
        } else {
          throw new Error('No blocks in DB')
        }
      } catch (err) {
        console.warn('Falling back to localStorage for blocksConfig:', err)
        const saved = localStorage.getItem('sgc_thong_tin_du_an_config')
        if (saved) {
          try {
            setBlocksConfig(JSON.parse(saved))
          } catch (e) {
            // fallback
          }
        }
      }
    }
    fetchBlocksConfig()
  }, [data]) // reload configuration if data is refreshed / reloaded

  const findBlockMatch = (duAnName, banChuoiKhoiName) => {
    if (!blocksConfig || blocksConfig.length === 0) return null

    const cleanDuAn = (duAnName || '').trim().toLowerCase()
    const cleanKhoi = (banChuoiKhoiName || '').trim().toLowerCase()

    if (!cleanDuAn && !cleanKhoi) return null

    // 1. Try to find a block by matching project name
    if (cleanDuAn) {
      for (const block of blocksConfig) {
        const matchProj = (block.projects || []).some(p => (p.name || '').trim().toLowerCase() === cleanDuAn)
        if (matchProj) {
          return block
        }
      }
    }

    // 2. Fallback: Try to find a block by matching block name
    if (cleanKhoi) {
      for (const block of blocksConfig) {
        if ((block.name || '').trim().toLowerCase() === cleanKhoi) {
          return block
        }
      }
    }

    return null
  }

  const handleRowClick = (row) => {
    setEditingRow(row)
  }

  const handleSaveEditedRow = async (updatedRow) => {
    try {
      if (updatedRow.isNew) {
        const exists = data.some(item => String(item.maNV || '').trim().toLowerCase() === String(updatedRow.maNV || '').trim().toLowerCase())
        if (exists) {
          showAlert(`Mã nhân viên "${updatedRow.maNV}" đã tồn tại trong hệ thống. Vui lòng nhập mã khác!`, 'error', 'Trùng mã nhân viên')
          throw new Error('Duplicate Employee ID')
        }
      }

      const payload = {
        stt: updatedRow.stt,
        ma_nv: updatedRow.maNV,
        ho_ten: updatedRow.hoTen,
        gioi_tinh: updatedRow.gioiTinh,
        ngay_sinh: updatedRow.ngaySinh || null,
        tuoi: updatedRow.ngaySinh ? (new Date().getFullYear() - new Date(updatedRow.ngaySinh).getFullYear()) : null,
        so_dien_thoai: updatedRow.soDienThoai,
        dien_thoai: updatedRow.soDienThoai,
        email_cong_ty: updatedRow.emailCongTy,
        email: updatedRow.emailCongTy,
        ban_chuoi_khoi: updatedRow.banChuoiKhoi,
        khoi_thi_cong: updatedRow.banChuoiKhoi,
        phong_vung_mien: updatedRow.phongVungMien,
        cccd: updatedRow.cccd,
        que_quan: updatedRow.queQuan,
        ngay_vao_lam: updatedRow.ngayVaoLam || null,
        so_nam_kinh_nghiem: updatedRow.soNamKinhNghiem ? Number(updatedRow.soNamKinhNghiem) : null,
        trinh_do: updatedRow.trinhDo,
        chuyen_nganh: updatedRow.chuyenNganh,
        chuc_vu: updatedRow.chucVu,
        chuc_danh: updatedRow.chucVu,
        du_an_id: updatedRow.duAnId,
        du_an: updatedRow.duAn,
        du_an_cong_trinh: updatedRow.duAn,
        kho_phu_trach: updatedRow.khoPhuTrach,
        so_luong_kho_quan_ly: updatedRow.soLuongKhoQuanLy ? Number(updatedRow.soLuongKhoQuanLy) : null,
        gia_tri_ton_kho_quan_ly: updatedRow.giaTriTonKhoQuanLy ? Number(updatedRow.giaTriTonKhoQuanLy) : null,
        loai_hop_dong: updatedRow.loaiHopDong,
        ngay_het_han_hd: updatedRow.ngayHetHanHD || null,
        trang_thai: updatedRow.trangThai,
        luong_co_ban: updatedRow.luongCoBan ? Number(updatedRow.luongCoBan) : null,
        chung_chi_nghiep_vu_kho: updatedRow.chungChiNghiepVuKho,
        chung_chi_atld: updatedRow.chungChiATLD,
        danh_gia_hieu_suat: updatedRow.danhGiaHieuSuat,
        danh_gia: updatedRow.danhGiaHieuSuat,
        so_dien_thoai_khan_cap: updatedRow.soDienThoaiKhanCap,
        ghi_chu: updatedRow.ghiChu
      }

      if (updatedRow.isNew && !payload.stt) {
        const maxStt = data.reduce((max, item) => Math.max(max, Number(item.stt) || 0), 0)
        payload.stt = maxStt + 1
      }

      let success = false
      let attempts = 0
      const maxAttempts = 40
      let currentPayload = { ...payload }

      while (!success && attempts < maxAttempts) {
        attempts++
        const { error } = updatedRow.isNew
          ? await supabase.from('danh_sach_thu_kho').insert(currentPayload)
          : await supabase.from('danh_sach_thu_kho').update(currentPayload).eq('ma_nv', updatedRow.maNV)

        if (!error) {
          success = true
          break
        }

        const errMsg = error.message || ''
        const match = errMsg.match(/Could not find the '(.*?)' column/)
        if (match && match[1]) {
          const missingColumn = match[1]
          console.warn(`Pruning column [${missingColumn}] which is missing in your Supabase table schema. Retrying...`)
          delete currentPayload[missingColumn]
        } else {
          throw error
        }
      }

      if (onReload) {
        await onReload()
      } else if (onUpdateData) {
        if (updatedRow.isNew) {
          onUpdateData(prev => [updatedRow, ...prev])
        } else {
          onUpdateData(prev => prev.map(item => item.maNV === updatedRow.maNV ? updatedRow : item))
        }
      }

      showAlert(
        updatedRow.isNew
          ? 'Đã thêm mới thông tin thủ kho thành công lên Đám mây Supabase!'
          : 'Đã lưu thay đổi thông tin thủ kho thành công lên Đám mây Supabase!',
        'success',
        'Lưu thành công'
      )
    } catch (err) {
      if (err.message === 'Duplicate Employee ID') return
      console.error(err)
      const details = err.message || String(err)
      
      showConfirm(
        `Không thể lưu dữ liệu lên Đám mây Supabase.\n\nLỗi: ${details}\n\n` +
        `Bạn có muốn tiếp tục lưu cục bộ vào bộ nhớ tạm thời của ứng dụng (dữ liệu sẽ mất khi làm mới trang)?`,
        () => {
          if (onUpdateData) {
            if (updatedRow.isNew) {
              onUpdateData(prev => [updatedRow, ...prev])
            } else {
              onUpdateData(prev => prev.map(item => item.maNV === updatedRow.maNV ? updatedRow : item))
            }
          }
          showAlert('Đã lưu cục bộ thay đổi thành công!', 'info')
        }
      )
    }
  }

  const handleDeleteRow = async (rowToDelete) => {
    try {
      const { error } = await supabase
        .from('danh_sach_thu_kho')
        .delete()
        .eq('ma_nv', rowToDelete.maNV)

      if (error) {
        throw error
      }

      if (onReload) {
        await onReload()
      } else if (onUpdateData) {
        onUpdateData(prev => prev.filter(item => item.maNV !== rowToDelete.maNV))
      }

      showAlert(`Đã xóa thông tin thủ kho ${rowToDelete.hoTen} thành công khỏi Đám mây Supabase!`, 'success', 'Xóa thành công')
    } catch (err) {
      console.error(err)
      const details = err.message || String(err)
      
      showConfirm(
        `Không thể kết nối để xóa trên Đám mây Supabase.\n\nLỗi: ${details}\n\n` +
        `Bạn có muốn tiếp tục xóa cục bộ khỏi bộ nhớ tạm thời của ứng dụng (dữ liệu sẽ khôi phục khi làm mới trang)?`,
        () => {
          if (onUpdateData) {
            onUpdateData(prev => prev.filter(item => item.maNV !== rowToDelete.maNV))
          }
          showAlert('Đã xóa cục bộ thành công!', 'info')
        }
      )
    }
  }

  const showAlert = (message, severity = 'info', title = 'Thông báo') => {
    setAlertConfig({ type: 'alert', message, severity, title })
  }

  const showConfirm = (message, onConfirm, onCancel, title = 'Xác nhận', severity = 'info') => {
    setAlertConfig({ type: 'confirm', message, onConfirm, onCancel, title, severity })
  }

  const fileInputRef = React.useRef(null)

  const handleMainFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportedFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData = XLSX.utils.sheet_to_json(ws)

        if (rawData.length === 0) {
          showAlert('Tệp Excel trống hoặc không có dữ liệu hợp lệ!', 'warning', 'Tệp trống')
          return
        }

        const parsed = rawData.map((row, index) => {
          const hoTen = row['Họ và tên'] || row['Họ tên'] || row['Tên'] || ''
          const maNV = row['Mã NV'] || row['Mã nhân viên'] || ''
          const banChuoiKhoi = row['Khối thi công'] || row['Khối'] || row['Ban/Chuỗi/Khối'] || ''
          const duAn = row['Dự án / Công trình'] || row['Dự án'] || row['Công trình'] || ''
          const chucVu = row['Chức danh'] || row['Chức vụ'] || ''
          const soDienThoai = row['Điện thoại di động'] || row['Điện thoại'] || row['Số điện thoại'] ? String(row['Điện thoại di động'] || row['Điện thoại'] || row['Số điện thoại'] || '') : ''
          const emailCongTy = row['Email công ty'] || row['Email'] || ''
          
          let ngaySinh = row['Ngày sinh'] || ''
          if (typeof ngaySinh === 'number') {
            const dateObj = XLSX.utils.sheet_to_date(ngaySinh)
            ngaySinh = dateObj.toISOString().slice(0, 10)
          } else if (ngaySinh && ngaySinh.includes('/')) {
            const parts = ngaySinh.split('/')
            if (parts.length === 3) {
              ngaySinh = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            }
          }

          const trinhDo = row['Trình độ'] || ''
          const trangThai = row['Trạng thái'] || ''
          const danhGiaHieuSuat = row['Đánh giá'] || row['Hiệu suất'] || ''

          const foundProj = duAn ? DU_AN_LIST.find(p => p.ten.toLowerCase().includes(duAn.trim().toLowerCase()) || duAn.trim().toLowerCase().includes(p.ten.toLowerCase())) : null
          const duAnId = foundProj ? foundProj.id : ''

          return {
            stt: data.length + index + 1,
            maNV,
            hoTen,
            banChuoiKhoi,
            duAnId,
            duAn,
            chucVu,
            soDienThoai,
            emailCongTy,
            ngaySinh: ngaySinh || null,
            tuoi: ngaySinh ? (new Date().getFullYear() - new Date(ngaySinh).getFullYear()) : null,
            trinhDo,
            trangThai,
            danhGiaHieuSuat,
            
            // Các giá trị mặc định được đưa về rỗng/null để không tự ý đưa thông tin mới vào
            gioiTinh: row['Giới tính'] || null,
            queQuan: row['Quê quán'] || null,
            ngayVaoLam: row['Ngày vào làm'] || null,
            soNamKinhNghiem: row['Kinh nghiệm'] || row['Số năm kinh nghiệm'] ? Number(row['Kinh nghiệm'] || row['Số năm kinh nghiệm']) : null,
            chuyenNganh: row['Chuyên ngành'] || null,
            khoPhuTrach: row['Kho phụ trách'] || null,
            soLuongKhoQuanLy: row['Số lượng kho quản lý'] ? Number(row['Số lượng kho quản lý']) : null,
            giaTriTonKhoQuanLy: row['Giá trị tồn kho quản lý'] ? Number(row['Giá trị tồn kho quản lý']) : null,
            loaiHopDong: row['Loại hợp đồng'] || null,
            chungChiNghiepVuKho: row['Chứng chỉ nghiệp vụ'] || null,
            chungChiATLD: row['Chứng chỉ ATLĐ'] || null,
            soDienThoaiKhanCap: row['SĐT khẩn cấp'] || null,
            ghiChu: row['Ghi chú'] || null
          }
        })

        setInitialImportedData(parsed)
        setShowImportModal(true)
      } catch (err) {
        console.error(err)
        showAlert('Lỗi phân tích tệp Excel. Vui lòng đảm bảo tệp sử dụng đúng các tiêu đề cột.', 'error', 'Lỗi phân tích')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const uniqueDuAnList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.duAn).filter(Boolean)))
    list.sort((a, b) => a.localeCompare(b, 'vi'))
    return list
  }, [data])

  const uniqueChucVuList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.chucVu).filter(Boolean)))
    list.sort((a, b) => a.localeCompare(b, 'vi'))
    return list
  }, [data])

  const uniqueTrangThaiList = useMemo(() => {
    const list = Array.from(new Set(data.map(d => d.trangThai).filter(Boolean)))
    list.sort((a, b) => a.localeCompare(b, 'vi'))
    return list
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter(d => {
      if (q && !(d.hoTen.toLowerCase().includes(q) || d.maNV.toLowerCase().includes(q) || d.soDienThoai.includes(q))) return false
      
      if (duAnFilter) {
        if (duAnFilter === 'Chưa phân bổ') {
          const proj = (d.duAn || '').trim().toLowerCase()
          if (proj && proj !== 'none' && proj !== '—') return false
        } else {
          if (d.duAn !== duAnFilter) return false
        }
      }
      
      if (chucVuFilter && d.chucVu !== chucVuFilter) return false
      if (trangThaiFilter && d.trangThai !== trangThaiFilter) return false
      return true
    })
  }, [data, search, duAnFilter, chucVuFilter, trangThaiFilter])

  React.useEffect(() => { setPage(1) }, [search, duAnFilter, chucVuFilter, trangThaiFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSafe, pageSize])

  const selectClass = { 
    className: 'input', 
    style: { 
      minWidth: 170, 
      height: '40px', 
      padding: '0 12px', 
      cursor: 'pointer', 
      boxSizing: 'border-box' 
    } 
  }

  const downloadTemplateExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template DS Thủ kho');

      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Khối thi công', key: 'banChuoiKhoi', width: 22 },
        { header: 'Dự án / Công trình', key: 'duAn', width: 40 },
        { header: 'Mã NV', key: 'maNV', width: 14 },
        { header: 'Họ và tên', key: 'hoTen', width: 26 },
        { header: 'Chức danh', key: 'chucVu', width: 18 },
        { header: 'Điện thoại di động', key: 'soDienThoai', width: 20 },
        { header: 'Email công ty', key: 'emailCongTy', width: 28 },
        { header: 'Ngày sinh', key: 'ngaySinh', width: 16 },
        { header: 'Trình độ', key: 'trinhDo', width: 16 },
        { header: 'Trạng thái', key: 'trangThai', width: 18 },
        { header: 'Đánh giá', key: 'danhGiaHieuSuat', width: 16 }
      ];

      // No sample rows are added to the template sheet, keeping it blank/empty as requested.

      // Style header
      const headerRow = worksheet.getRow(1);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: 'Arial',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFF' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '0F58A7' } // SGC Blue: #0f58a7
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: '444444' } },
          left: { style: 'thin', color: { argb: '444444' } },
          bottom: { style: 'medium', color: { argb: '444444' } },
          right: { style: 'thin', color: { argb: '444444' } }
        };
      });

      // Style data rows
      worksheet.eachRow({ includeHeader: false }, (row, rowNumber) => {
        row.height = 24;
        const isEven = rowNumber % 2 === 0;
        const bgColor = isEven ? 'F8FAFC' : 'FFFFFF';
        
        row.eachCell((cell, colNumber) => {
          const headerKey = worksheet.columns[colNumber - 1].key;
          let fontColor = '1B1919';
          let isBold = false;
          
          if (headerKey === 'maNV') {
            fontColor = '0F58A7';
            isBold = true;
          } else if (headerKey === 'hoTen') {
            isBold = true;
          }

          cell.font = {
            name: 'Arial',
            size: 10,
            bold: isBold,
            color: { argb: fontColor }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          
          if (['stt', 'maNV', 'ngaySinh', 'trangThai', 'danhGiaHieuSuat'].includes(headerKey)) {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'center'
            };
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: 'left'
            };
          }
          
          cell.border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'Form_DS_ThuKho_SGC.xlsx';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi tải form mẫu Excel:', err);
      showAlert('Lỗi khi sinh tệp Excel mẫu.', 'error', 'Lỗi tải tệp');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, minHeight: 0, padding: '24px', boxSizing: 'border-box' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340, height: '40px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36, width: '100%', height: '40px', boxSizing: 'border-box' }}
            placeholder="Tìm theo tên, mã NV, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select {...selectClass} value={duAnFilter} onChange={e => setDuAnFilter(e.target.value)}>
          <option value="">Tất cả dự án</option>
          <option value="Chưa phân bổ">Chưa phân bổ / Khác</option>
          {uniqueDuAnList.map(da => <option key={da} value={da}>{da}</option>)}
        </select>

        <select {...selectClass} value={chucVuFilter} onChange={e => setChucVuFilter(e.target.value)}>
          <option value="">Tất cả chức vụ</option>
          {uniqueChucVuList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select {...selectClass} value={trangThaiFilter} onChange={e => setTrangThaiFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {uniqueTrangThaiList.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Nút Tải Form và Up Dữ liệu */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={downloadTemplateExcel} 
            style={{ 
              background: 'var(--primary)',
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
              boxSizing: 'border-box'
            }}
          >
            <Download size={16} style={{ color: '#ffffff' }} /> Tải Form mẫu
          </button>
          <button 
            type="button"
            className="btn" 
            onClick={() => fileInputRef.current?.click()} 
            style={{ 
              background: '#f97316', 
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
              boxSizing: 'border-box'
            }}
          >
            <Upload size={16} /> Up Dữ liệu
          </button>
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={() => setEditingRow({ isNew: true })} 
            style={{ 
              background: '#2563eb', 
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
              boxSizing: 'border-box'
            }}
          >
            <Plus size={16} /> Thêm thủ kho
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            onChange={handleMainFileChange}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
          {filtered.length} / {data.length} thủ kho
        </span>

        <button 
          className="btn btn-primary" 
          onClick={() => exportThuKhoExcel(filtered)}
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
            boxSizing: 'border-box'
          }}
        >
          <Download size={16} /> Xuất Excel ({filtered.length})
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 40 }}>STT</th>
              <th style={{ width: 145, minWidth: 145, maxWidth: 145 }}>Khối thi công</th>
              <th style={{ width: 165, minWidth: 165, maxWidth: 165 }}>Dự án / Công trình</th>
              <th style={{ minWidth: 90, textAlign: 'center' }}>Mã NV</th>
              <th style={{ minWidth: 200 }}>Họ và tên</th>
              <th style={{ minWidth: 130 }}>Chức danh</th>
              <th style={{ minWidth: 130, textAlign: 'center' }}>Điện thoại di động</th>
              <th style={{ minWidth: 180 }}>Email công ty</th>
              <th style={{ minWidth: 110 }}>Ngày sinh</th>
              <th style={{ minWidth: 120 }}>Trình độ</th>
              <th style={{ minWidth: 130 }}>Trạng thái</th>
              <th style={{ minWidth: 110 }}>Đánh giá</th>
              <th style={{ minWidth: 200 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(row => {
              const matchedBlock = findBlockMatch(row.duAn, row.banChuoiKhoi)
              const colors = matchedBlock ? getModernColors(matchedBlock.color) : null

              return (
                <tr 
                  key={row.maNV} 
                  onDoubleClick={() => handleRowClick(row)}
                  style={{ cursor: 'pointer' }}
                  title="Nhấp đúp chuột vào dòng để chỉnh sửa thông tin thủ kho"
                >
                  <td style={{ textAlign: 'center' }}>{row.stt}</td>
                  <td style={{ width: 145, minWidth: 145, maxWidth: 145, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {matchedBlock ? (
                      <span style={{
                        background: colors.bgColor,
                        color: colors.color,
                        border: `1px solid ${colors.borderColor}`,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '11px',
                        fontFamily: '"Roboto", sans-serif',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        letterSpacing: '0.01em',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        lineHeight: '1.2'
                      }} title={matchedBlock.name}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.color, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{matchedBlock.name}</span>
                      </span>
                    ) : (
                      <span style={{ 
                        color: '#64748b', 
                        fontSize: '12px', 
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block' 
                      }} title={row.banChuoiKhoi || '—'}>
                        {row.banChuoiKhoi || '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ width: 165, minWidth: 165, maxWidth: 165, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {matchedBlock ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', overflow: 'hidden' }} title={row.duAn}>
                        <span style={{
                          background: colors.color,
                          color: '#ffffff',
                          fontFamily: '"Roboto", sans-serif',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '2px 5px',
                          borderRadius: '4px',
                          flexShrink: 0
                        }}>
                          {matchedBlock.badge || 'DA'}
                        </span>
                        <span style={{
                          fontFamily: '"Roboto", sans-serif',
                          fontSize: '12.5px',
                          color: '#334155',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {row.duAn}
                        </span>
                      </div>
                    ) : (
                      <span style={{ 
                        color: '#334155', 
                        fontSize: '12.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block' 
                      }} title={row.duAn || '—'}>
                        {row.duAn || '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'center' }}>{row.maNV}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ background: avatarColor(row.hoTen), flexShrink: 0 }}>{initials(row.hoTen)}</div>
                      <span 
                        onClick={() => setEditingRow(row)}
                        style={{ 
                          fontFamily: "'Roboto', sans-serif", 
                          fontWeight: 600, 
                          color: '#0f58a7', 
                          letterSpacing: '0.01em',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="Nhấp vào để chỉnh sửa thông tin thủ kho"
                      >
                        {row.hoTen}
                      </span>
                    </div>
                  </td>
                  <td><span className={`badge ${chucVuBadgeClass(row.chucVu)}`}>{row.chucVu}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    {row.soDienThoai ? (
                      <a 
                        href={`tel:${row.soDienThoai}`} 
                        style={{ color: '#0f58a7', textDecoration: 'underline', fontWeight: 600 }}
                        title="Bấm để gọi"
                      >
                        {row.soDienThoai}
                      </a>
                    ) : '—'}
                  </td>
                  <td>{row.emailCongTy}</td>
                  <td style={{ textAlign: 'center' }}>{formatDate(row.ngaySinh)}</td>
                  <td>{row.trinhDo}</td>
                  <td>
                    <span className={`badge ${(row.trangThai && row.trangThai !== 'None') ? trangThaiBadgeClass(row.trangThai) : 'badge-gray'}`}>
                      {(row.trangThai && row.trangThai !== 'None') ? row.trangThai : 'None'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${(row.danhGiaHieuSuat && row.danhGiaHieuSuat !== 'None') ? danhGiaBadgeClass(row.danhGiaHieuSuat) : 'badge-gray'}`}>
                      {(row.danhGiaHieuSuat && row.danhGiaHieuSuat !== 'None') ? row.danhGiaHieuSuat : 'None'}
                    </span>
                  </td>
                  <td>{row.ghiChu || '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={13}>
                <div className="empty-state">
                  <Search size={40} />
                  <h3>Không tìm thấy kết quả</h3>
                  <p>Thử thay đổi từ khoá tìm kiếm hoặc bộ lọc để xem thêm thủ kho.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <span>Hiển thị</span>
          <select className="input btn-sm" style={{ padding: '4px 10px' }} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>dòng / trang · {filtered.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} / {filtered.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-outline btn-sm" disabled={pageSafe <= 1} style={{ opacity: pageSafe <= 1 ? 0.5 : 1 }} onClick={() => setPage(p => Math.max(1, p - 1))}>Trước</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '0 6px' }}>Trang {pageSafe} / {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={pageSafe >= totalPages} style={{ opacity: pageSafe >= totalPages ? 0.5 : 1 }} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Sau</button>
        </div>
      </div>


      {editingRow && (
        <EditModal 
          row={editingRow} 
          onClose={() => setEditingRow(null)} 
          onSave={handleSaveEditedRow} 
          onDelete={handleDeleteRow}
          showConfirm={showConfirm}
          blocksConfig={blocksConfig}
        />
      )}

      {showImportModal && (
        <ImportModal 
          data={data} 
          onUpdateData={onUpdateData} 
          dbStatus={dbStatus} 
          onReload={onReload} 
          onClose={() => setShowImportModal(false)} 
          initialData={initialImportedData} 
          fileName={importedFileName} 
          setFileName={setImportedFileName}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}
      {alertConfig && (
        <CustomAlert
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          severity={alertConfig.severity}
          onConfirm={() => {
            if (alertConfig.onConfirm) alertConfig.onConfirm()
            setAlertConfig(null)
          }}
          onCancel={() => {
            if (alertConfig.onCancel) alertConfig.onCancel()
            setAlertConfig(null)
          }}
        />
      )}
    </div>
  )
}



function ImportModal({ data, onUpdateData, dbStatus, onReload, onClose, initialData, fileName, setFileName, showAlert, showConfirm }) {
  const [importedData, setImportedData] = useState(initialData || [])
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState('preview') // 'preview' or 'sql'
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (initialData && initialData.length > 0) {
      setImportedData(initialData)
    }
  }, [initialData])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (setFileName) setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawData = XLSX.utils.sheet_to_json(ws)

        if (rawData.length === 0) {
          setErrorMsg('Tệp Excel trống hoặc không có dữ liệu hợp lệ!')
          return
        }

        const parsed = rawData.map((row, index) => {
          const hoTen = row['Họ và tên'] || row['Họ tên'] || row['Tên'] || ''
          const maNV = row['Mã NV'] || row['Mã nhân viên'] || ''
          const banChuoiKhoi = row['Khối thi công'] || row['Khối'] || row['Ban/Chuỗi/Khối'] || ''
          const duAn = row['Dự án / Công trình'] || row['Dự án'] || row['Công trình'] || ''
          const chucVu = row['Chức danh'] || row['Chức vụ'] || ''
          const soDienThoai = row['Điện thoại di động'] || row['Điện thoại'] || row['Số điện thoại'] ? String(row['Điện thoại di động'] || row['Điện thoại'] || row['Số điện thoại'] || '') : ''
          const emailCongTy = row['Email công ty'] || row['Email'] || ''
          
          let ngaySinh = row['Ngày sinh'] || ''
          if (typeof ngaySinh === 'number') {
            const dateObj = XLSX.utils.sheet_to_date(ngaySinh)
            ngaySinh = dateObj.toISOString().slice(0, 10)
          } else if (ngaySinh && ngaySinh.includes('/')) {
            const parts = ngaySinh.split('/')
            if (parts.length === 3) {
              ngaySinh = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            }
          }

          const trinhDo = row['Trình độ'] || ''
          const trangThai = row['Trạng thái'] || ''
          const danhGiaHieuSuat = row['Đánh giá'] || row['Hiệu suất'] || ''

          const foundProj = duAn ? DU_AN_LIST.find(p => p.ten.toLowerCase().includes(duAn.trim().toLowerCase()) || duAn.trim().toLowerCase().includes(p.ten.toLowerCase())) : null
          const duAnId = foundProj ? foundProj.id : ''

          return {
            stt: data.length + index + 1,
            maNV,
            hoTen,
            banChuoiKhoi,
            duAnId,
            duAn,
            chucVu,
            soDienThoai,
            emailCongTy,
            ngaySinh: ngaySinh || null,
            tuoi: ngaySinh ? (new Date().getFullYear() - new Date(ngaySinh).getFullYear()) : null,
            trinhDo,
            trangThai,
            danhGiaHieuSuat,
            
            // Các giá trị mặc định được đưa về rỗng/null để không tự ý đưa thông tin mới vào
            gioiTinh: row['Giới tính'] || null,
            queQuan: row['Quê quán'] || null,
            ngayVaoLam: row['Ngày vào làm'] || null,
            soNamKinhNghiem: row['Kinh nghiệm'] || row['Số năm kinh nghiệm'] ? Number(row['Kinh nghiệm'] || row['Số năm kinh nghiệm']) : null,
            chuyenNganh: row['Chuyên ngành'] || null,
            khoPhuTrach: row['Kho phụ trách'] || null,
            soLuongKhoQuanLy: row['Số lượng kho quản lý'] ? Number(row['Số lượng kho quản lý']) : null,
            giaTriTonKhoQuanLy: row['Giá trị tồn kho quản lý'] ? Number(row['Giá trị tồn kho quản lý']) : null,
            loaiHopDong: row['Loại hợp đồng'] || null,
            chungChiNghiepVuKho: row['Chứng chỉ nghiệp vụ'] || null,
            chungChiATLD: row['Chứng chỉ ATLĐ'] || null,
            soDienThoaiKhanCap: row['SĐT khẩn cấp'] || null,
            ghiChu: row['Ghi chú'] || null
          }
        })

        setImportedData(parsed)
        setErrorMsg('')
      } catch (err) {
        console.error(err)
        setErrorMsg('Lỗi phân tích tệp Excel. Vui lòng đảm bảo tệp sử dụng đúng các tiêu đề cột.')
      }
    }
    reader.readAsBinaryString(file)
  }

  // Check duplicate mã nhân viên
  const annotatedData = useMemo(() => {
    const seenInFile = new Set()
    return importedData.map((item, index) => {
      const code = String(item.maNV || '').trim().toUpperCase()
      const isExistingDuplicate = data.some(existing => String(existing.maNV || '').trim().toUpperCase() === code)
      let isFileDuplicate = false
      if (seenInFile.has(code)) {
        isFileDuplicate = true
      } else {
        seenInFile.add(code)
      }
      
      const isDuplicate = isExistingDuplicate || isFileDuplicate
      return {
        ...item,
        isDuplicate,
        duplicateReason: isExistingDuplicate ? 'Trùng mã NV trong CSDL' : (isFileDuplicate ? 'Trùng mã NV trong tệp' : '')
      }
    })
  }, [importedData, data])

  const toSave = useMemo(() => annotatedData.filter(item => !item.isDuplicate), [annotatedData])
  const validCount = toSave.length
  const duplicateCount = annotatedData.length - validCount

  const sqlCreateTable = `CREATE TABLE IF NOT EXISTS danh_sach_thu_kho (
  stt INT,
  ma_nv VARCHAR(50) PRIMARY KEY,
  ho_ten VARCHAR(255) NOT NULL,
  gioi_tinh VARCHAR(50),
  ngay_sinh DATE,
  tuoi INT,
  so_dien_thoai VARCHAR(50),
  email_cong_ty VARCHAR(150),
  ban_chuoi_khoi VARCHAR(150),
  phong_vung_mien VARCHAR(150),
  cccd VARCHAR(50),
  que_quan VARCHAR(150),
  ngay_vao_lam DATE,
  so_nam_kinh_nghiem INT,
  trinh_do VARCHAR(150),
  chuyen_nganh VARCHAR(150),
  chuc_vu VARCHAR(150),
  du_an_id VARCHAR(50),
  du_an VARCHAR(255),
  kho_phu_trach VARCHAR(255),
  so_luong_kho_quan_ly INT,
  gia_tri_ton_kho_quan_ly NUMERIC,
  loai_hop_dong VARCHAR(255),
  ngay_het_han_hd DATE,
  trang_thai VARCHAR(100),
  luong_co_ban NUMERIC,
  chung_chi_nghiep_vu_kho VARCHAR(50),
  chung_chi_atld VARCHAR(50),
  danh_gia_hieu_suat VARCHAR(100),
  so_dien_thoai_khan_cap VARCHAR(50),
  ghi_chu TEXT
);`

  const sqlInsertData = useMemo(() => {
    if (toSave.length === 0) return '-- Không có dữ liệu hợp lệ (mới) để sinh SQL chèn.'
    let sql = `INSERT INTO danh_sach_thu_kho (\n` +
              `  stt, ma_nv, ho_ten, gioi_tinh, ngay_sinh, tuoi, so_dien_thoai, email_cong_ty, \n` +
              `  ban_chuoi_khoi, phong_vung_mien, cccd, que_quan, ngay_vao_lam, so_nam_kinh_nghiem, \n` +
              `  trinh_do, chuyen_nganh, chuc_vu, du_an_id, du_an, kho_phu_trach, so_luong_kho_quan_ly, \n` +
              `  gia_tri_ton_kho_quan_ly, loai_hop_dong, ngay_het_han_hd, trang_thai, luong_co_ban, \n` +
              `  chung_chi_nghiep_vu_kho, chung_chi_atld, danh_gia_hieu_suat, so_dien_thoai_khan_cap, ghi_chu\n` +
              `) VALUES\n`
    const rows = toSave.map(item => {
      const q = (val) => val ? `'${String(val).replace(/'/g, "''")}'` : 'NULL'
      const num = (val) => typeof val === 'number' && !isNaN(val) ? val : 0
      
      return `  (${num(item.stt)}, ` +
             `${q(item.maNV)}, ` +
             `${q(item.hoTen)}, ` +
             `${q(item.gioiTinh)}, ` +
             `${q(item.ngaySinh)}, ` +
             `${num(item.tuoi)}, ` +
             `${q(item.soDienThoai)}, ` +
             `${q(item.emailCongTy)}, ` +
             `${q(item.banChuoiKhoi)}, ` +
             `${q(item.phongVungMien || 'Phòng Vật tư')}, ` +
             `${q(item.cccd || '')}, ` +
             `${q(item.queQuan)}, ` +
             `${q(item.ngayVaoLam)}, ` +
             `${num(item.soNamKinhNghiem)}, ` +
             `${q(item.trinhDo)}, ` +
             `${q(item.chuyenNganh)}, ` +
             `${q(item.chucVu)}, ` +
             `${q(item.duAnId)}, ` +
             `${q(item.duAn)}, ` +
             `${q(item.khoPhuTrach)}, ` +
             `${num(item.soLuongKhoQuanLy)}, ` +
             `${num(item.giaTriTonKhoQuanLy)}, ` +
             `${q(item.loaiHopDong)}, ` +
             `${item.ngayHetHanHD ? q(item.ngayHetHanHD) : 'NULL'}, ` +
             `${q(item.trangThai)}, ` +
             `${num(item.luongCoBan || 15)}, ` +
             `${q(item.chungChiNghiepVuKho)}, ` +
             `${q(item.chungChiATLD)}, ` +
             `${q(item.danhGiaHieuSuat)}, ` +
             `${q(item.soDienThoaiKhanCap)}, ` +
             `${q(item.ghiChu)})`
    })
    return sql + rows.join(',\n') + ';'
  }, [toSave])

  const handleCopySQL = () => {
    const fullSQL = `${sqlCreateTable}\n\n${sqlInsertData}`
    navigator.clipboard.writeText(fullSQL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleApply = async () => {
    if (validCount === 0) {
      showAlert('Không có dữ liệu mới hợp lệ để lưu (tất cả các dòng đều bị trùng mã nhân viên)!', 'warning', 'Trùng mã nhân viên')
      return
    }
    if (saving) return
    setSaving(true)
    setErrorMsg('')
    try {
      const rowsToInsert = toSave.map(r => ({
        stt: r.stt,
        ma_nv: r.maNV,
        ho_ten: r.hoTen,
        gioi_tinh: r.gioiTinh,
        ngay_sinh: r.ngaySinh,
        tuoi: r.tuoi,
        so_dien_thoai: r.soDienThoai,
        dien_thoai: r.soDienThoai, // Alternative field name support
        email_cong_ty: r.emailCongTy,
        email: r.emailCongTy, // Alternative field name support
        ban_chuoi_khoi: r.banChuoiKhoi,
        khoi_thi_cong: r.banChuoiKhoi, // Alternative field name support
        phong_vung_mien: r.phongVungMien,
        cccd: r.cccd,
        que_quan: r.queQuan,
        ngay_vao_lam: r.ngayVaoLam,
        so_nam_kinh_nghiem: r.soNamKinhNghiem,
        trinh_do: r.trinhDo,
        chuyen_nganh: r.chuyenNganh,
        chuc_vu: r.chucVu,
        chuc_danh: r.chucVu, // Alternative field name support
        du_an_id: r.duAnId,
        du_an: r.duAn,
        du_an_cong_trinh: r.duAn, // Alternative field name support
        kho_phu_trach: r.khoPhuTrach,
        so_luong_kho_quan_ly: r.soLuongKhoQuanLy,
        gia_tri_ton_kho_quan_ly: r.giaTriTonKhoQuanLy,
        loai_hop_dong: r.loaiHopDong,
        ngay_het_han_hd: r.ngayHetHanHD || null,
        trang_thai: r.trangThai,
        luong_co_ban: r.luongCoBan,
        chung_chi_nghiep_vu_kho: r.chungChiNghiepVuKho,
        chung_chi_atld: r.chungChiATLD,
        danh_gia_hieu_suat: r.danhGiaHieuSuat,
        danh_gia: r.danhGiaHieuSuat, // Alternative field name support
        so_dien_thoai_khan_cap: r.soDienThoaiKhanCap,
        ghi_chu: r.ghiChu
      }))

      // Self-healing insert loop to dynamically prune missing columns from payload
      let currentRows = [...rowsToInsert]
      let success = false
      let attempts = 0
      const maxAttempts = 40

      while (!success && attempts < maxAttempts) {
        attempts++
        const { error } = await supabase
          .from('danh_sach_thu_kho')
          .insert(currentRows)

        if (!error) {
          success = true
          break
        }

        const errMsg = error.message || ''
        // Detect PostgREST schema mismatch error (e.g., column does not exist)
        const match = errMsg.match(/Could not find the '(.*?)' column/)
        if (match && match[1]) {
          const missingColumn = match[1]
          console.warn(`Pruning column [${missingColumn}] which is missing in your Supabase table schema. Retrying...`)
          currentRows = currentRows.map(row => {
            const newRow = { ...row }
            delete newRow[missingColumn]
            return newRow
          })
        } else {
          // If it is another type of database error, let it propagate
          throw error
        }
      }

      // Sync and reload the main application state
      if (onReload) {
        await onReload()
      } else if (onUpdateData) {
        onUpdateData(prev => [...prev, ...toSave])
      }

      let msg = `Đã nhập và đồng bộ thành công ${validCount} thủ kho mới lên Đám mây Supabase!`
      if (duplicateCount > 0) {
        msg += `\n(Tự động phát hiện và bỏ qua ${duplicateCount} dòng bị trùng mã nhân viên)`
      }
      showAlert(msg, 'success', 'Nhập dữ liệu thành công')
      onClose()
    } catch (err) {
      console.error(err)
      const details = err.message || String(err)
      showConfirm(
        `Không thể tải dữ liệu lên Đám mây Supabase.\n\nLỗi: ${details}\n\n` +
        `Điều này thường do bạn chưa tạo bảng "danh_sach_thu_kho" trong SQL Editor, hoặc chưa tắt RLS.\n\n` +
        `Bạn có muốn tiếp tục nạp cục bộ vào bộ nhớ tạm thời của ứng dụng (dữ liệu sẽ mất khi làm mới trang)?`,
        () => {
          if (onUpdateData) {
            onUpdateData(prev => [...prev, ...toSave])
          }
          onClose()
        },
        () => {
          setErrorMsg(`Lỗi đồng bộ Supabase: ${details}. Vui lòng kiểm tra cấu trúc bảng hoặc mã SQL khởi tạo ở tab bên dưới.`)
        },
        'Lỗi đồng bộ Supabase'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
    }} onClick={onClose}>
      <div className="card" style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: 0, 
        borderRadius: 0, 
        overflow: 'hidden', 
        backgroundColor: '#ffffff',
        boxShadow: 'none'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          background: '#ffffff', 
          padding: '16px 24px',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <div style={{
              background: '#eff6ff',
              color: '#0f58a7',
              width: 44,
              height: 44,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(11,87,208,0.08)'
            }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>Xem trước dữ liệu — Danh sách Thủ kho</div>
              <div style={{ color: '#f97316', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                {fileName || 'Dữ liệu tải lên.xlsx'} · {importedData.length} dòng dữ liệu
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '20px 24px' }}>
          
          {importedData.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #cbd5e1',
              borderRadius: 12,
              padding: '60px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              cursor: 'pointer',
              position: 'relative',
              transition: 'border-color 0.2s',
              margin: 'auto'
            }}>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%'
                }}
              />
              <FileSpreadsheet size={56} style={{ color: '#10b981', marginBottom: 16 }} />
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Kéo thả hoặc Click để chọn file Excel cần tải lên</h4>
              <p style={{ fontSize: 13, color: '#64748b', maxWidth: 450, margin: '0 auto 12px' }}>
                Hệ thống sẽ tự động đọc các cột dữ liệu theo đúng tiêu chuẩn của sheet Danh Sách Thủ Kho.
              </p>
              <div style={{ fontSize: 12, color: '#0f58a7', fontWeight: 600 }}>
                * Khuyên dùng file mẫu tải về từ ứng dụng để đảm bảo cấu trúc cột chính xác nhất
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              
              {/* Blue notice banner */}
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                color: '#0369a1',
                fontSize: 13,
                textAlign: 'left'
              }}>
                <Info size={18} style={{ color: '#0f58a7', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>
                  <strong>Chế độ: ĐỒNG BỘ NỐI TIẾP</strong> – Dữ liệu mới trong tệp này sẽ được <strong>CHÈN THÊM (nối tiếp)</strong> vào danh sách hiện tại. Toàn bộ dữ liệu cũ của bạn sẽ được giữ nguyên, không bị thay thế hay xóa bỏ!
                </span>
              </div>

              {/* Tabs for Preview / SQL */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    background: 'none',
                    borderBottom: activeTab === 'preview' ? '3px solid #0f58a7' : 'none',
                    color: activeTab === 'preview' ? '#0f58a7' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('preview')}
                >
                  Xem trước lưới dữ liệu ({importedData.length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    background: 'none',
                    borderBottom: activeTab === 'sql' ? '3px solid #0f58a7' : 'none',
                    color: activeTab === 'sql' ? '#0f58a7' : '#64748b',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveTab('sql')}
                >
                  Mã SQL khởi tạo cho Supabase
                </button>
              </div>

              {/* Tab Content 1: Preview */}
              {activeTab === 'preview' && (
                <div style={{ 
                  flex: 1, 
                  minHeight: 0, 
                  overflow: 'auto', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: 8, 
                  background: '#f8fafc',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: '#0c4685', color: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', width: 50 }}>STT</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 120 }}>Khối thi công</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 200 }}>Dự án / Công trình</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 90 }}>Mã NV</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 150 }}>Họ và tên</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 110 }}>Chức danh</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 110 }}>Điện thoại di động</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 160 }}>Email công ty</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 100 }}>Ngày sinh</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'left', minWidth: 110 }}>Trình độ</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 110 }}>Trạng thái</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 90 }}>Đánh giá</th>
                        <th style={{ padding: '10px 12px', border: '1px solid #0c4685', fontSize: 12, fontWeight: 700, textAlign: 'center', minWidth: 150 }}>Trạng thái nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annotatedData.map((row, i) => (
                        <tr key={i} style={{ 
                          borderBottom: '1px solid #cbd5e1',
                          backgroundColor: row.isDuplicate ? '#fff5f5' : (i % 2 === 0 ? '#ffffff' : '#f8fafc'),
                          transition: 'background-color 0.15s'
                        }}>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'left' }}>{row.banChuoiKhoi}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }} title={row.duAn}>{row.duAn}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: row.isDuplicate ? '#dc2626' : '#0f58a7' }}>{row.maNV}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>{row.hoTen}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'left' }}>{row.chucVu}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{row.soDienThoai}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'left' }}>{row.emailCongTy}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatDate(row.ngaySinh)}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'left' }}>{row.trinhDo}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                            <span className={`badge ${trangThaiBadgeClass(row.trangThai)}`}>{row.trangThai}</span>
                          </td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                            <span className={`badge ${danhGiaBadgeClass(row.danhGiaHieuSuat)}`}>{row.danhGiaHieuSuat}</span>
                          </td>
                          <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                            {row.isDuplicate ? (
                              <span style={{ color: '#dc2626', background: '#fee2e2', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={12} /> {row.duplicateReason}
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', background: '#dcfce7', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={12} /> Hợp lệ (Mới)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab Content 2: SQL */}
              {activeTab === 'sql' && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'left' }}>
                      Mã SQL được tối ưu hóa chính xác cho các cột hiển thị của <strong>DANH SÁCH THỦ KHO</strong>.
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySQL}
                      style={{
                        background: copied ? '#059669' : '#0f58a7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Đã sao chép!' : 'Sao chép toàn bộ SQL'}
                    </button>
                  </div>

                  <div style={{ background: '#0f172a', borderRadius: 8, padding: 14, overflow: 'hidden', textAlign: 'left' }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>1. Khởi tạo cấu trúc bảng (Supabase SQL Editor)</div>
                    <pre style={{
                      margin: 0,
                      background: '#1e293b',
                      padding: 12,
                      borderRadius: 6,
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      fontSize: 11.5,
                      overflowX: 'auto',
                      border: '1px solid #334155',
                      maxHeight: '120px'
                    }}>
                      {sqlCreateTable}
                    </pre>

                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 14, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>2. Dữ liệu chèn từ File Excel ({toSave.length} bản ghi mới)</div>
                    <pre style={{
                      margin: 0,
                      background: '#1e293b',
                      padding: 12,
                      borderRadius: 6,
                      color: '#a7f3d0',
                      fontFamily: 'monospace',
                      fontSize: 11.5,
                      overflowX: 'auto',
                      border: '1px solid #334155',
                      maxHeight: '160px',
                      overflowY: 'auto'
                    }}>
                      {sqlInsertData}
                    </pre>
                  </div>

                  <div style={{
                    background: '#fef08a',
                    border: '1px solid #fef08a',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    color: '#713f12',
                    fontSize: 12,
                    textAlign: 'left'
                  }}>
                    <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <strong>Hướng dẫn:</strong> Bấm nút <strong>"Sao chép toàn bộ SQL"</strong> ở trên, mở tài khoản <strong>Supabase Project &gt; SQL Editor &gt; New Query</strong>, dán mã vào và nhấn <strong>Run</strong> để đồng bộ dữ liệu trực tiếp lên đám mây.
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Info Row */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                <div style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: 10, 
                  padding: '14px 20px', 
                  fontSize: 13, 
                  color: '#475569',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600 }}>
                    📊 Tổng cộng phát hiện: <strong style={{ color: '#1e293b', fontSize: 14 }}>{importedData.length}</strong> dòng dữ liệu được tải lên từ file Excel.
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} /> {validCount} dòng dữ liệu hợp lệ -> sẽ được lưu
                    </span>
                    {duplicateCount > 0 && (
                      <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} /> {duplicateCount} dòng trùng mã nhân viên -> sẽ tự động bỏ qua khi lưu
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
          )}

          {errorMsg && (
            <div style={{
              marginTop: 16,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '12px 16px',
              color: '#991b1b',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          background: '#f8fafc',
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12
        }}>
          <button 
            type="button"
            className="btn btn-outline" 
            onClick={onClose}
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8 }}
          >
            <X size={15} /> Hủy bỏ
          </button>
          {importedData.length > 0 && (
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={handleApply}
              disabled={saving || validCount === 0}
              style={{ 
                background: validCount === 0 ? '#cbd5e1' : '#0f58a7', 
                borderColor: validCount === 0 ? '#cbd5e1' : '#0f58a7', 
                fontWeight: 700, 
                opacity: saving ? 0.6 : 1, 
                cursor: (saving || validCount === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 8,
                color: '#ffffff'
              }}
            >
              {saving ? 'Đang đồng bộ...' : `Lưu ${validCount} dòng dữ liệu`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


