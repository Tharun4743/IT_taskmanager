import * as Sentry from '@sentry/node';

/**
 * Initializes Sentry Error Tracking if SENTRY_DSN environment variable is present.
 */
export function initSentry(app?: any) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[Sentry] SENTRY_DSN environment variable not set. Error tracking disabled.');
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2, // 20% performance trace sampling rate
    });
    console.log('[Sentry] Successfully initialized production error tracking.');
    return true;
  } catch (err) {
    console.error('[Sentry Initialization Error]:', err);
    return false;
  }
}

export function captureException(error: any, context?: any) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}
