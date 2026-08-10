import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { sendPush, VAPID_PUBLIC_KEY } from '../push.js';

const router = Router();

router.use(authenticate);

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(500).json({ message: 'Push notifications are not configured' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { endpoint, p256dh, auth, userAgent } = req.body || {};

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ message: 'Missing push subscription fields' });
    }

    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1);

    if (existing.length > 0) {
      await db.update(pushSubscriptions)
        .set({ isActive: true, updatedAt: new Date(), userAgent: userAgent || existing[0].userAgent })
        .where(eq(pushSubscriptions.id, existing[0].id));
      return res.json(existing[0]);
    }

    const row = await db.insert(pushSubscriptions).values({
      id: uuidv4(),
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent || null,
      isActive: true,
    }).returning();
    res.status(201).json(row[0]);
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ message: 'Failed to save push subscription' });
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req: any, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: 'endpoint is required' });

    await db.update(pushSubscriptions).set({ isActive: false, updatedAt: new Date() }).where(eq(pushSubscriptions.endpoint, endpoint));
    res.json({ message: 'unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
});

export async function dispatchPushToUser(userId: string, payload: Record<string, unknown>) {
  const subs = await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)));
  await Promise.allSettled(
    subs.map((s) =>
      sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      )
    )
  );
}

export default router;
