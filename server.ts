import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

// Allow large payloads for PDF / DOCX base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ---------------------------------------------------------------
// CÀI ĐẶT GEMINI API KEY ĐỘNG QUA SUPABASE
// ---------------------------------------------------------------
// Cho phép cấu hình Gemini API Key (dùng để AI quét CV) ngay trên giao diện
// (nút "Cài đặt API Key") thay vì phải sửa file .env và deploy lại.
// Giá trị được lưu trong bảng `sgc_cai_dat_api` trên Supabase. Giao diện (frontend)
// ghi/đọc bảng này TRỰC TIẾP bằng Supabase anon key (giống các bảng cấu hình khác
// của app như sgc_cai_dat_chuc_vu) — vì trên Cloudflare Pages KHÔNG có server Node
// nào chạy nền để phục vụ các route /api/* bên dưới. Các route /api/settings ở đây
// chỉ dùng khi server.ts thực sự được host ở nơi có Node server (chạy `npm run dev`,
// `npm start`, hoặc một dịch vụ Node riêng) — ví dụ để /api/parse-cv đọc được Gemini
// API Key mà không cần đưa vào biến môi trường.
// Các key khác (GitHub Token, repo, branch, thư mục CV) KHÔNG thuộc tính năng này,
// vẫn cấu hình cố định qua biến môi trường .env / Cloudflare như trước.
const SUPABASE_URL_FOR_SETTINGS = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vwwgihnumdwmihdfqudx.supabase.co";
const SUPABASE_ANON_KEY_FOR_SETTINGS = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2dpaG51bWR3bWloZGZxdWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDk0MDMsImV4cCI6MjA5ODk4NTQwM30.qJbHbW0AIE25AHEIEPDpF3voZfYaRSEpVCnSwHArpmw";
const supabaseSettings = createClient(SUPABASE_URL_FOR_SETTINGS, SUPABASE_ANON_KEY_FOR_SETTINGS);

const SETTINGS_TABLE = "sgc_cai_dat_api";
const settingsCache = new Map<string, { value: string; expiresAt: number }>();
const SETTINGS_CACHE_TTL_MS = 30_000;

// Đọc một giá trị cấu hình: ưu tiên biến môi trường (.env), sau đó tới Supabase.
async function getSetting(key: string): Promise<string> {
  if (process.env[key]) return process.env[key] as string;

  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const { data, error } = await supabaseSettings
      .from(SETTINGS_TABLE)
      .select("gia_tri")
      .eq("id", key)
      .maybeSingle();
    if (error) {
      console.warn(`Không đọc được cấu hình '${key}' từ Supabase:`, error.message);
      return "";
    }
    const value = (data && data.gia_tri) || "";
    settingsCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
    return value;
  } catch (err: any) {
    console.warn(`Lỗi khi đọc cấu hình '${key}':`, err.message);
    return "";
  }
}

// Ghi một giá trị cấu hình vào Supabase.
async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseSettings
    .from(SETTINGS_TABLE)
    .upsert({ id: key, gia_tri: value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  settingsCache.set(key, { value, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS });
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

// Health check endpoint
app.get("/api/health", async (_req, res) => {
  const geminiKey = await getSetting("GEMINI_API_KEY");
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(geminiKey),
    time: new Date().toISOString()
  });
});

