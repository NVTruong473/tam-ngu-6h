import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateLookupQuality,
  lookupQualityCases,
  selectDailyLookupQualityCase,
} from "../scripts/lookup-quality.mjs";

function result(overrides = {}) {
  return {
    sourceLanguage: "English",
    intent: "Correction",
    term: "I need more time.",
    meaning: "Could you please give me more time?",
    note: "Cách nói lịch sự, tự nhiên.",
    ...overrides,
  };
}

test("golden rewrite accepts a direct polite answer", () => {
  const rewrite = lookupQualityCases.find((entry) => entry.id === "polite-rewrite");
  assert.deepEqual(evaluateLookupQuality(rewrite, result()), []);
});

test("golden rewrite rejects a translation, wrong intent and known bad wording", () => {
  const rewrite = lookupQualityCases.find((entry) => entry.id === "polite-rewrite");
  const failures = evaluateLookupQuality(rewrite, result({
    intent: "Translation",
    meaning: "Tôi cần thêm thời gian.",
    note: "Tôi sẽ rất kích ơn nếu bạn chờ.",
  }));
  assert.equal(failures.length, 3);
});

test("Chinese golden case requires Chinese source and Han term", () => {
  const chinese = lookupQualityCases.find((entry) => entry.id === "chinese-phrase");
  assert.equal(evaluateLookupQuality(chinese, result({
    sourceLanguage: "Chinese",
    intent: "Translation",
    term: "慢一点",
  })).length, 0);
  assert.equal(evaluateLookupQuality(chinese, result({
    sourceLanguage: "English",
    intent: "Translation",
    term: "slowly",
  })).length, 2);
});

test("daily monitor rotates deterministically through every golden case", () => {
  const observed = new Set();
  for (let offset = 0; offset < lookupQualityCases.length; offset += 1) {
    observed.add(selectDailyLookupQualityCase(new Date(Date.UTC(2026, 10, 7 + offset))).id);
  }
  assert.equal(observed.size, lookupQualityCases.length);
});
