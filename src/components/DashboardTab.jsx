import React, { useMemo, useState, useEffect } from 'react'
import { UserCheck, PackageSearch, AlertTriangle, Users, X, Info } from 'lucide-react'
import { formatVND } from '../constants.js'
import { supabase } from '../supabaseClient'
import useEscapeKey from '../hooks/useEscapeKey'

const BLOCK_COLORS = ['#0f58a7', '#f97316', '#a855f7', '#10b981', '#ec4899', '#14b8a6', '#eab308']
const UNASSIGNED_COLOR = '#94a3b8'

export default function DashboardTab({ data = [], onNavigateToTab }) {
  const [blocks, setBlocks] = useState([])
  const [selectedProjectStaff, setSelectedProjectStaff] = useState(null)
  useEscapeKey(() => setSelectedProjectStaff(null), Boolean(selectedProjectStaff))

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

    const totalValue = projects.reduce((s, p) => s + p.totalValue, 0)

    const riskProjects = projects
      .filter(p => p.totalThuKho > 0 && p.totalValue > 0)
      .map(p => ({ ...p, avgValuePerPerson: p.totalValue / p.totalThuKho }))
      .sort((a, b) => b.avgValuePerPerson - a.avgValuePerPerson)
      .slice(0, 3)

    return { projects, blockColorMap, totalValue, riskProjects }
  }, [activeData, allProjectsFlat, blocks])

  // Danh sách thủ kho thực tế của Ngăn kho (dự án) đang xem chi tiết
  const staffDetailsList = useMemo(() => {
    if (!selectedProjectStaff) return []
    const lowerProjName = selectedProjectStaff.trim().toLowerCase()
    return activeData.filter(tk => (tk.duAn || '').trim().toLowerCase() === lowerProjName)
  }, [activeData, selectedProjectStaff])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>

      {/* Cảnh báo rủi ro tập trung giá trị tồn kho */}
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

      {/* Bảng chi tiết Khối thi công ↔ Ngăn kho */}
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
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0f58a7' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Dự án</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Ngăn kho</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>Thủ kho phụ trách</th>
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

                  const GROUP_BG = ['#ffffff', '#eff6ff']
                  const rows = []
                  blockNames.forEach((blockName, groupIdx) => {
                    const projs = byBlock[blockName].sort((a, b) => b.totalThuKho - a.totalThuKho)
                    const groupBg = GROUP_BG[groupIdx % GROUP_BG.length]
                    let firstRow = true
                    projs.forEach(p => {
                      rows.push(
                        <tr key={p.project} style={{ background: groupBg }}>
                          {firstRow && (
                            <td
                              rowSpan={projs.length}
                              style={{
                                padding: '10px 14px', fontWeight: 700, color: '#1e293b',
                                borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                                borderTop: '2px solid #94a3b8',
                                verticalAlign: 'top', whiteSpace: 'nowrap'
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: warehouseStats.blockColorMap[blockName] || UNASSIGNED_COLOR, flexShrink: 0 }} />
                                {blockName}
                              </span>
                            </td>
                          )}
                          <td
                            onClick={() => onNavigateToTab('duan', p.project)}
                            style={{
                              padding: '10px 14px', color: '#0f58a7', fontWeight: 700, cursor: 'pointer',
                              borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                              borderTop: firstRow ? '2px solid #94a3b8' : undefined
                            }}
                          >
                            {p.project}
                          </td>
                          <td style={{
                            padding: '10px 14px', textAlign: 'center',
                            borderBottom: '1px solid #e2e8f0',
                            borderTop: firstRow ? '2px solid #94a3b8' : undefined
                          }}>
                            {p.totalThuKho > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedProjectStaff(p.project)
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontWeight: 700, color: '#0f58a7', fontSize: 12,
                                  background: '#f0f7ff', border: '1px solid #bfdbfe',
                                  cursor: 'pointer', padding: '2px 10px', borderRadius: '12px',
                                  transition: 'all 0.15s ease', outline: 'none'
                                }}
                                title="Bấm để xem danh sách thủ kho phụ trách ngăn kho này"
                              >
                                {p.totalThuKho}
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Chưa có thủ kho</span>
                            )}
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
                <tr style={{ background: '#dbeafe' }}>
                  <td colSpan={2} style={{ padding: '12px 14px', fontWeight: 800, color: '#1e3a8a', borderTop: '2px solid #94a3b8', borderRight: '1px solid #bfdbfe' }}>TỔNG CỘNG</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#1e3a8a', borderTop: '2px solid #94a3b8' }}>{activeData.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Banner truy cập nhanh danh sách chi tiết */}
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

      {/* Modal chi tiết thủ kho phụ trách ngăn kho — tương tự sheet Định biên nhân sự */}
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
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>DANH SÁCH THỦ KHO PHỤ TRÁCH</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: '#bfdbfe', fontWeight: 500 }}>
                    Ngăn kho / Dự án: <span style={{ color: '#fff', fontWeight: 700 }}>{selectedProjectStaff}</span>
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
                          Chưa có thủ kho nào phân bổ cho ngăn kho này.
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
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
