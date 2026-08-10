const CACHE = 'dayang-spa-v1';
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload: any = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Dayang Spa Resto', body: event.data.text() };
    }
  }

  const title = payload.title || 'Dayang Spa Resto';
  const options: any = {
    body: payload.body || '',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const route = (typeof data.route === 'string' ? data.route : '/') + (data.relatedId ? `?id=${data.relatedId}` : '');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(route));
        }
      }
      return self.clients.openWindow(route);
    })
  );
});
