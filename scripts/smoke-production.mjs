const siteUrl = new URL(process.env.SMOKE_URL || "https://nvtruong473.github.io/tam-ngu-6h/");
const apiUrl = (process.env.SMOKE_API_URL || "https://fcsuldrerhbynwotcvyn.supabase.co/functions/v1/tam-ngu-api").replace(/\/$/, "");
const deepLookup = process.env.SMOKE_DEEP_LOOKUP === "1";
const requireSchedulerHeartbeat = process.env.SMOKE_REQUIRE_SCHEDULER !== "0";
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
      // Consume the body before AbortSignal.timeout expires. Returning a live
      // Response and reading it much later can abort an otherwise successful
      // request when another parallel check is still retrying.
      return await response.text();
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
  const examples = Array.isArray(result?.examples) ? result.examples : [];
  const structurallyValid = examples.length === 2
    && examples.every((example) => example?.english
      && example?.chinese
      && example?.pinyin
      && example?.vietnameseReading
      && example?.vietnamese
      && hasAlignedToneGuides(example));
  if (!payload?.ok || !result?.meaning || !structurallyValid) {
    const diagnostics = {
      payloadOk: payload?.ok === true,
      hasMeaning: Boolean(result?.meaning),
      exampleCount: examples.length,
      alignedExamples: examples.filter(hasAlignedToneGuides).length,
    };
    throw new Error(`Tra cứu thật trả dữ liệu chưa hợp lệ: ${JSON.stringify(diagnostics)}`);
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

const [html, manifestText, worker, healthText] = await Promise.all([
  fetchWithRetry(siteUrl, "Trang chính"),
  fetchWithRetry(new URL("manifest.webmanifest", siteUrl), "Web App Manifest"),
  fetchWithRetry(new URL("sw.js", siteUrl), "Service Worker"),
  // A fresh backend rollout may wait almost one minute for the first Supabase
  // Cron tick to create its private heartbeat. Keep this bounded below CI's
  // timeout while avoiding a false failed deployment at second 59.
  fetchWithRetry(`${apiUrl}/health`, "API Tam Ngữ", 18),
]);

const manifest = JSON.parse(manifestText);
const health = JSON.parse(healthText);

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
if (requireSchedulerHeartbeat && (!health?.scheduler?.fresh
  || health?.scheduler?.maximumAgeSeconds !== 300
  || !Number.isFinite(health?.scheduler?.ageSeconds))) failures.push("bộ lập lịch Push không có nhịp tim mới");
if (requireSchedulerHeartbeat && !health?.delivery?.healthy) failures.push("bộ lập lịch còn lỗi giao bài chưa phục hồi");
if (requireSchedulerHeartbeat
  && (!health?.deviceReceipt?.configured || !health?.deviceReceipt?.storageHealthy)) failures.push("biên nhận thiết bị chưa sẵn sàng");

if (failures.length > 0) throw new Error(`Bản production chưa đạt: ${failures.join(", ")}.`);
if (deepLookup) await verifyLookupWithRetry();
process.stdout.write(`Production OK${deepLookup ? " + Gemini lookup" : ""}: ${siteUrl.href}\n`);
