/* Service worker: only shows reminder notifications (no caching, so it never serves old pages). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.t || 'הורות', {
    body: d.b || '', tag: d.tag || 'gp', icon: '/icon-192.png', badge: '/icon-192.png', dir: 'auto',
    data: { url: (typeof d.url === 'string' && d.url.charAt(0) === '/') ? d.url : '/#home' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/#home';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if ('focus' in c) { await c.focus(); try { if ('navigate' in c) await c.navigate(url); } catch (x) {} return; } }
    await self.clients.openWindow(url);
  })());
});
