/* Simple Service Worker: app files only. Member data is never cached (always straight from the server). */
const V = 'pol-v5';
const BACKEND = 'https://script.google.com/macros/s/AKfycby5061fZpmlxdhUPsyOTJ-UGelBG96vBgKPF5WtZPcyBqUsk4BMySw3za1UJ1CW9h79/exec';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'card-birthday-v2.webp', 'card-anniversary-v2.webp'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V && k !== 'pol-meta').map(k => caches.delete(k))))
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

/* రోజువారీ నోటిఫికేషన్ (Android Chrome 'periodic sync'; ఫోన్ తనకు వీలైనప్పుడు రోజుకు ఒకసారి నడుపుతుంది) */
self.addEventListener('periodicsync', e => { if (e.tag === 'daily-msg') e.waitUntil(dailyNote()); });
async function dailyNote() {
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify({ fn: 'getDaily', args: [] }) });
    const d = (await r.json()).result;
    if (!d) return;
    const c = await caches.open('pol-meta'), m = await c.match('last-note');
    if (m && (await m.text()) === d.date) return;   // ఈ రోజు ఇప్పటికే పంపాము
    const fresh = [['🌅', d.devotion], ['🤲', d.prayer], ['💬', d.testimony]].find(z => z[1] && z[1].d === d.date);   // ఈ రోజు కొత్తగా చేర్చినదే
    if (!fresh) return;
    const k = fresh[1], body = fresh[0] + ' ' + (k.t ? k.t + ' – ' : '') + k.x;
    await self.registration.showNotification('🙏 The Prince of Life Ministries', { body: body.slice(0, 140), tag: 'daily-' + d.date, icon: 'icon-192.png', badge: 'icon-192.png' });
    await c.put('last-note', new Response(d.date));
  } catch (e) {}
}
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.length ? l[0].focus() : clients.openWindow('./')));
});
