/*
 * LoungeLens service worker — offline support, NETWORK-FIRST.
 *
 * Strategy: NETWORK-FIRST with cache fallback. Every load tries the network first,
 * so users ALWAYS get the latest version automatically (no hard-refresh, no
 * ?cachebust needed). If the network is unavailable (airport on bad wifi), it
 * falls back to the last-cached copy so the app still works offline.
 *
 * This fixes the earlier cache-first bug where users were stuck on a stale version.
 * Bump CACHE_VERSION on each release so old caches are purged on activate.
 */
const CACHE_VERSION = "loungelens-v18-2026-06-22-enrich2";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./brand.js",
  "./engine.js",
  "./flight-engine.js",
  "./flight-live.js",
  "./data/flights.js",
  "./selfcheck.js",
  "./profile.js",
  "./auth.js",
  "./suggest.js",
  "./app.js",
  "./data/cards.js",
  "./data/lounges.js",
  "./data/meta.js",
  "./data/sources.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // pre-cache the shell, then activate immediately
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  // delete every old cache version so stale files can't survive a release,
  // take control of open pages, then TELL them a new version is live so they
  // reload once on their own (fixes the "old design until manual refresh" bug).
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((c) => c.postMessage({ type: "sw-updated", version: CACHE_VERSION })))
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // don't touch cross-origin
  // NETWORK-FIRST: try fresh, update cache, fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

// let the page tell us to activate a waiting SW immediately
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
