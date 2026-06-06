// FC Niksar Service Worker v2
const CACHE = 'fcn-v2';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
  );
});

// ---- Push Notifications ----
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}

  const title = data.title || 'FC Niksar';
  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const existing = wins.find(w => w.url.includes('fc-niksar'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(url);
    })
  );
});
