// Network-first service worker: always try the live site, fall back to the
// last cached copy when offline (so the app opens on a plane with the most
// recent prices it saw). Bump CACHE to invalidate everything.
const CACHE = "award-scout-v2";

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
  // Store under the query-stripped URL: data requests carry a fresh
  // cache-busting query every load, and caching each variant separately
  // would grow the cache without bound.
  const key = new URL(request.url);
  key.search = "";
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(key.href, copy));
        return response;
      })
      .catch(() => caches.match(key.href))
  );
});
