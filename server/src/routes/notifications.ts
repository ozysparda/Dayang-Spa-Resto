import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user notifications
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const userNotifications = await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    res.json({
      notifications: userNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const updatedNotification = await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();

    if (!updatedNotification.length) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(updatedNotification[0]);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', async (req: any, res) => {
  try {
    const userId = req.user.id;

    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});

export default router;