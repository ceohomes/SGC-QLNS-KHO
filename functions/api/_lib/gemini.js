// Gọi Gemini API trực tiếp bằng REST (fetch) thay vì dùng SDK @google/genai —
// vì SDK đó viết cho Node.js, còn Cloudflare Pages Functions chạy trên Workers
// (không phải Node), nên gọi thẳng REST endpoint cho chắc chắn tương thích.
// Tự động thử lần lượt vài model để tránh lỗi 503 khi model đang quá tải.

const MODELS_TO_TRY = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];

// Cloudflare Pages Functions chạy trên các máy chủ biên (edge) rải khắp thế giới —
// đôi khi request bị định tuyến qua một trung tâm dữ liệu ở khu vực mà Google chặn
// gọi Gemini API trực tiếp (lỗi 400 "User location is not supported for the API use").
// Nếu có cấu hình CF_ACCOUNT_ID + AI_GATEWAY_NAME (biến môi trường Cloudflare), sẽ gọi
// Gemini thông qua Cloudflare AI Gateway (hạ tầng cố định của Cloudflare) thay vì gọi
// thẳng generativelanguage.googleapis.com, giúp tránh bị chặn theo vị trí máy chủ biên.
function buildGeminiUrl(model, apiKey, env) {
  const accountId = env && (env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayName = env && (env.AI_GATEWAY_NAME || env.CF_AI_GATEWAY_NAME);
  if (accountId && gatewayName) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/google-ai-studio/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export async function callGeminiWithFallback(apiKey, parts, systemInstructionText, responseSchema = null, env = null) {
  let lastError = null;

  for (const model of MODELS_TO_TRY) {
    try {
      const url = buildGeminiUrl(model, apiKey, env);
      const body = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: {
          responseMimeType: "application/json",
          // Khi có responseSchema: buộc Gemini phải trả về đủ mọi trường (kể cả
          // chuỗi rỗng nếu không tìm thấy) thay vì lặng lẽ bỏ qua trường khó,
          // giúp tăng khả năng trích xuất các trường liên hệ nằm trong khung/sidebar.
          ...(responseSchema ? { responseSchema } : {})
        }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = new Error(`Gemini model ${model} lỗi ${res.status}: ${errText.slice(0, 300)}`);
        continue;
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
      if (text) {
        return { text, modelUsed: model };
      }
      lastError = new Error(`Gemini model ${model} trả về rỗng.`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Tất cả model Gemini đều thất bại.");
}
