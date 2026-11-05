import assert from "node:assert/strict";
import test from "node:test";
import { schedulerFreshnessSeconds, schedulerHealth } from "../supabase/functions/tam-ngu-api/service-health.mjs";

test("scheduler heartbeat stays healthy inside the five-minute window", () => {
  const now = Date.parse("2026-11-06T14:30:00.000Z");
  assert.deepEqual(schedulerHealth("2026-11-06T14:26:01.000Z", now), {
    fresh: true,
    ageSeconds: 239,
  });
  assert.equal(schedulerFreshnessSeconds, 300);
});

test("scheduler heartbeat becomes unhealthy after the five-minute window", () => {
  const now = Date.parse("2026-11-06T14:30:00.000Z");
  assert.deepEqual(schedulerHealth("2026-11-06T14:24:59.000Z", now), {
    fresh: false,
    ageSeconds: 301,
  });
});

test("missing and implausibly future heartbeats are unhealthy", () => {
  const now = Date.parse("2026-11-06T14:30:00.000Z");
  assert.deepEqual(schedulerHealth(null, now), { fresh: false, ageSeconds: null });
  assert.deepEqual(schedulerHealth("2026-11-06T14:32:00.000Z", now), {
    fresh: false,
    ageSeconds: 0,
  });
});