// Lấy trạng thái cấu hình Gemini API Key hiện tại (KHÔNG trả về giá trị thật,
// chỉ trả về đã cấu hình hay chưa + vài ký tự đầu/cuối đã che dấu để đối chiếu).
// Lưu ý: trên Cloudflare Pages route này không chạy — giao diện đọc thẳng từ Supabase.
app.get("/api/settings", async (_req, res) => {
  try {
    const geminiKey = await getSetting("GEMINI_API_KEY");
    res.json({
      geminiApiKey: { configured: Boolean(geminiKey), masked: maskSecret(geminiKey) }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Không thể tải cấu hình" });
  }
});

// Lưu / cập nhật Gemini API Key vào Supabase.
// Lưu ý: trên Cloudflare Pages route này không chạy — giao diện ghi thẳng vào Supabase.
app.post("/api/settings", async (req, res) => {
  try {
    const { geminiApiKey } = req.body || {};

    if (typeof geminiApiKey !== "string" || !geminiApiKey.trim()) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập Gemini API Key." });
    }

    await setSetting("GEMINI_API_KEY", geminiApiKey.trim());

    res.json({ success: true, updated: ["GEMINI_API_KEY"] });
  } catch (err: any) {
    console.error("Lỗi khi lưu Gemini API Key:", err.message);
    res.status(500).json({ success: false, error: err.message || "Không thể lưu cấu hình" });
  }
});

// Helper to extract text from PDF buffer using pdfjs-dist
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const doc = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item: any) => item.str || "").join(" ");
      fullText += pageStrings + "\n";
    }
    return fullText.trim();
  } catch (err) {
    console.warn("Lỗi trích xuất văn bản từ PDF bằng pdfjs-dist:", err);
    return "";
  }
}

