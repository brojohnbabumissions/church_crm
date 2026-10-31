/* Simple Service Worker: app files only. Member data is never cached (always straight from the server). */
const V = 'pol-v2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  // Only our own GET requests. Server (Apps Script) calls are POST + another origin, so they are never touched.
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(r)
      .then(res => {
        // Save a copy ONLY if the response is good (status 200-299). Errors like 404 are never cached.
        if (res && res.ok && res.type === 'basic') {
          const cp = res.clone();
          caches.open(V).then(c => c.put(r, cp)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Offline: use the saved copy; for page opens fall back to index.html
        caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : undefined))
      )
  );
});
