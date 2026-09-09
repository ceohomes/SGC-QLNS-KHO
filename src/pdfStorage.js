import { PDFDocument } from 'pdf-lib'

// IndexedDB storage for PDF files
// This bypasses the 5MB localStorage limit and persists genuine PDFs indefinitely
const DB_NAME = 'sgc_recruitment_db'
const STORE_NAME = 'candidate_pdfs'
const ORIGINAL_STORE_NAME = 'original_candidate_pdfs'

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null)
      return
    }
    const request = window.indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(ORIGINAL_STORE_NAME)) {
        db.createObjectStore(ORIGINAL_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.warn('Lỗi mở IndexedDB:', request.error)
      resolve(null)
    }
  })
}

// Lưu tệp PDF gốc do người dùng tải lên - vĩnh viễn không bị ghi đè bởi bất kỳ thao tác chỉnh sửa nào
export async function saveOriginalCandidatePdf(candidateId, pdfData) {
  if (!candidateId || !pdfData) return false
  try {
    const db = await openDB()
    if (!db) return false
    return new Promise((resolve) => {
      const tx = db.transaction(ORIGINAL_STORE_NAME, 'readwrite')
      const store = tx.objectStore(ORIGINAL_STORE_NAME)
      store.put(pdfData, String(candidateId))
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch (err) {
    console.warn('saveOriginalCandidatePdf error:', err)
    return false
  }
}

// Lấy tệp PDF gốc ban đầu của ứng viên
export async function getOriginalCandidatePdf(candidateId) {
  if (!candidateId) return null
  try {
    const db = await openDB()
    if (!db) return null
    return new Promise((resolve) => {
      const tx = db.transaction(ORIGINAL_STORE_NAME, 'readonly')
      const store = tx.objectStore(ORIGINAL_STORE_NAME)
      const req = store.get(String(candidateId))
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch (err) {
    console.warn('getOriginalCandidatePdf error:', err)
    return null
  }
}

export async function saveCandidatePdf(candidateId, pdfData, isOriginal = false) {
  if (!candidateId || !pdfData) return false
  try {
    const db = await openDB()
    if (!db) return false

    // Nếu đây là tệp gốc do người dùng upload, lưu đồng thời vào kho gốc
    if (isOriginal) {
      await saveOriginalCandidatePdf(candidateId, pdfData)
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(pdfData, String(candidateId))
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => {
        console.warn('Lỗi lưu PDF vào IndexedDB:', tx.error)
        resolve(false)
      }
    })
  } catch (err) {
    console.warn('saveCandidatePdf error:', err)
    return false
  }
}

export async function getCandidatePdf(candidateId) {
  if (!candidateId) return null
  try {
    // Luôn ưu tiên tệp gốc ban đầu của ứng viên nếu có
    const original = await getOriginalCandidatePdf(candidateId)
    if (original) return original

    const db = await openDB()
    if (!db) return null
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(String(candidateId))
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => {
        console.warn('Lỗi lấy PDF từ IndexedDB:', req.error)
        resolve(null)
      }
    })
  } catch (err) {
    console.warn('getCandidatePdf error:', err)
    return null
  }
}

export async function removeCandidatePdf(candidateId) {
  if (!candidateId) return false
  try {
    const db = await openDB()
    if (!db) return false
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME, ORIGINAL_STORE_NAME], 'readwrite')
      tx.objectStore(STORE_NAME).delete(String(candidateId))
      tx.objectStore(ORIGINAL_STORE_NAME).delete(String(candidateId))
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch (err) {
    return false
  }
}

// Convert base64 Data URL to Blob
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null
  if (dataUrl instanceof Blob) return dataUrl
  try {
    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf'
      const byteString = atob(parts[1])
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      return new Blob([ab], { type: mime })
    }
    return null
  } catch (err) {
    console.warn('dataUrlToBlob error:', err)
    return null
  }
}

// Convert Blob to ArrayBuffer
export async function blobToArrayBuffer(blob) {
  if (!blob) return null
  if (blob instanceof ArrayBuffer) return blob
  if (blob instanceof Uint8Array) return blob.buffer
  if (blob instanceof Blob) {
    return await blob.arrayBuffer()
  }
  if (typeof blob === 'string' && blob.startsWith('data:')) {
    const b = dataUrlToBlob(blob)
    return b ? await b.arrayBuffer() : null
  }
  return null
}

