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
  assert.match(serviceWorker, /tam-ngu-6h-v18/);
  assert.match(serviceWorker, /html\.matchAll/);
  assert.match(serviceWorker, /skipWaiting/);
  assert.match(serviceWorker, /clients\.claim/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /payload\?\.web_push === 8030/);
  assert.match(serviceWorker, /normalizePushPayload/);
  assert.match(serviceWorker, /acknowledgePush/);
  assert.match(serviceWorker, /\/receipt/);
  assert.match(serviceWorker, /Persist deduplication only after display succeeds/);
  assert.ok(
    serviceWorker.indexOf("await self.registration.showNotification") < serviceWorker.indexOf("await cache.put(marker"),
    "the service worker must not mark a notification as seen before iOS accepts the display call",
  );
  assert.match(serviceWorker, /tam-ngu-current-lesson/);
  assert.match(serviceWorker, /renotify: false/);
  assert.match(serviceWorker, /seenNotificationIds/);
  assert.match(serviceWorker, /getNotifications/);
  assert.match(serviceWorker, /notification\.close/);
  assert.match(serviceWorker, /icon-v2-192\.png/);
  assert.doesNotMatch(serviceWorker, /badge:/);
  assert.match(serviceWorker, /setUnreadAppBadge/);
  assert.match(serviceWorker, /setAppBadge\(1\)/);
  assert.match(serviceWorker, /client\.visibilityState === "visible"/);
  assert.match(serviceWorker, /clearUnreadAppBadge/);
  assert.match(serviceWorker, /clearAppBadge\(\)/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /pushsubscriptionchange/);
  assert.match(serviceWorker, /refresh-subscription/);
  assert.match(serviceWorker, /clients\.matchAll\(\{ type: "window", includeUncontrolled: true \}\)/);
  assert.match(serviceWorker, /NOTIFICATION_CACHE_MAX_ENTRIES = 96/);
  assert.match(serviceWorker, /cache\.put\(root\.href, copy\)/);
  assert.match(serviceWorker, /catch\(\(\) => Response\.error\(\)\)/);
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
    && [...item.notification.english].length <= 39
    && [...item.notification.chinese].length <= 16
    && [...item.notification.vietnamese].length <= 42));
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

test("keeps setup inside Tam Ngữ with one explicit iOS permission", async () => {
  const [page, styles, userFacingErrorSource, packageText] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/user-facing-error.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /showActivation/);
  assert.match(page, /Cho phép & hoàn tất/);
  assert.match(page, /Notification\.requestPermission/);
  assert.match(page, /pushManager\.subscribe/);
  assert.match(page, /activationPrompt/);
  assert.match(page, /Không app phụ/);
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /appinstalled/);
  assert.match(page, /beginOneTapSetup/);
  assert.match(page, /Cài Tam Ngữ ngay/);
  assert.match(page, /Bật bài học trên Màn hình khóa/);
  assert.match(page, /WidgetKit và App Intents đã nằm trong bản cài/);
  assert.match(page, /Thẻ học native · Cách thêm/);
  assert.match(page, /Không phát âm thanh và không phải thông báo/i);
  assert.match(page, /showWidgetSetup && nativeApp/);
  assert.match(page, /showActivation && !nativeApp/);
  assert.match(page, /showInstall && !nativeApp/);
  assert.match(page, /altstore:\/\/source\?url=/);
  assert.match(page, /releases\/latest\/download\/altstore-source\.json/);
  assert.match(page, /Mở bản native trong AltStore/);
  assert.doesNotMatch(page, /Bật nhịp hằng ngày/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /userFacingError/);
  assert.match(userFacingErrorSource, /Không kết nối được/);
  assert.match(page, /aria-label="Tìm trong thư viện bài học"/);
  assert.match(page, /persistSchedule/);
  assert.match(page, /Thêm & lưu/);
  assert.match(page, /mọi thay đổi tự lưu/);
  assert.doesNotMatch(page, /Lưu lịch thông báo/);
  assert.match(styles, /button \{ min-width: 44px; min-height: 44px;/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(page, /Scriptable|scriptable:\/\/\/|showWidgetInstall|navigator\.clipboard/);
  assert.doesNotMatch(packageText, /build-widget-data/);
  assert.match(packageText, /generate:widget-data/);
});

