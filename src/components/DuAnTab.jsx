import React, { useMemo, useState, useEffect } from 'react'
import { 
  Building2, Search, MapPin, Briefcase, Users, GripVertical, Check, 
  RefreshCw, UserMinus, ArrowRightLeft, MoveRight, ChevronRight,
  UserCheck, ExternalLink, Columns, LayoutGrid, Pencil, ChevronDown,
  ChevronUp, Layers, Filter
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { chucVuBadgeClass, avatarColor, initials } from '../constants.js'
import EditModal from './EditModal.jsx'

export default function DuAnTab({ data = [], onUpdateData, onReload }) {
  const [selectedProjectId, setSelectedProjectId] = useState('UNASSIGNED') // Selected source project
  const [viewMode, setViewMode] = useState('split') // 'split' | 'kanban'
  const [selectedBlockFilter, setSelectedBlockFilter] = useState('ALL')
  const [collapsedBlocks, setCollapsedBlocks] = useState({})
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

  // Group projects by Block for clear hierarchy in both Split and Kanban views
  const groupedProjects = useMemo(() => {
    // 1. Special group (Chưa phân bổ & Đã nghỉ việc)
    const specialProjects = projectStats.filter(p => p.id === 'UNASSIGNED' || p.id === 'RETIRED')
    const specialGroup = {
      id: 'SPECIAL',
      name: 'TRẠNG THÁI ĐẶC BIỆT',
      badge: 'HỆ THỐNG',
      color: '#0f58a7',
      bgColor: '#f1f5f9',
      projects: specialProjects,
      totalPersonnel: specialProjects.reduce((sum, p) => sum + p.count, 0)
    }

    // 2. Groups from configured blocks
    const blockGroups = blocks.map(b => {
      const bProjects = projectStats.filter(p => p.blockId === b.id)
      return {
        id: b.id,
        name: b.name,
        badge: b.badge,
        color: b.color || '#0f58a7',
        bgColor: b.bgColor || '#f8fafc',
        borderColor: b.borderColor || '#cbd5e1',
        badgeBg: b.badgeBg || '#e0f2fe',
        projects: bProjects,
        totalPersonnel: bProjects.reduce((sum, p) => sum + p.count, 0)
      }
    })

    // 3. Any projects without matching block
    const otherProjects = projectStats.filter(p => 
      p.id !== 'UNASSIGNED' && 
      p.id !== 'RETIRED' && 
      !blocks.some(b => b.id === p.blockId)
    )

    const otherGroup = otherProjects.length > 0 ? [{
      id: 'OTHER',
      name: 'DỰ ÁN KHÁC',
      badge: 'KHÁC',
      color: '#64748b',
      bgColor: '#f8fafc',
      borderColor: '#cbd5e1',
      badgeBg: '#e2e8f0',
      projects: otherProjects,
      totalPersonnel: otherProjects.reduce((sum, p) => sum + p.count, 0)
    }] : []

    return [specialGroup, ...blockGroups, ...otherGroup]
  }, [projectStats, blocks])

  const toggleBlockCollapse = (blockId) => {
    setCollapsedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
  }

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

  // Common storekeeper card renderer for both Split View and Kanban View
  const renderStorekeeperCard = (tk) => {
    const isMenuOpen = activeTransferMenu === tk.maNV
    const cardStyle = getProjectStyle(tk.duAn, tk.trangThai)

    return (
      <div
        key={tk.maNV}
        draggable
        onDragStart={(e) => handleDragStart(e, tk)}
        onDragEnd={() => setDraggedStorekeeper(null)}
        onDoubleClick={() => setEditingStorekeeper(tk)}
        title="Kéo thả hoặc bấm nút 'Chuyển' để luân chuyển dự án"
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

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
            {/* Quick Transfer Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveTransferMenu(isMenuOpen ? null : tk.maNV)
              }}
              title="Chuyển nhanh sang dự án khác"
              style={{
                background: isMenuOpen ? '#0f58a7' : '#f1f5f9',
                color: isMenuOpen ? '#ffffff' : '#0f58a7',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '3px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <ArrowRightLeft size={11} />
              <span>Chuyển</span>
            </button>

            {/* Edit Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditingStorekeeper(tk)
              }}
              title="Chỉnh sửa thông tin"
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '3px 5px',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <Pencil size={11} />
            </button>

            {/* Drag Handle */}
            <div style={{ color: '#94a3b8', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
              <GripVertical size={14} title="Kéo & thả để chuyển dự án" />
            </div>

            {/* Quick Transfer Dropdown Popover */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 250,
                  maxHeight: 300,
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', padding: '4px 8px', textTransform: 'uppercase' }}>
                  Chuyển sang dự án:
                </div>
                <button
                  type="button"
                  onClick={() => transferPersonnel(tk, 'Chưa phân bổ')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#334155',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#e2e8f0', color: '#475569', fontWeight: 800 }}>HOLD</span>
                  <span>Chưa phân bổ</span>
                </button>
                <button
                  type="button"
                  onClick={() => transferPersonnel(tk, 'Đã nghỉ việc')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#ef4444',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 800 }}>QUIT</span>
                  <span>Đã nghỉ việc</span>
                </button>
                <div style={{ height: 1, backgroundColor: '#e2e8f0', margin: '3px 0' }} />
                {blocks.map(b => (
                  <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: b.color || '#0f58a7', padding: '4px 8px 1px 8px', textTransform: 'uppercase' }}>
                      {b.badge} • {b.name}
                    </div>
                    {(b.projects || []).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => transferPersonnel(tk, p.name)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 6, padding: '5px 8px 5px 14px', borderRadius: 5, fontSize: 11.5,
                          fontWeight: 500, color: '#1e293b', background: 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = b.bgColor || '#f0f9ff'
                          e.currentTarget.style.color = b.color || '#0f58a7'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = '#1e293b'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.badge && (
                          <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: b.badgeBg || '#e0f2fe', color: b.color || '#0f58a7', fontWeight: 700 }}>
                            {p.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', marginTop: 2, overflow: 'hidden' }}>
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

        {/* Contact & Chức vụ Line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
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
                textDecoration: 'none', 
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

        {/* View Mode Switcher & Global Storekeeper Search Bar & Save Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '3px', gap: '3px' }}>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: viewMode === 'split' ? 800 : 600,
                background: viewMode === 'split' ? '#0f58a7' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : '#64748b',
                boxShadow: viewMode === 'split' ? '0 1px 3px rgba(15,88,167,0.25)' : 'none',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Columns size={14} />
              <span>Chế độ 2 cột</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: viewMode === 'kanban' ? 800 : 600,
                background: viewMode === 'kanban' ? '#0f58a7' : 'transparent',
                color: viewMode === 'kanban' ? '#ffffff' : '#64748b',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(15,88,167,0.25)' : 'none',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <LayoutGrid size={14} />
              <span>Bảng Kanban</span>
            </button>
          </div>

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

      {/* Main Dual-Pane Workspace OR Kanban View */}
      {viewMode === 'split' ? (
        <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* LEFT PANEL: Projects Tree/List Grouped by Block */}
          <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, minHeight: 0 }}>
            
            {/* Project search bar */}
            <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Danh sách dự án ({projectStats.length})
                </span>
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

            {/* Grouped Projects scroll list */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12,
              paddingRight: 4
            }}>
              {groupedProjects.map(group => {
                const isCollapsed = collapsedBlocks[group.id]
                const matchingProjects = group.projects.filter(p => 
                  !searchProject.trim() || 
                  p.name.toLowerCase().includes(searchProject.toLowerCase()) || 
                  (p.badge && p.badge.toLowerCase().includes(searchProject.toLowerCase()))
                )

                if (searchProject.trim() && matchingProjects.length === 0) return null

                return (
                  <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Block Accordion Header */}
                    <div 
                      onClick={() => toggleBlockCollapse(group.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: group.color || '#0f58a7',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {group.badge}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {group.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1.5px 6px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1'
                        }}>
                          {matchingProjects.reduce((s, p) => s + p.count, 0)} NS
                        </span>
                        {isCollapsed ? <ChevronRight size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
                      </div>
                    </div>

                    {/* Projects inside Block */}
                    {!isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                        {matchingProjects.map(p => {
                          const isSelected = p.id === selectedProjectId
                          const isDragOver = dragOverProjectId === p.id

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
                                padding: '10px 14px',
                                borderRadius: '12px',
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
                                gap: 10,
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
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
                                  fontSize: 12.5,
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
                                gap: 5,
                                background: isSelected ? '#0284c7' : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#475569',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                <span>{p.count}</span>
                                <Users size={11} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
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
                  {activeProjectStorekeepers.map(renderStorekeeperCard)}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* KANBAN BOARD VIEW: Horizontal Scrollable Columns for all Projects */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* Top Block Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: 4 }}>
              Lọc theo khối:
            </span>
            <button
              type="button"
              onClick={() => setSelectedBlockFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: selectedBlockFilter === 'ALL' ? 800 : 600,
                background: selectedBlockFilter === 'ALL' ? '#0f58a7' : '#ffffff',
                color: selectedBlockFilter === 'ALL' ? '#ffffff' : '#334155',
                border: `1.5px solid ${selectedBlockFilter === 'ALL' ? '#0f58a7' : '#cbd5e1'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              Tất cả khối ({projectStats.length})
            </button>
            {blocks.map(b => {
              const bCount = projectStats.filter(p => p.blockId === b.id).length
              const isSelected = selectedBlockFilter === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBlockFilter(b.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    background: isSelected ? (b.color || '#0f58a7') : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: `1.5px solid ${isSelected ? (b.color || '#0f58a7') : '#cbd5e1'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    fontSize: 9.5,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : (b.badgeBg || '#e0f2fe'),
                    color: isSelected ? '#ffffff' : (b.color || '#0f58a7'),
                    fontWeight: 800
                  }}>
                    {b.badge}
                  </span>
                  <span>{b.name} ({bCount})</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setSelectedBlockFilter('UNASSIGNED')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: selectedBlockFilter === 'UNASSIGNED' ? 800 : 600,
                background: selectedBlockFilter === 'UNASSIGNED' ? '#d97706' : '#ffffff',
                color: selectedBlockFilter === 'UNASSIGNED' ? '#ffffff' : '#334155',
                border: `1.5px solid ${selectedBlockFilter === 'UNASSIGNED' ? '#d97706' : '#cbd5e1'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              Chưa phân bổ
            </button>
            <button
              type="button"
              onClick={() => setSelectedBlockFilter('RETIRED')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: selectedBlockFilter === 'RETIRED' ? 800 : 600,
                background: selectedBlockFilter === 'RETIRED' ? '#ef4444' : '#ffffff',
                color: selectedBlockFilter === 'RETIRED' ? '#ffffff' : '#334155',
                border: `1.5px solid ${selectedBlockFilter === 'RETIRED' ? '#ef4444' : '#cbd5e1'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              Đã nghỉ việc
            </button>
          </div>

          {/* Horizontal Scrollable Kanban Columns */}
          <div style={{
            flex: 1,
            display: 'flex',
            gap: 16,
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 8,
            alignItems: 'stretch'
          }}>
            {projectStats
              .filter(p => {
                if (selectedBlockFilter === 'ALL') return true
                if (selectedBlockFilter === 'UNASSIGNED') return p.id === 'UNASSIGNED'
                if (selectedBlockFilter === 'RETIRED') return p.id === 'RETIRED'
                return p.blockId === selectedBlockFilter
              })
              .filter(p => {
                if (!searchProject.trim()) return true
                const s = searchProject.toLowerCase()
                return p.name.toLowerCase().includes(s) || (p.badge && p.badge.toLowerCase().includes(s))
              })
              .map(p => {
                const isDragOver = dragOverProjectId === p.id
                
                // Get personnel matching this column
                const personnelInCol = data.filter(tk => {
                  const isRetired = tk.trangThai === 'Đã nghỉ việc' || tk.trangThai === 'Nghỉ việc'
                  if (p.id === 'RETIRED') return isRetired
                  if (isRetired) return false

                  const currentProj = (tk.duAn || '').trim()
                  const isKnown = allProjects.some(pr => pr.name.toLowerCase() === currentProj.toLowerCase())

                  if (p.id === 'UNASSIGNED') {
                    return (!currentProj || currentProj === 'none' || currentProj === '—' || !isKnown)
                  }
                  return currentProj.toLowerCase() === p.name.toLowerCase()
                }).filter(tk => {
                  if (!searchStorekeeper.trim()) return true
                  const s = searchStorekeeper.toLowerCase()
                  return (
                    (tk.hoTen || '').toLowerCase().includes(s) ||
                    (tk.maNV || '').toLowerCase().includes(s) ||
                    (tk.soDienThoai || '').includes(s) ||
                    (tk.chucVu || '').toLowerCase().includes(s)
                  )
                }).sort((a, b) => {
                  const roleA = (a.chucVu || '').toLowerCase()
                  const roleB = (b.chucVu || '').toLowerCase()
                  const isLeaderA = roleA.includes('trưởng') || roleA.includes('truong')
                  const isLeaderB = roleB.includes('trưởng') || roleB.includes('truong')
                  if (isLeaderA && !isLeaderB) return -1
                  if (!isLeaderA && isLeaderB) return 1
                  return (a.hoTen || '').localeCompare(b.hoTen || '', 'vi')
                })

                return (
                  <div
                    key={p.id}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragOverProjectId !== p.id) setDragOverProjectId(p.id)
                    }}
                    onDragLeave={() => setDragOverProjectId(null)}
                    onDrop={(e) => handleDropOnProject(e, p.name, p.id)}
                    style={{
                      width: '295px',
                      minWidth: '295px',
                      maxWidth: '295px',
                      borderRadius: '14px',
                      backgroundColor: isDragOver ? '#eff6ff' : '#f8fafc',
                      borderTop: isDragOver 
                        ? `2px dashed ${p.color || '#0b57d0'}` 
                        : `1.5px solid ${p.borderColor || '#cbd5e1'}`,
                      borderRight: isDragOver 
                        ? `2px dashed ${p.color || '#0b57d0'}` 
                        : `1.5px solid ${p.borderColor || '#cbd5e1'}`,
                      borderBottom: isDragOver 
                        ? `2px dashed ${p.color || '#0b57d0'}` 
                        : `1.5px solid ${p.borderColor || '#cbd5e1'}`,
                      borderLeft: isDragOver 
                        ? `5px solid ${p.color || '#0b57d0'}` 
                        : `5px solid ${p.color || '#94a3b8'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease',
                      maxHeight: '100%',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Column Header */}
                    <div style={{
                      padding: '12px 14px',
                      borderBottom: '1.5px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: p.badgeBg || '#e2e8f0',
                          color: p.color || '#475569',
                        }}>
                          {p.badge}
                        </span>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: 11,
                          fontWeight: 800
                        }}>
                          <span>{personnelInCol.length}</span>
                          <Users size={11} />
                        </div>
                      </div>
                      <h4 style={{
                        margin: 0,
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left'
                      }} title={p.name}>
                        {p.name}
                      </h4>
                      <span style={{ fontSize: 11, color: '#64748b', textAlign: 'left', fontWeight: 500 }}>
                        {p.blockName}
                      </span>
                    </div>

                    {/* Column Cards Body */}
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      {personnelInCol.length === 0 ? (
                        <div style={{
                          padding: '24px 12px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '12px',
                          border: '1.5px dashed #cbd5e1',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff'
                        }}>
                          Kéo thả nhân sự vào đây
                        </div>
                      ) : (
                        personnelInCol.map(renderStorekeeperCard)
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

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
