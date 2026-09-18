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

/**
 * Trích xuất CV bằng AI.
 * 1. Thử gọi backend /api/parse-cv.
 * 2. Nếu không có backend (Cloudflare Pages), tự động đọc GEMINI_API_KEY từ Supabase và gọi thẳng Gemini REST API từ Client!
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
      if (data.success && data.source !== 'fallback_after_error') {
        return data
      }
    }
  } catch (err) {
    console.info('Backend /api/parse-cv không có sẵn, chuyển sang gọi trực tiếp Gemini từ client...')
  }

  // 2. Chế độ trực tiếp từ Client (Dành cho Cloudflare Pages)
  const settings = await getCloudSettings()
  const apiKey = settings.geminiApiKey

  // Kiểm tra tính hợp lệ của API Key: Phải là định dạng AIzaSy...
  if (!apiKey || !apiKey.startsWith('AIzaSy')) {
    console.warn('GEMINI_API_KEY trong Supabase chưa đúng định dạng (phải bắt đầu bằng AIzaSy...).')
    return {
      success: false,
      needsValidKey: true,
      error: 'GEMINI_API_KEY trong Supabase chưa đúng định dạng chuẩn (phải bắt đầu bằng AIzaSy...). Vui lòng tạo API Key tại aistudio.google.com và lưu vào Cài đặt.'
    }
  }

  // Gọi trực tiếp Gemini qua REST API
  try {
    const commaIdx = (base64Data || '').indexOf(',')
    const cleanBase64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data
    const isImageOrPdf = base64Data && (mimeType?.includes('pdf') || mimeType?.includes('image'))

    const promptText = `Bạn là chuyên gia nhân sự tuyển dụng thủ kho tập đoàn SGC. Hãy phân tích CV này và trích xuất JSON:
{
  "hoTen": "Họ và tên ứng viên",
  "soDienThoai": "Số điện thoại",
  "email": "Email",
  "ngaySinh": "DD/MM/YYYY",
  "gioiTinh": "Nam hoặc Nữ",
  "cccd": "Số CCCD",
  "queQuan": "Quê quán / Tỉnh thành",
  "diaChi": "Địa chỉ hiện tại",
  "chucVu": "Vị trí ứng tuyển (Thủ kho hiện trường, Quản lý kho, Thủ kho tổng...)",
  "trinhDo": "Trình độ học vấn cao nhất (Đại học, Cao đẳng, Trung cấp...)",
  "chuyenNganh": "Chuyên ngành đào tạo",
  "soNamKinhNghiem": 2,
  "kinhNghiem": "Tóm tắt các nơi từng làm việc, số năm, vị trí",
  "kyNang": "Các kỹ năng chuyên môn chính, cách nhau bởi dấu phẩy",
  "chungChi": "Chứng chỉ nghề, ATLĐ nếu có",
  "aiDanhGia": "Đánh giá ngắn gọn 1-2 câu về mức độ phù hợp",
  "diemPhuHop": 8.5
}
Chỉ trả về duy nhất chuỗi JSON hợp lệ, không bọc markdown.`

    const parts = []
    if (isImageOrPdf && cleanBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'application/pdf',
          data: cleanBase64
        }
      })
    }
    parts.push({ text: promptText })

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    })

    if (!geminiRes.ok) {
      const errJson = await geminiRes.json().catch(() => ({}))
      throw new Error(errJson.error?.message || `Lỗi Gemini API: ${geminiRes.status}`)
    }

    const geminiJson = await geminiRes.json()
    const textOutput = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Parse JSON từ output
    let cleanJson = textOutput.trim()
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    }
    const parsedData = JSON.parse(cleanJson)

    return {
      success: true,
      data: parsedData,
      source: 'gemini-3.6-flash-direct'
    }
  } catch (directErr) {
    console.error('Lỗi khi gọi Gemini trực tiếp:', directErr)
    return {
      success: false,
      error: directErr.message
    }
  }
}
