// Minimal, safe service worker.
// IMPORTANT: it caches NO assets — Next's JS chunks are always fetched from the
// network, so a stale cached chunk can never break the app. On activate it deletes
// any caches left by older versions (recovers browsers stuck on old chunks).
const CACHE = "wpm-v3-nocache";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Network-first for page navigations; everything else falls through to the network.
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => Response.error()));
  }
});
