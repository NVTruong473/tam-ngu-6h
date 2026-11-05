const siteUrl = new URL(process.env.SMOKE_URL || "https://nvtruong473.github.io/tam-ngu-6h/");
const apiUrl = (process.env.SMOKE_API_URL || "https://fcsuldrerhbynwotcvyn.supabase.co/functions/v1/tam-ngu-api").replace(/\/$/, "");

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, label, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "cache-control": "no-cache", "user-agent": "tam-ngu-production-smoke-test" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(5_000);
    }
  }
  throw lastError || new Error(`${label} không phản hồi.`);
}

const [pageResponse, manifestResponse, workerResponse, healthResponse] = await Promise.all([
  fetchWithRetry(siteUrl, "Trang chính"),
  fetchWithRetry(new URL("manifest.webmanifest", siteUrl), "Web App Manifest"),
  fetchWithRetry(new URL("sw.js", siteUrl), "Service Worker"),
  fetchWithRetry(`${apiUrl}/health`, "API Tam Ngữ"),
]);

const [html, manifest, worker, health] = await Promise.all([
  pageResponse.text(),
  manifestResponse.json(),
  workerResponse.text(),
  healthResponse.json(),
]);

const failures = [];
if (!html.includes("<title>Tam Ngữ 6H</title>")) failures.push("trang chính sai tiêu đề");
if (manifest?.display !== "standalone") failures.push("manifest không chạy standalone");
if (!Array.isArray(manifest?.icons) || !manifest.icons.some((icon) => icon.sizes === "512x512")) failures.push("manifest thiếu icon 512");
if (!worker.includes('addEventListener("push"') || !worker.includes("showNotification")) failures.push("service worker thiếu Web Push");
if (!health?.ok || !health?.pushConfigured || !health?.lookupConfigured || !health?.lookupProtectionConfigured) failures.push("backend chưa cấu hình đủ");

if (failures.length > 0) throw new Error(`Bản production chưa đạt: ${failures.join(", ")}.`);
process.stdout.write(`Production OK: ${siteUrl.href}\n`);
