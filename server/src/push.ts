import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.PUBLIC_VAPID_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@dayangspa.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };

export async function sendPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}, payload: Record<string, unknown>) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60,
    });
  } catch (err) {
    // Ignore invalid/unsubscribed endpoints so one bad subscription
    // cannot crash an entire notification dispatch.
    console.warn('Push send failed', (err as Error).message);
  }
}
