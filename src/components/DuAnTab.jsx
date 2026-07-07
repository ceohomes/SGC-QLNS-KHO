import React, { useMemo, useState } from 'react'
import { Building2, Search, MapPin, HardHat, Calendar, ExternalLink, Package, Briefcase } from 'lucide-react'
import { DU_AN_LIST } from '../mockData.js'

export default function DuAnTab({ data = [] }) {
  const [searchTerm, setSearchTerm] = useState('')

  // Tính toán số lượng thủ kho phân bổ tại mỗi công trình từ danh sách thực tế
  const duAnStats = useMemo(() => {
    return DU_AN_LIST.map(proj => {
      // Tìm các thủ kho đang thuộc dự án này
      const tkInProj = data.filter(x => x.duAnId === proj.id)
      const count = tkInProj.length
      const truongKho = tkInProj.find(x => x.chucVu === 'Thủ kho trưởng' || x.chucVu === 'Thủ kho trưởng hiện trường')
      const totalTonKhoValue = tkInProj.reduce((sum, x) => sum + (Number(x.giaTriTonKhoQuanLy) || 0), 0)

      return {
        ...proj,
        thuKhoCount: count,
        truongKhoName: truongKho ? truongKho.hoTen : 'Chưa phân bổ',
        totalTonKhoValue: Math.round(totalTonKhoValue * 10) / 10
      }
    })
  }, [data])

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return duAnStats
    return duAnStats.filter(x =>
      x.ten.toLowerCase().includes(q) ||
      x.diaDiem.toLowerCase().includes(q) ||
      x.nhaThau.toLowerCase().includes(q)
    )
  }, [duAnStats, searchTerm])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {/* Search Header bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
          <Building2 size={22} style={{ color: 'var(--primary)' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>DANH SÁCH 15+ DỰ ÁN & CÔNG TRÌNH THI CÔNG</h4>
            <span style={{ fontSize: 13, color: 'var(--text-light)' }}>Theo dõi phân bổ lực lượng thủ kho & quy mô lao động trên từng công trình</span>
          </div>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input"
            placeholder="Tìm kiếm công trình, địa điểm, nhà thầu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 38, fontSize: 13.5 }}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: '80px 0' }}>
          <Building2 size={48} />
          <h3>Không tìm thấy công trình nào</h3>
          <p>Hãy thử tìm kiếm với các từ khóa khác hoặc xóa bộ lọc.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {filtered.map(proj => (
            <div key={proj.id} className="card" style={{
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              transition: 'all 0.2s ease', position: 'relative', border: '1px solid #e2e8f0'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(11,87,208,0.12)' }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {/* Header colored banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0c4685 0%, #15305b 100%)',
                padding: '16px 20px', color: '#ffffff', textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#93c5fd', background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                    {proj.id}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fef08a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <HardHat size={12} /> Quy mô TC: {proj.quyMo} CN
                  </span>
                </div>
                <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: '#ffffff' }}>{proj.ten}</h5>
              </div>

              {/* Stats box body */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'left' }}>
                  <MapPin size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span>Địa điểm: <strong>{proj.diaDiem}</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'left' }}>
                  <Briefcase size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>Nhà thầu chính: <strong>{proj.nhaThau}</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'left' }}>
                  <Calendar size={15} style={{ color: '#059669', flexShrink: 0 }} />
                  <span>Khởi công: <strong>{proj.khoiCongThang}</strong></span>
                </div>

                {/* Divider */}
                <div style={{ height: 1, backgroundColor: '#e2e8f0', margin: '4px 0' }} />

                {/* Warehouse Stats inside card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>Thủ kho phân bổ</span>
                    <strong style={{ fontSize: 18, color: '#0f58a7', fontWeight: 800 }}>{proj.thuKhoCount} nhân sự</strong>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block', fontWeight: 600 }}>T.Giá kho quản lý</span>
                    <strong style={{ fontSize: 18, color: '#10b981', fontWeight: 800 }}>{proj.totalTonKhoValue} tỷ VND</strong>
                  </div>
                </div>

                {/* Warehouse Chief */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: proj.truongKhoName === 'Chưa phân bổ' ? '#fffbeb' : '#f0fdf4',
                  border: proj.truongKhoName === 'Chưa phân bổ' ? '1px solid #fde68a' : '1px solid #bbf7d0',
                  padding: '8px 12px', borderRadius: 8, fontSize: 13, textAlign: 'left', marginTop: 4
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Thủ kho trưởng:</span>
                  <strong style={{ color: proj.truongKhoName === 'Chưa phân bổ' ? '#d97706' : '#15803d' }}>{proj.truongKhoName}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
