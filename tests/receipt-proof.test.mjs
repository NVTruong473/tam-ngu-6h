import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptProof, receiptMaximumAgeMs, verifyReceiptProof } from "../supabase/functions/tam-ngu-api/receipt-proof.mjs";

test("accepts an authentic and recent device receipt", async () => {
  const secret = "server-only-rate-limit-salt";
  const receiptId = "dispatch:3a98b290-61cf-4cfe-a575-d6857ab59744";
  const now = Date.parse("2026-11-06T03:00:00.000Z");
  const token = await createReceiptProof(secret, receiptId, now);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifyReceiptProof(secret, receiptId, now, token, now + 1_000), true);
});

test("rejects tampering, another secret and expired receipts", async () => {
  const secret = "server-only-rate-limit-salt";
  const receiptId = "dispatch:3a98b290-61cf-4cfe-a575-d6857ab59744";
  const now = Date.parse("2026-11-06T03:00:00.000Z");
  const token = await createReceiptProof(secret, receiptId, now);
  assert.equal(await verifyReceiptProof(secret, `${receiptId}0`, now, token, now), false);
  assert.equal(await verifyReceiptProof("another-secret", receiptId, now, token, now), false);
  assert.equal(await verifyReceiptProof(secret, receiptId, now, token, now + receiptMaximumAgeMs + 1), false);
  assert.equal(await verifyReceiptProof(secret, receiptId, now, `${token.slice(0, -1)}!`, now), false);
  const futureTimestamp = now + (5 * 60 * 1_000) + 1;
  const futureToken = await createReceiptProof(secret, receiptId, futureTimestamp);
  assert.equal(await verifyReceiptProof(secret, receiptId, futureTimestamp, futureToken, now), false);
});
