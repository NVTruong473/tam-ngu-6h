import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryPhaseAtHour,
  symbolForDeliveryPhase,
} from "../supabase/functions/tam-ngu-api/delivery-phase.mjs";

test("uses the same day parts as the installed app for custom schedules", () => {
  assert.equal(deliveryPhaseAtHour(0), "night");
  assert.equal(deliveryPhaseAtHour(5), "night");
  assert.equal(deliveryPhaseAtHour(6), "morning");
  assert.equal(deliveryPhaseAtHour(11), "morning");
  assert.equal(deliveryPhaseAtHour(12), "noon");
  assert.equal(deliveryPhaseAtHour(17), "noon");
  assert.equal(deliveryPhaseAtHour(18), "evening");
  assert.equal(deliveryPhaseAtHour(21), "evening");
  assert.equal(deliveryPhaseAtHour(22), "night");
  assert.equal(deliveryPhaseAtHour(23), "night");
});

test("uses calm night visuals and rejects invalid hours", () => {
  assert.equal(symbolForDeliveryPhase("morning"), "☀️");
  assert.equal(symbolForDeliveryPhase("noon"), "🌤️");
  assert.equal(symbolForDeliveryPhase("evening"), "🌙");
  assert.equal(symbolForDeliveryPhase("night"), "🌙");
  assert.throws(() => deliveryPhaseAtHour(24), /0–23/);
  assert.throws(() => deliveryPhaseAtHour(1.5), /0–23/);
});
