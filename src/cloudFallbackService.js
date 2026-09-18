import { supabase } from './supabaseClient'
import { apiUrl } from './apiBase'

// Cache settings in-memory to avoid querying Supabase on every call
let cachedSettings = null
let cacheExpiresAt = 0

/**
 * Lấy cấu hình từ bảng sgc_cai_dat_api trên Supabase.
 * Tự động cache 30 giây để tối ưu hiệu năng.
 */
export async function getCloudSettings(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedSettings && now < cacheExpiresAt) {
    return cachedSettings
  }

  try {
    const { data, error } = await supabase
      .from('sgc_cai_dat_api')
      .select('id, gia_tri')

    if (error) {
      console.warn('Lỗi khi đọc bảng sgc_cai_dat_api:', error.message)
      return cachedSettings || {}
    }

    const map = {}
    ;(data || []).forEach(row => {
      if (row && row.id) {
        map[row.id] = row.gia_tri || ''
      }
    })

    cachedSettings = {
      geminiApiKey: map['GEMINI_API_KEY'] || '',
      githubToken: map['GITHUB_TOKEN'] || '',
      githubRepo: map['GITHUB_REPO'] || 'ceohomes/CV-TQT',
      githubBranch: map['GITHUB_BRANCH'] || 'main',
      githubFolder: map['GITHUB_CV_FOLDER'] || 'cvs'
    }
    cacheExpiresAt = now + 30000
    return cachedSettings
  } catch (err) {
    console.warn('Lỗi kết nối Supabase getCloudSettings:', err)
    return cachedSettings || {}
  }
}

/**
 * Chuẩn hóa tên tệp khi lưu lên GitHub
 */
function sanitizeFileName(name) {
  const ts = Date.now()
  const clean = (name || 'CV.pdf')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
  return `${ts}_${clean}`
}

/**
 * Đẩy tệp CV lên GitHub.
 * 1. Thử gọi backend /api/upload-cv-github (nếu có server Node.js).
 * 2. Nếu server không có sẵn (như khi host trên Cloudflare Pages), tự động gọi thẳng GitHub API từ trình duyệt.
 */
export async function uploadCvToGitHubUniversal({ fileName, base64Data, candidateName }) {
  if (!base64Data) {
    throw new Error('Không có dữ liệu tệp để tải lên GitHub.')
  }

  // Bước 1: Thử gọi backend nếu có
  try {
    const res = await fetch(apiUrl('/api/upload-cv-github'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, base64Data, candidateName })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success) return data
    }
    // Nếu trả về lỗi xác thực token cụ thể từ backend
    if (res.status === 401) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Token GitHub bị từ chối xác thực (401 Bad credentials).')
    }
  } catch (err) {
    // Nếu lỗi là 401 Bad credentials, ném ra ngay
    if (err.message && err.message.includes('401')) {
      throw err
    }
    // Ngược lại (ví dụ 404 do Cloudflare Pages không có /api/), chuyển sang gọi trực tiếp
    console.info('Backend /api/upload-cv-github không phản hồi, chuyển sang đẩy trực tiếp lên GitHub từ client...')
  }

  // Bước 2: Gọi trực tiếp GitHub API từ Client (hỗ trợ 100% Cloudflare Pages)
  const settings = await getCloudSettings()
  const token = settings.githubToken
  if (!token) {
    throw new Error('Chưa cấu hình GitHub Token trong Cài đặt hoặc trên Supabase.')
  }

  const repo = settings.githubRepo || 'ceohomes/CV-TQT'
  const branch = settings.githubBranch || 'main'
  const folder = settings.githubFolder || 'cvs'
  const targetFileName = sanitizeFileName(fileName)
  const filePath = folder ? `${folder}/${targetFileName}` : targetFileName

  // Tách raw base64 nếu có prefix data URL
  const commaIdx = base64Data.indexOf(',')
  const rawBase64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Upload CV: ${candidateName || targetFileName}`,
      content: rawBase64,
      branch: branch
    })
  })

  const ghData = await ghRes.json()
  if (!ghRes.ok) {
    if (ghRes.status === 401) {
      throw new Error('Token GitHub bị từ chối (401 Bad credentials). Vui lòng kiểm tra lại Token.')
    }
    throw new Error(ghData.message || 'Lỗi khi đẩy tệp lên GitHub.')
  }

  const downloadUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`
  const htmlUrl = `https://github.com/${repo}/blob/${branch}/${filePath}`

  return {
    success: true,
    fileName: targetFileName,
    path: filePath,
    downloadUrl,
    htmlUrl,
    repo,
    branch
  }
}

