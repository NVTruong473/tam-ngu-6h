export const receiptMaximumAgeMs = 24 * 60 * 60 * 1000;
const receiptFutureToleranceMs = 5 * 60 * 1000;
const encoder = new TextEncoder();

function signatureBytes(token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=";
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function signatureToken(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function receiptKey(secret) {
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(`tam-ngu-receipt-v1:${secret}`));
  return await crypto.subtle.importKey("raw", keyMaterial, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function receiptMessage(receiptId, timestamp) {
  return encoder.encode(`v1\n${receiptId}\n${timestamp}`);
}

export async function createReceiptProof(secret, receiptId, timestamp) {
  if (!secret || !receiptId || !Number.isSafeInteger(timestamp)) throw new TypeError("Biên nhận không hợp lệ.");
  const signature = await crypto.subtle.sign("HMAC", await receiptKey(secret), receiptMessage(receiptId, timestamp));
  return signatureToken(new Uint8Array(signature));
}

export async function verifyReceiptProof(secret, receiptId, timestamp, token, now = Date.now()) {
  const signature = signatureBytes(String(token || ""));
  if (!secret || !receiptId || !Number.isSafeInteger(timestamp) || !signature) return false;
  if (timestamp < now - receiptMaximumAgeMs || timestamp > now + receiptFutureToleranceMs) return false;
  return await crypto.subtle.verify("HMAC", await receiptKey(secret), signature, receiptMessage(receiptId, timestamp));
}
