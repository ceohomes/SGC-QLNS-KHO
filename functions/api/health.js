import { getGeminiApiKey } from "./_lib/settings.js";

export async function onRequestGet({ env }) {
  const geminiKey = await getGeminiApiKey(env);
  return Response.json({
    status: "ok",
    runtime: "cloudflare-pages-functions",
    hasGeminiKey: Boolean(geminiKey),
    time: new Date().toISOString()
  });
}
