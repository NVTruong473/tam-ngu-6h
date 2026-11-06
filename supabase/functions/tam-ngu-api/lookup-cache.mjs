const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const lookupCacheVersion = "v2";
export const lookupCacheTtlDays = 7;
export const lookupCacheMaximumEntries = 2_000;

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hexadecimal(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeLookupCacheQuery(value) {
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`${lookupCacheVersion}:tam-ngu:lookup-index:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function encryptionKey(secret) {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${lookupCacheVersion}:tam-ngu:lookup-cipher:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function lookupCacheKey(secret, query) {
  if (!secret) throw new Error("Lookup cache secret is not configured.");
  const normalized = normalizeLookupCacheQuery(query);
  if (!normalized) throw new Error("Lookup cache query is empty.");
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(normalized));
  return hexadecimal(new Uint8Array(signature));
}

export async function encryptLookupCacheValue(secret, value) {
  if (!secret) throw new Error("Lookup cache secret is not configured.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(lookupCacheVersion) },
    await encryptionKey(secret),
    encoder.encode(JSON.stringify(value)),
  );
  return `${lookupCacheVersion}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptLookupCacheValue(secret, value) {
  if (!secret) throw new Error("Lookup cache secret is not configured.");
  const [version, encodedIv, encodedCiphertext, extra] = String(value || "").split(".");
  if (version !== lookupCacheVersion || !encodedIv || !encodedCiphertext || extra) {
    throw new Error("Lookup cache payload is invalid.");
  }
  const iv = fromBase64Url(encodedIv);
  if (iv.byteLength !== 12) throw new Error("Lookup cache IV is invalid.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(lookupCacheVersion) },
    await encryptionKey(secret),
    fromBase64Url(encodedCiphertext),
  );
  return JSON.parse(decoder.decode(decrypted));
}
