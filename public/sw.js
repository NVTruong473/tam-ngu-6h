const CACHE_VERSION = "tam-ngu-6h-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      const root = new URL("./", self.registration.scope);
      return cache.addAll([
        root.href,
        new URL("manifest.webmanifest", root).href,
        new URL("icons/icon-192.png", root).href,
        new URL("icons/icon-512.png", root).href,
        new URL("icons/apple-touch-icon.png", root).href,
        new URL("mascot.png", root).href,
      ]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
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
  const fallback = { title: "Tâm Ngữ 6H", body: "Một lời nhắc nhỏ: quay lại học tiếp nhé." };
  let payload = fallback;
  try { payload = { ...fallback, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: new URL("icons/icon-192.png", self.registration.scope).href,
    badge: new URL("icons/icon-192.png", self.registration.scope).href,
    data: { url: self.registration.scope },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || self.registration.scope));
});