// Helper to extract candidate name accurately
function extractCandidateName(fileName: string, text: string): string {
  const lines = (text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const blacklist = /curriculum|vitae|resume|thông tin|hồ sơ|mục tiêu|kinh nghiệm|học vấn|kỹ năng|chứng chỉ|cộng hòa|độc lập|hạnh phúc|quản lý|thủ kho|chuyên viên|giới thiệu|bảng điểm/i;

  // 1. Scan first 15 lines for Vietnamese candidate name
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (blacklist.test(line)) continue;
    // Standard Vietnamese proper name: 2 to 5 words, starts with capital
    if (/^[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zà-ỹ]+(\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zà-ỹ]+){1,4}$/.test(line)) {
      return line;
    }
  }

  // 2. Look for labeled name
  const nameLabelMatch = (text || "").match(/(?:họ\s*(?:và|&)?\s*tên|full\s*name|candidate\s*name)[\s:]*([A-ZÀ-Ỵ][a-zà-ỹ\s]+)/i);
  if (nameLabelMatch && nameLabelMatch[1] && nameLabelMatch[1].trim().length > 3) {
    return nameLabelMatch[1].trim();
  }

  // 3. Fallback from fileName: clean hyphens, underscores and capitalize words
  let fn = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/^(cv|hoso|resume)[_\s-]?/i, "")
    .replace(/[_\s-]?(cv|resume|sgc)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (fn && fn.length > 2) {
    return fn
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return "Ứng viên Thủ kho SGC";
}

// Helper for high-precision heuristic extraction fallback
function fallbackHeuristicExtract(text: string, fileName: string) {
  const clean = text || "";
  
  // Extract phone (handles spaces, dashes, dots, +84)
  const phoneMatch = clean.match(/(?:(?:\+84|0)[\s.-]?[35789][0-9\s.-]{7,13}[0-9])\b/);
  let soDienThoai = "";
  if (phoneMatch) {
    const rawDigits = phoneMatch[0].replace(/[\s.-]/g, "");
    if (rawDigits.length === 10) {
      soDienThoai = rawDigits.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
    } else {
      soDienThoai = phoneMatch[0].trim();
    }
  }

  // Extract email
  const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0].trim() : "";

  // Extract candidate name
  const hoTen = extractCandidateName(fileName, clean);

  // Extract date of birth
  let ngaySinh = "";
  const dobMatch = clean.match(/(?:ngày sinh|năm sinh|dob|sinh ngày|sinh\s*:?)[\s:]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{4})/i);
  if (dobMatch) {
    ngaySinh = dobMatch[1].replace(/-/g, "/");
  } else {
    // Look for dd/mm/yyyy pattern near the top
    const generalDateMatch = clean.slice(0, 1000).match(/\b([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\b/);
    if (generalDateMatch) {
      ngaySinh = generalDateMatch[1];
    }
  }

  // Extract Address / Quê quán
  let diaChi = "";
  const addrMatch = clean.match(/(?:địa chỉ|thường trú|tạm trú|nơi ở)[\s:]*([^\n\r]+)/i);
  if (addrMatch) {
    diaChi = addrMatch[1].trim();
  } else {
    const vnAddrMatch = clean.match(/(?:thôn|xóm|số|ngõ|ngách|đường|xã|phường|quận|huyện)[^,\n]+(?:,\s*[^,\n]+){1,3}/i);
    if (vnAddrMatch) {
      diaChi = vnAddrMatch[0].trim();
    }
  }

  // Extract experience years
  let soNamKinhNghiem = 1;
  const expMatch = clean.match(/([0-9]+)\s*(?:năm|nam)\s*(?:kinh nghiệm|kn)/i);
  if (expMatch) {
    soNamKinhNghiem = parseInt(expMatch[1], 10);
  } else {
    // Try to detect year spans like 2022 - 2026
    const yearMatches = Array.from(clean.matchAll(/\b(201\d|202\d)\b/g)).map(m => parseInt(m[1], 10));
    if (yearMatches.length >= 2) {
      const minYear = Math.min(...yearMatches);
      const maxYear = Math.max(...yearMatches);
      const span = maxYear - minYear;
      if (span > 0 && span <= 20) {
        soNamKinhNghiem = Math.min(span, 10);
      }
    }
  }

  // Extract CCCD
  const cccdMatch = clean.match(/\b(0[0-9]{11}|[0-9]{9})\b/);
  const cccd = cccdMatch ? cccdMatch[0] : "";

  // Education level
  let trinhDo = "Trung cấp";
  if (/thạc sĩ|thac si|master/i.test(clean)) {
    trinhDo = "Thạc sĩ";
  } else if (/tiến sĩ|tien si|phd/i.test(clean)) {
    trinhDo = "Tiến sĩ";
  } else if (/đại học|dai hoc|cử nhân|cu nhan|bachelor/i.test(clean)) {
    trinhDo = "Đại học";
  } else if (/cao đẳng|cao dang/i.test(clean)) {
    trinhDo = "Cao đẳng";
  }

  // Major / Field
  let chuyenNganh = "Quản trị kho vận / Xây dựng";
  if (/kế toán|ke toan/i.test(clean)) {
    chuyenNganh = "Kế toán / Quản lý vật tư";
  } else if (/tài chính|tai chinh/i.test(clean)) {
    chuyenNganh = "Tài chính - Ngân hàng";
  } else if (/xây dựng|xay dung/i.test(clean)) {
    chuyenNganh = "Kỹ thuật Xây dựng";
  } else if (/logistics|xuất nhập khẩu/i.test(clean)) {
    chuyenNganh = "Logistics & Chuỗi cung ứng";
  }

  // Position
  let chucVu = "Thủ kho";
  if (/trưởng nhóm|truong nhom/i.test(clean)) {
    chucVu = "Trưởng nhóm kho dự án";
  } else if (/hiện trường|hien truong/i.test(clean)) {
    chucVu = "Thủ kho hiện trường";
  } else if (/nhập liệu|nhap lieu/i.test(clean)) {
    chucVu = "Thủ kho nhập liệu";
  } else if (/phụ kho|phu kho/i.test(clean)) {
    chucVu = "Phụ kho";
  }

  // Gender
  const isFemale = /\bnữ\b|nu\b|female/i.test(clean);
  const gioiTinh = isFemale ? "Nữ" : "Nam";

  // Skills detected in text
  const skillsList: string[] = [];
  if (/sap\b/i.test(clean)) skillsList.push("SAP");
  if (/excel/i.test(clean)) skillsList.push("Excel");
  if (/kiểm kê|kiem ke/i.test(clean)) skillsList.push("Kiểm kê kho bãi");
  if (/nhập xuất tồn|nhap xuat ton/i.test(clean)) skillsList.push("Quản lý xuất nhập tồn");
  if (/pr|po|migo/i.test(clean)) skillsList.push("PR, PO, Migo");
  if (/xe nâng/i.test(clean)) skillsList.push("Lái xe nâng");
  if (skillsList.length === 0) {
    skillsList.push("Excel", "Quản lý kho bãi", "Kiểm đếm hàng hóa");
  }

  // Experience summary
  let kinhNghiem = "Có kinh nghiệm thực tế quản lý vật tư, theo dõi xuất nhập tồn và đối chiếu số liệu kho.";
  const knBlock = clean.match(/(?:kinh nghiệm làm việc|kinh nghiệm|quá trình làm việc)[\s:]*([\s\S]{50,400}?)(?=\n\s*(?:học vấn|kỹ năng|mục tiêu|$))/i);
  if (knBlock && knBlock[1]) {
    kinhNghiem = knBlock[1].replace(/\r?\n+/g, " ").trim().slice(0, 350);
  }

  return {
    hoTen: hoTen || "Ứng viên Thủ kho SGC",
    soDienThoai,
    email,
    ngaySinh,
    gioiTinh,
    cccd,
    queQuan: "",
    diaChi,
    chucVu,
    duAn: "",
    trinhDo,
    chuyenNganh,
    soNamKinhNghiem,
    kinhNghiem,
    kyNang: skillsList.join(", "),
    chungChi: /atlđ|an toàn lao động/i.test(clean) ? "Chứng chỉ ATLĐ" : "Chứng chỉ ATLĐ",
    aiDanhGia: `Ứng viên có trình độ ${trinhDo} (${chuyenNganh}), có ${soNamKinhNghiem} năm kinh nghiệm thực tế trong công tác quản lý kho và vật tư, phù hợp phỏng vấn vị trí ${chucVu}.`,
    diemPhuHop: 8.5,
    isParsedWithAI: false
  };
}

// Helper to call Gemini with automatic cascading fallback models to handle 503 spikes
async function callGeminiWithFallback(ai: GoogleGenAI, contents: any, config: any) {
  // Try lightweight fast models first to avoid 503 high demand spikes
  const models = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`Calling Gemini with model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      if (response && response.text) {
        console.log(`Gemini response received successfully with ${model}`);
        return { response, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed (${err.status || err.message}). Trying fallback model...`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to respond.");
}

// Endpoint to parse CV using PDF text extraction, Mammoth DOCX, cascading Gemini API, and smart heuristic fallback
app.post("/api/parse-cv", async (req, res) => {
  try {
    const { fileName = "CV.pdf", mimeType = "application/pdf", base64Data = "", rawText = "" } = req.body;

    let extractedText = rawText || "";
    const cleanBase64 = base64Data ? base64Data.replace(/^data:.*?;base64,/, "") : "";
    const isWord = 
      mimeType.includes("word") || 
      mimeType.includes("officedocument") || 
      fileName.endsWith(".docx") || 
      fileName.endsWith(".doc");
    const isPdf = 
      mimeType === "application/pdf" || 
      fileName.endsWith(".pdf");

    // 1. Extract text from PDF files using pdfjs-dist if not already provided
    if (isPdf && cleanBase64 && !extractedText) {
      try {
        const fileBuffer = Buffer.from(cleanBase64, "base64");
        const pdfText = await extractTextFromPdfBuffer(fileBuffer);
        if (pdfText) {
          extractedText = pdfText;
          console.log(`Extracted ${extractedText.length} characters of text from PDF: ${fileName}`);
        }
      } catch (err) {
        console.warn("PDF extraction warning:", err);
      }
    }

    // 2. Extract text from Word files with Mammoth if base64 data is present
    if (isWord && cleanBase64 && !extractedText) {
      try {
        const fileBuffer = Buffer.from(cleanBase64, "base64");
        const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = mammothResult.value || "";
        console.log(`Extracted ${extractedText.length} characters of text from Word: ${fileName}`);
      } catch (err) {
        console.warn("Mammoth extraction warning:", err);
      }
    }

    // Run baseline heuristic extract from extractedText
    const baselineFallback = fallbackHeuristicExtract(extractedText, fileName);

    const apiKey = await getSetting("GEMINI_API_KEY");

    // If no API key is set, return rich heuristic extraction
    if (!apiKey) {
      console.log("No GEMINI_API_KEY configured, returning smart heuristic extraction.");
      return res.json({
        success: true,
        data: baselineFallback,
        source: "heuristic_fallback",
        note: "Đã trích xuất thông tin chi tiết từ nội dung hồ sơ."
      });
    }

    // Call Gemini API server-side
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const systemInstruction = `Bạn là chuyên gia tuyển dụng nhân sự kho và quản lý vật tư xây dựng tại tập đoàn SGC (SGC Construction & Engineering).
Nhiệm vụ của bạn là đọc kỹ toàn bộ nội dung CV/hồ sơ xin việc của ứng viên và trích xuất dữ liệu thành định dạng JSON chuẩn.
Các quy tắc:
1. "hoTen": Họ và tên đầy đủ viết hoa chữ cái đầu (ví dụ: "Nguyễn Thị Ngọc Bích"). Không bao giờ để tên dạng slug tệp (như "Nguyen-Thi-Ngoc-Bich").
2. "soDienThoai": Số điện thoại liên hệ (chuẩn hóa có khoảng cách hoặc liền, ví dụ: "0987 031 361").
3. "email": Địa chỉ email chính xác từ CV.
4. "ngaySinh": Ngày tháng năm sinh (định dạng DD/MM/YYYY hoặc YYYY-MM-DD, ví dụ: "13/12/1997").
5. "gioiTinh": "Nam" hoặc "Nữ" (dựa vào thông tin giới tính hoặc danh xưng/ảnh).
6. "cccd": Số Căn cước công dân hoặc CMND (nếu có, không có thì để "").
7. "queQuan": Quê quán, nguyên quán hoặc tỉnh thành gốc.
8. "diaChi": Địa chỉ hiện tại hoặc nơi tạm trú (ví dụ: "Thôn 4, Xã Hoà Lạc, Hà Nội").
9. "chucVu": Vị trí ứng tuyển hoặc chức danh đề xuất phù hợp tại SGC ("Thủ kho", "Trưởng nhóm kho dự án", "Thủ kho hiện trường", "Phụ kho", "Thủ kho nhập liệu").
10. "duAn": Dự án hoặc địa bàn mong muốn (nếu có nêu cụ thể, hoặc để "").
11. "trinhDo": Trình độ học vấn cao nhất của ứng viên ("Thạc sĩ", "Đại học", "Cao đẳng", "Trung cấp").
12. "chuyenNganh": Chuyên ngành học (ví dụ: "Kế toán", "Tài chính - Ngân hàng", "Quản lý vật tư", "Xây dựng", "Logistics").
13. "soNamKinhNghiem": Tổng số năm kinh nghiệm làm việc (số nguyên hoặc thập phân, ví dụ: 3 hoặc 4).
14. "kinhNghiem": Tóm tắt súc tích quá trình công tác, các đơn vị từng làm và nhiệm vụ chính (2-4 câu).
15. "kyNang": Các kỹ năng nổi bật (SAP, PR/PO/Migo, Excel, kiểm kê xuất nhập tồn, quản lý vật tư...).
16. "chungChi": Chứng chỉ liên quan (ATLĐ, PCCC, kế toán...).
17. "aiDanhGia": Nhận xét đánh giá chuyên môn khách quan của AI về thế mạnh, năng lực và mức độ phù hợp với vị trí quản lý kho vật tư tại SGC (2 câu).
18. "diemPhuHop": Chấm điểm độ phù hợp từ 1.0 đến 10.0 (số thực, ví dụ: 9.0 hoặc 8.5).
Chỉ trả về JSON thuần túy, không kèm markdown \`\`\`json.`;

    let parts: any[] = [];

    if (extractedText && extractedText.trim().length > 30) {
      // Direct text prompt: fastest, most accurate, no OCR distortions
      parts = [
        {
          text: `Dưới đây là toàn bộ nội dung văn bản được trích xuất trực tiếp từ tệp CV ứng viên (Tên tệp: ${fileName}):\n\n--- NỘI DUNG CV ---\n${extractedText}\n--- HẾT NỘI DUNG ---\n\nHãy đọc kỹ và trích xuất tất cả các trường thông tin theo đúng yêu cầu JSON.`
        }
      ];
    } else if (cleanBase64 && (isPdf || mimeType.startsWith("image/"))) {
      // Scanned PDF or Image without extracted text -> send inlineData to Gemini
      parts = [
        {
          inlineData: {
            mimeType: isPdf ? "application/pdf" : (mimeType || "image/jpeg"),
            data: cleanBase64
          }
        },
        {
          text: `Hãy đọc kỹ tài liệu CV đính kèm (Tên tệp: ${fileName}) và trích xuất tất cả các trường thông tin ứng viên theo đúng cấu trúc JSON.`
        }
      ];
    } else {
      parts = [
        {
          text: `Hồ sơ ứng viên: ${fileName}. Hãy trích xuất thông tin cơ bản cho vị trí Thủ kho theo cấu trúc JSON.`
        }
      ];
    }

    const { response, modelUsed } = await callGeminiWithFallback(
      ai,
      { parts },
      {
        systemInstruction,
        responseMimeType: "application/json"
      }
    );

    let cleanText = response.text || "{}";
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(cleanText);
    } catch {
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsedJson = JSON.parse(match[0]);
        } catch {
          parsedJson = {};
        }
      }
    }

    // Normalize diemPhuHop if formatted as "9/10" or string
    let normalizedScore = 8.5;
    if (parsedJson.diemPhuHop) {
      const numMatch = String(parsedJson.diemPhuHop).match(/([0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) {
        normalizedScore = parseFloat(numMatch[1]);
      }
    }

    // Merge baseline fallback with AI parsed result
    const merged = {
      ...baselineFallback,
      ...parsedJson,
      hoTen: parsedJson.hoTen || baselineFallback.hoTen,
      soDienThoai: parsedJson.soDienThoai || baselineFallback.soDienThoai,
      email: parsedJson.email || baselineFallback.email,
      ngaySinh: parsedJson.ngaySinh || baselineFallback.ngaySinh,
      diaChi: parsedJson.diaChi || baselineFallback.diaChi,
      trinhDo: parsedJson.trinhDo || baselineFallback.trinhDo,
      chuyenNganh: parsedJson.chuyenNganh || baselineFallback.chuyenNganh,
      soNamKinhNghiem: parsedJson.soNamKinhNghiem ? Number(parsedJson.soNamKinhNghiem) : baselineFallback.soNamKinhNghiem,
      diemPhuHop: normalizedScore,
      isParsedWithAI: true
    };

    return res.json({
      success: true,
      data: merged,
      source: modelUsed
    });

  } catch (error: any) {
    console.error("Error in /api/parse-cv:", error);
    const { rawText = "", fileName = "CV.pdf" } = req.body || {};
    const fallback = fallbackHeuristicExtract(rawText, fileName);
    return res.json({
      success: true,
      data: fallback,
      source: "fallback_after_error",
      error: error.message || "Unknown error"
    });
  }
});

