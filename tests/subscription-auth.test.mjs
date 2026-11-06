import assert from "node:assert/strict";
import test from "node:test";
import {
  constantTimeEqual,
  subscriptionKeysMatch,
} from "../supabase/functions/tam-ngu-api/subscription-auth.mjs";

const subscription = {
  endpoint: "https://web.push.apple.com/Q2FwYWJpbGl0eQ",
  keys: {
    p256dh: "A".repeat(87),
    auth: "B".repeat(22),
  },
};

test("authenticates only the exact endpoint and Web Push encryption keys", () => {
  assert.equal(subscriptionKeysMatch(subscription, structuredClone(subscription)), true);
  assert.equal(subscriptionKeysMatch(subscription, { ...subscription, endpoint: `${subscription.endpoint}x` }), false);
  assert.equal(subscriptionKeysMatch(subscription, { ...subscription, keys: { ...subscription.keys, auth: "C".repeat(22) } }), false);
  assert.equal(subscriptionKeysMatch(subscription, null), false);
});

test("compares equal-length secrets without accepting prefixes", () => {
  assert.equal(constantTimeEqual("same-secret", "same-secret"), true);
  assert.equal(constantTimeEqual("same-secret", "same-secrex"), false);
  assert.equal(constantTimeEqual("same-secret", "same-secret-longer"), false);
});
