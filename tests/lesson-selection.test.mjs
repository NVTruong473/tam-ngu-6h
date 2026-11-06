import assert from "node:assert/strict";
import test from "node:test";
import { lessonSelectionForCursor } from "../supabase/functions/_shared/lesson-selection.mjs";

test("delivers every reviewed lesson once before starting a review round", () => {
  assert.deepEqual(lessonSelectionForCursor(0, 123), { index: 0, round: 1, isReview: false });
  assert.deepEqual(lessonSelectionForCursor(122, 123), { index: 122, round: 1, isReview: false });
  assert.deepEqual(lessonSelectionForCursor(123, 123), { index: 0, round: 2, isReview: true });
  assert.deepEqual(lessonSelectionForCursor(247, 123), { index: 1, round: 3, isReview: true });
});

test("handles an temporarily empty bank and rejects corrupt progress", () => {
  assert.deepEqual(lessonSelectionForCursor(0, 0), { index: 0, round: 1, isReview: false });
  assert.throws(() => lessonSelectionForCursor(-1, 123), /không âm/);
  assert.throws(() => lessonSelectionForCursor(1.5, 123), /không âm/);
  assert.throws(() => lessonSelectionForCursor(0, -1), /không âm/);
});
