function sanitizeFileNameForGitHub(originalName) {
  const timestamp = Date.now();
  const dotIndex = (originalName || "").lastIndexOf(".");
  const ext = dotIndex !== -1 ? originalName.slice(dotIndex).toLowerCase() : ".pdf";
  const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : (originalName || "CV");

  const cleanBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${timestamp}_${cleanBase || "CV"}${ext}`;
}

// Endpoint to upload CV to GitHub repo to avoid Supabase storage bloat
export async function onRequestPost({ request, env }) {
  try {
    const { fileName, base64Data, candidateName } = await request.json();
    if (!base64Data) {
      return Response.json({ success: false, error: "base64Data is required" }, { status: 400 });
    }

    const token = env.GITHUB_TOKEN || "";
    const repo = env.GITHUB_REPO || "ceohomes/CV-TQT";
    const branch = env.GITHUB_BRANCH || "main";
    const folder = env.GITHUB_CV_FOLDER || "cvs";

    if (!token) {
      return Response.json({
        success: false,
        error: "Server chưa cấu hình GITHUB_TOKEN. Vào Cloudflare -> Settings -> Biến số và bí mật để thêm."
      }, { status: 400 });
    }

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
      return Response.json({
        success: false,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
        details: errData
      }, { status: response.status });
    }

    const resData = await response.json();
    const downloadUrl = resData.content?.download_url || `https://raw.githubusercontent.com/${repo}/${branch}/${targetPath}`;
    const htmlUrl = resData.content?.html_url || `https://github.com/${repo}/blob/${branch}/${targetPath}`;

    return Response.json({
      success: true,
      fileName: targetFileName,
      path: targetPath,
      downloadUrl,
      htmlUrl,
      repo,
      branch
    });
  } catch (err) {
    console.error("Error uploading CV to GitHub:", err);
    return Response.json({
      success: false,
      error: err.message || "Failed to upload CV to GitHub"
    }, { status: 500 });
  }
}
