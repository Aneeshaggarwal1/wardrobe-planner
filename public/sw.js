/*
 * Service worker: caches the app shell and demo assets so the installed app
 * opens instantly and works offline. Pages are network-first (fresh when
 * online, cached when not); static assets are cache-first.
 */
const CACHE = "wp-shell-v1";
const SHELL = ["/", "/today", "/outfits", "/wardrobe", "/laundry", "/curate", "/demo/seed.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/demo/") ||
    url.pathname.startsWith("/icons/");

  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/today"))),
    );
  }
});
