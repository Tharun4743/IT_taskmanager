// VSBEC IT TaskManager - PWA Push Notification Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Handle Push Notifications from Google FCM / Apple APNs ──────────────────
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'VSBEC IT TaskManager',
    body: 'You have a new update in IT TaskManager!',
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/',
    tag: 'vsbec-it-task-update'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
    } catch (e) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon || '/logo.png',
    badge: notificationData.badge || '/logo.png',
    tag: notificationData.tag || 'taskmanager-alert',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: notificationData.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '📱 Open App' }
    ]
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