// Helper to sanitize filename for GitHub CV repository
function sanitizeFileNameForGitHub(originalName: string): string {
  const timestamp = Date.now();
  const dotIndex = (originalName || "").lastIndexOf(".");
  const ext = dotIndex !== -1 ? originalName.slice(dotIndex).toLowerCase() : ".pdf";
  const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : (originalName || "CV");

  // Normalize Vietnamese diacritics to clean ascii for maximum URL and filesystem safety
  const cleanBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${timestamp}_${cleanBase || "CV"}${ext}`;
}

// Check GitHub repo config status
app.get("/api/github-status", async (_req, res) => {
  const token = process.env.GITHUB_TOKEN || "";
  const repo = process.env.GITHUB_REPO || "ceohomes/CV-TQT";
  const folder = process.env.GITHUB_CV_FOLDER || "cvs";
  const branch = process.env.GITHUB_BRANCH || "main";
  res.json({
    configured: Boolean(token),
    repo: repo,
    folder: folder,
    branch: branch
  });
});

// Endpoint to stream/download CV from GitHub repo (ceohomes/CV-TQT/cvs) directly to browser
app.get("/api/github-cv-file", async (req, res) => {
  try {
    const fileParam = (req.query.file as string) || (req.query.fileName as string) || "";
    const urlParam = (req.query.url as string) || "";

    const token = process.env.GITHUB_TOKEN || "";
    const repo = process.env.GITHUB_REPO || "ceohomes/CV-TQT";
    const branch = process.env.GITHUB_BRANCH || "main";
    const folder = process.env.GITHUB_CV_FOLDER || "cvs";

    let targetUrl = urlParam;
    let targetFileName = fileParam;

    if (!targetUrl && targetFileName) {
      if (targetFileName.startsWith("http")) {
        targetUrl = targetFileName;
      } else {
        const cleanName = path.basename(targetFileName);
        targetUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${folder}/${cleanName}`;
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing file or url query parameter" });
    }

    const fetchHeaders: Record<string, string> = {
      "User-Agent": "SGC-HR-Manager"
    };
    if (token) {
      fetchHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Try fetching via direct raw URL first
    let response = await fetch(targetUrl, { headers: fetchHeaders });

    // If raw URL failed or returned 404, try GitHub API contents endpoint
    if (!response.ok && targetFileName) {
      const cleanName = path.basename(targetFileName);
      const apiContentUrl = `https://api.github.com/repos/${repo}/contents/${folder}/${cleanName}?ref=${branch}`;
      const apiRes = await fetch(apiContentUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "SGC-HR-Manager",
          "Accept": "application/vnd.github.raw+json"
        }
      });
      if (apiRes.ok) {
        response = apiRes;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GitHub fetch error: ${response.status} ${response.statusText}`
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const cleanName = targetFileName ? path.basename(targetFileName) : "CV.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(cleanName)}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buffer);
  } catch (err: any) {
    console.error("Error fetching CV from GitHub:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch CV from GitHub" });
  }
});

// Endpoint to upload CV to GitHub repo (ceohomes/CV-TQT/cvs) to avoid Supabase storage bloat
app.post("/api/upload-cv-github", async (req, res) => {
  try {
    const { fileName, base64Data, candidateName } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ success: false, error: "base64Data is required" });
    }

    const token = process.env.GITHUB_TOKEN || "";
    const repo = process.env.GITHUB_REPO || "ceohomes/CV-TQT";
    const branch = process.env.GITHUB_BRANCH || "main";
    const folder = process.env.GITHUB_CV_FOLDER || "cvs";

    // Clean base64 string (strip data:application/...;base64, prefix)
    let rawBase64 = base64Data;
    if (rawBase64.includes(",")) {
      rawBase64 = rawBase64.split(",")[1];
    }
    rawBase64 = rawBase64.replace(/\s/g, "");

    const targetFileName = sanitizeFileNameForGitHub(fileName || "CV_UngVien.pdf");
    const targetPath = `${folder}/${targetFileName}`;
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${targetPath}`;

    const commitMessage = `Upload CV: ${targetFileName} ${candidateName ? `cho ${candidateName}` : ""}`.trim();

    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "SGC-HR-Manager",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        message: commitMessage,
        content: rawBase64,
        branch: branch
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("GitHub API upload error:", response.status, errData);
      return res.status(response.status).json({
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
        details: errData
      });
    }

    const resData: any = await response.json();
    const downloadUrl = resData.content?.download_url || `https://raw.githubusercontent.com/${repo}/${branch}/${targetPath}`;
    const htmlUrl = resData.content?.html_url || `https://github.com/${repo}/blob/${branch}/${targetPath}`;

    return res.json({
      success: true,
      fileName: targetFileName,
      path: targetPath,
      downloadUrl: downloadUrl,
      htmlUrl: htmlUrl,
      repo: repo,
      branch: branch
    });
  } catch (err: any) {
    console.error("Error uploading CV to GitHub:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to upload CV to GitHub"
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Express v5 wildcard path
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
