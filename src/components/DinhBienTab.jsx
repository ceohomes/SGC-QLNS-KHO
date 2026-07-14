import React, { useState, useEffect, useMemo } from 'react'
import { 
  ClipboardList, Search, RefreshCw, Calendar, Check, AlertCircle, 
  Copy, ChevronDown, ChevronUp, Users, TrendingUp, Info, HelpCircle,
  TrendingDown, ArrowLeftRight, Database, Table, PlusCircle, X
} from 'lucide-react'
import { supabase } from '../supabaseClient'

const SQL_CODE_DINH_BIEN = `-- -------------------------------------------------------------
-- TẠO BẢNG ĐỊNH BIÊN NHÂN SỰ HÀNG THÁNG (sgc_dinh_bien_nhan_su)
-- Vui lòng chạy đoạn mã này trong SQL Editor của Supabase để lưu trữ trên mây!
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgc_dinh_bien_nhan_su (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    project_name TEXT NOT NULL,
    month TEXT NOT NULL, -- Định dạng: 'YYYY-MM'
    quota INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_month UNIQUE(project_name, month)
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE sgc_dinh_bien_nhan_su ENABLE ROW LEVEL SECURITY;

-- Chính sách công khai (Mọi người đều có quyền đọc/ghi tự do)
CREATE POLICY "Allow public read for dinh_bien" ON sgc_dinh_bien_nhan_su FOR SELECT USING (true);
CREATE POLICY "Allow public write for dinh_bien" ON sgc_dinh_bien_nhan_su FOR ALL USING (true) WITH CHECK (true);`

