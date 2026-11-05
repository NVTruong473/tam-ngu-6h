const siteUrl = new URL(process.env.SMOKE_URL || "https://nvtruong473.github.io/tam-ngu-6h/");
const apiUrl = (process.env.SMOKE_API_URL || "https://fcsuldrerhbynwotcvyn.supabase.co/functions/v1/tam-ngu-api").replace(/\/$/, "");
const deepLookup = process.env.SMOKE_DEEP_LOOKUP === "1";
const pinyinToneMarks = new Set([..."āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ"]);

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

async function verifyLookup() {
  const clientBytes = crypto.getRandomValues(new Uint8Array(18));
  const clientId = `tg6h_${[...clientBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const response = await fetch(`${apiUrl}/lookup`, {
    method: "POST",
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
      origin: siteUrl.origin,
      "user-agent": "tam-ngu-production-deep-smoke-test",
      "x-client-id": clientId,
    },
    body: JSON.stringify({ query: "take it easy" }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Tra cứu thật HTTP ${response.status}`);
  const result = payload?.result;
  const hasAlignedToneGuides = (example) => {
    const expected = [...String(example?.pinyin || "")].filter((character) => pinyinToneMarks.has(character)).length;
    const reading = String(example?.vietnameseReading || "");
    const supplied = (reading.match(/\([1-4]\)/g) || []).length;
    return expected === supplied && !/\([1-4]\)\s+\([1-4]\)/.test(reading);
  };
  if (!payload?.ok
    || !result?.meaning
    || !Array.isArray(result?.examples)
    || result.examples.length !== 2
    || !result.examples.every((example) => example?.english
      && example?.chinese
      && example?.pinyin
      && example?.vietnameseReading
      && example?.vietnamese
      && hasAlignedToneGuides(example))) {
    throw new Error("Tra cứu thật trả dữ liệu chưa hợp lệ");
  }
}

async function verifyLookupWithRetry(attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await verifyLookup();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(6_000);
    }
  }
  throw lastError || new Error("Tra cứu thật không phản hồi.");
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
if (!["apple", "fcm", "mozilla", "wns"].every((provider) => health?.pushProviders?.includes(provider))) failures.push("backend chưa công bố đủ dịch vụ Push");
if (health?.dispatchReliability?.graceMinutes !== 10
  || health?.dispatchReliability?.concurrency !== 8
  || health?.dispatchReliability?.attempts !== 2) failures.push("backend chưa bật cơ chế bù lịch và retry Push");

if (failures.length > 0) throw new Error(`Bản production chưa đạt: ${failures.join(", ")}.`);
if (deepLookup) await verifyLookupWithRetry();
process.stdout.write(`Production OK${deepLookup ? " + Gemini lookup" : ""}: ${siteUrl.href}\n`);
