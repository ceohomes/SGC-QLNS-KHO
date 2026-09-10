// Gọi Gemini API trực tiếp bằng REST (fetch) thay vì dùng SDK @google/genai —
// vì SDK đó viết cho Node.js, còn Cloudflare Pages Functions chạy trên Workers
// (không phải Node), nên gọi thẳng REST endpoint cho chắc chắn tương thích.
// Tự động thử lần lượt vài model để tránh lỗi 503 khi model đang quá tải.

const MODELS_TO_TRY = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];

export async function callGeminiWithFallback(apiKey, parts, systemInstructionText) {
  let lastError = null;

  for (const model of MODELS_TO_TRY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: { responseMimeType: "application/json" }
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
