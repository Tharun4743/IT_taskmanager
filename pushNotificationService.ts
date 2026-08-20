import webpush from 'web-push';
import { pool } from './db.js';

let vapidPublicKey: string = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey: string = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject: string = process.env.VAPID_SUBJECT || 'mailto:admin@vsbec.ac.in';

let isPushInitialized = false;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

/**
 * Initializes VAPID keys strictly from environment variables or database system_settings.
 * If no keys are present in env or DB, generates fresh keys and persists them in DB.
 */
export async function initPushNotifications(): Promise<void> {
  if (isPushInitialized) return;

  try {
    // 1. Check if keys exist in DB if not in process.env
    if (!vapidPublicKey || !vapidPrivateKey) {
      const pubRes = await pool.query("SELECT value FROM system_settings WHERE key = 'vapid_public_key' LIMIT 1").catch(() => ({ rows: [] }));
      const privRes = await pool.query("SELECT value FROM system_settings WHERE key = 'vapid_private_key' LIMIT 1").catch(() => ({ rows: [] }));

      if (pubRes.rows[0]?.value && privRes.rows[0]?.value) {
        vapidPublicKey = pubRes.rows[0].value;
        vapidPrivateKey = privRes.rows[0].value;
      } else {
        // Auto-generate if not provided in env or DB
        const keys = webpush.generateVAPIDKeys();
        vapidPublicKey = keys.publicKey;
        vapidPrivateKey = keys.privateKey;

        await pool.query(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES 
            ('vapid_public_key', $1, CURRENT_TIMESTAMP),
            ('vapid_private_key', $2, CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [vapidPublicKey, vapidPrivateKey]).catch(err => {
          console.error('[WebPush] Error persisting VAPID keys to DB:', err);
        });

        console.log('[WebPush] 🔑 Generated and saved persistent VAPID Keypair to database.');
      }
    } else {
      // If keys provided via process.env, update DB system_settings
      await pool.query(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES 
          ('vapid_public_key', $1, CURRENT_TIMESTAMP),
          ('vapid_private_key', $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `, [vapidPublicKey, vapidPrivateKey]).catch(() => {});
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isPushInitialized = true;
    console.log('[WebPush] ✅ Web Push Service initialized from environment.');
  } catch (err: any) {
    console.error('[WebPush] Initialization error:', err.message);
  }
}

/**
 * Returns the public VAPID key needed for client browser push subscription
 */
export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

/**
 * Saves or updates a browser PushSubscription for a user
 */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<boolean> {
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error('Invalid PushSubscription payload');
  }

  try {
    await pool.query(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, endpoint) 
      DO UPDATE SET 
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent || null]);

    console.log(`[WebPush] 📱 Saved push subscription for user ${userId}`);
    return true;
  } catch (err: any) {
    console.error(`[WebPush] Failed to save push subscription for user ${userId}:`, err.message);
    throw err;
  }
}

/**
 * Removes a push subscription for a user (e.g. on logout or permission revoke)
 */
export async function removePushSubscription(userId: string, endpoint: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint]);
    return true;
  } catch (err: any) {
    console.error(`[WebPush] Failed to delete push subscription for user ${userId}:`, err.message);
    return false;
  }
}

/**
 * Helper to dispatch a web push payload to a list of subscription records
 */
async function dispatchPushToSubscriptions(subs: any[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };
  if (!isPushInitialized) await initPushNotifications();

  const formattedPayload = JSON.stringify({
    title: payload.title || 'VSBEC IT TaskManager',
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/badge.png',
    url: payload.url || '/',
    tag: payload.tag || 'taskmanager-notification',
    timestamp: Date.now(),
    data: payload.data || {}
  });

  let sent = 0;
  let failed = 0;

  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, formattedPayload);
        sent++;
      } catch (err: any) {
        failed++;
        // 404 Not Found or 410 Gone means the subscription is expired/uninstalled
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.warn(`[WebPush] Push dispatch failed for endpoint (${err.statusCode || err.message})`);
        }
      }
    })
  );

  // Clean up dead subscriptions
  if (expiredEndpoints.length > 0) {
    pool.query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1)', [expiredEndpoints])
      .then(() => console.log(`[WebPush] 🧹 Cleaned up ${expiredEndpoints.length} expired push subscription(s).`))
      .catch(e => console.error('[WebPush] Error pruning expired subscriptions:', e));
  }

  return { sent, failed };
}

/**
 * Dispatches a push notification to a specific user across all their registered devices/browsers
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  try {
    const res = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
    return await dispatchPushToSubscriptions(res.rows, payload);
  } catch (err: any) {
    console.error(`[WebPush] sendPushToUser error for user ${userId}:`, err.message);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Dispatches a push notification to multiple users
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!userIds || userIds.length === 0) return { sent: 0, failed: 0 };
  try {
    const res = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)', [userIds]);
    return await dispatchPushToSubscriptions(res.rows, payload);
  } catch (err: any) {
    console.error('[WebPush] sendPushToUsers error:', err.message);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Dispatches a push notification to all students in a specific class
 */
export async function sendPushToClass(classId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  try {
    const res = await pool.query(`
      SELECT ps.endpoint, ps.p256dh, ps.auth
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE u.class_id = $1 AND u.role = 'STUDENT'
    `, [classId]);
    return await dispatchPushToSubscriptions(res.rows, payload);
  } catch (err: any) {
    console.error(`[WebPush] sendPushToClass error for class ${classId}:`, err.message);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Dispatches a push notification to all students across multiple classes
 */
export async function sendPushToClasses(classIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!classIds || classIds.length === 0) return { sent: 0, failed: 0 };
  try {
    const res = await pool.query(`
      SELECT ps.endpoint, ps.p256dh, ps.auth
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE u.class_id = ANY($1) AND u.role = 'STUDENT'
    `, [classIds]);
    return await dispatchPushToSubscriptions(res.rows, payload);
  } catch (err: any) {
    console.error('[WebPush] sendPushToClasses error:', err.message);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Dispatches a broadcast push notification to all registered devices in the system
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  try {
    const res = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions');
    return await dispatchPushToSubscriptions(res.rows, payload);
  } catch (err: any) {
    console.error('[WebPush] sendPushToAll error:', err.message);
    return { sent: 0, failed: 0 };
  }
}
