export function trangThaiBadgeClass(trangThai) {
  switch (trangThai) {
    case 'Đang làm việc': return 'badge-green'
    case 'Nghỉ phép': return 'badge-yellow'
    case 'Đã nghỉ việc': return 'badge-red'
    default: return 'badge-gray'
  }
}

export function tuyenDungBadgeClass(trangThai) {
  switch (trangThai) {
    case 'Đã tuyển dụng': return 'badge-green'
    case 'Đạt - Chờ cấp mã NV': return 'badge-purple'
    case 'Đang phỏng vấn': return 'badge-yellow'
    case 'Tiếp nhận CV': return 'badge-blue'
    case 'Không đạt': return 'badge-red'
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

export function formatDate(dateVal) {
  if (!dateVal) return '—'
  const str = String(dateVal).trim()
  if (!str || str === '—') return '—'

  // If already dd/mm/yyyy or d/m/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/')
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`
  }

  // If yyyy-mm-dd or yyyy/mm/dd
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }

  // If dd-mm-yyyy
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }

  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  return str
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
