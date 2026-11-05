const CACHE_VERSION = "tam-ngu-6h-v14";
const NOTIFICATION_CACHE = "tam-ngu-notifications-v1";
const seenNotificationIds = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const root = new URL("./", self.registration.scope);
      const shell = [
        new URL("manifest.webmanifest", root).href,
        new URL("icons/icon-v2-192.png", root).href,
        new URL("icons/icon-v2-512.png", root).href,
        new URL("icons/icon-v2-1024.png", root).href,
        new URL("icons/apple-touch-icon-v2.png", root).href,
        new URL("mascot.png", root).href,
      ];
      await cache.addAll(shell);

      const pageResponse = await fetch(root.href, { cache: "reload" });
      if (!pageResponse.ok) throw new Error("Không tải được app shell.");
      await cache.put(root.href, pageResponse.clone());

      const html = await pageResponse.text();
      const dependencies = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], root))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
      await cache.addAll([...new Set(dependencies)]);
    }),
  );
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE_VERSION, NOTIFICATION_CACHE].includes(key)).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isPageNavigation = event.request.mode === "navigate";

  if (isPageNavigation) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && requestUrl.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(new URL("./", self.registration.scope).href));
    }),
  );
});

async function displayPush(payload) {
  const notificationId = String(payload.notificationId || `${payload.title}:${payload.body}`).slice(0, 240);
  if (seenNotificationIds.has(notificationId)) return;
  seenNotificationIds.add(notificationId);

  const cache = await caches.open(NOTIFICATION_CACHE);
  const marker = new Request(new URL(`.notification/${encodeURIComponent(notificationId)}`, self.registration.scope).href);
  if (await cache.match(marker)) return;
  await cache.put(marker, new Response("seen", { headers: { "x-created-at": String(Date.now()) } }));

  const existing = await self.registration.getNotifications().catch(() => []);
  existing.forEach((notification) => notification.close());
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: new URL("icons/icon-v2-192.png", self.registration.scope).href,
    // iOS owns the card layout; one stable tag plus explicit closing above
    // guarantees that a new lesson replaces the previous lesson card.
    tag: "tam-ngu-current-lesson",
    renotify: false,
    timestamp: payload.timestamp || Date.now(),
    data: { url: payload.url || self.registration.scope },
  });
}

self.addEventListener("push", (event) => {
  const fallback = { title: "Tam Ngữ 6H", body: "Một bài học nhỏ đang chờ cậu." };
  let payload = fallback;
  try { payload = { ...fallback, ...event.data.json() }; } catch {}
  event.waitUntil(displayPush(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || self.registration.scope));
});