test("consumes smoke-test responses before their timeout signal expires", async () => {
  const smoke = await readFile(new URL("scripts/smoke-production.mjs", root), "utf8");
  assert.match(smoke, /return await response\.text\(\)/);
  assert.doesNotMatch(smoke, /return response;/);
});

test("keeps Gemini credentials server-only while shipping push and quick lookup", async () => {
  const [page, generator, appendGenerator, pronunciationEnricher, pronunciationRepairer, curriculumVerifier, edgeWorker, lookupCache, lookupQuality, pushEndpoints, dispatchReliability, pushPayload, subscriptionAuth, workflow, monitorWorkflow, backendDeployWorkflow, secretConfigurer, deployer, verifier, rateLimitMigration, migrationRunner] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("scripts/generate-curriculum.mjs", root), "utf8"),
    readFile(new URL("scripts/append-curriculum.mjs", root), "utf8"),
    readFile(new URL("scripts/enrich-vietnamese-readings.mjs", root), "utf8"),
    readFile(new URL("scripts/repair-vietnamese-readings.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-curriculum.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/index.ts", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/lookup-cache.mjs", root), "utf8"),
    readFile(new URL("scripts/lookup-quality.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/push-endpoints.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/dispatch-reliability.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/push-payload.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/tam-ngu-api/subscription-auth.mjs", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readFile(new URL(".github/workflows/production-monitor.yml", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-supabase.yml", root), "utf8"),
    readFile(new URL("scripts/configure-supabase-lookup.mjs", root), "utf8"),
    readFile(new URL("scripts/deploy-supabase-function.mjs", root), "utf8"),
    readFile(new URL("scripts/verify-supabase-api.mjs", root), "utf8"),
    readFile(new URL("supabase/migrations/20261102090000_lookup_rate_limit.sql", root), "utf8"),
    readFile(new URL("scripts/apply-supabase-migration.mjs", root), "utf8"),
  ]);
  const source = `${page}\n${generator}\n${appendGenerator}\n${pronunciationEnricher}\n${pronunciationRepairer}\n${curriculumVerifier}\n${edgeWorker}\n${lookupCache}\n${pushEndpoints}\n${dispatchReliability}\n${pushPayload}\n${subscriptionAuth}\n${workflow}\n${monitorWorkflow}\n${backendDeployWorkflow}\n${secretConfigurer}\n${deployer}\n${verifier}`;

  assert.doesNotMatch(source, /(?:AQ\.|sk-proj-|sk-or-v1-|gsk_|nvapi-)[A-Za-z0-9_-]{8,}/);
  assert.match(generator, /process\.env\.GEMINI_API_KEY/);
  assert.match(workflow, /secrets\.GEMINI_API_KEYS/);
  assert.match(workflow, /Append up to 3 independently verified lessons/);
  assert.match(workflow, /for candidate in \$\(seq 1 8\)/);
  assert.match(workflow, /Accepted \$accepted\/3 new lessons/);
  assert.match(workflow, /cp "\$backup" app\/curriculum\.json/);
  assert.match(workflow, /npm run append:curriculum && npm run verify:curriculum/);
  assert.match(workflow, /npm run smoke:production/);
  assert.match(workflow, /npm run quality:gate/);
  assert.match(workflow, /if: always\(\) && needs\.build\.result == 'success'/);
  assert.match(workflow, /if: always\(\) && needs\.deploy\.result == 'success'/);
  assert.match(monitorWorkflow, /cron: "17 \* \* \* \*"/);
  assert.match(monitorWorkflow, /cron: "37 22 \* \* \*"/);
  assert.match(monitorWorkflow, /SMOKE_DEEP_LOOKUP/);
  assert.match(monitorWorkflow, /npm run smoke:production/);
  assert.match(lookupQuality, /polite-rewrite/);
  assert.match(lookupQuality, /selectDailyLookupQualityCase/);
  assert.match(backendDeployWorkflow, /npm run supabase:verify/);
  assert.match(monitorWorkflow, /permissions:\s+contents: read/);
  assert.match(monitorWorkflow, /report-health:/);
  assert.match(monitorWorkflow, /issues: write/);
  assert.match(monitorWorkflow, /needs\.monitor\.result/);
  assert.match(monitorWorkflow, /gh issue create/);
  assert.match(monitorWorkflow, /gh issue close/);
  assert.match(monitorWorkflow, /Issue này sẽ tự đóng/);
  assert.match(backendDeployWorkflow, /permissions:\s+contents: read/);
  assert.match(backendDeployWorkflow, /secrets\.SUPABASE_ACCESS_TOKEN/);
  assert.doesNotMatch(backendDeployWorkflow, /npm run supabase:apply/);
  assert.match(backendDeployWorkflow, /npx --yes supabase@3\.0\.0 functions deploy tam-ngu-api/);
  assert.match(backendDeployWorkflow, /--remote="\$SUPABASE_PROJECT_REF"/);
  assert.match(backendDeployWorkflow, /--no-verify-jwt/);
  assert.match(backendDeployWorkflow, /--use-api/);
  assert.match(backendDeployWorkflow, /--yes/);
  assert.match(backendDeployWorkflow, /SMOKE_DEEP_LOOKUP: "1"/);
  assert.match(backendDeployWorkflow, /SMOKE_REQUIRE_DECLARATIVE_WORKER: "0"/);
  assert.match(backendDeployWorkflow, /npm run smoke:production/);
  assert.match(page, /Thư viện bài học/);
  assert.doesNotMatch(page, /Gemini tạo thêm theo lộ trình/);
  assert.match(page, /Đọc gần Việt/);
  assert.match(page, /Notification\.requestPermission/);
  assert.match(page, /clearUnreadAppBadge/);
  assert.match(page, /clearAppBadge/);
  assert.doesNotMatch(page, /registration\.showNotification/);
  assert.match(page, /\/test-push/);
  assert.match(page, /Bài kiểm tra thật đang được gửi qua máy chủ/);
  assert.match(page, /Gửi thẻ kiểm tra ngay/);
  assert.match(page, /sendRemoteTestPush/);
  assert.match(edgeWorker, /EN  \$\{notification\.english/);
  assert.match(edgeWorker, /encodeURIComponent\(lesson\.id\)/);
  assert.match(edgeWorker, /Only a later due delivery can clear that alarm/);
  assert.match(edgeWorker, /deliveryPhaseAtHour/);
  assert.match(edgeWorker, /lessonSelectionForCursor/);
  assert.match(edgeWorker, /Ôn tập vòng/);
  assert.match(edgeWorker, /phase === "night" \? lesson\?\.nightWish/);
  assert.match(edgeWorker, /tam-ngu-internal:\/\/dispatch-cron/);
  assert.match(edgeWorker, /"🧪 Tam Ngữ đã kết nối"/);
  assert.match(edgeWorker, /readBoundedJson/);
  assert.match(edgeWorker, /http:\/\/localhost:3000/);
  assert.match(edgeWorker, /http:\/\/127\.0\.0\.1:3000/);
  assert.match(edgeWorker, /pushRequestMaximumBytes = 16_384/);
  assert.match(edgeWorker, /lookupRequestMaximumBytes = 4_096/);
  assert.match(edgeWorker, /keyAuthenticatedMutations: true/);
  assert.match(edgeWorker, /appOpenReconciliation: true/);
  assert.match(edgeWorker, /last_sent_at: stored\.last_sent_at \|\| null/);
  assert.match(pushPayload, /declarativeWebPushVersion = 8030/);
  assert.match(pushPayload, /app_badge: "1"/);
  assert.match(pushPayload, /mutable: true/);
  assert.match(pushPayload, /maximumWebPushPayloadBytes = 3_993/);
  assert.match(page, /WidgetKit làm thẻ học chính/);
  assert.match(page, /Thông báo chỉ là tùy chọn phụ/);
  assert.match(edgeWorker, /icon-v2-192\.png/);
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
  assert.match(page, /\/subscription-status/);
  assert.match(page, /rotateExpiredSubscription/);
  assert.match(page, /subscription: subscription\.toJSON\(\)/);
  assert.match(page, /LOOKUP_CACHE_KEY/);
  assert.match(page, /tamngu6h\.lookup-cache\.v3/);
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
  assert.match(edgeWorker, /"🧪 Bản xem thử"/);
  assert.match(edgeWorker, /lessonSelection\.isReview \? `Ôn tập vòng \$\{lessonSelection\.round\}` : "Bài mới"/);
  assert.match(edgeWorker, /`中  \$\{notification\.chinese/);
  assert.match(edgeWorker, /`VI  \$\{notification\.vietnamese/);
  assert.match(edgeWorker, /notificationId: isDueRun/);
  assert.match(edgeWorker, /async function testPush/);
  assert.match(edgeWorker, /action === "test-push"/);
  assert.match(edgeWorker, /testPushCooldownMs = 60_000/);
  assert.match(edgeWorker, /urgency: "high"/);
  assert.match(edgeWorker, /subscriptionKeysMatch\(storedSubscription, body!\.subscription!\)/);
  assert.match(edgeWorker, /install_hash/);
  assert.match(edgeWorker, /askGeminiForLookup/);
  assert.match(edgeWorker, /lookupCacheEndpointPrefix = "tam-ngu-cache:\/\/"/);
  assert.match(edgeWorker, /lookupCacheRecordKind = `lookup-cache-\$\{lookupCacheVersion\}`/);
  assert.match(edgeWorker, /\.range\(lookupCacheMaximumEntries, lookupCacheMaximumEntries \+ 499\)/);
  assert.match(edgeWorker, /Lookup cache read unavailable; using Gemini fallback/);
  assert.match(edgeWorker, /replace\(\/\\bkích ơn\\b\/giu, "cảm kích"\)/);
  assert.match(edgeWorker, /meaning phải bắt đầu bằng phương án đã viết lại/);
  assert.match(edgeWorker, /plaintextQueriesStored: false/);
  assert.match(page, /Đã dùng lại kết quả được bảo vệ/);
  assert.match(lookupCache, /AES-GCM/);
  assert.match(lookupCache, /name: "HMAC", hash: "SHA-256"/);
  assert.match(lookupCache, /crypto\.getRandomValues\(new Uint8Array\(12\)\)/);
  assert.match(migrationRunner, /readdirSync/);
  assert.match(migrationRunner, /SUPABASE_ACCESS_TOKEN/);
  assert.match(edgeWorker, /Japanese, Korean/);
  assert.match(edgeWorker, /LOOKUP_QUERY_MAXIMUM = 240/);
  assert.match(edgeWorker, /validScheduleTimes/);
  assert.match(edgeWorker, /mode\?: "due"/);
  assert.match(edgeWorker, /last_dispatch_key/);
  assert.doesNotMatch(page, /Math\.min\(unlockedIndex, curriculum\.length - 1\)/);
  assert.match(page, /scheduledLesson\.index/);
  assert.match(edgeWorker, /lesson_cursor: body\?\.preview \? row\.lesson_cursor \?\? rawCursor : rawCursor \+ 1/);
  assert.match(edgeWorker, /normalizeLookupExample/);
  assert.match(edgeWorker, /hasToneGuidance/);
  assert.match(edgeWorker, /applyToneGuides/);
  assert.match(edgeWorker, /return expected === supplied/);
  assert.match(edgeWorker, /normalize\("NFC"\)/);
  assert.match(edgeWorker, /pinyinToneForSyllable/);
  assert.match(edgeWorker, /Unequal syllable counts cannot be aligned safely/);
  assert.match(edgeWorker, /Đặt từng marker \(1\)–\(4\) ngay sau đúng âm tiết/);
  assert.match(edgeWorker, /geminiAttemptTimeoutMs = 12_000/);
  assert.match(edgeWorker, /geminiLookupBudgetMs = 72_000/);
  assert.match(edgeWorker, /geminiRetryDelayMs = 4_000/);
  assert.match(edgeWorker, /round < 2/);
  assert.match(edgeWorker, /for \(const \[index, key\] of keys\.entries\(\)\)/);
  assert.doesNotMatch(edgeWorker, /keys\.slice\(0, 3\)/);
  assert.match(edgeWorker, /minItems: 2/);
  assert.match(edgeWorker, /GEMINI_API_KEYS/);
  assert.match(edgeWorker, /constantTimeEqual/);
  assert.match(edgeWorker, /isSupportedPushEndpoint/);
  assert.match(edgeWorker, /supportedPushProviders = \["apple", "fcm", "mozilla", "wns"\]/);
  assert.match(pushEndpoints, /hostname === "fcm\.googleapis\.com" && path\.startsWith\("\/fcm\/send\/"\)/);
  assert.match(pushEndpoints, /hostname === "updates\.push\.services\.mozilla\.com" && path\.startsWith\("\/wpush\/"\)/);
  assert.match(pushEndpoints, /hostname\.endsWith\("\.notify\.windows\.com"\) && path\.startsWith\("\/w\/"\)/);
  assert.match(edgeWorker, /hasValidPushKeys/);
  assert.match(edgeWorker, /async function refreshSubscription/);
  assert.match(edgeWorker, /action === "refresh-subscription"/);
  assert.match(edgeWorker, /async function subscriptionStatus/);
  assert.match(edgeWorker, /action === "subscription-status"/);
  assert.match(edgeWorker, /subscriptionKeysMatch\(stored, body!\.oldSubscription!\)/);
  assert.match(edgeWorker, /Không thể xác minh đăng ký thông báo cũ/);
  assert.match(edgeWorker, /Không thể ghi đè đăng ký của thiết bị khác/);
  assert.match(subscriptionAuth, /constantTimeEqual/);
  assert.match(subscriptionAuth, /subscriptionKeysMatch/);
  assert.match(edgeWorker, /topic: "tam-ngu-current-lesson"/);
  assert.match(edgeWorker, /last_dispatch_key\.is\.null,last_dispatch_key\.neq\.\$\{scheduled\.dispatchKey\}/);
  assert.match(edgeWorker, /databaseHealthy \? 200 : 503/);
  assert.match(edgeWorker, /dispatchConcurrency = 8/);
  assert.match(edgeWorker, /dispatchGraceMinutes = 10/);
  assert.match(edgeWorker, /sendWebPushWithRetry/);
  assert.match(edgeWorker, /failureState\.last_dispatch_key = row\.last_dispatch_key/);
  assert.match(edgeWorker, /dispatchReliability/);
  assert.match(dispatchReliability, /latestDueSchedule/);
  assert.match(dispatchReliability, /pushRetryDelayMs/);
  assert.match(dispatchReliability, /mapWithConcurrency/);
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
  assert.match(subscribeSource, /count: "exact", head: true \}\)\s*\.eq\("enabled", true\)/);
  assert.match(subscribeSource, /subscriptionKeysMatch/);
  assert.match(unsubscribeSource, /subscriptionKeysMatch/);
  assert.match(page, /Đưa Tam Ngữ lên \{devicePlatform === "android" \? "Android" : "iPhone"\}/);
  assert.match(page, /Mở đường link bằng <strong>Chrome<\/strong>/);
  assert.match(page, /syncWebPushSubscription/);
  assert.match(page, /pushsubscriptionchange is not available in every browser/);
  assert.doesNotMatch(edgeWorker, /mode: "silent"/);
  assert.match(secretConfigurer, /mkdtempSync/);
  assert.match(secretConfigurer, /GEMINI_API_KEYS/);
  assert.match(deployer, /functions", "deploy", "tam-ngu-api/);
  assert.match(deployer, /`--remote=\$\{ref\}`/);
  assert.match(deployer, /"--yes"/);
  const productionSmoke = await readFile(new URL("scripts/smoke-production.mjs", root), "utf8");
  assert.match(productionSmoke, /hasAlignedToneGuides/);
  assert.match(productionSmoke, /dispatchReliability/);
  assert.match(productionSmoke, /verifyLookupWithRetry/);
  assert.match(productionSmoke, /await wait\(6_000\)/);
  assert.match(verifier, /\/lookup/);
  assert.match(lookupQuality, /慢一点/);
  assert.match(lookupQuality, /Please rewrite politely/);
  assert.match(lookupQuality, /お疲れ様/);
  assert.match(verifier, /evaluateLookupQuality/);
  assert.match(rateLimitMigration, /v_device_minute >= 8/);
  assert.match(rateLimitMigration, /v_device_day >= 120/);
  assert.match(rateLimitMigration, /v_network_day >= 600/);
});
