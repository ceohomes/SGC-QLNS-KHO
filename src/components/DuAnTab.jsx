import React, { useMemo, useState, useEffect } from 'react'
import { 
  Building2, Search, MapPin, Briefcase, Users, GripVertical, Check, 
  RefreshCw, UserMinus, ArrowRightLeft, MoveRight, ChevronRight,
  UserCheck, ExternalLink
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { chucVuBadgeClass, avatarColor, initials } from '../constants.js'
import EditModal from './EditModal.jsx'

export default function DuAnTab({ data = [], onUpdateData, onReload }) {
  const [selectedProjectId, setSelectedProjectId] = useState('UNASSIGNED') // Selected source project
  const [searchStorekeeper, setSearchStorekeeper] = useState('')
  const [searchProject, setSearchProject] = useState('')
  const [successToast, setSuccessToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [pendingChanges, setPendingChanges] = useState({})
  
  // Quick transfer state for popover
  const [activeTransferMenu, setActiveTransferMenu] = useState(null) // maNV of storekeeper showing menu
  
  // Selection and edit states
  const [editingStorekeeper, setEditingStorekeeper] = useState(null)

  const handleSaveStorekeeper = async (updatedRow) => {
    try {
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

      let success = false
      let attempts = 0
      const maxAttempts = 40
      let currentPayload = { ...payload }

      while (!success && attempts < maxAttempts) {
        attempts++
        const { error } = await supabase
          .from('danh_sach_thu_kho')
          .update(currentPayload)
          .eq('ma_nv', updatedRow.maNV)

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

      setSuccessToast(`Đã lưu thông tin thủ kho ${updatedRow.hoTen} thành công!`)

      if (onReload) {
        await onReload()
      } else if (onUpdateData) {
        onUpdateData(prev => prev.map(item => item.maNV === updatedRow.maNV ? updatedRow : item))
      }
    } catch (err) {
      console.error('Lỗi khi lưu thông tin:', err)
      alert('Lỗi lưu thông tin: ' + err.message)
    }
  }

  // Load configs from Supabase
  const loadConfigs = async () => {
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
        setBlocks(formattedBlocks)
      } else {
        throw new Error('No blocks found')
      }
    } catch (err) {
      console.warn('Backup with LocalStorage:', err.message)
      const saved = localStorage.getItem('sgc_thong_tin_du_an_config')
      if (saved) {
        try {
          setBlocks(JSON.parse(saved))
        } catch (e) {
          setBlocks([])
        }
      }
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  // Flatten projects
  const allProjects = useMemo(() => {
    const list = []
    blocks.forEach(b => {
      if (b.projects) {
        b.projects.forEach(p => {
          if (p.name && !list.some(existing => existing.name.toLowerCase() === p.name.toLowerCase())) {
            list.push({
              id: p.id,
              name: p.name,
              badge: p.badge || b.badge,
              blockId: b.id,
              blockName: b.name,
              color: b.color,
              bgColor: b.bgColor,
              borderColor: b.borderColor,
              badgeBg: b.badgeBg
            })
          }
        })
      }
    })
    return list
  }, [blocks])

  // Filter storekeepers globally by search text
  const filteredStorekeepers = useMemo(() => {
    const sq = searchStorekeeper.trim().toLowerCase()
    if (!sq) return data

    return data.filter(tk => {
      return (
        tk.hoTen.toLowerCase().includes(sq) ||
        tk.maNV.toLowerCase().includes(sq) ||
        (tk.soDienThoai && tk.soDienThoai.includes(sq)) ||
        (tk.chucVu && tk.chucVu.toLowerCase().includes(sq))
      )
    })
  }, [data, searchStorekeeper])

  // Helper to obtain the theme styling of a project
  const getProjectStyle = (projectName, tkStatus) => {
    if (tkStatus === 'Đã nghỉ việc' || tkStatus === 'Nghỉ việc') {
      return {
        color: '#64748b',
        bgColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        badgeBg: '#e2e8f0',
        badge: 'QUIT'
      }
    }
    const projName = (projectName || '').trim()
    if (!projName || projName === 'none' || projName === '—') {
      return {
        color: '#475569',
        bgColor: '#f8fafc',
        borderColor: '#cbd5e1',
        badgeBg: '#e2e8f0',
        badge: 'HOLDING'
      }
    }
    const found = allProjects.find(p => p.name.toLowerCase() === projName.toLowerCase())
    if (found) {
      return {
        color: found.color,
        bgColor: found.bgColor,
        borderColor: found.borderColor,
        badgeBg: found.badgeBg,
        badge: found.badge
      }
    }
    return {
      color: '#475569',
      bgColor: '#ffffff',
      borderColor: '#e2e8f0',
      badgeBg: '#e2e8f0',
      badge: ''
    }
  }

  // Toast cleanup
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  // Core Transfer Logic
  const transferPersonnel = (storekeeper, destProjectName) => {
    const isDestRetired = destProjectName === 'Đã nghỉ việc'
    const finalProjectName = isDestRetired ? '' : (destProjectName === 'Chưa phân bổ' ? '' : destProjectName)

    // Determine block automatically to keep synchronizations
    let finalBlockName = 'KHỐI THI CÔNG CHƯA PHÂN BỔ'
    if (finalProjectName) {
      const matchedProj = allProjects.find(p => p.name.toLowerCase() === finalProjectName.toLowerCase())
      if (matchedProj) {
        finalBlockName = matchedProj.blockName
      }
    } else if (isDestRetired) {
      finalBlockName = ''
    }

    const finalTrangThai = isDestRetired ? 'Đã nghỉ việc' : 'Đang làm việc'

    // 1. Update local state
    const updatedData = data.map(d => {
      if (d.maNV === storekeeper.maNV) {
        return {
          ...d,
          duAn: finalProjectName,
          banChuoiKhoi: finalBlockName,
          trangThai: finalTrangThai
        }
      }
      return d
    })
    
    if (onUpdateData) {
      onUpdateData(updatedData)
    }

    setActiveTransferMenu(null)

    // 2. Queue in pending changes
    const oldProjName = storekeeper.duAn || (storekeeper.trangThai === 'Đã nghỉ việc' || storekeeper.trangThai === 'Nghỉ việc' ? 'Đã nghỉ việc' : 'Chưa phân bổ')
    
    setPendingChanges(prev => {
      const existing = prev[storekeeper.maNV]
      const fromProjectName = existing ? existing.fromProjectName : oldProjName
      
      const updated = {
        ...prev,
        [storekeeper.maNV]: {
          maNV: storekeeper.maNV,
          hoTen: storekeeper.hoTen,
          fromProjectName,
          toProjectName: destProjectName,
          finalProjectName,
          finalBlockName,
          finalTrangThai
        }
      }

      // If they moved back to original project, remove from list of pending changes
      if (destProjectName === fromProjectName) {
        const copy = { ...updated }
        delete copy[storekeeper.maNV]
        return copy
      }

      return updated
    })

    // Show success notification with from-to details
    setSuccessToast(`Đã chuyển ${storekeeper.hoTen} từ "${oldProjName}" sang "${destProjectName}" (Chưa lưu)`)
  }

  // Batch-Save Configuration Logic
  const handleSaveConfiguration = async () => {
    const changesArray = Object.values(pendingChanges)
    if (changesArray.length === 0) return

    setSaving(true)
    setSuccessToast(null)

    try {
      const updateStorekeeperConfig = async (change) => {
        const payload = {
          du_an: change.finalProjectName,
          du_an_cong_trinh: change.finalProjectName,
          khoi_thi_cong: change.finalBlockName,
          ban_chuoi_khoi: change.finalBlockName,
          trang_thai: change.finalTrangThai
        }
        
        let success = false
        let attempts = 0
        const maxAttempts = 20
        let currentPayload = { ...payload }

        while (!success && attempts < maxAttempts) {
          attempts++
          const { error } = await supabase
            .from('danh_sach_thu_kho')
            .update(currentPayload)
            .eq('ma_nv', change.maNV)

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
      }

      const promises = changesArray.map(change => updateStorekeeperConfig(change))
      await Promise.all(promises)

      setSuccessToast(`Đã lưu cấu hình thành công! Đã đồng bộ ${changesArray.length} nhân sự.`)
      setPendingChanges({})

      if (onReload) {
        await onReload()
      }
    } catch (err) {
      console.error('Lỗi lưu cấu hình:', err)
      alert('Lỗi lưu cấu hình: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Drag-and-drop state
  const [draggedStorekeeper, setDraggedStorekeeper] = useState(null)
  const [dragOverProjectId, setDragOverProjectId] = useState(null)

  const handleDragStart = (e, tk) => {
    setDraggedStorekeeper(tk)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tk.maNV)
  }

  const handleDropOnProject = (e, destProjectName, destProjId) => {
    e.preventDefault()
    setDragOverProjectId(null)
    if (!draggedStorekeeper) return

    const sourceProj = draggedStorekeeper.duAn || 'Chưa phân bổ'
    const isSourceRetired = draggedStorekeeper.trangThai === 'Đã nghỉ việc' || draggedStorekeeper.trangThai === 'Nghỉ việc'

    if (destProjId === 'RETIRED' && isSourceRetired) {
      setDraggedStorekeeper(null)
      return
    }

    if (sourceProj === destProjectName && !isSourceRetired && destProjId !== 'RETIRED') {
      setDraggedStorekeeper(null)
      return
    }

    transferPersonnel(draggedStorekeeper, destProjectName)
    setDraggedStorekeeper(null)
  }

  // Columns & Projects list with real-time stats
  const projectStats = useMemo(() => {
    const unassignedColumn = {
      id: 'UNASSIGNED',
      name: 'Chưa phân bổ',
      badge: 'HOLDING',
      blockName: 'Nhân sự tự do',
      color: '#475569',
      bgColor: '#f8fafc',
      borderColor: '#cbd5e1',
      badgeBg: '#e2e8f0',
      count: 0
    }

    const retiredColumn = {
      id: 'RETIRED',
      name: 'Đã nghỉ việc',
      badge: 'QUIT',
      blockName: 'Trạng thái nghỉ việc',
      color: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#fca5a5',
      badgeBg: '#fee2e2',
      count: 0
    }

    const projectsList = [
      unassignedColumn,
      retiredColumn,
      ...allProjects.map(p => ({
        ...p,
        count: 0
      }))
    ]

    // Calculate real-time counts using filteredStorekeepers
    filteredStorekeepers.forEach(tk => {
      const isRetired = tk.trangThai === 'Đã nghỉ việc' || tk.trangThai === 'Nghỉ việc'
      if (isRetired) {
        retiredColumn.count++
        return
      }

      const projName = (tk.duAn || '').trim()
      const isKnown = allProjects.some(p => p.name.toLowerCase() === projName.toLowerCase())

      if (!projName || projName === 'none' || projName === '—' || !isKnown) {
        unassignedColumn.count++
      } else {
        const found = projectsList.find(p => p.name && p.name.toLowerCase() === projName.toLowerCase())
        if (found) {
          found.count++
        } else {
          unassignedColumn.count++
        }
      }
    })

    // Filter by search query
    const query = searchProject.trim().toLowerCase()
    if (!query) return projectsList

    return projectsList.filter(p => 
      p.id === 'UNASSIGNED' || 
      p.id === 'RETIRED' ||
      p.name.toLowerCase().includes(query) || 
      p.badge.toLowerCase().includes(query) || 
      p.blockName.toLowerCase().includes(query)
    )
  }, [allProjects, filteredStorekeepers, searchProject])

  // Get active storekeepers (either globally filtered or project-filtered)
  const activeProjectStorekeepers = useMemo(() => {
    const sq = searchStorekeeper.trim()
    let list = []

    // If global search is active, show matching storekeepers
    if (sq) {
      list = [...filteredStorekeepers]
    } else {
      const activeProj = projectStats.find(p => p.id === selectedProjectId)
      if (!activeProj) return []

      list = data.filter(tk => {
        const isRetired = tk.trangThai === 'Đã nghỉ việc' || tk.trangThai === 'Nghỉ việc'

        if (activeProj.id === 'RETIRED') {
          return isRetired
        }
        
        // Non-retired storekeepers can go to their project
        if (isRetired) {
          return false
        }

        const projName = (tk.duAn || '').trim()
        const isKnown = allProjects.some(p => p.name.toLowerCase() === projName.toLowerCase())
        
        // Match project assignment
        if (activeProj.id === 'UNASSIGNED') {
          return (!projName || projName === 'none' || projName === '—' || !isKnown)
        } else {
          return (projName.toLowerCase() === activeProj.name.toLowerCase())
        }
      })
    }

    // Sort: Leaders at the top, then alphabetically by name in Vietnamese locale
    return list.sort((a, b) => {
      const roleA = (a.chucVu || '').toLowerCase()
      const roleB = (b.chucVu || '').toLowerCase()
      
      const isLeaderA = roleA.includes('trưởng') || roleA.includes('truong')
      const isLeaderB = roleB.includes('trưởng') || roleB.includes('truong')

      if (isLeaderA && !isLeaderB) return -1
      if (!isLeaderA && isLeaderB) return 1

      return (a.hoTen || '').localeCompare(b.hoTen || '', 'vi')
    })
  }, [selectedProjectId, data, allProjects, projectStats, searchStorekeeper, filteredStorekeepers])

  const selectedProjectInfo = useMemo(() => {
    return projectStats.find(p => p.id === selectedProjectId)
  }, [projectStats, selectedProjectId])

  const chucVuCounts = useMemo(() => {
    const counts = {}
    activeProjectStorekeepers.forEach(tk => {
      const cv = tk.chucVu || 'Khác'
      counts[cv] = (counts[cv] || 0) + 1
    })
    return counts
  }, [activeProjectStorekeepers])

  const renderChucVuStats = () => {
    if (Object.keys(chucVuCounts).length === 0) return null
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, marginRight: 2, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          Theo chức danh:
        </span>
        {Object.entries(chucVuCounts).map(([chucVu, count]) => {
          let bg = '#f1f5f9'
          let color = '#475569'
          let border = '#cbd5e1'
          
          if (['Thủ kho trưởng', 'Thủ kho trưởng hiện trường', 'Thủ kho nhập liệu'].includes(chucVu)) {
            bg = '#eff6ff'
            color = '#1e40af'
            border = '#bfdbfe'
          } else if (['Thủ kho', 'Thủ kho hiện trường'].includes(chucVu)) {
            bg = '#faf5ff'
            color = '#6b21a8'
            border = '#e9d5ff'
          } else if (['Trưởng nhóm kho', 'Trưởng nhóm Kho', 'Trưởng nhóm kho dự án'].includes(chucVu)) {
            bg = '#ecfdf5'
            color = '#065f46'
            border = '#a7f3d0'
          }

          return (
            <div 
              key={chucVu}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: bg,
                color: color,
                border: `1px solid ${border}`
              }}
            >
              <span>{chucVu}</span>
              <span style={{
                background: 'rgba(0, 0, 0, 0.06)',
                padding: '0.5px 4.5px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: 10.5
              }}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      
      {/* Toast Feedback */}
      {successToast && (
        <div style={{
          position: 'absolute', top: 20, right: 24, zIndex: 1000,
          background: '#ecfdf5', color: '#047857', padding: '12px 20px',
          borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(4,120,87,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid #a7f3d0', animation: 'fade-in 0.3s ease-out'
        }}>
          <Check size={18} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{successToast}</span>
        </div>
      )}

      {/* Modern Compact Header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', flex: '1 1 auto' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)', padding: '10px', borderRadius: '12px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              LUÂN CHUYỂN & PHÂN BỔ NHÂN SỰ
            </h4>
            <span style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 5 }}>
              💡 Chọn dự án ở bên trái để xem nhân sự, sau đó kéo thả thẻ để di chuyển sang dự án khác.
            </span>
          </div>
        </div>

        {/* Explain contents of changed information (Chi tiết luân chuyển) */}
        {Object.keys(pendingChanges).length > 0 && (
          <div style={{
            flex: '1 1 auto',
            maxWidth: '520px',
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '10px',
            padding: '8px 14px',
            fontSize: '12.5px',
            color: '#78350f',
            maxHeight: '74px',
            overflowY: 'auto',
            textAlign: 'left',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '11px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Chi tiết luân chuyển (chưa lưu):</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.values(pendingChanges).map(change => (
                <div key={change.maNV} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, lineHeight: '1.4' }}>
                  <strong style={{ color: '#0f58a7' }}>{change.hoTen}</strong> 
                  <span style={{ color: '#94a3b8', fontSize: '11.5px', fontWeight: 600 }}>{change.maNV}</span>
                  <span style={{ color: '#64748b', textDecoration: 'line-through', opacity: 0.85, fontSize: '12px' }}>
                    {change.fromProjectName || 'Chưa phân bổ'}
                  </span>
                  <span style={{ color: '#d97706', fontWeight: 'bold' }}>➔</span>
                  <strong style={{ color: '#047857', fontSize: '12.5px' }}>
                    {change.toProjectName || 'Chưa phân bổ'}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Storekeeper Search Bar & Save Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          
          {/* Synchronized status / Unsaves status block */}
          <div style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: Object.keys(pendingChanges).length > 0 ? '#b45309' : '#047857',
            backgroundColor: Object.keys(pendingChanges).length > 0 ? '#fef3c7' : '#ecfdf5',
            padding: '8px 14px',
            borderRadius: '10px',
            border: `1.5px solid ${Object.keys(pendingChanges).length > 0 ? '#fde68a' : '#a7f3d0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: Object.keys(pendingChanges).length > 0 ? '#f59e0b' : '#10b981',
              display: 'inline-block'
            }} />
            <span>
              {Object.keys(pendingChanges).length > 0 
                ? `Chưa lưu (${Object.keys(pendingChanges).length} thay đổi)` 
                : 'Dữ liệu đã đồng bộ'}
            </span>
          </div>

          {/* Save configuration button */}
          <button
            disabled={Object.keys(pendingChanges).length === 0 || saving}
            onClick={handleSaveConfiguration}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: 13,
              fontWeight: 800,
              cursor: (Object.keys(pendingChanges).length === 0 || saving) ? 'not-allowed' : 'pointer',
              backgroundColor: (Object.keys(pendingChanges).length === 0) 
                ? '#cbd5e1' 
                : (saving ? '#0284c7' : '#10b981'),
              color: (Object.keys(pendingChanges).length === 0) ? '#64748b' : '#ffffff',
              border: 'none',
              transition: 'all 0.15s ease',
              boxShadow: (Object.keys(pendingChanges).length === 0) ? 'none' : '0 4px 12px rgba(16,185,129,0.2)',
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check size={15} />
                <span>Lưu cấu hình</span>
              </>
            )}
          </button>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="input"
              placeholder="Lọc thủ kho trên toàn hệ thống..."
              value={searchStorekeeper}
              onChange={(e) => setSearchStorekeeper(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, fontSize: 13, height: 40, borderRadius: '10px', border: '1.5px solid #cbd5e1' }}
            />
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Workspace */}
      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* LEFT PANEL: Projects Tree/List */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, minHeight: 0 }}>
          
          {/* Project search bar */}
          <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Danh sách dự án ({projectStats.length})</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Building2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input"
                placeholder="Tìm dự án, công trình nhanh..."
                value={searchProject}
                onChange={(e) => setSearchProject(e.target.value)}
                style={{ width: '100%', paddingLeft: 34, fontSize: 13, height: 38 }}
              />
            </div>
          </div>

          {/* Projects scroll list */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 10,
            paddingRight: 4
          }}>
            {projectStats.map(p => {
              const isSelected = p.id === selectedProjectId
              const isDragOver = dragOverProjectId === p.id
              const isUnassigned = p.id === 'UNASSIGNED'

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOverProjectId !== p.id) setDragOverProjectId(p.id)
                  }}
                  onDragLeave={() => setDragOverProjectId(null)}
                  onDrop={(e) => handleDropOnProject(e, p.name, p.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    borderTop: isDragOver 
                      ? `2px dashed ${p.color || '#0b57d0'}` 
                      : `1.5px solid ${isSelected ? (p.color || '#bae6fd') : (p.borderColor || '#e2e8f0')}`,
                    borderRight: isDragOver 
                      ? `2px dashed ${p.color || '#0b57d0'}` 
                      : `1.5px solid ${isSelected ? (p.color || '#bae6fd') : (p.borderColor || '#e2e8f0')}`,
                    borderBottom: isDragOver 
                      ? `2px dashed ${p.color || '#0b57d0'}` 
                      : `1.5px solid ${isSelected ? (p.color || '#bae6fd') : (p.borderColor || '#e2e8f0')}`,
                    borderLeft: isDragOver
                      ? `5px solid ${p.color || '#0b57d0'}`
                      : `5px solid ${p.color || '#94a3b8'}`,
                    backgroundColor: isDragOver 
                      ? '#eff6ff' 
                      : (p.bgColor || '#ffffff'),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0,0,0,0.01)',
                    transform: isSelected ? 'scale(1.01)' : 'none',
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected && !isDragOver) {
                      e.currentTarget.style.borderColor = p.color || '#cbd5e1'
                      e.currentTarget.style.backgroundColor = p.bgColor || '#f8fafc'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected && !isDragOver) {
                      e.currentTarget.style.borderColor = p.borderColor || '#e2e8f0'
                      e.currentTarget.style.backgroundColor = p.bgColor || '#ffffff'
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: p.badgeBg || '#e2e8f0',
                        color: p.color || '#475569',
                      }}>
                        {p.badge}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.blockName}
                      </span>
                    </div>
                    <h5 style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: isSelected ? 800 : 600,
                      color: isSelected ? '#0369a1' : '#1e293b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {p.name}
                    </h5>
                  </div>

                  {/* Count indicator */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isSelected ? '#0284c7' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    <span>{p.count}</span>
                    <Users size={12} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Current Project's Personnel and Action area */}
        <div className="card" style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: 0,
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.015)',
          overflow: 'hidden'
        }}>
          
          {/* Header of Right Panel */}
          {searchStorekeeper.trim() ? (
            <div style={{
              padding: '12px 16px',
              borderBottom: '1.5px solid #e2e8f0',
              backgroundColor: '#f0f9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: '#0284c7',
                    color: '#ffffff'
                  }}>
                    TOÀN HỆ THỐNG
                  </span>
                  <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                    Chế độ lọc toàn cục
                  </span>
                </div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0369a1' }}>
                  Tìm thấy {activeProjectStorekeepers.length} thủ kho khớp với "{searchStorekeeper}"
                </h4>
              </div>
              {renderChucVuStats()}
            </div>
          ) : (
            selectedProjectInfo && (
              <div style={{
                padding: '12px 16px',
                borderBottom: '1.5px solid #e2e8f0',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                textAlign: 'left'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '5px',
                      background: selectedProjectInfo.color || '#64748b',
                      color: '#ffffff'
                    }}>
                      {selectedProjectInfo.badge}
                    </span>
                    <span style={{ 
                      fontSize: '13px', 
                      color: '#0f58a7', 
                      fontWeight: 800,
                      fontFamily: "'Roboto', sans-serif",
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em'
                    }}>
                      {selectedProjectInfo.blockName}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    {selectedProjectInfo.name}
                  </h4>
                </div>
                {renderChucVuStats()}
              </div>
            )
          )}

          {/* Scrollable list of Storekeepers */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '12px',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            {activeProjectStorekeepers.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                color: '#94a3b8',
                gap: 10
              }}>
                <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '50%', color: '#cbd5e1' }}>
                  <Users size={32} />
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Không tìm thấy nhân sự nào</span>
                <span style={{ fontSize: 12 }}>Hãy phân bổ nhân sự từ nhóm "Chưa phân bổ" sang dự án này</span>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))',
                gap: 10,
                alignContent: 'start'
              }}>
                {activeProjectStorekeepers.map(tk => {
                  const isMenuOpen = activeTransferMenu === tk.maNV
                  const cardStyle = getProjectStyle(tk.duAn, tk.trangThai)

                  return (
                    <div
                      key={tk.maNV}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tk)}
                      onDragEnd={() => setDraggedStorekeeper(null)}
                      onDoubleClick={() => setEditingStorekeeper(tk)}
                      title="Nhấp đúp chuột vào thẻ để chỉnh sửa thông tin thủ kho"
                      style={{
                        backgroundColor: cardStyle?.bgColor || '#ffffff',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        borderTop: `1.5px solid ${cardStyle?.borderColor || '#e2e8f0'}`,
                        borderRight: `1.5px solid ${cardStyle?.borderColor || '#e2e8f0'}`,
                        borderBottom: `1.5px solid ${cardStyle?.borderColor || '#e2e8f0'}`,
                        borderLeft: `5px solid ${cardStyle?.color || '#94a3b8'}`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        textAlign: 'left'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = cardStyle?.color || '#0b57d0'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(11,87,208,0.08)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = cardStyle?.borderColor || '#e2e8f0'
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'
                        e.currentTarget.style.transform = 'none'
                      }}
                    >
                      {/* Top profile segment */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{
                          background: avatarColor(tk.hoTen),
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 11,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {initials(tk.hoTen)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                            <span style={{
                              fontFamily: "'Roboto', sans-serif",
                              fontWeight: 700,
                              color: '#1e293b',
                              fontSize: 12.5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                              minWidth: 0
                            }} title={tk.hoTen}>
                              {tk.hoTen}
                            </span>
                            <span style={{
                              fontFamily: "'Roboto', sans-serif",
                              fontSize: 11.5,
                              fontWeight: 800,
                              color: '#0f58a7',
                              flexShrink: 0,
                              marginLeft: 'auto'
                            }}>
                              {tk.maNV}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                          <GripVertical size={14} title="Nhấp & Kéo để chuyển sang dự án bên trái" />
                        </div>
                      </div>

                      {/* Project Location (Moved to middle row) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', marginTop: '2px', overflow: 'hidden' }}>
                        {cardStyle?.badge && (
                          <span style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background: cardStyle.color || '#64748b',
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            lineHeight: 1
                          }}>
                            {cardStyle.badge}
                          </span>
                        )}
                        <span style={{ 
                          fontSize: 11.5, 
                          color: '#1e293b', 
                          fontWeight: 700, 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          flex: 1 
                        }} title={cardStyle?.badge === 'QUIT' ? 'Đã nghỉ việc' : (tk.duAn || 'Chưa phân bổ')}>
                          {cardStyle?.badge === 'QUIT' ? 'Đã nghỉ việc' : (tk.duAn || 'Chưa phân bổ')}
                        </span>
                      </div>

                      {/* Contact & Chức vụ Line (Moved to bottom row) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: '2px' }}>
                        <span className={`badge ${chucVuBadgeClass(tk.chucVu)}`} style={{ fontSize: 9.5, padding: '1.5px 5px' }}>
                          {tk.chucVu}
                        </span>
                        {tk.soDienThoai && (
                          <a 
                            href={`tel:${tk.soDienThoai}`}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            style={{ 
                              fontSize: 10.5, 
                              color: '#0f58a7', 
                              fontWeight: 600,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}
                          >
                            📞 {tk.soDienThoai}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Global Event click dismissal of popover menus */}
      {activeTransferMenu && (
        <div 
          onClick={() => setActiveTransferMenu(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'transparent' }} 
        />
      )}



      {editingStorekeeper && (
        <EditModal 
          row={editingStorekeeper} 
          onClose={() => setEditingStorekeeper(null)} 
          onSave={handleSaveStorekeeper} 
          blocksConfig={blocks} 
        />
      )}
    </div>
  )
}
