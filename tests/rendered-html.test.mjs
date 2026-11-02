import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("exports an installable PWA with one replaceable lock-screen card", async () => {
  const [html, manifestText, serviceWorker, highResolutionIcon] = await Promise.all([
    readFile(new URL("dist/client/index.html", root), "utf8"),
    readFile(new URL("dist/client/manifest.webmanifest", root), "utf8"),
    readFile(new URL("dist/client/sw.js", root), "utf8"),
    readFile(new URL("dist/client/icons/icon-v2-1024.png", root)),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /<title>Tam Ngữ 6H<\/title>/);
  assert.match(html, /noindex, nofollow/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "1024x1024" && icon.purpose === "maskable"));
  assert.equal(highResolutionIcon.readUInt32BE(16), 1024);
  assert.equal(highResolutionIcon.readUInt32BE(20), 1024);
  assert.match(serviceWorker, /tam-ngu-6h-v10/);
  assert.match(serviceWorker, /html\.matchAll/);
  assert.match(serviceWorker, /skipWaiting/);
  assert.match(serviceWorker, /clients\.claim/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /tam-ngu-current-lesson/);
  assert.match(serviceWorker, /renotify: false/);
  assert.match(serviceWorker, /seenNotificationIds/);
  assert.match(serviceWorker, /getNotifications/);
  assert.match(serviceWorker, /notification\.close/);
  assert.match(serviceWorker, /icon-v2-192\.png/);
  assert.doesNotMatch(serviceWorker, /badge:/);
  assert.match(serviceWorker, /notificationclick/);
});

test("ships a growing progressive curriculum with balanced seed formats", async () => {
  const curriculum = JSON.parse(await readFile(new URL("app/curriculum.json", root), "utf8"));
  const pinyinToneMarks = new Set([..."āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ"]);
  const counts = curriculum.reduce((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1;
    return result;
  }, {});

  assert.ok(curriculum.length >= 90);
  assert.ok(Math.abs((counts.sentence ?? 0) - (counts.message ?? 0)) <= 1);
  assert.ok(Math.abs((counts.message ?? 0) - (counts.dialogue ?? 0)) <= 1);
  assert.match(curriculum[0].stage, /^A2\.1/);
  assert.match(curriculum.at(-1).stage, /^B1/);
  assert.ok(curriculum.every((item) => item.lines.length >= 1));
  assert.ok(curriculum.every((item) => item.notification
    && [...item.notification.english].length <= 64
    && [...item.notification.chinese].length <= 26
    && [...item.notification.vietnamese].length <= 68));
  assert.ok(curriculum.every((item) => item.lines.every((line) => line.english && line.chinese && line.pinyin && line.vietnamese)));
  assert.ok(curriculum.every((item) => item.lines.every((line) => line.vietnameseReading && /\([1-4]\)/.test(line.vietnameseReading))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(line.vietnameseReading))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => !/[fjwz]/iu.test(line.vietnameseReading))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => !/(?:^|\s)(?:sh|zh)[a-z]+/iu.test(line.vietnameseReading))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => /\p{Script=Han}/u.test(line.chinese))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => !/[A-Za-z]/.test(line.chinese))));
  assert.ok(curriculum.every((item) => item.lines.every((line) => /\p{Script=Latin}/u.test(line.pinyin) && !/\p{Script=Han}/u.test(line.pinyin))));
  assert.ok(curriculum.every((item) => item.lines.every((line) =>
    [...line.pinyin].filter((character) => pinyinToneMarks.has(character)).length === (line.vietnameseReading.match(/\([1-4]\)/g) || []).length,
  )));
  assert.ok(curriculum.every((item) => item.lines.every((line) => !/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(line.vietnameseReading))));
  assert.doesNotMatch(JSON.stringify(curriculum), /<\/?[a-z][^>]*>/i);
});

