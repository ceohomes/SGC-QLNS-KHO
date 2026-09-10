export async function onRequestGet({ env }) {
  const token = env.GITHUB_TOKEN || "";
  const repo = env.GITHUB_REPO || "ceohomes/CV-TQT";
  const folder = env.GITHUB_CV_FOLDER || "cvs";
  const branch = env.GITHUB_BRANCH || "main";
  return Response.json({
    configured: Boolean(token),
    repo,
    folder,
    branch
  });
}
