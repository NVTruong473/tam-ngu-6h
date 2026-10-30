const CACHE_VERSION = "tam-ngu-6h-v8";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const root = new URL("./", self.registration.scope);
      const shell = [
        new URL("manifest.webmanifest", root).href,
        new URL("icons/icon-192.png", root).href,
        new URL("icons/icon-512.png", root).href,
        new URL("icons/apple-touch-icon.png", root).href,
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
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))),
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

self.addEventListener("push", (event) => {
  const fallback = { title: "Tâm Ngữ 6H", body: "Một bài học nhỏ đang chờ cậu." };
  let payload = fallback;
  try { payload = { ...fallback, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: new URL("icons/icon-192.png", self.registration.scope).href,
    badge: new URL("icons/icon-192.png", self.registration.scope).href,
    // The newest lesson replaces the earlier card instead of creating a stack.
    tag: "tam-ngu-current-lesson",
    renotify: false,
    timestamp: payload.timestamp || Date.now(),
    data: { url: payload.url || self.registration.scope },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || self.registration.scope));
});
