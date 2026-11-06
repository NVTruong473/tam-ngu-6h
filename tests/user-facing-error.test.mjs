import assert from "node:assert/strict";
import test from "node:test";
import { userFacingError } from "../app/user-facing-error.mjs";

test("turns browser transport jargon into an actionable Vietnamese message", () => {
  const expected = "Không kết nối được. Hãy kiểm tra mạng rồi chạm thử lại nhé.";
  assert.equal(userFacingError(new TypeError("Failed to fetch"), "fallback"), expected);
  assert.equal(userFacingError(new Error("NetworkError when attempting to fetch resource"), "fallback"), expected);
  assert.equal(userFacingError(new Error("Load failed"), "fallback"), expected);
});

test("preserves deliberate API guidance and has a safe fallback", () => {
  assert.equal(userFacingError(new Error("Cậu tra hơi nhanh rồi."), "fallback"), "Cậu tra hơi nhanh rồi.");
  assert.equal(userFacingError(null, "Chưa tra được lúc này."), "Chưa tra được lúc này.");
});
