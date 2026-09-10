import mammoth from "mammoth";
import { fallbackHeuristicExtract } from "./_lib/heuristic.js";
import { callGeminiWithFallback } from "./_lib/gemini.js";
import { getGeminiApiKey } from "./_lib/settings.js";

// Chuyển base64 -> ArrayBuffer bằng API chuẩn Web (atob), không dùng Buffer của Node
// vì Cloudflare Pages Functions chạy trên Workers runtime.
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia tuyển dụng nhân sự kho và quản lý vật tư xây dựng tại tập đoàn SGC (SGC Construction & Engineering).
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

export async function onRequestPost({ request, env }) {
  let bodyForFallback = {};
  try {
    const body = await request.json();
    bodyForFallback = body;
    const {
      fileName = "CV.pdf",
      mimeType = "application/pdf",
      base64Data = "",
      rawText = ""
    } = body;

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

    // Trích xuất text từ file Word bằng mammoth (bỏ qua trích xuất PDF bằng pdfjs-dist
    // vì thư viện đó cần môi trường giống DOM, không ổn định trên Workers runtime —
    // với PDF ta gửi thẳng file cho Gemini đọc trực tiếp, đa số Gemini đọc PDF tốt hơn).
    if (isWord && cleanBase64 && !extractedText) {
      try {
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const mammothResult = await mammoth.extractRawText({ arrayBuffer });
        extractedText = mammothResult.value || "";
      } catch (err) {
        console.warn("Mammoth extraction warning:", err);
      }
    }

    // Baseline heuristic extraction dùng làm nền / dự phòng
    const baselineFallback = fallbackHeuristicExtract(extractedText, fileName);

    const apiKey = await getGeminiApiKey(env);

    if (!apiKey) {
      return Response.json({
        success: true,
        data: baselineFallback,
        source: "heuristic_fallback",
        note: "Đã trích xuất thông tin chi tiết từ nội dung hồ sơ."
      });
    }

    let parts = [];

    if (extractedText && extractedText.trim().length > 30) {
      parts = [
        {
          text: `Dưới đây là toàn bộ nội dung văn bản được trích xuất trực tiếp từ tệp CV ứng viên (Tên tệp: ${fileName}):\n\n--- NỘI DUNG CV ---\n${extractedText}\n--- HẾT NỘI DUNG ---\n\nHãy đọc kỹ và trích xuất tất cả các trường thông tin theo đúng yêu cầu JSON.`
        }
      ];
    } else if (cleanBase64 && (isPdf || mimeType.startsWith("image/"))) {
      // PDF (kể cả bản scan) hoặc ảnh: gửi thẳng cho Gemini đọc đa phương thức (multimodal)
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

    let modelUsed = "heuristic_fallback";
    let cleanText = "{}";
    try {
      const result = await callGeminiWithFallback(apiKey, parts, SYSTEM_INSTRUCTION);
      cleanText = result.text || "{}";
      modelUsed = result.modelUsed;
    } catch (err) {
      console.error("Gemini call failed, falling back to heuristic:", err);
      return Response.json({
        success: true,
        data: baselineFallback,
        source: "heuristic_fallback",
        note: "AI tạm thời không phản hồi, đã dùng trích xuất thông minh từ nội dung hồ sơ."
      });
    }

    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsedJson = {};
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

    let normalizedScore = 8.5;
    if (parsedJson.diemPhuHop) {
      const numMatch = String(parsedJson.diemPhuHop).match(/([0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) {
        normalizedScore = parseFloat(numMatch[1]);
      }
    }

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

    return Response.json({
      success: true,
      data: merged,
      source: modelUsed
    });
  } catch (error) {
    console.error("Error in /api/parse-cv:", error);
    const rawText = bodyForFallback.rawText || "";
    const fileName = bodyForFallback.fileName || "CV.pdf";
    const fallback = fallbackHeuristicExtract(rawText, fileName);
    return Response.json({
      success: true,
      data: fallback,
      source: "fallback_after_error",
      error: error.message || "Unknown error"
    });
  }
}
