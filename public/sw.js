// Minimal service worker — just enough to make the app installable and
// to keep the shell loading if the network blips. This app is
// fundamentally online (Blob storage, AssemblyAI), so this deliberately
// does NOT try to cache uploads, API responses, or transcripts.

const CACHE = "spool-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for everything. API calls, uploads, and auth must always
// hit the network — only fall back to the cached shell for navigations
// when totally offline, so the app still opens to something.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return; // never intercept API calls

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await cache.match("/");
        if (shell) return shell;
      }
      return Response.error();
    }),
  );
});
