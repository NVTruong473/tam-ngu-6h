const CACHE_VERSION = "tam-ngu-6h-v15";
const NOTIFICATION_CACHE = "tam-ngu-notifications-v1";
const NOTIFICATION_CACHE_MAX_ENTRIES = 96;
const PUSH_API_URL = "https://fcsuldrerhbynwotcvyn.supabase.co/functions/v1/tam-ngu-api";
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
        .then(async (response) => {
          if (response.ok) {
            const copy = response.clone();
            // Every lesson query renders the same static app shell. Cache it
            // once under the canonical root instead of storing an HTML copy for
            // every ?lesson=… notification URL.
            const root = new URL("./", self.registration.scope);
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(root.href, copy);
          }
          return response;
        })
        .catch(() => caches.match(new URL("./", self.registration.scope).href).then((cached) => cached || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then(async (response) => {
          if (response.ok && requestUrl.origin === self.location.origin) {
            const copy = response.clone();
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(event.request, copy);
          }
          return response;
        })
        // Never return app-shell HTML for a missing JS, CSS or image request.
        // A typed network error lets the browser fail that resource correctly.
        .catch(() => Response.error());
    }),
  );
});

async function pruneNotificationMarkers(cache) {
  const keys = await cache.keys();
  if (keys.length <= NOTIFICATION_CACHE_MAX_ENTRIES) return;
  const datedKeys = await Promise.all(keys.map(async (request) => {
    const response = await cache.match(request);
    return { request, createdAt: Number(response?.headers.get("x-created-at") || 0) };
  }));
  datedKeys.sort((first, second) => first.createdAt - second.createdAt);
  await Promise.all(datedKeys
    .slice(0, Math.max(0, datedKeys.length - NOTIFICATION_CACHE_MAX_ENTRIES))
    .map(({ request }) => cache.delete(request)));
}

async function displayPush(payload) {
  const notificationId = String(payload.notificationId || `${payload.title}:${payload.body}`).slice(0, 240);
  if (seenNotificationIds.has(notificationId)) return;
  seenNotificationIds.add(notificationId);
  while (seenNotificationIds.size > NOTIFICATION_CACHE_MAX_ENTRIES) {
    seenNotificationIds.delete(seenNotificationIds.values().next().value);
  }

  const cache = await caches.open(NOTIFICATION_CACHE);
  const marker = new Request(new URL(`.notification/${encodeURIComponent(notificationId)}`, self.registration.scope).href);
  if (await cache.match(marker)) return;
  await cache.put(marker, new Response("seen", { headers: { "x-created-at": String(Date.now()) } }));
  await pruneNotificationMarkers(cache);

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

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const oldSubscription = event.oldSubscription;
    if (!oldSubscription || Notification.permission !== "granted") return;
    const subscription = event.newSubscription
      || await self.registration.pushManager.subscribe(oldSubscription.options);
    const response = await fetch(`${PUSH_API_URL}/refresh-subscription`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        oldSubscription: oldSubscription.toJSON(),
        subscription: subscription.toJSON(),
      }),
    });
    if (!response.ok) throw new Error("Không đồng bộ được đăng ký Push mới.");
  })());
});

async function openNotificationTarget(rawUrl) {
  const scope = self.registration.scope;
  let target;
  try {
    target = new URL(rawUrl || scope, scope);
    if (!target.href.startsWith(scope)) target = new URL(scope);
  } catch {
    target = new URL(scope);
  }

  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const exactClient = windowClients.find((client) => client.url === target.href);
  if (exactClient) return exactClient.focus();

  const appClient = windowClients.find((client) => client.url.startsWith(scope));
  if (appClient) {
    try {
      const navigated = await appClient.navigate(target.href);
      return (navigated || appClient).focus();
    } catch {
      return appClient.focus();
    }
  }

  const opened = await clients.openWindow(target.href);
  return opened?.focus();
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openNotificationTarget(event.notification.data?.url));
});
