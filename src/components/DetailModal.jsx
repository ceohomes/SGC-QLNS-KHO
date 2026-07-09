import React from 'react'
import { X, Phone, Mail, Building, Layers, MapPin, Calendar, Briefcase, Warehouse, Award, ShieldCheck, Pencil } from 'lucide-react'
import { formatDate, trangThaiBadgeClass, danhGiaBadgeClass, initials } from '../constants.js'

export default function DetailModal({ row, onClose, onEdit }) {
  const infoRow = (icon, label, value) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ color: 'var(--primary)', marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{value || '—'}</div>
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }} onClick={onClose}>
      <div className="card" style={{ width: 520, maxHeight: '85vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: 'linear-gradient(135deg, #0c4685 0%, #0f58a7 100%)', padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0
        }}>
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 18, background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)' }}>
            {initials(row.hoTen)}
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>{row.hoTen}</div>
            <div style={{ color: '#c7d2fe', fontSize: 13 }}>{row.maNV} · {row.chucVu}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onEdit && (
              <button 
                onClick={() => {
                  onClose()
                  onEdit(row)
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Pencil size={13} />
                <span>Sửa</span>
              </button>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 6, color: '#fff', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '8px 24px 20px' }}>
          {infoRow(<Phone size={16} />, 'Số điện thoại di động', row.soDienThoai)}
          {infoRow(<Mail size={16} />, 'Email công ty', row.emailCongTy)}
          {infoRow(<Building size={16} />, 'Ban / Chuỗi / Khối', row.banChuoiKhoi)}
          {infoRow(<Layers size={16} />, 'Phòng / Vùng / Miền', row.phongVungMien)}
          {infoRow(<MapPin size={16} />, 'Quê quán', row.queQuan)}
          {infoRow(<Calendar size={16} />, 'Ngày sinh / Tuổi', `${formatDate(row.ngaySinh)} · ${row.tuoi} tuổi`)}
          {infoRow(<Briefcase size={16} />, 'Dự án / Công trình', row.duAn)}
          {infoRow(<Warehouse size={16} />, 'Kho phụ trách', `${row.khoPhuTrach || '—'} (${row.soLuongKhoQuanLy || 0} kho)`)}
          {infoRow(<Calendar size={16} />, 'Ngày vào làm / Kinh nghiệm', `${formatDate(row.ngayVaoLam)} · ${row.soNamKinhNghiem || 0} năm`)}
          {infoRow(<Award size={16} />, 'Trình độ / Chuyên ngành', `${row.trinhDo || '—'} · ${row.chuyenNganh || '—'}`)}
          {infoRow(<ShieldCheck size={16} />, 'Chứng chỉ nghiệp vụ / ATLĐ', `${row.chungChiNghiepVuKho || '—'} / ${row.chungChiATLD || '—'}`)}
          {infoRow(<Briefcase size={16} />, 'Loại hợp đồng', `${row.loaiHopDong || '—'}${row.ngayHetHanHD ? ' · hết hạn ' + formatDate(row.ngayHetHanHD) : ''}`)}
          {infoRow(<Award size={16} />, 'Lương cơ bản / Giá trị tồn kho QL', `${row.luongCoBan || 0} triệu · ${row.giaTriTonKhoQuanLy || 0} tỷ`)}

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${trangThaiBadgeClass(row.trangThai)}`}>{row.trangThai}</span>
            <span className={`badge ${danhGiaBadgeClass(row.danhGiaHieuSuat)}`}>Hiệu suất: {row.danhGiaHieuSuat}</span>
          </div>

          {row.ghiChu && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--primary-light)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'left' }}>
              <strong>Ghi chú:</strong> {row.ghiChu}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
