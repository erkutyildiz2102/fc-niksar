// FC Niksar Service Worker v4 - Auto-Update
const CACHE = 'fcn-v4';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase, Vercel, CDN immer live laden
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('vercel') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('tailwindcss')) {
    return;
  }

  // index.html immer live vom Server holen (damit Updates sofort ankommen)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Alles andere: zuerst live, dann Cache als Fallback
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
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