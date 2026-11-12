const CACHE_NAME = "myridemate-v25";
const APP_SHELL = ["./", "./index.html", "./styles.css?v=25", "./translations.js?v=25", "./app.js?v=25", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      const shellFallback = event.request.mode === "navigate" ? caches.match("./index.html") : Promise.resolve(null);
      return shellFallback.then((fallback) => fallback || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }));
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      const data = event.data.json();
      payload = data && typeof data === "object" ? data : { body: String(data) };
    } catch {
      payload = { body: event.data.text() };
    }
  }
  const title = payload.title || "myridemate";
  const options = {
    body: payload.body || "Votre trajet approche.",
    icon: payload.icon || "./icon.svg",
    tag: payload.tag || "myridemate-approach",
    data: payload.data || { page: "trips" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("?page=trips", self.registration.scope).href;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients[0];
    if (client) {
      await client.navigate(target);
      await client.focus();
      return;
    }
    await self.clients.openWindow(target);
  })());
});
