import React, { useMemo, useState, useEffect } from 'react'
import { Users, UserCheck, ShieldAlert, Award, TrendingUp, BarChart2, PieChart as PieIcon, HelpCircle } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, Cell, PieChart, Pie, LabelList
} from 'recharts'
import StatCard from './StatCard.jsx'
import { formatVND } from '../constants.js'
import { supabase } from '../supabaseClient'

const FALLBACK_BLOCKS = [
  { name: 'KHỐI THI CÔNG CHƯA PHÂN BỔ', color: '#64748b' },
  { name: 'CỌC KHOAN NHỒI', color: '#ef4444' },
  { name: 'TUYẾN HN - QN', color: '#f97316' },
  { name: 'TUYẾN BT - CG', color: '#a855f7' },
  { name: 'SAN LẤP - HẠ TẦNG', color: '#10b981' }
]

const DEFAULT_BLOCKS = [
  {
    id: 'unassigned',
    name: 'KHỐI THI CÔNG CHƯA PHÂN BỔ',
    badge: 'NO',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    badgeBg: '#e2e8f0',
    projects: []
  },
  {
    id: 'block2',
    name: 'CỌC KHOAN NHỒI',
    badge: 'CKN',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    badgeBg: '#fee2e2',
    projects: [
      { id: 'p_ckn_1', name: 'Test1', badge: 'CKN' },
      { id: 'p_ckn_2', name: 'Test2', badge: 'CKN' }
    ]
  },
  {
    id: 'block3',
    name: 'TUYẾN HN - QN',
    badge: 'ĐS. HN-QN',
    color: '#f97316',
    bgColor: '#fff7ed',
    borderColor: '#fdb374',
    badgeBg: '#ffedd5',
    projects: [
      { id: 'p_hnqn_1', name: 'test1', badge: 'ĐS. HN-QN' },
      { id: 'p_hnqn_2', name: 'test2', badge: 'ĐS. HN-QN' }
    ]
  },
  {
    id: 'block4',
    name: 'TUYẾN BT - CG',
    badge: 'ĐS. BT - CG',
    color: '#a855f7',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
    badgeBg: '#f3e8ff',
    projects: []
  },
  {
    id: 'block5',
    name: 'SAN LẤP - HẠ TẦNG',
    badge: 'SLHT',
    color: '#10b981',
    bgColor: '#f0fdf4',
    borderColor: '#4ade80',
    badgeBg: '#dcfce7',
    projects: []
  }
]

const CustomXAxisTick = ({ x, y, payload }) => {
  const rawValue = payload?.value || '';
  const words = rawValue.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length > 13) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="middle"
        fill="#1e293b"
        style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
      >
        {lines.map((line, i) => (
          <tspan x={0} dy={i === 0 ? 6 : 10} key={i}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

const CustomLegend = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', fontSize: '13px', fontWeight: 700, paddingBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '11px',
          height: '11px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ef4444 0%, #10b981 40%, #2563eb 70%, #a855f7 100%)',
          display: 'inline-block',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }} />
        <span style={{ color: '#334155' }}>Thực tế</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '11px',
          height: '11px',
          borderRadius: '50%',
          backgroundColor: '#94a3b8',
          display: 'inline-block',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }} />
        <span style={{ color: '#334155' }}>Định biên</span>
      </div>
    </div>
  );
};

