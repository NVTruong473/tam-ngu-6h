export function isSupportedPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port || endpoint.length > 2048) return false;
    const hostname = url.hostname.toLowerCase();
    const path = url.pathname;
    // PushSubscription endpoints are opaque capabilities, but accepting every
    // HTTPS URL would turn this server into an authenticated-request proxy.
    // Keep the complete URL while limiting delivery to established browser
    // push services used by iOS/Safari, Chromium/Android, Firefox and Edge.
    return (hostname === "web.push.apple.com" || hostname.endsWith(".push.apple.com"))
      || (hostname === "fcm.googleapis.com" && path.startsWith("/fcm/send/"))
      || (hostname === "updates.push.services.mozilla.com" && path.startsWith("/wpush/"))
      || (hostname.endsWith(".notify.windows.com") && path.startsWith("/w/"));
  } catch {
    return false;
  }
}

export function hasValidPushKeys(subscription) {
  return Boolean(subscription
    && /^[A-Za-z0-9_-]{40,180}$/.test(subscription.keys?.p256dh || "")
    && /^[A-Za-z0-9_-]{12,80}$/.test(subscription.keys?.auth || ""));
}
