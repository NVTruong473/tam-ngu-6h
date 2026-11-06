import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeclarativePushPayload,
  declarativeWebPushVersion,
  maximumWebPushPayloadBytes,
} from "../supabase/functions/tam-ngu-api/push-payload.mjs";

test("builds a backwards-compatible declarative Web Push payload", () => {
  const serialized = buildDeclarativePushPayload({
    title: "☀️ 06:00 · Bài mới",
    body: "EN  Take it easy.\n中  别着急。\nVI  Cứ bình tĩnh nhé.",
    navigate: "https://nvtruong473.github.io/tam-ngu-6h/?lesson=calm",
    icon: "https://nvtruong473.github.io/tam-ngu-6h/icons/icon-v2-192.png",
    notificationId: "due:202611060600",
    timestamp: 1_794_000_000_000,
    receipt: { id: "dispatch:test", timestamp: 1_794_000_000_000, token: "signed" },
  });
  const payload = JSON.parse(serialized);
  assert.equal(payload.web_push, declarativeWebPushVersion);
  assert.equal(payload.app_badge, "1");
  assert.equal(payload.notification.app_badge, undefined);
  assert.equal(payload.mutable, true);
  assert.equal(payload.notification.navigate, "https://nvtruong473.github.io/tam-ngu-6h/?lesson=calm");
  assert.equal(payload.notification.silent, false);
  assert.equal(payload.notification.data.notificationId, "due:202611060600");
  assert.equal(payload.notification.data.receipt.token, "signed");
  assert.ok(new TextEncoder().encode(serialized).byteLength < maximumWebPushPayloadBytes);
});

test("rejects unsafe URLs and an oversized push body", () => {
  const base = {
    title: "Bài mới",
    body: "Nội dung",
    navigate: "https://nvtruong473.github.io/tam-ngu-6h/",
    icon: "https://nvtruong473.github.io/tam-ngu-6h/icons/icon-v2-192.png",
    notificationId: "manual:test",
    timestamp: 1_794_000_000_000,
  };
  assert.throws(() => buildDeclarativePushPayload({ ...base, navigate: "javascript:alert(1)" }), /HTTPS/);
  assert.throws(() => buildDeclarativePushPayload({ ...base, body: "a".repeat(5_000) }), /gần 4 KB/);
});
