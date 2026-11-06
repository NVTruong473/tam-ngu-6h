export function constantTimeEqual(first, second) {
  const firstBytes = new TextEncoder().encode(String(first || ""));
  const secondBytes = new TextEncoder().encode(String(second || ""));
  if (firstBytes.length !== secondBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < firstBytes.length; index += 1) {
    difference |= firstBytes[index] ^ secondBytes[index];
  }
  return difference === 0;
}

export function subscriptionKeysMatch(stored, provided) {
  return Boolean(stored
    && provided
    && stored.endpoint === provided.endpoint
    && constantTimeEqual(stored.keys?.p256dh, provided.keys?.p256dh)
    && constantTimeEqual(stored.keys?.auth, provided.keys?.auth));
}
