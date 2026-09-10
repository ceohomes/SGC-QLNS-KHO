import { useEffect, useRef } from 'react'

// Ngăn xếp dùng chung để khi có nhiều modal/sheet mở lồng nhau, bấm ESC chỉ
// đóng modal đang mở TRÊN CÙNG (mở sau cùng) trước, giống hành vi click nút "Đóng".
let modalStack = []

/**
 * Cho phép đóng modal/sheet bằng phím ESC, tương đương bấm nút "Đóng"/"X".
 * @param {Function} onEscape Hàm gọi khi bấm ESC (ví dụ: onClose, onCancel...)
 * @param {boolean} isActive Modal có đang mở hay không (mặc định true nếu component chỉ được render khi mở)
 */
export default function useEscapeKey(onEscape, isActive = true) {
  const idRef = useRef(null)
  if (idRef.current === null) {
    idRef.current = Symbol('modal')
  }

  useEffect(() => {
    if (!isActive || typeof onEscape !== 'function') return undefined

    const id = idRef.current
    modalStack.push(id)

    function handleKeyDown(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc' && e.keyCode !== 27) return
      // Chỉ modal đang mở trên cùng (mở sau cùng) mới xử lý phím ESC
      if (modalStack[modalStack.length - 1] !== id) return
      e.preventDefault()
      onEscape()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      modalStack = modalStack.filter((x) => x !== id)
    }
  }, [onEscape, isActive])
}
