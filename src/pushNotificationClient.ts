// Client-side Web Push Notification Manager for PWA / Mobile / Desktop

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err: any) {
    console.error('[WebPush Client] Service worker registration failed:', err);
    return null;
  }
}

export async function checkIsPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch (err) {
    return false;
  }
}

export async function subscribeToPushNotifications(
  authToken: string,
  apiUrl: string = ''
): Promise<{ success: boolean; message: string }> {
  if (!isPushSupported()) {
    return {
      success: false,
      message: 'Push notifications are not supported on this browser/device.'
    };
  }

  try {
    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Notification permission was not granted. Please enable notifications in your browser/device settings.'
      };
    }

    // 2. Register Service Worker & Wait for ready
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID Public Key from backend
    const keyRes = await fetch(`${apiUrl}/api/push/public-key`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (!keyRes.ok) {
      const errData = await keyRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to fetch VAPID public key from server');
    }

    const { publicKey } = await keyRes.json();
    if (!publicKey) {
      throw new Error('Server returned an empty VAPID public key');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 4. Create Push Subscription with Browser PushManager using current VAPID key
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch (e) {
        console.warn('[WebPush] Old subscription unsubscribe warning:', e);
      }
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any
    });

    // 5. Send Subscription to backend
    const subRes = await fetch(`${apiUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent
      })
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to register subscription on server');
    }

    return {
      success: true,
      message: 'Lock-screen push notifications activated successfully!'
    };
  } catch (err: any) {
    console.error('[WebPush Client] Subscription error:', err);
    return {
      success: false,
      message: err.message || 'An error occurred while enabling push notifications.'
    };
  }
}

export async function unsubscribeFromPushNotifications(
  authToken: string,
  apiUrl: string = ''
): Promise<{ success: boolean; message: string }> {
  if (!isPushSupported()) return { success: true, message: 'Push not supported' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch(`${apiUrl}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ endpoint })
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'Push notifications have been disabled on this device.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to disable push notifications.'
    };
  }
}

export async function sendTestPushNotification(
  authToken: string,
  apiUrl: string = ''
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message || 'Test push notification sent!' };
    } else {
      return { success: false, message: data.error || data.message || 'Failed to send test push' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error sending test notification' };
  }
}
