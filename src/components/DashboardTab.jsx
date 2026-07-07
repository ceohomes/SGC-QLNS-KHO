import React, { useMemo } from 'react'
import { Users, UserCheck, ShieldAlert, Award, TrendingUp, BarChart2, PieChart as PieIcon, HelpCircle } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, Cell, PieChart, Pie, LabelList
} from 'recharts'
import StatCard from './StatCard.jsx'
import { formatVND } from '../constants.js'

export default function DashboardTab({ data = [], onNavigateToTab }) {
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

  // ─── 2. Biểu đồ 1: Thống kê số lượng thủ kho theo Dự án (Top 10 dự án đông nhất) ───
  const projectChartData = useMemo(() => {
    const counts = {}
    data.forEach(item => {
      const projName = (item.duAn || '').trim()
      if (projName && projName !== '—' && projName !== 'None') {
        counts[projName] = (counts[projName] || 0) + 1
      } else {
        counts['Chưa phân bổ'] = (counts['Chưa phân bổ'] || 0) + 1
      }
    })
    return Object.entries(counts)
      .map(([name, count]) => {
        let displayName = name
        // Loại bỏ bớt hậu tố dài dòng để hiển thị biểu đồ đẹp hơn
        displayName = displayName
          .replace(' – Giai đoạn 2', '')
          .replace(' – Phân khu The Rainbow', '')
          .replace(' – Mở rộng GĐ3', '')
          .replace(' Tower B – Cao ốc Văn phòng', '')
        if (displayName.length > 20) {
          displayName = displayName.slice(0, 20) + '...'
        }
        return { name: displayName, originalName: name, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [data])

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

  // ─── 4. Biểu đồ 3: Phân bố Trình độ chuyên môn ───
  const degreeChartData = useMemo(() => {
    const counts = {}
    data.forEach(item => {
      let deg = (item.trinhDo || '').trim()
      if (!deg || deg === 'None' || deg === '—') {
        deg = 'Chưa cập nhật'
      }
      counts[deg] = (counts[deg] || 0) + 1
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

  const COLORS_DEGREE = [
    '#8b5cf6', // Violet
    '#3b82f6', // Bright blue
    '#ec4899', // Pink
    '#10b981', // Emerald green
    '#f59e0b', // Amber
    '#0f58a7', // Deep blue
    '#14b8a6', // Teal
    '#64748b'  // Slate gray
  ]

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      
      {/* 4 KPI cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
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
        <StatCard
          icon={<ShieldAlert />}
          label="Tỷ Lệ Đủ Chứng Chỉ Chuyên Môn"
          value={`${stats.certBothPercent}%`}
          sub="Đạt chuẩn chứng chỉ nghiệp vụ & ATLD"
          color="#8b5cf6"
          trend={{ direction: 'up', text: 'Đạt KPIs năm' }}
        />
        <StatCard
          icon={<Award />}
          label="Đánh Giá Hiệu Suất Tốt / Xuất Sắc"
          value={`${stats.highPerformPercent}%`}
          sub="Dựa trên báo cáo kiểm kê & hao hụt"
          color="#f59e0b"
          trend={{ direction: 'up', text: '+2.4% quý trước' }}
        />
      </div>

      {/* Row 2: Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
        
        {/* Left chart: Bar chart for projects */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                Phân bổ Nhân Sự theo các Dự án trọng điểm (Top 10)
              </h4>
            </div>
            <span style={{ fontSize: '11px', color: '#0f58a7', background: '#e0f2fe', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid #bae6fd' }}>
              💡 Kích đúp vào cột để xem chi tiết
            </span>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={projectChartData} margin={{ top: 25, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar 
                  dataKey="count" 
                  fill="var(--primary)" 
                  radius={[4, 4, 0, 0]} 
                  maxBarSize={32}
                  onDoubleClick={(state) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const entry = state.activePayload[0].payload;
                      onNavigateToTab('danhsach', entry.originalName);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {projectChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#0c4685' : 'var(--primary)'}
                      onDoubleClick={() => onNavigateToTab('danhsach', entry.originalName)}
                      style={{ cursor: 'pointer' }}
                      title="Kích đúp để xem chi tiết danh sách"
                    />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fill: '#0f58a7', fontSize: 11, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right charts grid: Two small pie charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          
          {/* Role Pie Chart */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} style={{ color: 'var(--primary)' }} />
              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase' }}>Cơ cấu Chức Danh</h4>
            </div>
            <div style={{ width: '100%', height: 160, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={roleChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
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
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Tổng số</span>
                <strong style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{stats.total}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              {roleChartData.map((entry, index) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_ROLE[index % COLORS_ROLE.length] }} />
                    <span style={{ color: '#475569', fontWeight: 500 }}>{entry.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{entry.value} ({Math.round((entry.value/stats.total)*100) || 0}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Degree Pie Chart */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} style={{ color: 'var(--primary)' }} />
              <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase' }}>Trình độ Chuyên môn</h4>
            </div>
            <div style={{ width: '100%', height: 160, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={degreeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {degreeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_DEGREE[index % COLORS_DEGREE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} nhân sự`, 'Số lượng']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Trình độ</span>
                <strong style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>3 Cấp</strong>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              {degreeChartData.map((entry, index) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_DEGREE[index % COLORS_DEGREE.length] }} />
                    <span style={{ color: '#475569', fontWeight: 500 }}>{entry.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{entry.value} ({Math.round((entry.value/stats.total)*100) || 0}%)</span>
                </div>
              ))}
            </div>
          </div>

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
