// FC Niksar Service Worker v6 - Cache-First für schnellen Start
const CACHE = 'fcn-v6';

// App-Shell Dateien beim Install direkt cachen
const APP_SHELL = [
  '/fc-niksar/',
  '/fc-niksar/index.html',
  '/fc-niksar/manifest.json',
  '/fc-niksar/icon-192.png',
  '/fc-niksar/icon-512.png'
];

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase, Vercel, CDN immer live laden (keine Daten cachen)
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('vercel') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('tailwindcss') ||
      url.hostname.includes('fontawesome')) {
    return;
  }

  // Navigation (index.html): Cache-First → sofortiger Start
  // Im Hintergrund wird der Cache aktualisiert (Stale-While-Revalidate)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        // Hintergrund-Update starten
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        // Sofort aus Cache antworten wenn vorhanden, sonst warten
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Alles andere: Cache-First, im Hintergrund updaten
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || fetchPromise;
    })
  );
});

// Push Notifications
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  e.waitUntil(self.registration.showNotification(data.title || 'FC Niksar', {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
    vibrate: [200, 100, 200]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(wins => {
    const w = wins.find(w => w.url.includes('fc-niksar'));
    if (w) { w.focus(); return; }
    return clients.openWindow(e.notification.data?.url || './');
  }));
});
