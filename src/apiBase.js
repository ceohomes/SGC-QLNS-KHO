// ---------------------------------------------------------------------------
// Địa chỉ gốc của backend API (server.ts).
//
// Khi frontend và backend chạy CHUNG một nơi (ví dụ chạy `npm run dev` / `npm start`
// ở local, hoặc host cả app trên một dịch vụ chạy Node như Render/Railway), để trống
// biến VITE_API_BASE_URL — mọi lời gọi /api/... sẽ tự động gọi cùng domain hiện tại.
//
// Khi frontend host trên Cloudflare Pages (chỉ phục vụ file tĩnh, KHÔNG chạy được
// server Express) còn backend (server.ts) được deploy riêng ở một dịch vụ chạy Node
// (Render, Railway...), hãy đặt VITE_API_BASE_URL = đường dẫn tới backend đó,
// ví dụ: https://ten-app-cua-ban.onrender.com
// ---------------------------------------------------------------------------
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

// Ghép base URL backend vào một đường dẫn API tương đối, ví dụ apiUrl('/api/parse-cv').
export function apiUrl(path) {
  if (!path.startsWith('/')) path = `/${path}`
  return `${API_BASE}${path}`
}