function normalizeParsedCv(parsedData, rawFileName = '') {
  if (!parsedData || typeof parsedData !== 'object') return parsedData
  
  const hoTen = parsedData.hoTen || parsedData.ho_ten || parsedData.name || ''
  const phone = parsedData.soDienThoai || parsedData.so_dien_thoai || parsedData.phone || parsedData.sdt || ''
  const email = parsedData.email || ''
  const ngaySinh = parsedData.ngaySinh || parsedData.ngay_sinh || parsedData.birthDate || ''
  const gioiTinh = parsedData.gioiTinh || parsedData.gioi_tinh || 'Nam'
  const cccd = parsedData.cccd || parsedData.cmnd || ''
  const queQuan = parsedData.queQuan || parsedData.que_quan || ''
  const diaChi = parsedData.diaChi || parsedData.dia_chi || queQuan || ''
  const chucVu = parsedData.chucVu || parsedData.vi_tri_ung_tuyen || parsedData.chuc_danh || 'Thủ kho'
  const duAn = parsedData.duAn || parsedData.du_an || ''
  const trinhDo = parsedData.trinhDo || parsedData.trinh_do || 'Đại học'
  const chuyenNganh = parsedData.chuyenNganh || parsedData.chuyen_nganh || ''
  
  let soNamKinhNghiem = 2
  if (parsedData.soNamKinhNghiem != null) {
    soNamKinhNghiem = Number(parsedData.soNamKinhNghiem) || 2
  } else if (parsedData.so_nam_kinh_nghiem != null) {
    const matchedNum = String(parsedData.so_nam_kinh_nghiem).match(/\d+/)
    soNamKinhNghiem = matchedNum ? Number(matchedNum[0]) : 2
  }

  let kinhNghiem = ''
  if (typeof parsedData.kinhNghiem === 'string') {
    kinhNghiem = parsedData.kinhNghiem
  } else if (typeof parsedData.kinh_nghiem === 'string') {
    kinhNghiem = parsedData.kinh_nghiem
  } else if (Array.isArray(parsedData.kinh_nghiem)) {
    kinhNghiem = parsedData.kinh_nghiem.map(k => `${k.vi_tri || ''} tại ${k.cong_ty || ''} (${k.thoi_gian || ''}): ${k.mo_ta || ''}`).join('; ')
  }

  let kyNang = ''
  if (Array.isArray(parsedData.ky_nang)) {
    kyNang = parsedData.ky_nang.join(', ')
  } else if (Array.isArray(parsedData.kyNang)) {
    kyNang = parsedData.kyNang.join(', ')
  } else if (typeof parsedData.kyNang === 'string') {
    kyNang = parsedData.kyNang
  } else if (typeof parsedData.ky_nang === 'string') {
    kyNang = parsedData.ky_nang
  }

  let chungChi = ''
  if (Array.isArray(parsedData.chung_chi)) {
    chungChi = parsedData.chung_chi.join(', ')
  } else if (typeof parsedData.chungChi === 'string') {
    chungChi = parsedData.chungChi
  } else if (typeof parsedData.chung_chi === 'string') {
    chungChi = parsedData.chung_chi
  }

  const aiDanhGia = parsedData.aiDanhGia || parsedData.danh_gia_ai || parsedData.danhGia || 'Hồ sơ đã được trích xuất bằng AI thành công.'
  let diemPhuHop = 8.5
  if (parsedData.diemPhuHop != null) {
    diemPhuHop = Number(parsedData.diemPhuHop) || 8.5
  } else if (parsedData.diem_phu_hop != null) {
    diemPhuHop = Number(parsedData.diem_phu_hop) || 8.5
  }

  return {
    hoTen: hoTen || rawFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    soDienThoai: phone,
    email,
    ngaySinh,
    gioiTinh,
    cccd,
    queQuan,
    diaChi,
    chucVu,
    duAn,
    trinhDo,
    chuyenNganh,
    soNamKinhNghiem,
    kinhNghiem,
    kyNang,
    chungChi,
    aiDanhGia,
    diemPhuHop,
    isParsedWithAI: true
  }
}

/**
 * Trích xuất CV bằng AI.
 * 1. Thử gọi backend /api/parse-cv.
 * 2. Nếu không có backend (Cloudflare Pages), tự động đọc GEMINI_API_KEY từ Supabase và gọi thẳng Gemini REST API từ Client!
 * 3. Tự động xoay vòng đa model (gemini-3.1-flash-lite -> gemini-3.8-flash -> gemini-3.6-flash) để chống 503 Spikes.
 */