test("keeps Gemini credentials server-only while shipping push and quick lookup", async () => {
  const [page, generator, appendGenerator, pronunciationEnricher, pronunciationRepairer, curriculumVerifier, edgeWorker, workflow, secretConfigurer, deployer, verifier, rateLimitMigration] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("scripts/generate-curriculum.mjs", root), "utf8"),
    readFile(new URL("scripts/append-curriculum.mjs", root), "utf8"),
    readFile(new URL("scripts/enrich-vietnamese-readings.mjs", root), "utf8"),
    readFile(new URL("scripts/repair-vietnamese-readings.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-curriculum.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/index.ts", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readFile(new URL("scripts/configure-supabase-lookup.mjs", root), "utf8"),
    readFile(new URL("scripts/deploy-supabase-function.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-supabase-api.mjs", root), "utf8"),
    readFile(new URL("supabase/migrations/20261102090000_lookup_rate_limit.sql", root), "utf8"),
  ]);
  const source = `${page}\n${generator}\n${appendGenerator}\n${pronunciationEnricher}\n${pronunciationRepairer}\n${curriculumVerifier}\n${edgeWorker}\n${workflow}\n${secretConfigurer}\n${deployer}\n${verifier}`;

  assert.doesNotMatch(source, /(?:AQ\.|sk-proj-|sk-or-v1-|gsk_|nvapi-)[A-Za-z0-9_-]{8,}/);
  assert.match(generator, /process\.env\.GEMINI_API_KEY/);
  assert.match(workflow, /secrets\.GEMINI_API_KEYS/);
  assert.match(workflow, /Append 24 reviewed lessons/);
  assert.match(workflow, /for candidate in \$\(seq 1 24\)/);
  assert.match(workflow, /Accepted \$accepted\/24 new lessons/);
  assert.match(page, /Thư viện bài học/);
  assert.doesNotMatch(page, /Gemini tạo thêm theo lộ trình/);
  assert.match(page, /Đọc gần Việt/);
  assert.match(page, /Notification\.requestPermission/);
  assert.match(page, /registration\.showNotification/);
  assert.match(page, /Thẻ tam ngữ mẫu vừa được gửi/);
  assert.match(page, /`✨ \$\{preview\?\.english/);
  assert.match(page, /`中  \$\{preview\?\.chinese/);
  assert.match(page, /icon-v2-192\.png/);
  assert.match(page, /NEXT_PUBLIC_PUSH_API_URL/);
  assert.match(page, /NEXT_PUBLIC_FEEDBACK_FORM_URL/);
  assert.match(page, /Nhắn cho dev/);
  assert.match(page, /Về Tam Ngữ 6H/);
  assert.match(page, /<details className="about-card">/);
  assert.match(workflow, /vars\.NEXT_PUBLIC_FEEDBACK_FORM_URL/);
  assert.match(page, /Hiện bài trên Màn hình khóa/);
  assert.match(page, /TRA NHANH · TỰ NHẬN DIỆN/);
  assert.match(page, /LOOKUP_QUERY_MAXIMUM = 240/);
  assert.match(page, /lookupIntentLabel/);
  assert.match(page, /DEFAULT_SCHEDULE = \["06:00", "12:00", "18:00"\]/);
  assert.match(page, /Mỗi ngày tối đa 24 mốc thông báo/);
  assert.match(page, /\/schedule/);
  assert.match(page, /LOOKUP_CACHE_KEY/);
  assert.match(page, /subscription\.unsubscribe/);
  assert.match(page, /ensureLookupClientId/);
  assert.match(page, /"x-client-id": ensureLookupClientId\(\)/);
  assert.doesNotMatch(page, /x-invite-code|Mã 8 số|Mở Tra nhanh AI \(tùy chọn\)/);
  assert.match(appendGenerator, /generateValidatedLessons/);
  assert.match(appendGenerator, /reviewGeneratedLessons/);
  assert.match(appendGenerator, /GENERATION_ATTEMPTS/);
  assert.match(appendGenerator, /assertPlainText/);
  assert.match(pronunciationEnricher, /vietnameseReading/);
  assert.match(pronunciationRepairer, /toneSlotsFor/);
  assert.match(pronunciationRepairer, /REPAIR_DRY_RUN/);
  assert.match(curriculumVerifier, /số thanh pinyin/i);
  assert.match(edgeWorker, /webpush/);
  assert.match(edgeWorker, /lesson\?\.notification \|\| firstLine/);
  assert.match(edgeWorker, /`🧪 \$\{notification\?\.english/);
  assert.match(edgeWorker, /`中  \$\{notification\.chinese/);
  assert.match(edgeWorker, /`VI  \$\{notification\.vietnamese/);
  assert.match(edgeWorker, /notificationId: isDueRun/);
  assert.match(edgeWorker, /install_hash/);
  assert.match(edgeWorker, /askGeminiForLookup/);
  assert.match(edgeWorker, /Japanese, Korean/);
  assert.match(edgeWorker, /LOOKUP_QUERY_MAXIMUM = 240/);
  assert.match(edgeWorker, /validScheduleTimes/);
  assert.match(edgeWorker, /mode\?: "due"/);
  assert.match(edgeWorker, /last_dispatch_key/);
  assert.match(edgeWorker, /rawCursor % curriculum\.length/);
  assert.match(edgeWorker, /lesson_cursor: body\?\.preview \? row\.lesson_cursor \?\? rawCursor : rawCursor \+ 1/);
  assert.match(edgeWorker, /normalizeLookupExample/);
  assert.match(edgeWorker, /hasToneGuidance/);
  assert.match(edgeWorker, /minItems: 2/);
  assert.match(edgeWorker, /GEMINI_API_KEYS/);
  assert.match(edgeWorker, /constantTimeEqual/);
  assert.match(edgeWorker, /isApplePushEndpoint/);
  assert.match(edgeWorker, /isTrustedAppOrigin/);
  assert.match(edgeWorker, /tam_ngu_take_lookup_quota/);
  assert.match(edgeWorker, /TAM_NGU_RATE_LIMIT_SALT/);
  assert.match(edgeWorker, /lookupProtectionConfigured/);
  assert.doesNotMatch(edgeWorker, /x-invite-code|verify-invite|TAM_NGU_INVITE_CODE/);
  const subscribeSource = edgeWorker.slice(edgeWorker.indexOf("async function subscribe"), edgeWorker.indexOf("async function unsubscribe"));
  const unsubscribeSource = edgeWorker.slice(edgeWorker.indexOf("async function unsubscribe"), edgeWorker.indexOf("function localClock"));
  assert.doesNotMatch(subscribeSource, /x-invite-code/);
  assert.doesNotMatch(unsubscribeSource, /x-invite-code/);
  assert.match(subscribeSource, /count: "exact"/);
  assert.doesNotMatch(edgeWorker, /mode: "silent"/);
  assert.match(secretConfigurer, /mkdtempSync/);
  assert.match(secretConfigurer, /GEMINI_API_KEYS/);
  assert.match(deployer, /functions", "deploy", "tam-ngu-api/);
  assert.match(verifier, /\/lookup/);
  assert.match(verifier, /慢一点/);
  assert.match(verifier, /Kỷ luật/);
  assert.match(verifier, /お疲れ様/);
  assert.match(rateLimitMigration, /v_device_minute >= 8/);
  assert.match(rateLimitMigration, /v_device_day >= 120/);
  assert.match(rateLimitMigration, /v_network_day >= 600/);
});
