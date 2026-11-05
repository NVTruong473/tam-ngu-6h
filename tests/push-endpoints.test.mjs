import assert from "node:assert/strict";
import test from "node:test";

import {
  hasValidPushKeys,
  isSupportedPushEndpoint,
} from "../supabase/functions/tam-ngu-api/push-endpoints.mjs";

const validKeys = {
  p256dh: "A".repeat(65),
  auth: "b".repeat(22),
};

test("accepts established browser push services", () => {
  assert.equal(isSupportedPushEndpoint("https://web.push.apple.com/QE_valid-capability"), true);
  assert.equal(isSupportedPushEndpoint("https://fcm.googleapis.com/fcm/send/valid-token"), true);
  assert.equal(isSupportedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/valid-token"), true);
  assert.equal(isSupportedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=valid"), true);
});

test("rejects arbitrary or ambiguous delivery targets", () => {
  assert.equal(isSupportedPushEndpoint("http://fcm.googleapis.com/fcm/send/token"), false);
  assert.equal(isSupportedPushEndpoint("https://fcm.googleapis.com.evil.example/fcm/send/token"), false);
  assert.equal(isSupportedPushEndpoint("https://fcm.googleapis.com:444/fcm/send/token"), false);
  assert.equal(isSupportedPushEndpoint("https://fcm.googleapis.com/not-push/token"), false);
  assert.equal(isSupportedPushEndpoint("https://example.com/wpush/token"), false);
  assert.equal(isSupportedPushEndpoint("not a url"), false);
});

test("requires complete base64url Web Push encryption keys", () => {
  assert.equal(hasValidPushKeys({ endpoint: "https://example.test", keys: validKeys }), true);
  assert.equal(hasValidPushKeys({ endpoint: "https://example.test", keys: { ...validKeys, p256dh: "short" } }), false);
  assert.equal(hasValidPushKeys({ endpoint: "https://example.test", keys: { ...validKeys, auth: "not+base64/url" } }), false);
  assert.equal(hasValidPushKeys(undefined), false);
});