export async function parseCvUniversal({ fileName, mimeType, base64Data, rawText = '' }) {
  // 1. Thử gọi backend trước
  try {
    const res = await fetch(apiUrl('/api/parse-cv'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, mimeType, base64Data, rawText })
    })

    if (res.ok) {
      const data = await res.json()
      // Chỉ chấp nhận nếu thực sự đã trích xuất bằng AI (không phải heuristic fallback thô sơ)
      if (data.success && data.source !== 'fallback_after_error' && data.source !== 'heuristic_fallback' && data.data?.isParsedWithAI) {
        return data
      }
    }
  } catch (err) {
    console.info('Backend /api/parse-cv không có sẵn, chuyển sang gọi trực tiếp Gemini từ client...')
  }

  // 2. Chế độ trực tiếp từ Client (Dành cho Cloudflare Pages & dự phòng)
  const settings = await getCloudSettings()
  const apiKey = settings.geminiApiKey

  // Kiểm tra tính hợp lệ của API Key: Phải là định dạng AIzaSy...
  if (!apiKey || !apiKey.startsWith('AIzaSy')) {
    console.warn('GEMINI_API_KEY trong Supabase chưa đúng định dạng (phải bắt đầu bằng AIzaSy...).')
    return {
      success: false,
      needsValidKey: true,
      error: 'GEMINI_API_KEY trong Supabase chưa đúng định dạng chuẩn (phải bắt đầu bằng AIzaSy...). Vui lòng kiểm tra lại trong Cài đặt.'
    }
  }

  // Thử trích xuất text từ PDF ngay trên client nếu có thể để tăng tốc độ và độ chính xác
  let clientExtractedText = rawText || ''
  const isPdf = mimeType?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')
  if (!clientExtractedText && base64Data && isPdf && typeof window !== 'undefined') {
    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs')
      const commaIdx = base64Data.indexOf(',')
      const rawB64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data
      const binaryStr = window.atob(rawB64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const loadingTask = pdfjsLib.getDocument({ data: bytes })
      const doc = await loadingTask.promise
      let textBuf = ''
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p)
        const textContent = await page.getTextContent()
        textBuf += textContent.items.map(it => it.str || '').join(' ') + '\n'
      }
      if (textBuf.trim().length > 40) {
        clientExtractedText = textBuf.trim()
      }
    } catch (e) {
      console.warn('Không thể trích xuất text PDF từ client, dùng inlineData gửi tới Gemini:', e)
    }
  }

  // Gọi trực tiếp Gemini qua REST API với xoay vòng model
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']
  let lastError = null

  const promptText = `Bạn là chuyên gia nhân sự tuyển dụng thủ kho tập đoàn SGC (SGC Construction & Engineering).
Nhiệm vụ: Trích xuất toàn bộ thông tin ứng viên từ hồ sơ này thành JSON chuẩn:
{
  "hoTen": "Họ và tên đầy đủ viết hoa",
  "soDienThoai": "Số điện thoại liên hệ",
  "email": "Email liên hệ",
  "ngaySinh": "DD/MM/YYYY hoặc YYYY",
  "gioiTinh": "Nam hoặc Nữ",
  "cccd": "Số CCCD/CMND nếu có",
  "queQuan": "Quê quán / Tỉnh thành",
  "diaChi": "Địa chỉ hiện tại",
  "chucVu": "Vị trí ứng tuyển (Thủ kho, Quản lý kho, Thủ kho hiện trường...)",
  "trinhDo": "Trình độ học vấn (Đại học, Cao đẳng, Trung cấp...)",
  "chuyenNganh": "Chuyên ngành đào tạo",
  "soNamKinhNghiem": 3,
  "kinhNghiem": "Tóm tắt kinh nghiệm làm việc, các đơn vị từng làm và vị trí",
  "kyNang": "Các kỹ năng chuyên môn chính (Excel, SAP, kiểm kê xuất nhập tồn...)",
  "chungChi": "Chứng chỉ nghề, ATLĐ nếu có",
  "aiDanhGia": "Đánh giá ngắn gọn 1-2 câu về mức độ phù hợp với vị trí Thủ kho SGC",
  "diemPhuHop": 9.0
}
CHÚ Ý QUAN TRỌNG: Quét kỹ cả các khung màu, sidebar, thông tin cạnh ảnh đại diện. Nhận diện số điện thoại, email, địa chỉ ngay cả khi đi kèm icon mà không có nhãn chữ.
Chỉ trả về chuỗi JSON thuần túy, không bọc markdown \`\`\`json.`

  const commaIdx = (base64Data || '').indexOf(',')
  const cleanBase64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data

  let parts = []
  if (clientExtractedText && clientExtractedText.length > 40) {
    parts = [
      { text: `${promptText}\n\n--- NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ CV (${fileName}) ---\n${clientExtractedText}\n--- HẾT NỘI DUNG ---` }
    ]
  } else if (cleanBase64 && (isPdf || mimeType?.includes('image'))) {
    parts = [
      {
        inlineData: {
          mimeType: isPdf ? 'application/pdf' : (mimeType || 'image/jpeg'),
          data: cleanBase64
        }
      },
      { text: promptText }
    ]
  } else {
    parts = [
      { text: `${promptText}\n\nTên tệp: ${fileName}` }
    ]
  }

  for (const model of modelsToTry) {
    try {
      console.log(`Đang gọi Gemini trực tiếp với model: ${model}...`)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      })

      if (!geminiRes.ok) {
        const errJson = await geminiRes.json().catch(() => ({}))
        console.warn(`Model ${model} thất bại (${geminiRes.status}):`, errJson.error?.message)
        lastError = new Error(errJson.error?.message || `Lỗi Gemini API: ${geminiRes.status}`)
        continue
      }

      const geminiJson = await geminiRes.json()
      const textOutput = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      let cleanJson = textOutput.trim()
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      }
      const parsedData = JSON.parse(cleanJson)
      const normalized = normalizeParsedCv(parsedData, fileName)

      return {
        success: true,
        data: normalized,
        source: `${model}-direct`
      }
    } catch (modelErr) {
      console.warn(`Lỗi khi gọi model ${model}:`, modelErr.message)
      lastError = modelErr
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Tất cả các mô hình Gemini đều không phản hồi.'
  }
}
