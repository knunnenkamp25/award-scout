// Network-first service worker: always try the live site, fall back to the
// last cached copy when offline (so the app opens on a plane with the most
// recent prices it saw). Bump CACHE to invalidate everything.
const CACHE = "award-scout-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      // Data files carry cache-busting query strings; ignore them when
      // matching so offline mode serves the last data we saw.
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
