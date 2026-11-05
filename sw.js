/* Simple Service Worker: app files only. Member data is never cached (always straight from the server). */
const V = 'pol-v8';
const BACKEND = 'https://script.google.com/macros/s/AKfycby5061fZpmlxdhUPsyOTJ-UGelBG96vBgKPF5WtZPcyBqUsk4BMySw3za1UJ1CW9h79/exec';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'card-birthday-v2.webp', 'card-anniversary-v2.webp'];
const WAIT_MS = 5000;   // a saved copy exists: if the network takes longer than this, show the saved copy (slow internet)

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

  e.respondWith((async () => {
    const saved = await caches.match(r);
    try {
      // Network first. If a saved copy exists and the network is very slow, use the saved copy.
      const res = await Promise.race([
        fetch(r),
        new Promise((_, no) => setTimeout(() => no(new Error('slow')), saved ? WAIT_MS : 60000))
      ]);
      // Save a copy ONLY if the response is good (status 200-299). Errors like 404 are never cached.
      if (res && res.ok && res.type === 'basic') {
        const cp = res.clone();
        caches.open(V).then(c => c.put(r, cp)).catch(() => {});
      }
      return res;
    } catch (err) {
      // Offline / very slow: saved copy; for page opens fall back to index.html
      if (saved) return saved;
      if (r.mode === 'navigate') {
        const home = await caches.match('index.html');
        if (home) return home;
      }
      return Response.error();
    }
  })());
});

/* రోజువారీ నోటిఫికేషన్ (Android Chrome 'periodic sync'; ఫోన్ తనకు వీలైనప్పుడు రోజుకు ఒకసారి నడుపుతుంది) */
self.addEventListener('periodicsync', e => { if (e.tag === 'daily-msg') e.waitUntil(dailyNote()); });

// HTML message -> plain short text (tags removed, &nbsp; &amp; etc. fixed)
function plain_(h) {
  return String(h || '')
    .replace(/<\/(p|div|li|h1|h2|br)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

async function dailyNote() {
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify({ fn: 'getDaily', args: [] }) });
    const d = (await r.json()).result;
    if (!d) return;
    const c = await caches.open('pol-meta'), m = await c.match('last-note');
    if (m && (await m.text()) === d.date) return;   // ఈ రోజు ఇప్పటికే పంపాము
    const fresh = [['🌅', d.devotion], ['🤲', d.prayer], ['💬', d.testimony]].find(z => z[1] && z[1].x);   // ఈ రోజు సందేశం ఉన్నదే
    if (!fresh) return;
    const k = fresh[1], body = fresh[0] + ' ' + (k.t ? plain_(k.t) + ' – ' : '') + plain_(k.x);
    await self.registration.showNotification('🙏 The Prince of Life Ministries', { body: body.slice(0, 140), tag: 'daily-' + d.date, icon: 'icon-192.png', badge: 'icon-192.png' });
    await c.put('last-note', new Response(d.date));
  } catch (e) {}
}
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.length ? l[0].focus() : clients.openWindow('./')));
});