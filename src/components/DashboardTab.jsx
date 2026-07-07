import React, { useMemo } from 'react'
import { Users, UserCheck, ShieldAlert, Award, TrendingUp, BarChart2, PieChart as PieIcon, HelpCircle } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts'
import StatCard from './StatCard.jsx'
import { formatVND } from '../constants.js'

export default function DashboardTab({ data = [], onNavigateToTab }) {
  // ─── 1. KPIs ───
  const stats = useMemo(() => {
    const total = data.length
    const working = data.filter(x => x.trangThai === 'Đang làm việc').length
    const leave = data.filter(x => x.trangThai === 'Nghỉ phép').length
    const quit = data.filter(x => x.trangThai === 'Đã nghỉ việc').length

    // Thủ kho có đầy đủ chứng chỉ chuyên môn & chứng chỉ ATLD
    const certBoth = data.filter(x => x.chungChiNghiepVuKho === 'Có' && x.chungChiATLD === 'Có').length
    const certBothPercent = total ? Math.round((certBoth / total) * 100) : 0

    // Hiệu suất loại Xuất sắc & Tốt
    const highPerform = data.filter(x => x.danhGiaHieuSuat === 'Xuất sắc' || x.danhGiaHieuSuat === 'Tốt').length
    const highPerformPercent = total ? Math.round((highPerform / total) * 100) : 0

    // Tổng quỹ lương cơ bản của toàn bộ lực lượng thủ kho
    const totalSalary = data.reduce((sum, x) => sum + (Number(x.luongCoBan) || 0), 0)

    return { total, working, leave, quit, certBothPercent, highPerformPercent, totalSalary }
  }, [data])

  // ─── 2. Biểu đồ 1: Thống kê số lượng thủ kho theo Dự án (Top 12 dự án đông nhất) ───
  const projectChartData = useMemo(() => {
    const counts = {}
    data.forEach(item => {
      if (item.duAn) {
        counts[item.duAn] = (counts[item.duAn] || 0) + 1
      }
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.replace(' – Giai đoạn 2', '').replace(' – Phân khu The Rainbow', '').slice(0, 26) + '...', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [data])

  // ─── 3. Biểu đồ 2: Cơ cấu chức danh (Thủ kho trưởng hiện trường, Thủ kho hiện trường, Trưởng nhóm kho) ───
  const roleChartData = useMemo(() => {
    const counts = { 'Thủ kho hiện trường': 0, 'Thủ kho trưởng hiện trường': 0, 'Trưởng nhóm kho': 0 }
    data.forEach(item => {
      let role = item.chucVu || ''
      if (role === 'Thủ kho' || role === 'Nhân viên kho') {
        role = 'Thủ kho hiện trường'
      } else if (role === 'Thủ kho trưởng') {
        role = 'Thủ kho trưởng hiện trường'
      } else if (role === 'Trưởng nhóm kho dự án' || role === 'Trưởng nhóm Kho') {
        role = 'Trưởng nhóm kho'
      }
      if (counts[role] !== undefined) {
        counts[role]++
      } else if (role) {
        counts[role] = (counts[role] || 0) + 1
      }
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [data])

  // ─── 4. Biểu đồ 3: Phân bố Trình độ chuyên môn ───
  const degreeChartData = useMemo(() => {
    const counts = {}
    data.forEach(item => {
      counts[item.trinhDo] = (counts[item.trinhDo] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [data])

  // COLORS
  const COLORS_ROLE = ['#0f58a7', '#10b981', '#f59e0b']
  const COLORS_DEGREE = ['#8b5cf6', '#3b82f6', '#ec4899']

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Phân bổ Nhân Sự theo các Dự án trọng điểm (Top 10)
            </h4>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={projectChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {projectChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0c4685' : 'var(--primary)'} />
                  ))}
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
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_ROLE[index] }} />
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
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_DEGREE[index] }} />
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
              Tổng quỹ lương hàng tháng ước tính: <strong style={{ color: '#1e293b', fontSize: 15 }}>{formatVND(stats.totalSalary)}</strong> · Trung bình <strong style={{ color: '#1e293b' }}>{(stats.totalSalary / stats.total).toFixed(1)} triệu / tháng</strong> cho mỗi nhân sự.
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
