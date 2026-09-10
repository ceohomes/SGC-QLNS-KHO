// Lấy tên file cuối cùng từ đường dẫn/URL, thay cho path.basename của Node
// (Cloudflare Pages Functions chạy trên Workers, không có module "path" của Node).
function basename(p) {
  if (!p) return "";
  const clean = p.split("?")[0].split("#")[0];
  const parts = clean.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const fileParam = url.searchParams.get("file") || url.searchParams.get("fileName") || "";
    const urlParam = url.searchParams.get("url") || "";

    const token = env.GITHUB_TOKEN || "";
    const repo = env.GITHUB_REPO || "ceohomes/CV-TQT";
    const branch = env.GITHUB_BRANCH || "main";
    const folder = env.GITHUB_CV_FOLDER || "cvs";

    let targetUrl = urlParam;
    let targetFileName = fileParam;

    if (!targetUrl && targetFileName) {
      if (targetFileName.startsWith("http")) {
        targetUrl = targetFileName;
      } else {
        const cleanName = basename(targetFileName);
        targetUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${folder}/${cleanName}`;
      }
    }

    if (!targetUrl) {
      return Response.json({ error: "Missing file or url query parameter" }, { status: 400 });
    }

    const fetchHeaders = { "User-Agent": "SGC-HR-Manager" };
    if (token) {
      fetchHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Thử tải trực tiếp từ raw URL trước
    let response = await fetch(targetUrl, { headers: fetchHeaders });

    // Nếu thất bại, thử qua GitHub Contents API
    if (!response.ok && targetFileName) {
      const cleanName = basename(targetFileName);
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
      return Response.json({
        error: `GitHub fetch error: ${response.status} ${response.statusText}`
      }, { status: response.status });
    }

    const cleanName = targetFileName ? basename(targetFileName) : "CV.pdf";

    // Truyền thẳng dữ liệu (stream) thay vì gom vào Buffer của Node
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(cleanName)}"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    console.error("Error fetching CV from GitHub:", err);
    return Response.json({ error: err.message || "Failed to fetch CV from GitHub" }, { status: 500 });
  }
}