export default function DashboardTab({ data = [], onNavigateToTab }) {
  const [blocks, setBlocks] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('2026-07')
  const [localQuotas, setLocalQuotas] = useState({})

  // ─── DANH SÁCH TẤT CẢ DỰ ÁN PHẲNG (Flat) ───
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

  useEffect(() => {
    const year = selectedMonth.split('-')[0] || '2026'
    const fetchQuotas = async () => {
      try {
        const startMonth = `${year}-01`
        const endMonth = `${year}-12`
        const { data: dbQuotas, error } = await supabase
          .from('sgc_dinh_bien_nhan_su')
          .select('*')
          .gte('month', startMonth)
          .lte('month', endMonth)

        if (error) throw error

        if (dbQuotas) {
          const qMap = {}
          dbQuotas.forEach(q => {
            const pNameLower = q.project_name.toLowerCase()
            if (!qMap[pNameLower]) {
              qMap[pNameLower] = {}
            }
            qMap[pNameLower][q.month] = q.quota
          })
          setLocalQuotas(qMap)
        }
      } catch (err) {
        console.warn('Dashboard backup load quotas from LocalStorage:', err)
        const saved = localStorage.getItem(`sgc_dinh_bien_config_year_${year}`)
        if (saved) {
          try {
            setLocalQuotas(JSON.parse(saved))
          } catch (e) {
            setLocalQuotas({})
          }
        } else {
          setLocalQuotas({})
        }
      }
    }
    fetchQuotas()
  }, [selectedMonth])

  useEffect(() => {
    const loadBlocks = async () => {
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
          throw new Error('No data in Supabase blocks table')
        }
      } catch (err) {
        console.warn('Dashboard fallback to LocalStorage:', err)
        const saved = localStorage.getItem('sgc_thong_tin_du_an_config')
        if (saved) {
          try {
            setBlocks(JSON.parse(saved))
          } catch (e) {
            setBlocks(DEFAULT_BLOCKS)
          }
        } else {
          setBlocks(DEFAULT_BLOCKS)
        }
      }
    }
    loadBlocks()
  }, [])

  const findBlockMatch = (duAnName, banChuoiKhoiName) => {
    if (!blocks || blocks.length === 0) return null

    const cleanDuAn = (duAnName || '').trim().toLowerCase()
    const cleanKhoi = (banChuoiKhoiName || '').trim().toLowerCase()

    if (!cleanDuAn && !cleanKhoi) return null

    // 1. Try to find a block by matching project name
    if (cleanDuAn) {
      for (const block of blocks) {
        const matchProj = (block.projects || []).some(p => (p.name || '').trim().toLowerCase() === cleanDuAn)
        if (matchProj) {
          return block
        }
      }
    }

    // 2. Fallback: Try to find a block by matching block name
    if (cleanKhoi) {
      for (const block of blocks) {
        if ((block.name || '').trim().toLowerCase() === cleanKhoi) {
          return block
        }
      }
    }

    return null
  }

  // ─── 1. KPIs ───
  const stats = useMemo(() => {
    const total = data.length
    
    // Nếu trạng thái trống, "None", hoặc "Đang làm việc", đều coi là đang làm việc thực tế
    const working = data.filter(x => {
      const status = (x.trangThai || '').trim().toLowerCase()
      return status === 'đang làm việc' || status === 'none' || status === ''
    }).length

    const leave = data.filter(x => {
      const status = (x.trangThai || '').trim().toLowerCase()
      return status === 'nghỉ phép'
    }).length

    const quit = data.filter(x => {
      const status = (x.trangThai || '').trim().toLowerCase()
      return status === 'đã nghỉ việc'
    }).length

    // Thủ kho có đầy đủ chứng chỉ chuyên môn & chứng chỉ ATLD
    const certBoth = data.filter(x => {
      const ccKho = (x.chungChiNghiepVuKho || '').toString().trim().toLowerCase()
      const ccAtld = (x.chungChiATLD || '').toString().trim().toLowerCase()
      return ccKho === 'có' && ccAtld === 'có'
    }).length
    const certBothPercent = total ? Math.round((certBoth / total) * 100) : 0

    // Hiệu suất loại Xuất sắc & Tốt
    const highPerform = data.filter(x => {
      const rating = (x.danhGiaHieuSuat || '').toString().trim().toLowerCase()
      return rating === 'xuất sắc' || rating === 'tốt'
    }).length
    const highPerformPercent = total ? Math.round((highPerform / total) * 100) : 0

    // Tổng quỹ lương cơ bản của toàn bộ lực lượng thủ kho
    const totalSalary = data.reduce((sum, x) => sum + (Number(x.luongCoBan) || 0), 0)

    return { total, working, leave, quit, certBothPercent, highPerformPercent, totalSalary }
  }, [data])

  // ─── 2. Biểu đồ 1: Phân bổ nhân sự theo Khối thi công & Dự án ───
  const projectBlockData = useMemo(() => {
    const list = []
    const allProjNames = new Set()
    
    allProjectsFlat.forEach(p => {
      allProjNames.add(p.name.trim().toLowerCase())
    })
    
    data.forEach(item => {
      const proj = (item.duAn || '').trim()
      if (proj && proj !== '—' && proj !== 'None') {
        allProjNames.add(proj.toLowerCase())
      }
    })
    
    allProjNames.forEach(projNameLower => {
      // 1. Tính số lượng thực tế (chỉ đếm người đang làm việc)
      const actualCount = data.filter(item => {
        const isRetired = item.trangThai === 'Đã nghỉ việc' || item.trangThai === 'Nghỉ việc'
        if (isRetired) return false
        const p = (item.duAn || '').trim().toLowerCase()
        return p === projNameLower
      }).length
      
      // 2. Lấy định biên cho tháng được chọn
      const quotaVal = localQuotas[projNameLower]?.[selectedMonth] ?? 0
      
      // Chỉ hiển thị dự án nếu có nhân sự thực tế > 0 hoặc định biên > 0
      if (actualCount === 0 && quotaVal === 0) {
        return
      }
      
      let displayName = ''
      let blockName = 'Chưa phân bổ'
      
      const configProj = allProjectsFlat.find(p => p.name.toLowerCase() === projNameLower)
      if (configProj) {
        displayName = configProj.name
        blockName = configProj.blockName
      } else {
        const matchedItem = data.find(item => (item.duAn || '').trim().toLowerCase() === projNameLower)
        displayName = matchedItem ? matchedItem.duAn.trim() : projNameLower
        
        const matchedBlock = findBlockMatch(displayName, matchedItem?.banChuoiKhoi)
        if (matchedBlock && matchedBlock.id !== 'unassigned' && matchedBlock.name !== 'KHỐI THI CÔNG CHƯA PHÂN BỔ') {
          blockName = matchedBlock.name
        }
      }
      
      list.push({
        block: blockName,
        project: displayName,
        actual: actualCount,
        quota: quotaVal
      })
    })

    // Sắp xếp theo khối, sau đó theo thực tế giảm dần
    list.sort((a, b) => {
      if (a.block === b.block) {
        return b.actual - a.actual
      }
      if (a.block === 'Chưa phân bổ') return 1
      if (b.block === 'Chưa phân bổ') return -1
      return a.block.localeCompare(b.block)
    })

    return list
  }, [data, allProjectsFlat, localQuotas, selectedMonth])

  const getBlockColor = (blockName) => {
    const clean = (blockName || '').trim().toUpperCase()

    // 1. Try finding in loaded blocks from state
    const found = blocks.find(b => {
      const bName = (b.name || '').trim().toUpperCase()
      if (bName === 'KHỐI THI CÔNG CHƯA PHÂN BỔ' && clean === 'CHƯA PHÂN BỔ') return true
      return bName === clean
    })
    if (found && found.color) {
      return found.color
    }

    // 2. Try finding in fallback blocks
    const fallbackFound = FALLBACK_BLOCKS.find(b => {
      const bName = b.name.toUpperCase()
      if (bName === 'KHỐI THI CÔNG CHƯA PHÂN BỔ' && clean === 'CHƯA PHÂN BỔ') return true
      return bName === clean
    })
    if (fallbackFound && fallbackFound.color) {
      return fallbackFound.color
    }

    // 3. Fallback logic
    if (clean.includes('CỌC KHOAN NHỒI')) return '#ef4444'
    if (clean.includes('SAN LẤP') || clean.includes('SLHT')) return '#10b981'
    if (clean.includes('M&E')) return '#2563eb'
    if (clean.includes('CHƯA PHÂN BỔ')) return '#64748b'
    if (clean.includes('TUYẾN HN')) return '#f97316'
    if (clean.includes('TUYẾN BT')) return '#a855f7'
    if (clean.includes('VẬT TƯ')) return '#7c3aed'
    if (clean.includes('ĐƯỜNG SẮT')) return '#db2777'
    
    const colors = ['#0f58a7', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16']
    let hash = 0
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const legendBlocks = useMemo(() => {
    // 1. Get unique blocks in order of appearance in projectBlockData
    const orderedBlockNames = []
    projectBlockData.forEach(item => {
      if (item.block && !orderedBlockNames.includes(item.block)) {
        orderedBlockNames.push(item.block)
      }
    })

    const list = []
    const addedNames = new Set()

    // 2. Add blocks based on their active appearance order
    orderedBlockNames.forEach(blockName => {
      const matched = blocks.find(b => (b.name || '').trim().toUpperCase() === blockName.trim().toUpperCase())
      const color = matched?.color || getBlockColor(blockName)
      
      list.push({
        name: blockName,
        color: color
      })
      addedNames.add(blockName.trim().toUpperCase())
    })

    // 3. Append remaining configured blocks that have no active project/personnel in the current month
    blocks.forEach(b => {
      if (b.id !== 'unassigned' && b.name !== 'KHỐI THI CÔNG CHƯA PHÂN BỔ') {
        const cleanName = (b.name || '').trim().toUpperCase()
        if (!addedNames.has(cleanName)) {
          list.push({
            name: b.name,
            color: b.color || '#64748b'
          })
          addedNames.add(cleanName)
        }
      }
    })

    return list
  }, [blocks, projectBlockData])

  // ─── 3. Biểu đồ 2: Cơ cấu chức danh (Chuẩn hóa nhóm chức danh chính) ───
  const roleChartData = useMemo(() => {
    const counts = {}
    data.forEach(item => {
      let role = (item.chucVu || '').trim()
      if (!role || role === 'None' || role === '—') {
        role = 'Chưa cập nhật'
      } else {
        // Chuẩn hóa một số chức danh thông dụng để gộp nhóm đẹp mắt
        if (role === 'Thủ kho' || role === 'Nhân viên kho') {
          role = 'Thủ kho hiện trường'
        } else if (role === 'Thủ kho trưởng') {
          role = 'Thủ kho trưởng hiện trường'
        } else if (role === 'Trưởng nhóm kho dự án' || role === 'Trưởng nhóm Kho') {
          role = 'Trưởng nhóm kho'
        }
      }
      counts[role] = (counts[role] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  // COLORS
  const COLORS_ROLE = [
    '#0f58a7', // Deep blue
    '#10b981', // Emerald green
    '#f59e0b', // Amber
    '#3b82f6', // Bright blue
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#64748b'  // Slate gray
  ]

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      
      {/* 3 KPI cards row (including Moved Doughnut Chart) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <StatCard
          icon={<Users />}
          label="Tổng Số Nhân Sự Thủ Kho"
          value={stats.total}
          sub="Được phân bổ tại các dự án"
          color="#0f58a7"
          trend={{ direction: 'up', text: 'Ổn định 100%' }}
        />
        <StatCard
          icon={<UserCheck />}
          label="Đang Làm Việc Thực Tế"
          value={stats.working}
          sub={`${stats.leave} nghỉ phép · ${stats.quit} đã nghỉ`}
          color="#10b981"
          trend={{ direction: 'up', text: `${Math.round((stats.working/stats.total)*100) || 0}% diện hoạt động` }}
        />
        {/* Card 3: Moved Doughnut Chart for 'Cơ cấu chức danh' */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(15, 88, 167, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <PieIcon size={16} style={{ color: '#0f58a7' }} />
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Cơ cấu Chức Danh
            </h4>
          </div>
          
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
            {/* Doughnut Chart Left */}
            <div style={{ width: 110, height: 110, position: 'relative', flexShrink: 0 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={roleChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {roleChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_ROLE[index % COLORS_ROLE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} nhân sự`, 'Số lượng']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: 9, color: '#64748b', display: 'block', lineHeight: 1 }}>Tổng số</span>
                <strong style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{stats.total}</strong>
              </div>
            </div>

            {/* Legend Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              {roleChartData.map((entry, index) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS_ROLE[index % COLORS_ROLE.length], flexShrink: 0 }} />
                    <span style={{ color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>
                      {entry.name}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b', flexShrink: 0, marginLeft: 6 }}>
                    {entry.value} ({Math.round((entry.value/stats.total)*100) || 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Grouped Bar chart by construction block & project (Expanded to Full Width) */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Phân bổ nhân sự theo từng khối thi công & dự án
            </h4>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Bộ chọn tháng định biên */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>Xem định biên tháng:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  padding: '5px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0f58a7',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0f58a7'
                  e.target.style.boxShadow = '0 0 0 2px rgba(15, 88, 167, 0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1'
                  e.target.style.boxShadow = 'none'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                  const mStr = `2026-${String(m).padStart(2, '0')}`
                  return (
                    <option key={mStr} value={mStr}>
                      Tháng {m}/2026
                    </option>
                  )
                })}
              </select>
            </div>

            <span style={{ fontSize: '11px', color: '#0f58a7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid #bae6fd' }}>
              💡 Kích đúp để xem chi tiết
            </span>
          </div>
        </div>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <BarChart data={projectBlockData} margin={{ top: 25, right: 10, left: -20, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="project" 
                tickFormatter={(val) => (val || '').trim()}
                tick={<CustomXAxisTick />} 
                axisLine={false} 
                tickLine={false}
                height={65}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
                formatter={(value, name, props) => {
                  const label = name === 'actual' || name === 'Thực tế' ? 'Thực tế' : 'Định biên'
                  return [value, `${label} (${props.payload.block})`]
                }}
              />
              <Legend 
                content={<CustomLegend />}
                verticalAlign="top" 
                height={36} 
              />
              <Bar 
                name="Thực tế"
                dataKey="actual" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={20}
                onDoubleClick={(state) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const entry = state.activePayload[0].payload;
                    onNavigateToTab('danhsach', entry.project);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {projectBlockData.map((entry, index) => (
                  <Cell 
                    key={`cell-actual-${index}`} 
                    fill={getBlockColor(entry.block)}
                    onDoubleClick={() => onNavigateToTab('danhsach', entry.project)}
                    style={{ cursor: 'pointer' }}
                    title="Kích đúp để xem chi tiết danh sách"
                  />
                ))}
                <LabelList dataKey="actual" position="top" style={{ fill: '#334155', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
              <Bar 
                name="Định biên"
                dataKey="quota" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={20}
                style={{ cursor: 'pointer' }}
              >
                {projectBlockData.map((entry, index) => (
                  <Cell 
                    key={`cell-quota-${index}`} 
                    fill="#94a3b8"
                    style={{ cursor: 'pointer' }}
                  />
                ))}
                <LabelList dataKey="quota" position="top" style={{ fill: '#0f58a7', fontSize: 10, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Custom color legend according to construction blocks */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          {legendBlocks.map(b => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: b.color, display: 'inline-block' }} />
              <span style={{ color: '#334155', fontWeight: 600 }}>{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Financial & Resource quick action banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #e8f0fe 0%, #dbeafe 100%)',
        border: '1px solid #bfdbfe',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={{
            background: '#ffffff', color: 'var(--primary)', padding: 10, borderRadius: 10,
            boxShadow: '0 2px 8px rgba(15, 88, 167, 0.1)', flexShrink: 0
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <h5 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a', margin: '0 0 4px 0' }}>Báo cáo Tài chính Nhân sự lực lượng Thủ kho</h5>
            <p style={{ fontSize: 13, color: '#3b82f6', margin: 0, fontWeight: 500 }}>
              Tổng quỹ lương hàng tháng ước tính: <strong style={{ color: '#1e293b', fontSize: 15 }}>{formatVND(stats.totalSalary)}</strong> · Trung bình <strong style={{ color: '#1e293b' }}>{(stats.totalSalary / (data.filter(x => (Number(x.luongCoBan) || 0) > 0).length || 1)).toFixed(1)} triệu / tháng</strong> cho mỗi nhân sự.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateToTab('danhsach')}
          className="btn btn-primary btn-sm"
          style={{ background: 'var(--primary)', color: '#ffffff', borderRadius: 8, fontWeight: 700 }}
        >
          Xem danh sách chi tiết
        </button>
      </div>

    </div>
  )
}
