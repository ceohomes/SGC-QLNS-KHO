import React, { useMemo } from 'react'
import {
  Users, UserCheck, Building2, Warehouse, TrendingUp, BarChart2,
  AlertTriangle, PackageSearch
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import StatCard from './StatCard.jsx'
import { formatVND } from '../constants.js'

const KHO_COLORS = ['#0f58a7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
const KHO_COLOR_KHAC = '#94a3b8'
const KHO_COLOR_UNASSIGNED = '#cbd5e1'
const MAX_TYPES_SHOWN = 6

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
  // Chỉ tính các thủ kho đang thực sự hoạt động (loại trừ đã nghỉ việc)
  const activeData = useMemo(() => data.filter(x => {
    const st = (x.trangThai || '').trim().toLowerCase()
    return st !== 'đã nghỉ việc' && st !== 'nghỉ việc'
  }), [data])

  // ─── Tổng hợp tương quan Dự án ↔ Ngăn kho ───
  const warehouseStats = useMemo(() => {
    const projectMap = {}
    const typeTotals = {}

    activeData.forEach(item => {
      const proj = (item.duAn || '').trim()
      const projectName = proj && proj !== '—' && proj !== 'None' ? proj : 'Chưa phân bổ'

      const rawType = (item.khoPhuTrach || '').toString().trim()
      const type = rawType && rawType !== 'None' && rawType !== '—' ? rawType : null

      const nganKho = item.soLuongKhoQuanLy != null && item.soLuongKhoQuanLy !== ''
        ? Number(item.soLuongKhoQuanLy) || 0
        : (type ? 1 : 0)
      const value = Number(item.giaTriTonKhoQuanLy) || 0

      if (!projectMap[projectName]) {
        projectMap[projectName] = {
          project: projectName,
          totalThuKho: 0,
          totalNganKho: 0,
          totalValue: 0,
          unassigned: 0,
          byType: {}
        }
      }
      const p = projectMap[projectName]
      p.totalThuKho += 1
      p.totalNganKho += nganKho
      p.totalValue += value

      if (!type) {
        p.unassigned += 1
      } else {
        if (!p.byType[type]) p.byType[type] = { count: 0, nganKho: 0, value: 0 }
        p.byType[type].count += 1
        p.byType[type].nganKho += nganKho
        p.byType[type].value += value

        if (!typeTotals[type]) typeTotals[type] = { nganKho: 0, value: 0, count: 0 }
        typeTotals[type].nganKho += nganKho
        typeTotals[type].value += value
        typeTotals[type].count += 1
      }
    })

    const projects = Object.values(projectMap).sort((a, b) => b.totalNganKho - a.totalNganKho)

    const sortedTypeNames = Object.entries(typeTotals)
      .sort((a, b) => b[1].nganKho - a[1].nganKho)
      .map(([name]) => name)
    const topTypes = sortedTypeNames.slice(0, MAX_TYPES_SHOWN)
    const hasOther = sortedTypeNames.length > MAX_TYPES_SHOWN

    const typeColorMap = {}
    topTypes.forEach((t, i) => { typeColorMap[t] = KHO_COLORS[i % KHO_COLORS.length] })

    const totalNganKho = projects.reduce((s, p) => s + p.totalNganKho, 0)
    const totalValue = projects.reduce((s, p) => s + p.totalValue, 0)
    const totalUnassigned = projects.reduce((s, p) => s + p.unassigned, 0)
    const totalProjects = projects.filter(p => p.project !== 'Chưa phân bổ' && p.totalNganKho > 0).length

    // Dữ liệu biểu đồ cột chồng: mỗi dự án 1 cột, chia theo loại ngăn kho
    const chartData = projects
      .filter(p => p.totalNganKho > 0)
      .map(p => {
        const row = { project: p.project, __totalThuKho: p.totalThuKho }
        let otherSum = 0
        Object.entries(p.byType).forEach(([type, info]) => {
          if (topTypes.includes(type)) {
            row[type] = info.nganKho
          } else {
            otherSum += info.nganKho
          }
        })
        if (hasOther) row['Khác'] = otherSum
        return row
      })

    // Rủi ro: dự án có giá trị tồn kho bình quân/người cao nhất (áp lực trách nhiệm cao)
    const riskProjects = projects
      .filter(p => p.totalThuKho > 0 && p.totalValue > 0)
      .map(p => ({ ...p, avgValuePerPerson: p.totalValue / p.totalThuKho }))
      .sort((a, b) => b.avgValuePerPerson - a.avgValuePerPerson)
      .slice(0, 3)

    return { projects, topTypes, hasOther, typeColorMap, totalNganKho, totalValue, totalUnassigned, totalProjects, chartData, riskProjects }
  }, [activeData])

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

      {/* Row 1: KPI tổng quan Dự án & Ngăn kho */}
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
          label="Dự Án Đang Có Ngăn Kho"
          value={warehouseStats.totalProjects}
          sub="Dự án đang được thủ kho quản lý"
          color="#f97316"
        />
        <StatCard
          icon={<Warehouse />}
          label="Tổng Số Ngăn Kho Quản Lý"
          value={warehouseStats.totalNganKho}
          sub={warehouseStats.totalUnassigned > 0 ? `${warehouseStats.totalUnassigned} thủ kho chưa gán loại ngăn kho` : 'Tất cả đã được phân loại'}
          color="#10b981"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Tổng Giá Trị Tồn Kho Quản Lý"
          value={formatVND(warehouseStats.totalValue)}
          sub="Tổng hợp trên toàn bộ dự án"
          color="#8b5cf6"
        />
      </div>

      {/* Row 2: Biểu đồ tương quan Dự án ↔ Ngăn kho */}
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
                    formatter={(value, name) => [`${value} ngăn kho`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 12 }} />
                  {warehouseStats.topTypes.map(type => (
                    <Bar
                      key={type}
                      name={type}
                      dataKey={type}
                      stackId="kho"
                      fill={warehouseStats.typeColorMap[type]}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                  {warehouseStats.hasOther && (
                    <Bar
                      name="Khác"
                      dataKey="Khác"
                      stackId="kho"
                      fill={KHO_COLOR_KHAC}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
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
              Dự án có giá trị tồn kho bình quân / thủ kho cao nhất — cần giám sát chặt
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

      {/* Row 4: Bảng chi tiết Dự án ↔ Ngăn kho */}
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PackageSearch size={18} style={{ color: 'var(--primary)' }} />
          <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            Chi tiết Ngăn kho theo từng Dự án
          </h4>
        </div>

        {warehouseStats.projects.filter(p => p.totalThuKho > 0).length === 0 ? (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13.5, fontWeight: 600 }}>
            Chưa có dữ liệu để hiển thị.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0f58a7' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Dự án</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Loại ngăn kho</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Thủ kho phụ trách</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Số ngăn kho</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Giá trị tồn kho</th>
                </tr>
              </thead>
              <tbody>
                {warehouseStats.projects.filter(p => p.totalThuKho > 0).map((p, pIdx) => {
                  const typeRows = Object.entries(p.byType).sort((a, b) => b[1].nganKho - a[1].nganKho)
                  const rowCount = typeRows.length + (p.unassigned > 0 ? 1 : 0) || 1
                  const zebraBg = pIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                  let firstRow = true

                  const rows = []
                  if (typeRows.length === 0 && p.unassigned === 0) {
                    rows.push(
                      <tr key={`${p.project}-empty`} style={{ background: zebraBg }}>
                        <td rowSpan={1} style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => onNavigateToTab('duan', p.project)}>{p.project}</td>
                        <td colSpan={4} style={{ padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Chưa có dữ liệu ngăn kho</td>
                      </tr>
                    )
                  } else {
                    typeRows.forEach(([type, info]) => {
                      rows.push(
                        <tr key={`${p.project}-${type}`} style={{ background: zebraBg }}>
                          {firstRow && (
                            <td
                              rowSpan={rowCount}
                              onClick={() => onNavigateToTab('duan', p.project)}
                              style={{ padding: '10px 14px', fontWeight: 700, color: '#0f58a7', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              {p.project}
                            </td>
                          )}
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: warehouseStats.typeColorMap[type] || KHO_COLOR_KHAC, flexShrink: 0 }} />
                              {type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{info.count}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{info.nganKho}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{formatVND(Math.round(info.value * 10) / 10)}</td>
                        </tr>
                      )
                      firstRow = false
                    })
                    if (p.unassigned > 0) {
                      rows.push(
                        <tr key={`${p.project}-unassigned`} style={{ background: zebraBg }}>
                          {firstRow && (
                            <td
                              rowSpan={rowCount}
                              onClick={() => onNavigateToTab('duan', p.project)}
                              style={{ padding: '10px 14px', fontWeight: 700, color: '#0f58a7', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              {p.project}
                            </td>
                          )}
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontStyle: 'italic' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: KHO_COLOR_UNASSIGNED, flexShrink: 0 }} />
                              Chưa gán loại ngăn kho
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{p.unassigned}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>—</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>—</td>
                        </tr>
                      )
                    }
                  }
                  return rows
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#eff6ff' }}>
                  <td colSpan={2} style={{ padding: '12px 14px', fontWeight: 800, color: '#1e3a8a' }}>TỔNG CỘNG</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#1e3a8a' }}>{activeData.length}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#1e3a8a' }}>{warehouseStats.totalNganKho}</td>
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
