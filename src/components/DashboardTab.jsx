import React, { useMemo, useState, useEffect } from 'react'
import {
  Users, UserCheck, Building2, Warehouse, TrendingUp, BarChart2,
  AlertTriangle, PackageSearch
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import StatCard from './StatCard.jsx'
import { formatVND } from '../constants.js'
import { supabase } from '../supabaseClient'

const BLOCK_COLORS = ['#0f58a7', '#f97316', '#a855f7', '#10b981', '#ec4899', '#14b8a6', '#eab308']
const UNASSIGNED_COLOR = '#94a3b8'

const CustomXAxisTick = ({ x, y, payload }) => {
  const rawValue = payload?.value || ''
  const words = rawValue.trim().split(/\s+/)
  const lines = []
  let currentLine = ''

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length > 13) {
      if (currentLine) lines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine = (currentLine + ' ' + word).trim()
    }
  })
  if (currentLine) lines.push(currentLine.trim())

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
  )
}

export default function DashboardTab({ data = [], onNavigateToTab }) {
  const [blocks, setBlocks] = useState([])

  // Tải cấu hình Khối thi công & Ngăn kho — CÙNG một nguồn dữ liệu với sheet "Danh sách theo dự án"
  // (bảng sgc_thong_tin_du_an_blocks / sgc_thong_tin_du_an_projects) để 2 sheet luôn khớp số liệu.
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
              .map(p => ({ id: p.id, name: p.name, badge: p.badge }))
            return {
              id: b.id,
              name: b.name,
              badge: b.badge,
              color: b.color,
              projects: blockProjs
            }
          })
          setBlocks(formattedBlocks)
        }
      } catch (err) {
        console.warn('Dashboard: không tải được cấu hình Khối/Ngăn kho, dùng dữ liệu thô từ Dự án:', err)
        setBlocks([])
      }
    }
    loadBlocks()
  }, [])

  // Danh sách Ngăn kho (dự án) phẳng, kèm Khối thi công đang chứa nó — đúng cấu trúc của sheet "Danh sách theo dự án"
  const allProjectsFlat = useMemo(() => {
    const list = []
    blocks.forEach(b => {
      (b.projects || []).forEach(p => {
        if (p.name && !list.some(x => x.name.toLowerCase() === p.name.toLowerCase())) {
          list.push({ name: p.name, blockName: b.name, blockColor: b.color })
        }
      })
    })
    return list
  }, [blocks])

  const getBlockColor = (blockName, index) => {
    const found = blocks.find(b => (b.name || '').trim().toLowerCase() === (blockName || '').trim().toLowerCase())
    if (found && found.color) return found.color
    if (blockName === 'Chưa phân bổ') return UNASSIGNED_COLOR
    return BLOCK_COLORS[index % BLOCK_COLORS.length]
  }

  // Chỉ tính các thủ kho đang thực sự hoạt động (loại trừ đã nghỉ việc)
  const activeData = useMemo(() => data.filter(x => {
    const st = (x.trangThai || '').trim().toLowerCase()
    return st !== 'đã nghỉ việc' && st !== 'nghỉ việc'
  }), [data])

  // ─── Tổng hợp tương quan Khối thi công ↔ Ngăn kho (Dự án), lấy đúng theo dữ liệu "Dự án" của từng thủ kho ───
  const warehouseStats = useMemo(() => {
    const projectMap = {}

    activeData.forEach(item => {
      const rawProj = (item.duAn || '').trim()
      const isKnown = rawProj && rawProj !== '—' && rawProj !== 'None'
      const projectName = isKnown ? rawProj : 'Chưa phân bổ'

      const configMatch = allProjectsFlat.find(p => p.name.toLowerCase() === projectName.toLowerCase())
      const blockName = configMatch ? configMatch.blockName : (projectName === 'Chưa phân bổ' ? 'Chưa phân bổ' : (item.banChuoiKhoi || 'Chưa phân bổ'))

      const value = Number(item.giaTriTonKhoQuanLy) || 0

      if (!projectMap[projectName]) {
        projectMap[projectName] = { project: projectName, block: blockName, totalThuKho: 0, totalValue: 0 }
      }
      const p = projectMap[projectName]
      p.totalThuKho += 1
      p.totalValue += value
    })

    // Thêm các Ngăn kho đã cấu hình nhưng hiện chưa có thủ kho nào (để thấy được ngăn kho trống)
    allProjectsFlat.forEach(p => {
      if (!projectMap[p.name]) {
        projectMap[p.name] = { project: p.name, block: p.blockName, totalThuKho: 0, totalValue: 0 }
      }
    })

    const projects = Object.values(projectMap).sort((a, b) => b.totalThuKho - a.totalThuKho)

    const blockNamesInUse = Array.from(new Set(projects.filter(p => p.totalThuKho > 0).map(p => p.block)))
    const blockColorMap = {}
    blockNamesInUse.forEach((b, i) => { blockColorMap[b] = getBlockColor(b, i) })

    const totalNganKho = projects.filter(p => p.totalThuKho > 0).length
    const totalValue = projects.reduce((s, p) => s + p.totalValue, 0)
    const totalBlocks = blockNamesInUse.filter(b => b !== 'Chưa phân bổ').length

    const chartData = projects
      .filter(p => p.totalThuKho > 0)
      .map(p => ({ project: p.project, block: p.block, thuKho: p.totalThuKho, value: p.totalValue }))

    const riskProjects = projects
      .filter(p => p.totalThuKho > 0 && p.totalValue > 0)
      .map(p => ({ ...p, avgValuePerPerson: p.totalValue / p.totalThuKho }))
      .sort((a, b) => b.avgValuePerPerson - a.avgValuePerPerson)
      .slice(0, 3)

    return { projects, blockColorMap, totalNganKho, totalValue, totalBlocks, chartData, riskProjects }
  }, [activeData, allProjectsFlat, blocks])

  const stats = useMemo(() => {
    const total = data.length
    const working = data.filter(x => {
      const status = (x.trangThai || '').trim().toLowerCase()
      return status === 'đang làm việc' || status === 'none' || status === ''
    }).length
    return { total, working }
  }, [data])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>

      {/* Row 1: KPI tổng quan Khối thi công & Ngăn kho */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <StatCard
          icon={<Users />}
          label="Tổng Số Nhân Sự Thủ Kho"
          value={stats.total}
          sub={`${stats.working} đang làm việc thực tế`}
          color="#0f58a7"
        />
        <StatCard
          icon={<Building2 />}
          label="Khối Thi Công Đang Quản Lý"
          value={warehouseStats.totalBlocks}
          sub="Khối thi công đang có ngăn kho hoạt động"
          color="#f97316"
        />
        <StatCard
          icon={<Warehouse />}
          label="Ngăn Kho Đang Hoạt Động"
          value={warehouseStats.totalNganKho}
          sub="Số dự án / ngăn kho đang có thủ kho phụ trách"
          color="#10b981"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Tổng Giá Trị Tồn Kho Quản Lý"
          value={formatVND(warehouseStats.totalValue)}
          sub="Tổng hợp trên toàn bộ ngăn kho"
          color="#8b5cf6"
        />
      </div>

      {/* Row 2: Biểu đồ tương quan Khối thi công ↔ Ngăn kho */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Tương quan Ngăn kho theo từng Dự án
            </h4>
          </div>
          <span style={{ fontSize: '11px', color: '#0f58a7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid #bae6fd' }}>
            💡 Kích đúp vào cột để xem chi tiết dự án
          </span>
        </div>

        {warehouseStats.chartData.length === 0 ? (
          <div style={{ padding: '48px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13.5, fontWeight: 600 }}>
            Chưa có dữ liệu ngăn kho nào được ghi nhận.
          </div>
        ) : (
          <>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                <BarChart
                  data={warehouseStats.chartData}
                  margin={{ top: 25, right: 10, left: -20, bottom: 15 }}
                  onDoubleClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const entry = state.activePayload[0].payload
                      onNavigateToTab('duan', entry.project)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="project"
                    tick={<CustomXAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    height={65}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff' }}
                    formatter={(value, name, props) => [`${value} thủ kho`, `${props.payload.block}`]}
                  />
                  <Bar name="Số thủ kho phụ trách" dataKey="thuKho" radius={[4, 4, 0, 0]} maxBarSize={36} style={{ cursor: 'pointer' }}>
                    {warehouseStats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={warehouseStats.blockColorMap[entry.block] || UNASSIGNED_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Chú giải màu theo Khối thi công */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              {Object.entries(warehouseStats.blockColorMap).map(([name, color]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                  <span style={{ color: '#334155', fontWeight: 600 }}>{name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Row 3: Cảnh báo rủi ro tập trung giá trị tồn kho */}
      {warehouseStats.riskProjects.length > 0 && (
        <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: '#d97706' }} />
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Ngăn kho có giá trị tồn kho bình quân / thủ kho cao nhất — cần giám sát chặt
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {warehouseStats.riskProjects.map((p, idx) => (
              <div
                key={p.project}
                onClick={() => onNavigateToTab('duan', p.project)}
                style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                  padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fffbeb'}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>#{idx + 1} · {p.totalThuKho} thủ kho phụ trách</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>{p.project}</div>
                <div style={{ fontSize: 12.5, color: '#78350f' }}>
                  Bình quân <strong>{formatVND(Math.round(p.avgValuePerPerson * 10) / 10)}</strong> / người · Tổng <strong>{formatVND(Math.round(p.totalValue * 10) / 10)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 4: Bảng chi tiết Khối thi công ↔ Ngăn kho */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PackageSearch size={18} style={{ color: 'var(--primary)' }} />
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            Chi tiết Ngăn kho theo từng Dự án
          </h4>
        </div>

        {warehouseStats.projects.length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13.5, fontWeight: 600 }}>
            Chưa có dữ liệu để hiển thị.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0f58a7' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Khối thi công</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Ngăn kho (Dự án)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Thủ kho phụ trách</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Giá trị tồn kho</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const byBlock = {}
                  warehouseStats.projects.forEach(p => {
                    if (!byBlock[p.block]) byBlock[p.block] = []
                    byBlock[p.block].push(p)
                  })
                  const blockNames = Object.keys(byBlock).sort((a, b) => {
                    if (a === 'Chưa phân bổ') return 1
                    if (b === 'Chưa phân bổ') return -1
                    return a.localeCompare(b)
                  })

                  const rows = []
                  let zebraIdx = 0
                  blockNames.forEach(blockName => {
                    const projs = byBlock[blockName].sort((a, b) => b.totalThuKho - a.totalThuKho)
                    let firstRow = true
                    projs.forEach(p => {
                      const zebraBg = zebraIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      zebraIdx++
                      rows.push(
                        <tr key={p.project} style={{ background: zebraBg }}>
                          {firstRow && (
                            <td
                              rowSpan={projs.length}
                              style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', whiteSpace: 'nowrap' }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: warehouseStats.blockColorMap[blockName] || UNASSIGNED_COLOR, flexShrink: 0 }} />
                                {blockName}
                              </span>
                            </td>
                          )}
                          <td
                            onClick={() => onNavigateToTab('duan', p.project)}
                            style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#0f58a7', fontWeight: 700, cursor: 'pointer' }}
                          >
                            {p.project}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontWeight: p.totalThuKho > 0 ? 700 : 400, color: p.totalThuKho > 0 ? '#1e293b' : '#94a3b8' }}>
                            {p.totalThuKho > 0 ? p.totalThuKho : 'Chưa có thủ kho'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                            {p.totalValue > 0 ? formatVND(Math.round(p.totalValue * 10) / 10) : '—'}
                          </td>
                        </tr>
                      )
                      firstRow = false
                    })
                  })
                  return rows
                })()}
              </tbody>
              <tfoot>
                <tr style={{ background: '#eff6ff' }}>
                  <td colSpan={2} style={{ padding: '12px 14px', fontWeight: 800, color: '#1e3a8a' }}>TỔNG CỘNG</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#1e3a8a' }}>{activeData.length}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>{formatVND(Math.round(warehouseStats.totalValue * 10) / 10)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Row 5: Banner truy cập nhanh danh sách chi tiết */}
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
            <UserCheck size={22} />
          </div>
          <div>
            <h5 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a', margin: '0 0 4px 0' }}>Danh sách Thủ kho theo Dự án & Ngăn kho</h5>
            <p style={{ fontSize: 13, color: '#3b82f6', margin: 0, fontWeight: 500 }}>
              Xem chi tiết từng thủ kho, ngăn kho đang phụ trách và giá trị tồn kho quản lý.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateToTab('duan')}
          className="btn btn-primary btn-sm"
          style={{ background: 'var(--primary)', color: '#ffffff', borderRadius: 8, fontWeight: 700 }}
        >
          Xem danh sách chi tiết
        </button>
      </div>

    </div>
  )
}
