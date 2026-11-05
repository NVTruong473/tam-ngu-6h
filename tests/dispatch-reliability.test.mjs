import assert from "node:assert/strict";
import test from "node:test";
import {
  isRetryablePushFailure,
  latestDueSchedule,
  mapWithConcurrency,
  pushRetryDelayMs,
} from "../supabase/functions/tam-ngu-api/dispatch-reliability.mjs";

test("finds the newest scheduled slot inside a bounded recovery window", () => {
  const clock = { dateKey: "20261106", minuteOfDay: 12 * 60 + 7 };
  assert.deepEqual(latestDueSchedule(clock, ["06:00", "12:00", "12:05"], 10), {
    time: "12:05",
    hour: 12,
    latenessMinutes: 2,
    dispatchKey: "202611061205",
  });
  assert.equal(latestDueSchedule(clock, ["06:00"], 10), null);
  assert.equal(latestDueSchedule(clock, ["12:08"], 10), null);
});

test("keeps a failed late-night slot recoverable after midnight", () => {
  assert.deepEqual(latestDueSchedule({ dateKey: "20260101", minuteOfDay: 3 }, ["23:58", "00:05"], 10), {
    time: "23:58",
    hour: 23,
    latenessMinutes: 5,
    dispatchKey: "202512312358",
  });
});

test("retries only transient Web Push failures with a short bounded delay", () => {
  assert.equal(isRetryablePushFailure(0), true);
  assert.equal(isRetryablePushFailure(429), true);
  assert.equal(isRetryablePushFailure(503), true);
  assert.equal(isRetryablePushFailure(410), false);
  assert.equal(pushRetryDelayMs(429, { "retry-after": "2" }, 0, 0), 2_000);
  assert.equal(pushRetryDelayMs(429, { "retry-after": "60" }, 0, 0), 5_000);
  assert.equal(pushRetryDelayMs(400, {}, 0, 0), null);
});

test("bounds asynchronous delivery concurrency without losing result order", async () => {
  let active = 0;
  let maximum = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 4));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
  assert.equal(maximum, 3);
});
