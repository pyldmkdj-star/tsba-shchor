const CACHE_NAME = 'tzeva-shahor-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'צבע שחור', body: e.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || 'https://i.ibb.co/NdRLGW5x/notify.png',
    badge: 'https://i.ibb.co/NdRLGW5x/notify.png',
    image: data.image || undefined,
    dir: 'rtl',
    lang: 'he',
    vibrate: [200, 100, 200],
    tag: data.tag || 'tzeva-shahor-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    data: { url: '/' }
  };

  e.waitUntil(self.registration.showNotification(data.title || 'צבע שחור', options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});

// Background sync for storing alerts
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'STORE_ALERT') {
    // Handled by indexedDB in main thread
  }
});
