// FC Niksar Service Worker v8
// index.html: Network-First (immer aktuell), Bilder/Icons: Cache-First (schnell)
const CACHE = 'fcn-v8';

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  // Icons sofort cachen, dann sofort aktiv werden
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/fc-niksar/icon-192.png',
      '/fc-niksar/icon-512.png',
      '/fc-niksar/manifest.json'
    ])).catch(() => {}).then(() => self.skipWaiting())
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

  // Firebase, Vercel, CDN: immer live, nie cachen
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('vercel') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('tailwindcss') ||
      url.hostname.includes('fontawesome')) {
    return;
  }

  // index.html: Network-First → immer aktuelle Version
  // Fallback auf Cache wenn offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Bilder & Icons: Cache-First (ändern sich selten)
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Alles andere: live laden
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