export default function DinhBienTab({ data = [], onReload }) {
  // Lấy năm hiện tại làm mặc định
  const getInitialYear = () => {
    return new Date().getFullYear()
  }

  const [selectedYear, setSelectedYear] = useState(getInitialYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [blocks, setBlocks] = useState([])
  const [quotas, setQuotas] = useState([]) // { id, project_name, month, quota }
  const [localQuotas, setLocalQuotas] = useState({}) // { [project_name.toLowerCase()]: { [monthStr]: quota_number } }
  const [originalLocalQuotas, setOriginalLocalQuotas] = useState({}) // Để so sánh thay đổi chưa lưu
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [useSupabase, setUseSupabase] = useState(false)
  const [successToast, setSuccessToast] = useState(null)
  const [showSqlConfig, setShowSqlConfig] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  
  // Trạng thái hiển thị chi tiết nhân sự thực tế
  const [selectedProjectStaff, setSelectedProjectStaff] = useState(null)

  // Danh sách nhân viên thực tế của dự án đang chọn
  const staffDetailsList = useMemo(() => {
    if (!selectedProjectStaff) return []
    const lowerProjName = selectedProjectStaff.trim().toLowerCase()
    return data.filter(tk => {
      const isRetired = tk.trangThai === 'Đã nghỉ việc' || tk.trangThai === 'Nghỉ việc'
      if (isRetired) return false
      return (tk.duAn || '').trim().toLowerCase() === lowerProjName
    })
  }, [data, selectedProjectStaff])

  // Trạng thái điều chỉnh định biên 12 tháng bằng click đúp
  const [editingProject, setEditingProject] = useState(null)
  const [tempQuotas, setTempQuotas] = useState({}) // { [monthStr]: number }

  useEffect(() => {
    if (editingProject) {
      const pNameLower = editingProject.name.toLowerCase()
      const projectQuotas = localQuotas[pNameLower] || {}
      const initialTemp = {}
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`
        initialTemp[monthStr] = projectQuotas[monthStr] ?? 0
      }
      setTempQuotas(initialTemp)
    } else {
      setTempQuotas({})
    }
  }, [editingProject, selectedYear])

  const handleTempQuotaChange = (monthStr, val) => {
    const valInt = val === '' ? 0 : parseInt(val, 10)
    if (isNaN(valInt) || valInt < 0) return
    setTempQuotas(prev => ({
      ...prev,
      [monthStr]: valInt
    }))
  }

  const handleSaveTempQuotas = () => {
    if (!editingProject) return
    const pLower = editingProject.name.toLowerCase()
    setLocalQuotas(prev => ({
      ...prev,
      [pLower]: {
        ...(prev[pLower] || {}),
        ...tempQuotas
      }
    }))
    setEditingProject(null)
    setSuccessToast(`Đã cập nhật định biên của dự án ${editingProject.name}!`)
  }

  // ─── 1. TẢI CẤU HÌNH DỰ ÁN VÀ KHỐI ───
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
        throw new Error('No blocks found in Supabase')
      }
    } catch (err) {
      console.warn('Backup tải danh sách dự án với LocalStorage:', err.message)
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

  // ─── 2. TẢI DANH SÁCH ĐỊNH BIÊN CỦA NĂM ĐANG CHỌN ───
  const loadQuotas = async (year) => {
    setLoading(true)
    try {
      const startMonth = `${year}-01`
      const endMonth = `${year}-12`
      const { data: dbQuotas, error } = await supabase
        .from('sgc_dinh_bien_nhan_su')
        .select('*')
        .gte('month', startMonth)
        .lte('month', endMonth)

      if (error) throw error

      setUseSupabase(true)
      if (dbQuotas) {
        setQuotas(dbQuotas)
        const qMap = {}
        dbQuotas.forEach(q => {
          const pNameLower = q.project_name.toLowerCase()
          if (!qMap[pNameLower]) {
            qMap[pNameLower] = {}
          }
          qMap[pNameLower][q.month] = q.quota
        })
        setLocalQuotas(qMap)
        setOriginalLocalQuotas(JSON.parse(JSON.stringify(qMap)))
      }
    } catch (err) {
      console.warn('Dùng LocalStorage làm phương án dự phòng định biên:', err.message)
      setUseSupabase(false)
      const saved = localStorage.getItem(`sgc_dinh_bien_config_year_${year}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setLocalQuotas(parsed)
          setOriginalLocalQuotas(JSON.parse(saved))
        } catch (e) {
          setLocalQuotas({})
          setOriginalLocalQuotas({})
        }
      } else {
        setLocalQuotas({})
        setOriginalLocalQuotas({})
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  useEffect(() => {
    loadQuotas(selectedYear)
  }, [selectedYear])

  // Tự động tắt Toast thông báo sau 3 giây
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  // ─── 3. DANH SÁCH TẤT CẢ DỰ ÁN PHẲNG (Flat) ───
  const allProjectsFlat = useMemo(() => {
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
              bgColor: b.bgColor || b.bg_color,
              borderColor: b.borderColor || b.border_color,
              badgeBg: b.badgeBg || b.badge_bg
            })
          }
        })
      }
    })
    return list
  }, [blocks])

  // ─── 4. ĐẾM SỐ LƯỢNG NHÂN SỰ THỰC TẾ TRONG TỪNG DỰ ÁN ───
  // Tính dựa trên danh sách data hiện tại (chỉ đếm người Đang làm việc)
  const actualHeadcountByProject = useMemo(() => {
    const counts = {}
    data.forEach(tk => {
      const isRetired = tk.trangThai === 'Đã nghỉ việc' || tk.trangThai === 'Nghỉ việc'
      if (isRetired) return

      const pName = (tk.duAn || '').trim().toLowerCase()
      if (pName && pName !== 'none' && pName !== '—') {
        counts[pName] = (counts[pName] || 0) + 1
      }
    })
    return counts
  }, [data])

  // ─── 5. TỔNG HỢP DANH SÁCH CÙNG KPI ĐỊNH BIÊN ───
  const projectDinhBienData = useMemo(() => {
    return allProjectsFlat.map(p => {
      const pNameLower = p.name.toLowerCase()
      const actual = actualHeadcountByProject[pNameLower] || 0
      
      // So sánh KPI theo Tháng hiện hành của năm được chọn
      const currentMonthNum = new Date().getMonth() + 1
      const activeMonthStr = `${selectedYear}-${String(currentMonthNum).padStart(2, '0')}`
      const target = localQuotas[pNameLower]?.[activeMonthStr] ?? 0
      
      const diff = target - actual // Chênh lệch định biên: Định biên - Thực tế
      // Trạng thái: 'perfect' (Đủ), 'lack' (Thiếu), 'excess' (Thừa)
      let status = 'perfect'
      if (diff > 0) status = 'lack' // Định biên > Thực tế -> Thiếu nhân sự
      else if (diff < 0) status = 'excess' // Định biên < Thực tế -> Vượt định biên (Thừa)

      return {
        ...p,
        actual,
        target,
        diff: Math.abs(diff),
        diffRaw: diff,
        status
      }
    })
  }, [allProjectsFlat, actualHeadcountByProject, localQuotas, selectedYear])

  // Lọc danh sách dự án hiển thị theo tìm kiếm
  const filteredProjectDinhBienData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return projectDinhBienData
    return projectDinhBienData.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.blockName.toLowerCase().includes(query) ||
      p.badge.toLowerCase().includes(query)
    )
  }, [projectDinhBienData, searchQuery])

  // ─── 6. CÁC CHỈ SỐ KPI TỔNG THỂ ───
  const kpis = useMemo(() => {
    let totalTarget = 0
    let totalActual = 0
    let lackCount = 0
    let excessCount = 0
    let perfectCount = 0

    projectDinhBienData.forEach(p => {
      totalTarget += p.target
      totalActual += p.actual

      if (p.status === 'lack') lackCount++
      else if (p.status === 'excess') excessCount++
      else perfectCount++
    })

    const diffRaw = totalTarget - totalActual

    return {
      totalTarget,
      totalActual,
      diffRaw,
      diffAbs: Math.abs(diffRaw),
      lackCount,
      excessCount,
      perfectCount,
      totalProjects: projectDinhBienData.length
    }
  }, [projectDinhBienData])

  // ─── 7. KIỂM TRA THAY ĐỔI CHƯA LƯU ───
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(localQuotas) !== JSON.stringify(originalLocalQuotas)
  }, [localQuotas, originalLocalQuotas])

  // ─── 8. CẬP NHẬT ĐỊNH BIÊN LOCALLY KHI GÕ ───
  const handleQuotaChange = (pName, monthStr, value) => {
    const valInt = value === '' ? 0 : parseInt(value, 10)
    if (isNaN(valInt) || valInt < 0) return

    setLocalQuotas(prev => {
      const pLower = pName.toLowerCase()
      const projectQuotas = prev[pLower] || {}
      return {
        ...prev,
        [pLower]: {
          ...projectQuotas,
          [monthStr]: valInt
        }
      }
    })
  }

  // Khôi phục thay đổi chưa lưu
  const handleReset = () => {
    setLocalQuotas(JSON.parse(JSON.stringify(originalLocalQuotas)))
    setSuccessToast('Đã khôi phục các thay đổi chưa lưu.')
  }

  // ─── 9. LƯU ĐỊNH BIÊN LÊN DB HOẶC LOCAL STORAGE ───
  const handleSaveQuotas = async () => {
    setSaving(true)
    try {
      // 1. Luôn lưu cục bộ trước để tránh mất mát
      localStorage.setItem(`sgc_dinh_bien_config_year_${selectedYear}`, JSON.stringify(localQuotas))

      if (!useSupabase) {
        setOriginalLocalQuotas(JSON.parse(JSON.stringify(localQuotas)))
        setSuccessToast('Đã lưu định biên cục bộ vào trình duyệt thành công!')
        setSaving(false)
        return
      }

      // 2. Đồng bộ lên Supabase
      const payload = []
      allProjectsFlat.forEach(p => {
        const pNameLower = p.name.toLowerCase()
        const projectQuotas = localQuotas[pNameLower] || {}
        
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`
          const targetVal = projectQuotas[monthStr] || 0
          const id = `${p.id}_${monthStr}`
          payload.push({
            id,
            project_id: p.id,
            project_name: p.name,
            month: monthStr,
            quota: targetVal
          })
        }
      })

      // Thực hiện upsert an toàn
      let success = false
      let attempts = 0
      const maxAttempts = 10
      let currentPayload = [...payload]

      while (!success && attempts < maxAttempts) {
        attempts++
        const { error } = await supabase
          .from('sgc_dinh_bien_nhan_su')
          .upsert(currentPayload, { onConflict: 'id' })

        if (!error) {
          success = true
          break
        }

        const errMsg = error.message || ''
        const match = errMsg.match(/Could not find the '(.*?)' column/)
        if (match && match[1]) {
          const missingColumn = match[1]
          console.warn(`Pruning column [${missingColumn}] from sgc_dinh_bien_nhan_su upsert. Retrying...`)
          currentPayload = currentPayload.map(item => {
            const copy = { ...item }
            delete copy[missingColumn]
            return copy
          })
        } else {
          throw error
        }
      }

      setOriginalLocalQuotas(JSON.parse(JSON.stringify(localQuotas)))
      setSuccessToast(`Đã đồng bộ và lưu định biên năm ${selectedYear} lên Supabase!`)
      if (onReload) await onReload()
    } catch (err) {
      console.error('Lỗi khi lưu định biên lên Supabase:', err)
      setOriginalLocalQuotas(JSON.parse(JSON.stringify(localQuotas)))
      setSuccessToast('Lưu offline thành công! Supabase trả về lỗi.')
      alert('Lỗi lưu đồng bộ Supabase: ' + err.message + '\nTuy nhiên hệ thống đã lưu tạm thời vào máy tính của bạn.')
    } finally {
      setSaving(false)
    }
  }

  // ─── 10. SAO CHÉP ĐỊNH BIÊN TỪ NĂM TRƯỚC (Copy tool) ───
  const handleCopyFromPreviousYear = async () => {
    const prevYear = selectedYear - 1
    let prevQuotasMap = null

    try {
      const startMonth = `${prevYear}-01`
      const endMonth = `${prevYear}-12`
      const { data: dbQuotas, error } = await supabase
        .from('sgc_dinh_bien_nhan_su')
        .select('*')
        .gte('month', startMonth)
        .lte('month', endMonth)

      if (!error && dbQuotas && dbQuotas.length > 0) {
        prevQuotasMap = {}
        dbQuotas.forEach(q => {
          const pNameLower = q.project_name.toLowerCase()
          if (!prevQuotasMap[pNameLower]) {
            prevQuotasMap[pNameLower] = {}
          }
          const currentMonthStr = q.month.replace(`${prevYear}-`, `${selectedYear}-`)
          prevQuotasMap[pNameLower][currentMonthStr] = q.quota
        })
      }
    } catch (err) {
      console.warn('Không thể tải định biên năm trước từ Supabase:', err.message)
    }

    if (!prevQuotasMap) {
      const saved = localStorage.getItem(`sgc_dinh_bien_config_year_${prevYear}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          prevQuotasMap = {}
          Object.keys(parsed).forEach(pNameLower => {
            prevQuotasMap[pNameLower] = {}
            Object.keys(parsed[pNameLower]).forEach(oldMonthStr => {
              const currentMonthStr = oldMonthStr.replace(`${prevYear}-`, `${selectedYear}-`)
              prevQuotasMap[pNameLower][currentMonthStr] = parsed[pNameLower][oldMonthStr]
            })
          })
        } catch (e) {
          prevQuotasMap = null
        }
      }
    }

    if (prevQuotasMap && Object.keys(prevQuotasMap).length > 0) {
      const mergedQuotas = { ...localQuotas }
      Object.keys(prevQuotasMap).forEach(key => {
        mergedQuotas[key] = {
          ...(mergedQuotas[key] || {}),
          ...prevQuotasMap[key]
        }
      })
      setLocalQuotas(mergedQuotas)
      setSuccessToast(`Đã sao chép định biên từ năm ${prevYear} thành công (Vui lòng bấm Lưu)`)
    } else {
      alert(`Không tìm thấy dữ liệu định biên của năm trước (${prevYear}) để sao chép!`)
    }
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      
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

      {/* Header Panel */}
      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', flex: '1 1 auto', minWidth: '280px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)', padding: '10px', borderRadius: '12px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Định biên nhân sự hàng tháng
            </h4>
            <span style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              🎯 Cấu hình định biên tối ưu cho năm {selectedYear} (So sánh KPI theo Tháng {new Date().getMonth() + 1}/{selectedYear}). <span style={{ color: '#0f58a7', fontWeight: 700 }}>💡 Click đúp vào dòng để điền thông tin</span>
            </span>
          </div>
        </div>

        {/* Info Metrics + Database indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* 4 Compact KPIs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Metric 1: Projects */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0f58a7' }} />
              <div>
                <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 700, lineHeight: 1.1 }}>Dự án</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>{kpis.totalProjects}</span>
              </div>
            </div>

            {/* Metric 2: Total Quota */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1' }} />
              <div>
                <span style={{ fontSize: 10, color: '#6366f1', display: 'block', fontWeight: 700, lineHeight: 1.1 }}>Định biên</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#4338ca' }}>{kpis.totalTarget} <span style={{ fontSize: 9.5, fontWeight: 500 }}>NS</span></span>
              </div>
            </div>

            {/* Metric 3: Actual */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
              <div>
                <span style={{ fontSize: 10, color: '#10b981', display: 'block', fontWeight: 700, lineHeight: 1.1 }}>Thực tế</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#047857' }}>{kpis.totalActual} <span style={{ fontSize: 9.5, fontWeight: 500 }}>NS</span></span>
              </div>
            </div>

            {/* Metric 4: Difference */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', 
              background: kpis.diffRaw > 0 ? '#fff7ed' : (kpis.diffRaw < 0 ? '#fef2f2' : '#f0fdf4'), 
              borderRadius: '8px', 
              border: `1px solid ${kpis.diffRaw > 0 ? '#fdb374' : (kpis.diffRaw < 0 ? '#fca5a5' : '#86efac')}` 
            }}>
              <div style={{ 
                width: 8, height: 8, borderRadius: '50%', 
                backgroundColor: kpis.diffRaw > 0 ? '#ea580c' : (kpis.diffRaw < 0 ? '#ef4444' : '#10b981') 
              }} />
              <div>
                <span style={{ 
                  fontSize: 10, 
                  color: kpis.diffRaw > 0 ? '#ea580c' : (kpis.diffRaw < 0 ? '#ef4444' : '#10b981'), 
                  display: 'block', fontWeight: 700, lineHeight: 1.1 
                }}>Cân đối</span>
                <span style={{ 
                  fontSize: 12.5, fontWeight: 800, 
                  color: kpis.diffRaw > 0 ? '#c2410c' : (kpis.diffRaw < 0 ? '#b91c1c' : '#047857') 
                }}>
                  {kpis.diffRaw > 0 ? `Thiếu ${kpis.diffAbs}` : (kpis.diffRaw < 0 ? `Vượt ${kpis.diffAbs}` : 'Đủ')}
                </span>
              </div>
            </div>
          </div>

          {/* Database state indicators */}
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 14, display: 'flex', alignItems: 'center' }}>
            {useSupabase ? (
              <div 
                onClick={() => setShowSqlConfig(!showSqlConfig)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, transition: 'all 0.2s ease'
                }}
                title="Click để xem cấu hình SQL trên Supabase"
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                <Database size={14} />
                <span>Supabase: Đang đồng bộ</span>
              </div>
            ) : (
              <div 
                onClick={() => setShowSqlConfig(!showSqlConfig)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa',
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, transition: 'all 0.2s ease'
                }}
                title="Click để xem hướng dẫn đồng bộ lên Supabase"
              >
                <AlertCircle size={14} style={{ color: '#ea580c' }} />
                <span>Lưu cục bộ (Trình duyệt)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SQL Setup Helper Panel */}
      {showSqlConfig && (
        <div style={{
          background: '#0f172a', color: '#e2e8f0', padding: 20, borderRadius: 16,
          textAlign: 'left', border: '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} style={{ color: '#38bdf8' }} />
              <span style={{ fontWeight: 800, fontSize: 13.5, color: '#f8fafc', letterSpacing: '0.01em' }}>
                THIẾT LẬP BẢNG ĐỊNH BIÊN TRÊN SUPABASE CLOUD
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => loadQuotas(selectedMonth)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff', padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RefreshCw size={12} />
                <span>Thử kết nối lại</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(SQL_CODE_DINH_BIEN);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                style={{
                  background: copiedSql ? '#10b981' : '#38bdf8',
                  border: 'none', color: '#0f172a', padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <Copy size={12} />
                <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
              </button>
            </div>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: 12.5, color: '#94a3b8', lineHeight: 1.4 }}>
            Để bật tính năng đồng bộ định biên lên cơ sở dữ liệu Supabase của bạn, vui lòng truy cập 
            <strong style={{ color: '#38bdf8' }}> SQL Editor</strong> trong Supabase dashboard, dán đoạn mã SQL bên dưới rồi nhấn <strong style={{ color: '#38bdf8' }}>Run</strong>. 
            Hệ thống sẽ tự động khởi tạo bảng lưu trữ và cấu hình RLS.
          </p>

          <pre style={{
            margin: 0, padding: 14, background: '#020617', borderRadius: 8,
            overflowX: 'auto', fontSize: 11.5, fontFamily: 'monospace', color: '#38bdf8',
            maxHeight: 180, border: '1px solid #1e293b'
          }}>
            <code>{SQL_CODE_DINH_BIEN}</code>
          </pre>
        </div>
      )}

      {/* Main Workspace with Table and Controls */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #e2e8f0', padding: 0 }}>
        
        {/* Controls Bar */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1.5px solid #e2e8f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Year selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={15} style={{ color: '#0f58a7' }} />
                <span>Chọn năm:</span>
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>

            {/* Copy button from previous year */}
            <button
              onClick={handleCopyFromPreviousYear}
              title="Nhấn để tự động sao chép định biên của năm trước sang năm nay"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#475569',
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#0f58a7'
                e.currentTarget.style.color = '#0f58a7'
                e.currentTarget.style.backgroundColor = '#f0f9ff'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.color = '#475569'
                e.currentTarget.style.backgroundColor = '#ffffff'
              }}
            >
              <Copy size={14} />
              <span>Sao chép năm trước</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search project */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Tìm tên dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: 12.5,
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  outline: 'none',
                  height: '34px'
                }}
              />
            </div>

            {/* Reset button */}
            {hasUnsavedChanges && (
              <button
                onClick={handleReset}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease'
                }}
              >
                Hủy bỏ
              </button>
            )}

            {/* Save quotas button */}
            <button
              disabled={!hasUnsavedChanges || saving}
              onClick={handleSaveQuotas}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: 13,
                fontWeight: 800,
                cursor: (!hasUnsavedChanges || saving) ? 'not-allowed' : 'pointer',
                backgroundColor: !hasUnsavedChanges ? '#cbd5e1' : '#10b981',
                color: !hasUnsavedChanges ? '#64748b' : '#ffffff',
                border: 'none',
                height: '34px',
                transition: 'all 0.15s ease',
                boxShadow: !hasUnsavedChanges ? 'none' : '0 4px 10px rgba(16,185,129,0.2)'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{hasUnsavedChanges ? 'Lưu định biên' : 'Đã lưu đồng bộ'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body / Scrollable table */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fcfcfc' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #eff6ff', borderTopColor: '#0f58a7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 600 }}>Đang tải danh sách định biên...</span>
            </div>
          ) : filteredProjectDinhBienData.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: '#94a3b8', gap: 10 }}>
              <AlertCircle size={32} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Không có dự án nào khớp với bộ lọc</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '22%' }}>Dự án / Công trình</th>
                  <th style={{ padding: '12px 6px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '6%', textAlign: 'center' }}>T.Tế</th>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <th key={m} style={{ padding: '12px 4px', fontSize: 11, fontWeight: 700, color: '#0f58a7', textTransform: 'uppercase', width: '6%', textAlign: 'center' }}>
                      Th.{m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Chúng ta nhóm các hàng theo Khối Thi Công để người dùng dễ theo dõi */}
                {blocks.map(block => {
                  const blockProjects = filteredProjectDinhBienData.filter(p => p.blockId === block.id)
                  if (blockProjects.length === 0) return null

                  return (
                    <React.Fragment key={block.id}>
                      {/* Tiêu đề nhóm Khối */}
                      <tr style={{ backgroundColor: block.badgeBg || block.badge_bg || block.bgColor || block.bg_color || '#f1f5f9', borderBottom: '1.5px solid ' + (block.borderColor || block.border_color || '#cbd5e1') }}>
                        <td colSpan="14" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, color: block.color || '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: block.color || '#475569', marginRight: 8 }} />
                          {block.name}
                        </td>
                      </tr>

                      {/* Các dự án thuộc khối */}
                      {blockProjects.map(p => {
                        const projectQuotas = localQuotas[p.name.toLowerCase()] || {}
                        const origProjectQuotas = originalLocalQuotas[p.name.toLowerCase()] || {}
                        
                        let isRowChanged = false
                        for (let m = 1; m <= 12; m++) {
                          const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`
                          if ((projectQuotas[mStr] ?? 0) !== (origProjectQuotas[mStr] ?? 0)) {
                            isRowChanged = true
                            break
                          }
                        }

                        return (
                          <tr 
                            key={p.id} 
                            onDoubleClick={() => setEditingProject({
                              ...p,
                              blockName: block.name,
                              blockColor: block.color || '#475569',
                              blockBg: block.badgeBg || block.badge_bg || block.bgColor || block.bg_color || '#e2e8f0'
                            })}
                            title="Nhấn đúp (Double click) vào dòng này để điền thông tin định biên"
                            style={{ 
                              borderBottom: '1px solid #e2e8f0', 
                              backgroundColor: isRowChanged ? '#fefbeb' : '#ffffff',
                              transition: 'all 0.15s ease',
                              cursor: 'pointer'
                            }}
                            className="table-row-hover"
                          >
                            {/* Cột 1: Tên dự án */}
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: p.badgeBg || '#e2e8f0',
                                  color: p.color || '#475569',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {p.badge}
                                </span>
                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }} title={p.name}>
                                  {p.name}
                                </span>
                                {isRowChanged && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 3px', borderRadius: '3px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                                    *
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cột 2: Thực tế */}
                            <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                              {p.actual > 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedProjectStaff(p.name)
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontWeight: 700,
                                    color: '#0f58a7',
                                    fontSize: 12,
                                    background: '#f0f7ff',
                                    border: '1px solid #bfdbfe',
                                    cursor: 'pointer',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    transition: 'all 0.15s ease',
                                    outline: 'none'
                                  }}
                                  className="actual-pill-btn"
                                  title="Bấm để xem danh sách chi tiết nhân sự thực tế"
                                >
                                  <span>{p.actual}</span>
                                  <Users size={11} style={{ color: '#3b82f6' }} />
                                </button>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#94a3b8', fontSize: 12, padding: '2px 8px' }}>
                                  <span>0</span>
                                  <Users size={11} style={{ color: '#cbd5e1' }} />
                                </div>
                              )}
                            </td>

                            {/* 12 cột Định biên cho 12 tháng */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                              const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`
                              const val = projectQuotas[monthStr] ?? 0
                              const origVal = origProjectQuotas[monthStr] ?? 0
                              const isMonthChanged = val !== origVal
                              
                              return (
                                <td key={m} style={{ padding: '6px 4px', textAlign: 'center' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    backgroundColor: isMonthChanged ? '#fef3c7' : (val > 0 ? '#eff6ff' : '#f8fafc'),
                                    color: isMonthChanged ? '#b45309' : (val > 0 ? '#1d4ed8' : '#94a3b8'),
                                    border: isMonthChanged ? '1px solid #d97706' : (val > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0'),
                                    userSelect: 'none'
                                  }}>
                                    {val === 0 ? '-' : val}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Info Row */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1.5px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 500,
          textAlign: 'left'
        }}>
          <Info size={14} style={{ color: '#0f58a7' }} />
          <span>
            <strong>Định biên nhân sự:</strong> Giúp nhà quản trị kiểm soát nhân sự tối ưu, tránh dư thừa hoặc thiếu hụt năng lực vận hành tại hiện trường. Thay đổi chỉ có hiệu lực trên tháng đã chọn.
          </span>
        </div>
      </div>

      {/* Modal chi tiết nhân sự thực tế */}
      {selectedProjectStaff && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setSelectedProjectStaff(null)}>
          <div className="card" style={{ 
            width: 650, maxWidth: '100%', maxHeight: '80vh', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0c4685 0%, #0f58a7 100%)', 
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>CHI TIẾT NHÂN SỰ THỰC TẾ</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: '#bfdbfe', fontWeight: 500 }}>
                    Dự án: <span style={{ color: '#fff', fontWeight: 700 }}>{selectedProjectStaff}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProjectStaff(null)} 
                style={{ 
                  background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', 
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                className="close-btn-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Table */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ 
                backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', 
                overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' 
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontWeight: 700, textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', width: 50, textAlign: 'center' }}>STT</th>
                      <th style={{ padding: '10px 14px', width: 90 }}>Mã NV</th>
                      <th style={{ padding: '10px 14px' }}>Họ và Tên</th>
                      <th style={{ padding: '10px 14px' }}>Chức vụ</th>
                      <th style={{ padding: '10px 14px', width: 110 }}>Điện thoại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffDetailsList.length > 0 ? (
                      staffDetailsList.map((tk, index) => (
                        <tr key={tk.maNV || index} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }} className="table-row-hover">
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{index + 1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f58a7' }}>{tk.maNV}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{tk.hoTen}</td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 500 }}>
                            <span style={{ 
                              fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              backgroundColor: (tk.chucVu || '').toLowerCase().includes('trưởng') ? '#fee2e2' : '#f1f5f9',
                              color: (tk.chucVu || '').toLowerCase().includes('trưởng') ? '#b91c1c' : '#475569'
                            }}>
                              {tk.chucVu || 'Thủ kho'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'Roboto, sans-serif' }}>{tk.soDienThoai || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                          Chưa có thủ kho nào phân bổ cho dự án này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1.5px solid #e2e8f0', backgroundColor: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Info size={13} style={{ color: '#3b82f6' }} />
                Nguồn: danh_sach_thu_kho (Live)
              </span>
              <button
                onClick={() => setSelectedProjectStaff(null)}
                style={{
                  padding: '6px 16px', backgroundColor: '#64748b', color: '#ffffff',
                  fontSize: 13, fontWeight: 700, border: 'none', borderRadius: '6px',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                className="close-btn-footer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa định biên 12 tháng (Double click) */}
      {editingProject && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setEditingProject(null)}>
          <div className="card" style={{ 
            width: '100%', maxWidth: '1500px', maxHeight: '95vh', 
            display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0c4685 0%, #0f58a7 100%)', 
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.03em' }}>ĐIỀU CHỈNH ĐỊNH BIÊN NHÂN SỰ MỐC 12 THÁNG</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#bfdbfe', fontWeight: 500 }}>
                    Năm {selectedYear}
                  </p>
                </div>
              </div>

              {/* Thông tin dự án và khối bên phải */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: '16px', marginLeft: 'auto' }}>
                {/* Block Info Tag */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  backgroundColor: 'rgba(255,255,255,0.15)', 
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '5px 12px', 
                  borderRadius: '16px' 
                }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: editingProject.blockColor || '#ffffff' 
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {editingProject.blockName || 'Chưa phân bổ'}
                  </span>
                </div>

                {/* Project Badge & Name */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  backgroundColor: '#ffffff', 
                  padding: '5px 12px', 
                  borderRadius: '8px', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                }}>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '1.5px 6px',
                    borderRadius: '4px',
                    background: editingProject.badgeBg || '#e2e8f0',
                    color: editingProject.color || '#475569',
                    whiteSpace: 'nowrap'
                  }}>
                    {editingProject.badge}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b' }}>
                    {editingProject.name}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setEditingProject(null)} 
                style={{ 
                  background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', 
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                className="close-btn-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content with 12 Month Fields in Horizontal Table View */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ 
                backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', 
                padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'start', gap: 10 
              }}>
                <Info size={16} style={{ color: '#1d4ed8', marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.4, textAlign: 'left' }}>
                  Nhập số lượng thủ kho định biên cho từng tháng trong năm <strong>{selectedYear}</strong> dạng bảng trải dài. Nhấp <strong>Xác nhận</strong> để cập nhật, sau đó bấm <strong>Lưu cục bộ (Trình duyệt)</strong> ngoài màn hình chính để đồng bộ lên hệ thống.
                </span>
              </div>

              {/* Horizontal table representation */}
              <div style={{ 
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px',
                overflowX: 'auto',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <th key={m} style={{ padding: '12px 6px', fontSize: 12.5, fontWeight: 700, color: '#0f58a7', textAlign: 'center', width: '8.33%' }}>
                          Tháng {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                        const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`
                        const currentVal = tempQuotas[monthStr] ?? 0
                        
                        return (
                          <td key={m} style={{ padding: '20px 6px', textAlign: 'center', borderRight: m < 12 ? '1px dashed #e2e8f0' : 'none' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                className="no-spinner"
                                value={currentVal === 0 ? '' : currentVal}
                                onChange={(e) => handleTempQuotaChange(monthStr, e.target.value)}
                                style={{
                                  width: '65px',
                                  height: '32px',
                                  border: '1.5px solid #cbd5e1',
                                  borderRadius: '6px',
                                  textAlign: 'center',
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: '#0f58a7',
                                  outline: 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                onFocus={(e) => {
                                  e.target.style.borderColor = '#0f58a7'
                                  e.target.style.boxShadow = '0 0 0 3px rgba(15, 88, 167, 0.15)'
                                }}
                                onBlur={(e) => {
                                  e.target.style.borderColor = '#cbd5e1'
                                  e.target.style.boxShadow = 'none'
                                }}
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1.5px solid #e2e8f0', backgroundColor: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12
            }}>
              <button
                onClick={() => setEditingProject(null)}
                style={{
                  padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569',
                  fontSize: 13, fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '6px',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveTempQuotas}
                style={{
                  padding: '8px 20px', backgroundColor: '#0f58a7', color: '#ffffff',
                  fontSize: 13, fontWeight: 700, border: 'none', borderRadius: '6px',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 6
                }}
              >
                <Check size={14} />
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Hide spin-buttons / spinners for number inputs */
        .no-spinner::-webkit-outer-spin-button,
        .no-spinner::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        .no-spinner {
          -moz-appearance: textfield !important;
        }
        .table-row-hover:hover {
          background-color: #f8fafc !important;
        }
        .actual-pill-btn:hover {
          background-color: #dbeafe !important;
          border-color: #93c5fd !important;
          transform: translateY(-1px);
        }
        .close-btn-hover:hover {
          background-color: rgba(255,255,255,0.3) !important;
        }
        .close-btn-footer:hover {
          background-color: #475569 !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}
