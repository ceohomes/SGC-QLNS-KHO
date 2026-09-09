import React, { useState, useEffect } from 'react'
import { 
  Briefcase, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Info
} from 'lucide-react'
import { supabase } from '../supabaseClient'

export const DEFAULT_CHUC_VU_LIST = [
  { id: 2, ten_chuc_vu: 'Thủ kho hiện trường' },
  { id: 3, ten_chuc_vu: 'Thủ kho nhập liệu' },
  { id: 4, ten_chuc_vu: 'Trưởng nhóm kho dự án' },
  { id: 6, ten_chuc_vu: 'Chuyên viên hậu kiểm kho' }
]

export const isSafeDbId = (id) => typeof id === 'number' && Number.isInteger(id) && id > 0 && id < 2000000000

export default function CaiDatChucVuModal({ isOpen, onClose, onPositionsUpdated, candidateCountByPosition = {} }) {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(false)

  // Form thêm / sửa
  const [editingItem, setEditingItem] = useState(null)
  const [inputTen, setInputTen] = useState('')
  const [formError, setFormError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Modal xác nhận xóa
  const [deletingPosition, setDeletingPosition] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPositions()
    }
  }, [isOpen])

  const loadPositions = async () => {
    setLoading(true)
    let loadedFromDb = false

    try {
      const { data, error } = await supabase
        .from('sgc_cai_dat_chuc_vu')
        .select('*')
        .order('id', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        setPositions(data)
        localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(data))
        if (onPositionsUpdated) onPositionsUpdated(data)
        loadedFromDb = true
      }
    } catch (err) {
      console.warn('Supabase fetch error:', err)
    }

    if (!loadedFromDb) {
      try {
        const local = localStorage.getItem('sgc_cai_dat_chuc_vu')
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.map((p, idx) => ({
              ...p,
              id: isSafeDbId(p.id) ? p.id : (idx + 1)
            }))
            setPositions(cleaned)
            localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(cleaned))
            if (onPositionsUpdated) onPositionsUpdated(cleaned)
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.warn('Lỗi đọc localStorage:', e)
      }

      setPositions(DEFAULT_CHUC_VU_LIST)
      localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(DEFAULT_CHUC_VU_LIST))
      if (onPositionsUpdated) onPositionsUpdated(DEFAULT_CHUC_VU_LIST)
    }

    setLoading(false)
  }

  const resetForm = () => {
    setEditingItem(null)
    setInputTen('')
    setFormError('')
  }

  const handleStartEdit = (pos) => {
    setEditingItem(pos)
    setInputTen(pos.ten_chuc_vu || '')
    setFormError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError('')

    const ten = inputTen.trim()
    if (!ten) {
      setFormError('Vui lòng nhập tên chức vụ!')
      return
    }

    // Kiểm tra trùng tên
    const isDuplicate = positions.some(p => {
      if (editingItem && (p.id === editingItem.id || p.ten_chuc_vu?.toLowerCase() === editingItem.ten_chuc_vu?.toLowerCase())) {
        return false
      }
      return p.ten_chuc_vu?.trim().toLowerCase() === ten.toLowerCase()
    })

    if (isDuplicate) {
      setFormError(`Chức vụ "${ten}" đã có trong danh sách!`)
      return
    }

    setLoading(true)

    if (editingItem) {
      // CẬP NHẬT
      const oldTen = editingItem.ten_chuc_vu
      const updatedList = positions.map(p => {
        if (p.id === editingItem.id || p.ten_chuc_vu === oldTen) {
          return { ...p, ten_chuc_vu: ten }
        }
        return p
      })

      setPositions(updatedList)
      localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(updatedList))
      if (onPositionsUpdated) onPositionsUpdated(updatedList)

      try {
        let query = supabase.from('sgc_cai_dat_chuc_vu').update({ ten_chuc_vu: ten })
        if (isSafeDbId(editingItem.id)) {
          query = query.eq('id', editingItem.id)
        } else {
          query = query.eq('ten_chuc_vu', oldTen)
        }
        await query
      } catch (err) {
        console.warn('Lỗi cập nhật Supabase:', err)
      }

      setActionSuccess(`Đã cập nhật chức vụ thành "${ten}"!`)
    } else {
      // THÊM MỚI
      const newItem = {
        id: Date.now(),
        ten_chuc_vu: ten
      }
      const updatedList = [...positions, newItem]

      setPositions(updatedList)
      localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(updatedList))
      if (onPositionsUpdated) onPositionsUpdated(updatedList)

      try {
        const { data } = await supabase
          .from('sgc_cai_dat_chuc_vu')
          .insert([{ ten_chuc_vu: ten }])
          .select()

        if (data && data[0]) {
          const syncedList = updatedList.map(p => p.id === newItem.id ? data[0] : p)
          setPositions(syncedList)
          localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(syncedList))
        }
      } catch (err) {
        console.warn('Lỗi chèn Supabase:', err)
      }

      setActionSuccess(`Đã thêm mới chức vụ "${ten}" thành công!`)
    }

    setLoading(false)
    resetForm()
    setTimeout(() => setActionSuccess(''), 3000)
  }

  // Mở popup view xác nhận xóa
  const handleOpenDeleteModal = (pos) => {
    setDeletingPosition(pos)
  }

  // Xác nhận thực hiện xóa dữ liệu
  const handleConfirmDelete = async () => {
    if (!deletingPosition) return
    setIsDeleting(true)

    const pos = deletingPosition
    const nextList = positions.filter(p => p.id !== pos.id && p.ten_chuc_vu !== pos.ten_chuc_vu)
    
    setPositions(nextList)
    localStorage.setItem('sgc_cai_dat_chuc_vu', JSON.stringify(nextList))
    if (onPositionsUpdated) onPositionsUpdated(nextList)

    try {
      let query = supabase.from('sgc_cai_dat_chuc_vu').delete()
      if (isSafeDbId(pos.id)) {
        query = query.eq('id', pos.id)
      } else {
        query = query.eq('ten_chuc_vu', pos.ten_chuc_vu)
      }
      await query
    } catch (err) {
      console.warn('Lỗi xóa Supabase:', err)
    }

    if (editingItem && (editingItem.id === pos.id || editingItem.ten_chuc_vu === pos.ten_chuc_vu)) {
      resetForm()
    }

    setIsDeleting(false)
    setDeletingPosition(null)
    setActionSuccess(`Đã xóa chức vụ "${pos.ten_chuc_vu}" thành công!`)
    setTimeout(() => setActionSuccess(''), 3000)
  }

  if (!isOpen) return null

  const deletingTen = deletingPosition ? (typeof deletingPosition === 'string' ? deletingPosition : deletingPosition.ten_chuc_vu) : ''
  const candidatesCount = deletingTen ? (candidateCountByPosition[deletingTen] || 0) : 0

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header - Sạch sẽ không còn nút SQL & Đồng bộ */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0f58a7 0%, #1e40af 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Briefcase size={20} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                CÀI ĐẶT DANH MỤC CHỨC VỤ
              </h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Tạo mới, sửa tên chức vụ và tự động đồng bộ lên Supabase
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thông báo thao tác thành công nếu có */}
        {actionSuccess && (
          <div style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: 8,
            color: '#047857',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content */}
        <div style={{
          padding: 20,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {/* Form thêm / sửa tên chức vụ */}
          <form onSubmit={handleSave} style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 16
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10
            }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                {editingItem ? <Edit3 size={15} color="#0284c7" /> : <Plus size={15} color="#0f58a7" />}
                <span>{editingItem ? 'Chỉnh sửa tên chức vụ:' : 'Thêm chức vụ mới:'}</span>
              </label>

              {editingItem && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Hủy sửa
                </button>
              )}
            </div>

            {formError && (
              <div style={{
                marginBottom: 8,
                padding: '6px 10px',
                background: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: 6,
                color: '#b91c1c',
                fontSize: 12,
                fontWeight: 600
              }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="input"
                value={inputTen}
                onChange={e => setInputTen(e.target.value)}
                placeholder="Nhập tên chức vụ (VD: Thủ kho, Trưởng nhóm kho dự án...)"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600
                }}
                autoFocus
                required
              />

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: 40,
                  padding: '0 20px',
                  background: editingItem ? '#0284c7' : '#0f58a7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(15, 88, 167, 0.2)'
                }}
              >
                <Check size={16} />
                <span>{editingItem ? 'Cập nhật' : 'Lưu chức vụ'}</span>
              </button>
            </div>
          </form>

          {/* Bảng danh sách chức vụ */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Danh sách chức vụ ({positions.length})
              </span>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                * Tự động áp dụng vào bộ lọc và form tuyển dụng
              </span>
            </div>

            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0f58a7', color: '#ffffff', fontWeight: 700 }}>
                    <th style={{ padding: '10px 12px', width: 70, minWidth: 65, textAlign: 'center', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.2)' }}>STT</th>
                    <th style={{ padding: '10px 16px', borderRight: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>Tên chức vụ</th>
                    <th style={{ padding: '10px 14px', width: 100, minWidth: 90, textAlign: 'center', whiteSpace: 'nowrap' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có chức vụ nào. Hãy nhập tên chức vụ ở trên!
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos, index) => {
                      const ten = typeof pos === 'string' ? pos : pos.ten_chuc_vu
                      const isEditing = editingItem && (editingItem.id === pos.id || editingItem.ten_chuc_vu === ten)

                      return (
                        <tr 
                          key={pos.id || index}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isEditing ? '#eff6ff' : (index % 2 === 0 ? '#ffffff' : '#fcfdfd'),
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#1e293b' }}>
                            {ten}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(pos)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0284c7',
                                  cursor: 'pointer',
                                  padding: 4,
                                  borderRadius: 4
                                }}
                                title="Đổi tên chức vụ"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(pos)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: 4,
                                  borderRadius: 4
                                }}
                                title="Xóa chức vụ"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} />
            <span>Mọi thay đổi sẽ đồng bộ tức thì lên Supabase và lưu trữ vĩnh viễn.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: '#0f58a7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL VIEW XÁC NHẬN XÓA DỮ LIỆU CHỨC VỤ (Popup theo note) */}
      {/* ========================================================= */}
      {deletingPosition && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10001,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 440,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '1px solid #f87171'
          }}>
            {/* Header popup xóa */}
            <div style={{
              background: '#fee2e2',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #fecaca'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#991b1b' }}>
                    Xác nhận xóa chức vụ
                  </h4>
                  <span style={{ fontSize: 11.5, color: '#b91c1c' }}>
                    Thao tác này sẽ xóa khỏi hệ thống
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeletingPosition(null)}
                disabled={isDeleting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#991b1b',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung thông tin chức vụ cần xóa */}
            <div style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn xóa chức vụ sau khỏi danh mục không?
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 14
              }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  Tên chức vụ:
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  {deletingTen}
                </div>

                {candidatesCount > 0 && (
                  <div style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed #cbd5e1',
                    fontSize: 12,
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertTriangle size={14} />
                    <span>Hiện đang có <b>{candidatesCount} ứng viên</b> ứng tuyển chức vụ này.</span>
                  </div>
                )}
              </div>

              <div style={{
                fontSize: 12,
                color: '#64748b',
                lineHeight: 1.4
              }}>
                * Sau khi xóa, chức vụ sẽ không còn hiển thị ở danh mục tuyển dụng và sẽ được đồng bộ xóa trên Supabase.
              </div>
            </div>

            {/* Footer hành động */}
            <div style={{
              padding: '12px 18px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                type="button"
                onClick={() => setDeletingPosition(null)}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)'
                }}
              >
                <Trash2 size={15} />
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa chức vụ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
