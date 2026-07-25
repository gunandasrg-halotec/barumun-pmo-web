/* Service worker untuk halaman lapangan /lapor-alat-berat.
   Scope dibatasi ke /lapor-alat-berat (didaftarkan dari halaman itu),
   sehingga aplikasi PMO lainnya tidak terpengaruh.
   - Navigasi: network-first, fallback ke index.html cache (agar bisa dibuka offline).
   - Aset statis (hash-named, immutable): cache-first.
   - Request /api/ TIDAK pernah di-cache. */
const CACHE = "pmo-field-shell-v1";
const ASSET_RE = /\.(?:js|css|woff2?|ttf|png|jpe?g|svg|ico|webp)$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // jangan cache API

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put("/index.html", net.clone());
          return net;
        } catch (e) {
          const cache = await caches.open(CACHE);
          return (await cache.match("/index.html")) || (await cache.match(req)) || Response.error();
        }
      })()
    );
    return;
  }

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const net = await fetch(req);
          if (net.ok) cache.put(req, net.clone());
          return net;
        } catch (e) {
          return hit || Response.error();
        }
      })()
    );
  }
});
