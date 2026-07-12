export function trangThaiBadgeClass(trangThai) {
  switch (trangThai) {
    case 'Đang làm việc': return 'badge-green'
    case 'Nghỉ phép': return 'badge-yellow'
    case 'Đã nghỉ việc': return 'badge-red'
    default: return 'badge-gray'
  }
}

export function chucVuBadgeClass(chucVu) {
  switch (chucVu) {
    case 'Thủ kho trưởng':
    case 'Thủ kho trưởng hiện trường':
    case 'Thủ kho nhập liệu':
      return 'badge-blue'
    case 'Thủ kho':
    case 'Thủ kho hiện trường':
      return 'badge-purple'
    case 'Trưởng nhóm kho':
    case 'Trưởng nhóm Kho':
    case 'Trưởng nhóm kho dự án':
      return 'badge-green'
    default: return 'badge-gray'
  }
}

export function danhGiaBadgeClass(dg) {
  switch (dg) {
    case 'Xuất sắc': return 'badge-green'
    case 'Tốt': return 'badge-blue'
    case 'Khá': return 'badge-yellow'
    default: return 'badge-gray'
  }
}

export function formatVND(soTrieu) {
  return `${soTrieu.toLocaleString('vi-VN')} triệu`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date('2026-07-07')
  const target = new Date(dateStr)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export const AVATAR_COLORS = ['#0f58a7', '#0891b2', '#7c3aed', '#db2777', '#d97706', '#059669', '#dc2626', '#083e96']

export function avatarColor(seedStr) {
  let sum = 0
  for (let i = 0; i < seedStr.length; i++) sum += seedStr.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function initials(hoTen) {
  const parts = hoTen.trim().split(' ')
  return parts[parts.length - 1][0].toUpperCase()
}
