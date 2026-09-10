// Lấy Gemini API Key: ưu tiên biến môi trường Cloudflare (nếu admin đặt tay),
// nếu không có thì đọc từ bảng sgc_cai_dat_api trên Supabase — đúng nơi mà
// nút "Cài đặt API Key" trên giao diện đang lưu vào.
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://vwwgihnumdwmihdfqudx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2dpaG51bWR3bWloZGZxdWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDk0MDMsImV4cCI6MjA5ODk4NTQwM30.qJbHbW0AIE25AHEIEPDpF3voZfYaRSEpVCnSwHArpmw";

export async function getGeminiApiKey(env) {
  if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;

  try {
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from("sgc_cai_dat_api")
      .select("gia_tri")
      .eq("id", "GEMINI_API_KEY")
      .maybeSingle();

    if (error) {
      console.warn("Không đọc được Gemini API Key từ Supabase:", error.message);
      return "";
    }
    return (data && data.gia_tri) || "";
  } catch (err) {
    console.warn("Lỗi khi đọc Gemini API Key:", err.message);
    return "";
  }
}
