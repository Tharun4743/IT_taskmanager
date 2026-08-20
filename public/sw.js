// VSBEC IT TaskManager - PWA Push Notification Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Handle Push Notifications from Google FCM / Apple APNs ──────────────────
self.addEventListener('push', (event) => {
  const origin = self.location.origin || '';
  const defaultIcon = origin ? `${origin}/logo.png` : '/logo.png';

  let notificationData = {
    title: 'VSBEC IT TaskManager',
    body: 'You have a new update in IT TaskManager!',
    icon: defaultIcon,
    badge: defaultIcon,
    url: '/',
    tag: `vsbec-${Date.now()}`
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
      if (notificationData.icon && !notificationData.icon.startsWith('http')) {
        notificationData.icon = `${origin}${notificationData.icon.startsWith('/') ? '' : '/'}${notificationData.icon}`;
      }
      if (notificationData.badge && !notificationData.badge.startsWith('http')) {
        notificationData.badge = `${origin}${notificationData.badge.startsWith('/') ? '' : '/'}${notificationData.badge}`;
      }
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  console.log('[ServiceWorker] 🔔 Received Push Notification:', notificationData.title, notificationData.body);

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || defaultIcon,
    tag: notificationData.tag || `taskmanager-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: notificationData.url || '/',
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// ── Handle Notification Click Action ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this origin
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Handle Push Subscription Change / Refresh ────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSubscription })
        });
      })
      .catch((err) => {
        console.error('[SW] Failed to renew push subscription:', err);
      })
  );
});
