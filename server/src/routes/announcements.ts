import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { announcements, announcementReads, users, staffProfiles, activityLogs, notifications } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { dispatchPushToUser } from '../routes/push.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/announcements - Get announcements
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const userRole = req.user.role;
    const userId = req.user.id;
    const isAdmin = ['ADMIN', 'DEVELOPER'].includes(userRole);

    let announcementList;
    
    if (!isAdmin) {
      // Staff see announcements targeted to their outlet and role, or all outlets
      announcementList = await db.select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        targetOutletId: announcements.targetOutletId,
        targetRole: announcements.targetRole,
        createdBy: announcements.createdBy,
        isActive: announcements.isActive,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        creatorName: users.username,
      })
        .from(announcements)
        .leftJoin(users, eq(announcements.createdBy, users.id))
        .where(and(
          eq(announcements.isActive, true),
          sql`(${announcements.targetOutletId} IS NULL OR ${announcements.targetOutletId} = ${userOutletId})`,
          sql`(${announcements.targetRole} IS NULL OR ${announcements.targetRole} = ${userRole})`
        ))
        .orderBy(desc(announcements.createdAt));
    } else {
      // Admin see announcements for their outlet or all outlets
      announcementList = await db.select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        targetOutletId: announcements.targetOutletId,
        targetRole: announcements.targetRole,
        createdBy: announcements.createdBy,
        isActive: announcements.isActive,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        creatorName: users.username,
      })
        .from(announcements)
        .leftJoin(users, eq(announcements.createdBy, users.id))
        .where(and(
          eq(announcements.isActive, true),
          sql`(${announcements.targetOutletId} IS NULL OR ${announcements.targetOutletId} = ${userOutletId})`
        ))
        .orderBy(desc(announcements.createdAt));
    }

    // Get read status for each announcement
    const announcementsWithReadStatus = await Promise.all(
      announcementList.map(async (announcement) => {
        const readRecord = await db.select()
          .from(announcementReads)
          .where(and(
            eq(announcementReads.announcementId, announcement.id),
            eq(announcementReads.userId, userId)
          ))
          .limit(1);

        return {
          ...announcement,
          isRead: readRecord.length > 0,
        };
      })
    );

    res.json(announcementsWithReadStatus);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/:id - Get single announcement
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const announcement = await db.select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      targetOutletId: announcements.targetOutletId,
      targetRole: announcements.targetRole,
      createdBy: announcements.createdBy,
      isActive: announcements.isActive,
      createdAt: announcements.createdAt,
      updatedAt: announcements.updatedAt,
      creatorName: users.username,
    })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdBy, users.id))
      .where(eq(announcements.id, id))
      .limit(1);

    if (!announcement.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    res.json(announcement[0]);
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ message: 'Failed to fetch announcement' });
  }
});

// POST /api/announcements - Create announcement (ADMIN/DEVELOPER only)
router.post('/', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { title, content, targetOutletId, targetRole } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const newAnnouncement = await db.insert(announcements).values({
      id: uuidv4(),
      title,
      content,
      targetOutletId: targetOutletId || userOutletId,
      targetRole,
      createdBy: req.user.id,
      isActive: true,
    }).returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'ANNOUNCEMENT',
      entityId: newAnnouncement[0].id,
      details: {
        title,
      },
      outletId: userOutletId,
    });

    // Get target users and create notifications + push notifications
    let targetUserIds: string[] = [];
    
    if (targetRole) {
      const targetedUsers = await db.select({ userId: users.id })
        .from(users)
        .innerJoin(staffProfiles, eq(users.id, staffProfiles.userId))
        .where(and(
          eq(staffProfiles.outletId, targetOutletId || userOutletId),
          eq(users.role, targetRole),
          eq(users.isActive, true)
        ));
      targetUserIds = targetedUsers.map(u => u.userId);
    } else {
      const targetedUsers = await db.select({ userId: users.id })
        .from(users)
        .innerJoin(staffProfiles, eq(users.id, staffProfiles.userId))
        .where(and(
          eq(staffProfiles.outletId, targetOutletId || userOutletId),
          eq(users.isActive, true)
        ));
      targetUserIds = targetedUsers.map(u => u.userId);
    }

    // Create notifications for target users (excluding creator)
    const notificationPromises = targetUserIds
      .filter(userId => userId !== req.user.id)
      .map(userId =>
        db.insert(notifications).values({
          id: uuidv4(),
          userId,
          title: `New Announcement: ${title}`,
          message: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          type: 'ANNOUNCEMENT',
          relatedId: newAnnouncement[0].id,
        })
      );
    
    await Promise.all(notificationPromises);

    // Dispatch push notifications to target users (excluding creator)
    const pushPromises = targetUserIds
      .filter(userId => userId !== req.user.id)
      .map(userId =>
        dispatchPushToUser(userId, {
          type: 'ANNOUNCEMENT',
          title: `New Announcement: ${title}`,
          body: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          data: {
            announcementId: newAnnouncement[0].id,
            route: '/announcements',
          },
        }).catch(err => console.error('Push notification failed:', err))
      );
    
    await Promise.allSettled(pushPromises);

    res.status(201).json(newAnnouncement[0]);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Failed to create announcement' });
  }
});

// PATCH /api/announcements/:id - Update announcement
router.patch('/:id', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const updates = req.body;

    // Check if announcement exists
    const existingAnnouncement = await db.select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!existingAnnouncement.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    // Update announcement
    const updatedAnnouncement = await db.update(announcements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      details: {
        title: existingAnnouncement[0].title,
        updates,
      },
      outletId: userOutletId,
    });

    res.json(updatedAnnouncement[0]);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/:id - Delete announcement
router.delete('/:id', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;

    // Check if announcement exists
    const existingAnnouncement = await db.select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!existingAnnouncement.length) {
      return res.status(404).json({ message: 'Announcement not found' });
    }

    // Soft delete
    const deletedAnnouncement = await db.update(announcements)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'ANNOUNCEMENT',
      entityId: id,
      details: {
        title: existingAnnouncement[0].title,
      },
      outletId: userOutletId,
    });

    res.json(deletedAnnouncement[0]);
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ message: 'Failed to delete announcement' });
  }
});

// POST /api/announcements/:id/read - Mark announcement as read
router.post('/:id/read', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if already read
    const existingRead = await db.select()
      .from(announcementReads)
      .where(and(
        eq(announcementReads.announcementId, id),
        eq(announcementReads.userId, userId)
      ))
      .limit(1);

    if (existingRead.length === 0) {
      await db.insert(announcementReads).values({
        id: uuidv4(),
        announcementId: id,
        userId,
      });
    }

    res.json({ message: 'Announcement marked as read' });
  } catch (error) {
    console.error('Mark announcement as read error:', error);
    res.status(500).json({ message: 'Failed to mark announcement as read' });
  }
});

export default router;