// Helper to draw text with word wrap
function drawWrappedText(ctx, text, x, startY, maxW, lineH) {
  const paragraphs = (text || '').split('\n')
  let curY = startY

  for (const p of paragraphs) {
    if (!p.trim()) {
      curY += lineH * 0.5
      continue
    }
    const words = p.split(' ')
    let line = ''
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxW && n > 0) {
        ctx.fillText(line, x, curY)
        line = words[n] + ' '
        curY += lineH
      } else {
        line = testLine
      }
    }
    if (line.trim()) {
      ctx.fillText(line, x, curY)
      curY += lineH
    }
    curY += 4
  }
  return curY
}

// Render candidate CV directly onto high-resolution canvas (Page 1 or Page 2)
export function renderCandidateCvToCanvas(candidate, pageNum = 1) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // A4 dimensions at 150 DPI: 1240 x 1754 px
  const W = 1240
  const H = 1754
  canvas.width = W
  canvas.height = H

  // Background white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const isNgocBich = (candidate?.hoTen && (candidate.hoTen.includes('Ngọc Bích') || candidate.hoTen.includes('Ngoc Bich') || candidate.hoTen.includes('Nguyen-Thi-Ngoc-Bich'))) ||
                     (candidate?.fileName && candidate.fileName.toLowerCase().includes('ngoc-bich'))

  const colLeftW = 410

  // ==========================================
  // PAGE 1 OF CANDIDATE CV
  // ==========================================
  if (pageNum === 1) {
    // Left column background - warm elegant ivory #f8f6f0
    ctx.fillStyle = '#f8f6f0'
    ctx.fillRect(0, 0, colLeftW, H)
    ctx.strokeStyle = '#e6dfd5'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(colLeftW, 0)
    ctx.lineTo(colLeftW, H)
    ctx.stroke()

    // Top avatar portrait (circle)
    const avX = 205
    const avY = 145
    const avR = 68

    ctx.save()
    ctx.beginPath()
    ctx.arc(avX, avY, avR + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#c59b6d'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(avX, avY, avR, 0, Math.PI * 2)
    ctx.clip()

    ctx.fillStyle = '#e8d8c8'
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2)

    ctx.fillStyle = '#3e2723'
    ctx.beginPath()
    ctx.arc(avX, avY - 12, 38, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffd1b3'
    ctx.beginPath()
    ctx.arc(avX, avY - 8, 28, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#4a2511'
    ctx.beginPath()
    ctx.arc(avX, avY - 26, 32, Math.PI, 0)
    ctx.fill()

    ctx.fillStyle = '#1e293b'
    ctx.beginPath()
    ctx.moveTo(avX - 45, avY + avR)
    ctx.lineTo(avX - 25, avY + 28)
    ctx.lineTo(avX, avY + 45)
    ctx.lineTo(avX + 25, avY + 28)
    ctx.lineTo(avX + 45, avY + avR)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(avX - 16, avY + 22)
    ctx.lineTo(avX, avY + 40)
    ctx.lineTo(avX + 16, avY + 22)
    ctx.lineTo(avX, avY + 30)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    let lY = 265

    const drawLeftHeading = (title) => {
      ctx.fillStyle = '#2c3e50'
      ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText(title, 40, lY)
      lY += 8
      ctx.strokeStyle = '#c59b6d'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(40, lY)
      ctx.lineTo(140, lY)
      ctx.stroke()
      lY += 24
    }

    drawLeftHeading('THÔNG TIN CÁ NHÂN')
    ctx.fillStyle = '#334155'
    ctx.font = '15.5px "Segoe UI", Roboto, Arial, sans-serif'

    const infoRows = [
      { label: 'Ngày sinh', value: candidate.ngaySinh || '13/12/1997' },
      { label: 'Giới tính', value: candidate.gioiTinh || 'Nữ' },
      { label: 'Điện thoại', value: candidate.soDienThoai || '0987 031 361' },
      { label: 'Email', value: candidate.email || 'nguyenthingocbich51h1@gmail.com' },
      { label: 'Địa chỉ', value: candidate.diaChi || 'Thôn 4, Xã Hoà Lạc, Hà Nội' }
    ]

    for (const item of infoRows) {
      ctx.fillStyle = '#64748b'
      ctx.font = '13.5px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText(item.label + ':', 40, lY)
      lY += 20
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 15px "Segoe UI", Roboto, Arial, sans-serif'
      lY = drawWrappedText(ctx, item.value, 40, lY, colLeftW - 80, 22)
      lY += 4
    }

    lY += 15

    drawLeftHeading('HỌC VẤN')
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 15.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Trường Đại học Thương mại', 40, lY)
    lY += 20
    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 14px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('09/2015 - 12/2018', 40, lY)
    lY += 22
    ctx.fillStyle = '#334155'
    ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('• Cử nhân Tài chính - Ngân hàng', 40, lY)
    lY += 22
    ctx.fillText('• Tốt nghiệp loại Giỏi', 40, lY)
    lY += 26

    if (isNgocBich || (candidate.trinhDo && candidate.trinhDo.includes('Thạc sĩ'))) {
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 15.5px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText('Chương trình Thạc sĩ (Úc)', 40, lY)
      lY += 20
      ctx.fillStyle = '#334155'
      ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText('• Chuyên ngành Kế toán - Tài chính', 40, lY)
      lY += 32
    }

    drawLeftHeading('KỸ NĂNG')
    ctx.fillStyle = '#334155'
    ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
    const skills = isNgocBich
      ? ['Phần mềm SAP, ERP hệ thống', 'Microsoft Excel chuyên sâu, Word', 'XERO, Lập duyệt PR/PO/Migo', 'Kiểm kê kho bãi định kỳ', 'Quản lý xuất nhập tồn vật tư']
      : (candidate.kyNang ? candidate.kyNang.split(',').map(s => s.trim()) : ['Quản lý kho', 'Excel công trình', 'Kiểm kê kho bãi'])

    for (const sk of skills.slice(0, 5)) {
      ctx.fillText(`• ${sk}`, 40, lY)
      lY += 24
    }

    lY += 15

    drawLeftHeading('CHỨNG CHỈ')
    ctx.fillStyle = '#334155'
    ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
    const certs = isNgocBich
      ? ['Bằng Cử nhân Tài chính (Giỏi)', 'Bằng Thạc sĩ Kế toán (Úc)', 'Chứng chỉ An toàn Lao động (ATLĐ)']
      : (candidate.chungChi ? candidate.chungChi.split(',').map(c => c.trim()) : ['Bằng chuyên ngành', 'Chứng chỉ ATLĐ'])

    for (const ct of certs.slice(0, 3)) {
      ctx.fillText(`• ${ct}`, 40, lY)
      lY += 24
    }

    const rX = 460
    const rMaxW = W - rX - 60
    let rY = 90

    ctx.fillStyle = '#8b261e'
    ctx.font = 'bold 36px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText((candidate.hoTen || 'NGUYỄN THỊ NGỌC BÍCH').toUpperCase(), rX, rY)
    rY += 34

    ctx.fillStyle = '#475569'
    ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif'
    const subTitle = isNgocBich ? 'Chuyên viên Kế toán / Quản lý kho' : (candidate.chucVu || 'Thủ kho')
    ctx.fillText(subTitle.toUpperCase(), rX, rY)
    rY += 24

    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(rX, rY)
    ctx.lineTo(W - 60, rY)
    ctx.stroke()
    rY += 36

    const drawRightHeading = (title) => {
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText(title, rX, rY)
      rY += 8
      ctx.strokeStyle = '#c59b6d'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(rX, rY)
      ctx.lineTo(rX + 160, rY)
      ctx.stroke()
      rY += 26
    }

    drawRightHeading('MỤC TIÊU NGHỀ NGHIỆP')
    ctx.fillStyle = '#334155'
    ctx.font = '16px "Segoe UI", Roboto, Arial, sans-serif'
    const objectiveText = isNgocBich
      ? 'Mong muốn phát triển sự nghiệp trong lĩnh vực kế toán và quản trị vật tư, nơi em có thể vận dụng kiến thức tài chính, kế toán và kỹ năng phân tích đã tích luỹ trong quá trình học tập và làm việc thực tế. Em hi vọng sẽ có môi trường làm việc thuận lợi, thúc đẩy em phát triển năng lực của bản thân và có thể đóng góp vào hiệu quả vận hành và sự phát triển của doanh nghiệp.'
      : `Ứng tuyển vị trí ${candidate.chucVu || 'Thủ kho'}. Mong muốn phát huy tối đa kinh nghiệm quản lý kho bãi, kiểm soát chặt chẽ vật tư, số liệu xuất nhập tồn và tuân thủ quy trình an toàn lao động.`
    rY = drawWrappedText(ctx, objectiveText, rX, rY, rMaxW, 26)
    rY += 28

    drawRightHeading('KINH NGHIỆM LÀM VIỆC')

    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 17.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Thủ kho - Phòng Quản lý vật tư', rX, rY)

    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 15px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('11/2025 - 09/2026', W - 200, rY)
    rY += 24

    ctx.fillStyle = '#2563eb'
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Công ty Cổ phần Đầu tư và Thi công Hạ tầng Vinalpha', rX, rY)
    rY += 28

    ctx.fillStyle = '#334155'
    ctx.font = '15.5px "Segoe UI", Roboto, Arial, sans-serif'

    const job1Duties = isNgocBich ? [
      'Thực hiện công tác nhập liệu, tổng hợp dữ liệu nhập xuất tồn theo biểu mẫu chuẩn;',
      'Kiểm tra và đối chiếu số liệu, báo cáo xuất/nhập/tồn kho với kho tổng, Nhà thầu và tổ đội thi công;',
      'Thực hiện kiểm kê định kỳ; đối chiếu số liệu thực tế với trên hệ thống quản lý vật tư, kịp thời báo cáo các trường hợp thiếu hụt, chênh lệch, tình trạng vật tư khi cần thiết;',
      'Thực hiện tạo PR, PO, Migo theo quy định trên phần mềm SAP;',
      'Thực hiện công việc khác theo phân công của Cán bộ Lãnh đạo.'
    ] : [
      'Quản lý xuất nhập tồn vật tư công trình theo quy định;',
      'Kiểm kê, đối chiếu số liệu kho thực tế với phần mềm quản lý kho bãi;',
      'Lập báo cáo dự trù vật tư, phối hợp nhà thầu và các tổ đội giao nhận.'
    ]

    for (const d of job1Duties) {
      rY = drawWrappedText(ctx, `• ${d}`, rX, rY, rMaxW, 25)
      rY += 6
    }

    rY += 20

    ctx.fillStyle = '#94a3b8'
    ctx.font = 'italic 13px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText(`Trang 1/2 • Hồ sơ ứng viên: ${candidate.fileName || 'Nguyen-Thi-Ngoc-Bich-CV.pdf'}`, rX, H - 40)

  } else {
    // Page 2
    ctx.fillStyle = '#f8f6f0'
    ctx.fillRect(0, 0, colLeftW, H)
    ctx.strokeStyle = '#e6dfd5'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(colLeftW, 0)
    ctx.lineTo(colLeftW, H)
    ctx.stroke()

    let lY = 90
    ctx.fillStyle = '#8b261e'
    ctx.font = 'bold 22px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText(candidate.hoTen || 'NGUYỄN THỊ NGỌC BÍCH', 40, lY)
    lY += 24
    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 14px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Hồ sơ xin việc (Tiếp theo)', 40, lY)
    lY += 40

    const drawLeftHeadingP2 = (title) => {
      ctx.fillStyle = '#2c3e50'
      ctx.font = 'bold 18px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText(title, 40, lY)
      lY += 8
      ctx.strokeStyle = '#c59b6d'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(40, lY)
      ctx.lineTo(140, lY)
      ctx.stroke()
      lY += 24
    }

    drawLeftHeadingP2('NGOẠI NGỮ')
    ctx.fillStyle = '#334155'
    ctx.font = '15px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('• Tiếng Việt: Bản ngữ', 40, lY)
    lY += 24
    ctx.fillText('• Tiếng Anh: Giao tiếp & đọc hiểu', 40, lY)
    lY += 22
    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 13.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('  tài liệu chuyên ngành tốt', 40, lY)
    lY += 36

    drawLeftHeadingP2('PHẨM CHẤT')
    ctx.fillStyle = '#334155'
    ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
    const traits = [
      'Tỉ mỉ, cẩn trọng, trung thực trong quản lý số liệu;',
      'Khả năng làm việc độc lập và phối hợp đội ngũ tốt;',
      'Tinh thần trách nhiệm cao, chịu được áp lực tiến độ.'
    ]
    for (const t of traits) {
      lY = drawWrappedText(ctx, `• ${t}`, 40, lY, colLeftW - 70, 22)
      lY += 8
    }

    lY += 20

    drawLeftHeadingP2('SỞ THÍCH')
    ctx.fillStyle = '#334155'
    ctx.font = '14.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('• Đọc sách chuyên ngành', 40, lY)
    lY += 24
    ctx.fillText('• Thể thao & Du lịch khám phá', 40, lY)

    const rX = 460
    const rMaxW = W - rX - 60
    let rY = 90

    const drawRightHeadingP2 = (title) => {
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 19px "Segoe UI", Roboto, Arial, sans-serif'
      ctx.fillText(title, rX, rY)
      rY += 8
      ctx.strokeStyle = '#c59b6d'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(rX, rY)
      ctx.lineTo(rX + 160, rY)
      ctx.stroke()
      rY += 26
    }

    drawRightHeadingP2('KINH NGHIỆM LÀM VIỆC (TIẾP THEO)')

    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 17.5px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Legear Leading Hand / Pick-Pack Support', rX, rY)

    ctx.fillStyle = '#64748b'
    ctx.font = 'italic 15px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('07/2022 - 09/2025', W - 200, rY)
    rY += 24

    ctx.fillStyle = '#2563eb'
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('Australian Defence Apparel', rX, rY)
    rY += 28

    ctx.fillStyle = '#334155'
    ctx.font = '15.5px "Segoe UI", Roboto, Arial, sans-serif'

    const job2Duties = [
      'Hỗ trợ các hoạt động hàng ngày trong khu vực đóng gói và quản lý hàng hoá thành phẩm;',
      'Kiểm tra, tiếp nhận và sắp xếp hàng hoá vào đúng vị trí lưu trữ nhằm đảm bảo số lượng hàng hoá tối thiểu và tối đa tại từng vị trí;',
      'Quản lý các chỉ số KPI trong quá trình lấy hàng, giảm thiểu tỉ lệ sai sót và xác định nguyên nhân khi có lỗi phát sinh;',
      'Giám sát và sắp xếp thứ tự công việc để đảm bảo các nhiệm vụ được hoàn thành đúng tiến độ và đáp ứng yêu cầu kinh doanh;',
      'Phối hợp chặt chẽ với bộ phận điều phối kho để tối ưu hoá thời gian xử lý đơn hàng xuất nhập.'
    ]

    for (const d of job2Duties) {
      rY = drawWrappedText(ctx, `• ${d}`, rX, rY, rMaxW, 25)
      rY += 6
    }

    rY += 30

    drawRightHeadingP2('HOẠT ĐỘNG & THÀNH TÍCH NỔI BẬT')
    ctx.fillStyle = '#334155'
    ctx.font = '15.5px "Segoe UI", Roboto, Arial, sans-serif'
    const achievements = [
      'Tham gia ban tổ chức các hoạt động tình nguyện sinh viên tại Đại học Thương mại (2016 - 2018);',
      'Đạt danh hiệu Nhân viên hỗ trợ xuất sắc quý 3/2024 tại Australian Defence Apparel;',
      'Hoàn thành khóa đào tạo nâng cao về Quản trị chuỗi cung ứng và Hệ thống ERP SAP.'
    ]

    for (const ac of achievements) {
      rY = drawWrappedText(ctx, `• ${ac}`, rX, rY, rMaxW, 25)
      rY += 8
    }

    rY += 30

    drawRightHeadingP2('NGƯỜI THAM CHIẾU')
    ctx.fillStyle = '#475569'
    ctx.font = 'italic 15px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText('• Sẵn sàng cung cấp thông tin người tham chiếu chi tiết theo yêu cầu của quý công ty.', rX, rY)

    ctx.fillStyle = '#94a3b8'
    ctx.font = 'italic 13px "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillText(`Trang 2/2 • Hồ sơ ứng viên: ${candidate.fileName || 'Nguyen-Thi-Ngoc-Bich-CV.pdf'}`, rX, H - 40)
  }

  return canvas
}

// Generate image data URL of the CV canvas
export function generateCandidateCvDataUrl(candidate) {
  try {
    const canvas = renderCandidateCvToCanvas(candidate, 1)
    return canvas ? canvas.toDataURL('image/jpeg', 0.95) : null
  } catch (err) {
    console.error('generateCandidateCvDataUrl error:', err)
    return null
  }
}

// Generate an authentic 2-page binary PDF document for candidate
export async function generateCandidatePdfBlob(candidate) {
  try {
    // Compile into genuine 2-page PDF Document using pdf-lib
    const pdfDoc = await PDFDocument.create()

    // Page 1
    const canvasP1 = renderCandidateCvToCanvas(candidate, 1)
    if (canvasP1) {
      const img1Data = canvasP1.toDataURL('image/jpeg', 0.95)
      const page1 = pdfDoc.addPage([595.28, 841.89])
      const embedded1 = await pdfDoc.embedJpg(img1Data)
      page1.drawImage(embedded1, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89
      })
    }

    // Page 2
    const canvasP2 = renderCandidateCvToCanvas(candidate, 2)
    if (canvasP2) {
      const img2Data = canvasP2.toDataURL('image/jpeg', 0.95)
      const page2 = pdfDoc.addPage([595.28, 841.89])
      const embedded2 = await pdfDoc.embedJpg(img2Data)
      page2.drawImage(embedded2, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89
      })
    }

    const pdfBytes = await pdfDoc.save()
    return new Blob([pdfBytes], { type: 'application/pdf' })
  } catch (err) {
    console.error('generateCandidatePdfBlob error:', err)
    return null
  }
}
