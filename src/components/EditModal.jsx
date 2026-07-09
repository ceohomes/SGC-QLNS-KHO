import React from 'react'
import { X, Award, Info, Briefcase, Trash2, Check } from 'lucide-react'

export default function EditModal({ row, onClose, onSave, onDelete, showConfirm, blocksConfig = [] }) {
  const [formData, setFormData] = React.useState(() => {
    if (row && row.isNew) {
      return {
        isNew: true,
        hoTen: '',
        maNV: '',
        ngaySinh: '',
        soDienThoai: '',
        emailCongTy: '',
        banChuoiKhoi: '',
        duAn: '',
        chucVu: 'Thủ kho hiện trường',
        trinhDo: '',
        trangThai: 'Đang làm việc',
        danhGiaHieuSuat: 'Chưa đánh giá',
        ghiChu: '',
        ...row
      }
    }
    return { ...row }
  })
  const [isSaving, setIsSaving] = React.useState(false)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = () => {
    if (showConfirm && onDelete) {
      const message = `Xóa thông tin thủ kho:\n${formData.hoTen || ''} (Mã NV: ${formData.maNV || ''})\nBạn có chắc chắn muốn xóa thông tin thủ kho này khỏi hệ thống không?\nHành động này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.`
      
      showConfirm(
        message,
        async () => {
          setIsSaving(true)
          try {
            await onDelete(formData)
            onClose()
          } catch (err) {
            console.error(err)
          } finally {
            setIsSaving(false)
          }
        },
        () => {},
        'XÁC NHẬN XÓA THỦ KHO',
        'error'
      )
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13.5px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fff'
  }

  const labelStyle = {
    fontSize: '12.5px',
    fontWeight: '700',
    color: '#334155',
    display: 'block',
    marginBottom: '6px',
    textAlign: 'left'
  }

  const sectionTitleStyle = {
    fontSize: '13.5px',
    fontWeight: '800',
    color: '#0f58a7',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '6px',
    marginBottom: '12px',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 600,
      backdropFilter: 'blur(1.5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div style={{
        background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '700px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{
          background: '#0f58a7', padding: '14px 20px', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} />
            <span>{formData.isNew ? 'THÊM MỚI THÔNG TIN THỦ KHO' : 'CHỈNH SỬA THÔNG TIN THỦ KHO'}</span>
          </h3>
          <button 
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Section 1: Thông tin cá nhân & Liên hệ */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <h4 style={sectionTitleStyle}>
                <Info size={16} />
                <span>Thông tin cá nhân & Liên hệ</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Họ và tên *</label>
                  <input type="text" required value={formData.hoTen || ''} onChange={e => handleChange('hoTen', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Mã nhân viên (ID) *</label>
                  <input 
                    type="text" 
                    required 
                    disabled={!formData.isNew} 
                    value={formData.maNV || ''} 
                    onChange={e => handleChange('maNV', e.target.value)} 
                    placeholder={formData.isNew ? "Nhập mã nhân viên..." : ""}
                    style={formData.isNew ? inputStyle : { ...inputStyle, backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 }} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ngày sinh</label>
                  <input type="date" value={formData.ngaySinh || ''} onChange={e => handleChange('ngaySinh', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Số điện thoại di động *</label>
                  <input type="text" required value={formData.soDienThoai || ''} onChange={e => handleChange('soDienThoai', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email công ty</label>
                  <input type="text" value={formData.emailCongTy || ''} onChange={e => handleChange('emailCongTy', e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Section 2: Công việc, Đánh giá & Trạng thái */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <h4 style={sectionTitleStyle}>
                <Briefcase size={16} />
                <span>Công việc, Đánh giá & Trạng thái</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Khối thi công *</label>
                  <select
                    required
                    value={formData.banChuoiKhoi || ''}
                    onChange={e => {
                      const newBlockName = e.target.value;
                      const block = blocksConfig.find(b => b.name === newBlockName);
                      const firstProjName = (block && block.projects && block.projects.length > 0) ? block.projects[0].name : '';
                      setFormData(prev => ({
                        ...prev,
                        banChuoiKhoi: newBlockName,
                        duAn: firstProjName
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="" disabled>-- Chọn Khối thi công --</option>
                    {blocksConfig.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    {formData.banChuoiKhoi && !blocksConfig.some(b => b.name === formData.banChuoiKhoi) && (
                      <option value={formData.banChuoiKhoi}>{formData.banChuoiKhoi}</option>
                    )}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Dự án / Công trình</label>
                  <select
                    value={formData.duAn || ''}
                    onChange={e => handleChange('duAn', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">-- Không có / Chọn Dự án --</option>
                    {(() => {
                      const currentBlock = blocksConfig.find(b => (b.name || '').trim().toLowerCase() === (formData.banChuoiKhoi || '').trim().toLowerCase());
                      const availableProjects = currentBlock ? (currentBlock.projects || []) : [];
                      return (
                        <>
                          {availableProjects.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                          {formData.duAn && !availableProjects.some(p => p.name === formData.duAn) && (
                            <option value={formData.duAn}>{formData.duAn}</option>
                          )}
                        </>
                      );
                    })()}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Chức danh *</label>
                  <select required value={formData.chucVu || ''} onChange={e => handleChange('chucVu', e.target.value)} style={inputStyle}>
                    <option value="Thủ kho hiện trường">Thủ kho hiện trường</option>
                    <option value="Thủ kho nhập liệu">Thủ kho nhập liệu</option>
                    <option value="Trưởng nhóm kho">Trưởng nhóm kho</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Trình độ</label>
                  <input type="text" value={formData.trinhDo || ''} onChange={e => handleChange('trinhDo', e.target.value)} style={inputStyle} placeholder="Vd: Đại học, Cao đẳng" />
                </div>
                <div>
                  <label style={labelStyle}>Trạng thái hoạt động</label>
                  <select 
                    value={(formData.trangThai === 'None' || !formData.trangThai) ? '' : formData.trangThai} 
                    onChange={e => handleChange('trangThai', e.target.value || null)} 
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    <option value="Đang làm việc">Đang làm việc</option>
                    <option value="Nghỉ phép">Nghỉ phép</option>
                    <option value="Đã nghỉ việc">Đã nghỉ việc</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Đánh giá hiệu suất</label>
                  <select 
                    value={(formData.danhGiaHieuSuat === 'None' || !formData.danhGiaHieuSuat) ? '' : formData.danhGiaHieuSuat} 
                    onChange={e => handleChange('danhGiaHieuSuat', e.target.value || null)} 
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    <option value="Xuất sắc">Xuất sắc</option>
                    <option value="Tốt">Tốt</option>
                    <option value="Khá">Khá</option>
                    <option value="Trung bình">Trung bình</option>
                    <option value="Chưa đánh giá">Chưa đánh giá</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Ghi chú</label>
                  <textarea 
                    value={formData.ghiChu || ''} 
                    onChange={e => handleChange('ghiChu', e.target.value)} 
                    style={{ 
                      ...inputStyle, 
                      minHeight: '80px', 
                      resize: 'vertical', 
                      lineHeight: '1.5', 
                      fontFamily: 'inherit',
                      whiteSpace: 'pre-wrap'
                    }} 
                    placeholder="Nhập ghi chú thêm nếu có..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Modal Footer Actions */}
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12
          }}>
            {!formData.isNew && onDelete && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDeleteClick}
                style={{
                  background: '#dc2626', color: '#ffffff', border: 'none',
                  padding: '8px 16px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  marginRight: 'auto',
                  boxShadow: '0 4px 6px -1px rgba(220,38,38,0.2)',
                  opacity: isSaving ? 0.7 : 1,
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => { if(!isSaving) e.currentTarget.style.background = '#b91c1c' }}
                onMouseOut={(e) => { if(!isSaving) e.currentTarget.style.background = '#dc2626' }}
              >
                <Trash2 size={15} />
                <span>Xóa thủ kho</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                padding: '8px 16px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
                transition: 'background-color 0.2s',
                backgroundColor: 'transparent'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: '#3b82f6', color: '#ffffff', border: 'none',
                padding: '8px 20px', fontSize: 13.5, fontWeight: 700, borderRadius: 8,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)',
                opacity: isSaving ? 0.7 : 1
              }}
              onMouseOver={(e) => { if(!isSaving) e.currentTarget.style.background = '#2563eb' }}
              onMouseOut={(e) => { if(!isSaving) e.currentTarget.style.background = '#3b82f6' }}
            >
              {isSaving ? (
                <>
                  <div style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Lưu lại</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
