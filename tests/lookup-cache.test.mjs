import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptLookupCacheValue,
  encryptLookupCacheValue,
  lookupCacheKey,
  lookupCacheMaximumEntries,
  lookupCacheTtlDays,
  normalizeLookupCacheQuery,
} from "../supabase/functions/tam-ngu-api/lookup-cache.mjs";

test("cache key canonicalizes equivalent queries without storing plaintext", async () => {
  assert.equal(normalizeLookupCacheQuery("  Xin   CHÀO  "), "xin chào");
  const first = await lookupCacheKey("secret-a", "Xin   CHÀO");
  const equivalent = await lookupCacheKey("secret-a", " xin chào ");
  const otherQuery = await lookupCacheKey("secret-a", "tạm biệt");
  const otherSecret = await lookupCacheKey("secret-b", "xin chào");
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, equivalent);
  assert.notEqual(first, otherQuery);
  assert.notEqual(first, otherSecret);
});

test("cache payload uses randomized authenticated encryption", async () => {
  const result = { meaning: "xin chào", examples: ["hello"] };
  const first = await encryptLookupCacheValue("secret-a", result);
  const second = await encryptLookupCacheValue("secret-a", result);
  assert.notEqual(first, second);
  assert.deepEqual(await decryptLookupCacheValue("secret-a", first), result);
  await assert.rejects(() => decryptLookupCacheValue("wrong-secret", first));
  await assert.rejects(() => decryptLookupCacheValue("secret-a", `${first}tampered`));
});

test("cache retention is deliberately bounded", () => {
  assert.equal(lookupCacheTtlDays, 7);
  assert.equal(lookupCacheMaximumEntries, 2_000);
});
