import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { staffProfiles, staffStatus, staffStatusHistory, users, outlets, activityLogs, notifications } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and ADMIN or DEVELOPER role
router.use(authenticate, authorize('ADMIN', 'DEVELOPER'));

// GET /api/staff - Get all staff
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const isAdmin = ['ADMIN', 'DEVELOPER'].includes(req.user.role);

    const staffList = await db.select({
      id: staffProfiles.id,
      name: staffProfiles.name,
      email: staffProfiles.email,
      phone: staffProfiles.phone,
      isActive: staffProfiles.isActive,
      outletId: staffProfiles.outletId,
      outletName: outlets.name,
      userId: users.id,
      username: users.username,
      role: users.role,
      status: staffStatus.status,
      createdAt: staffProfiles.createdAt,
    })
      .from(staffProfiles)
      .leftJoin(users, eq(staffProfiles.userId, users.id))
      .leftJoin(outlets, eq(staffProfiles.outletId, outlets.id))
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .where(eq(staffProfiles.outletId, userOutletId))
      .orderBy(staffProfiles.name);

    res.json(staffList);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
});

// GET /api/staff/:id - Get single staff
router.get('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const staff = await db.select({
      id: staffProfiles.id,
      name: staffProfiles.name,
      email: staffProfiles.email,
      phone: staffProfiles.phone,
      isActive: staffProfiles.isActive,
      outletId: staffProfiles.outletId,
      outletName: outlets.name,
      userId: users.id,
      username: users.username,
      role: users.role,
      status: staffStatus.status,
      createdAt: staffProfiles.createdAt,
    })
      .from(staffProfiles)
      .leftJoin(users, eq(staffProfiles.userId, users.id))
      .leftJoin(outlets, eq(staffProfiles.outletId, outlets.id))
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .where(and(
        eq(staffProfiles.id, req.params.id),
        eq(staffProfiles.outletId, userOutletId)
      ))
      .limit(1);

    if (!staff.length) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    res.json(staff[0]);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
});

// POST /api/staff - Create new staff
router.post('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { name, email, phone, username, password, role, outletId } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const targetOutletId = outletId || userOutletId;

    // Check if username already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate IDs
    const userId = uuidv4();
    const staffId = uuidv4();

    // Create user
    const newUser = await db.insert(users).values({
      id: userId,
      staffId: `STF-${Date.now()}`,
      username,
      password: hashedPassword,
      role: role || 'STAFF',
      isActive: true,
    }).returning();

    // Create staff profile
    const newStaff = await db.insert(staffProfiles).values({
      id: staffId,
      userId,
      name,
      email,
      phone,
      outletId: targetOutletId,
      isActive: true,
    }).returning();

    // Create initial staff status
    await db.insert(staffStatus).values({
      id: uuidv4(),
      staffId,
      status: 'OFF',
      outletId: targetOutletId,
    });

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'STAFF_CREATED',
      entityType: 'STAFF',
      entityId: staffId,
      details: {
        staffName: name,
        username,
        role: role || 'STAFF',
      },
      outletId: userOutletId,
    });

    res.status(201).json({
      id: newStaff[0].id,
      name: newStaff[0].name,
      email: newStaff[0].email,
      phone: newStaff[0].phone,
      userId: newUser[0].id,
      username: newUser[0].username,
      role: newUser[0].role,
      outletId: newStaff[0].outletId,
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Failed to create staff' });
  }
});

// PATCH /api/staff/:id - Update staff
router.patch('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const updates = req.body;

    // Check if staff exists
    const existingStaff = await db.select()
      .from(staffProfiles)
      .where(and(
        eq(staffProfiles.id, id),
        eq(staffProfiles.outletId, userOutletId)
      ))
      .limit(1);

    if (!existingStaff.length) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Update staff profile
    const updatedStaff = await db.update(staffProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'STAFF_UPDATED',
      entityType: 'STAFF',
      entityId: id,
      details: {
        staffName: existingStaff[0].name,
        updates,
      },
      outletId: userOutletId,
    });

    res.json(updatedStaff[0]);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Failed to update staff' });
  }
});

// PATCH /api/staff/:id/status - Update staff status
router.patch('/:id/status', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['FREE', 'IN_CHARGE', 'IN_TREATMENT', 'ON_BREAK', 'OFF'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Get current status
    const currentStatus = await db.select()
      .from(staffStatus)
      .where(and(
        eq(staffStatus.staffId, id),
        eq(staffStatus.outletId, userOutletId)
      ))
      .limit(1);

    if (!currentStatus.length) {
      return res.status(404).json({ message: 'Staff status not found' });
    }

    const oldStatus = currentStatus[0].status;

    // Update status
    const updatedStatus = await db.update(staffStatus)
      .set({ status, updatedAt: new Date() })
      .where(eq(staffStatus.staffId, id))
      .returning();

    // Create status history
    await db.insert(staffStatusHistory).values({
      id: uuidv4(),
      staffId: id,
      oldStatus,
      newStatus: status,
      changedBy: req.user.id,
      outletId: userOutletId,
    });

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'STAFF_STATUS_CHANGED',
      entityType: 'STAFF',
      entityId: id,
      details: {
        oldStatus,
        newStatus: status,
      },
      outletId: userOutletId,
    });

    res.json(updatedStatus[0]);
  } catch (error) {
    console.error('Update staff status error:', error);
    res.status(500).json({ message: 'Failed to update staff status' });
  }
});

// GET /api/staff/:id/status-history - Get staff status history
router.get('/:id/status-history', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await db.select({
      id: staffStatusHistory.id,
      oldStatus: staffStatusHistory.oldStatus,
      newStatus: staffStatusHistory.newStatus,
      timestamp: staffStatusHistory.timestamp,
      changedByName: users.username,
    })
      .from(staffStatusHistory)
      .leftJoin(users, eq(staffStatusHistory.changedBy, users.id))
      .where(and(
        eq(staffStatusHistory.staffId, id),
        eq(staffStatusHistory.outletId, userOutletId)
      ))
      .orderBy(desc(staffStatusHistory.timestamp))
      .limit(limit);

    res.json(history);
  } catch (error) {
    console.error('Get staff status history error:', error);
    res.status(500).json({ message: 'Failed to fetch staff status history' });
  }
});

// DELETE /api/staff/:id - Deactivate staff
router.delete('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;

    // Check if staff exists
    const existingStaff = await db.select()
      .from(staffProfiles)
      .where(and(
        eq(staffProfiles.id, id),
        eq(staffProfiles.outletId, userOutletId)
      ))
      .limit(1);

    if (!existingStaff.length) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Deactivate staff
    const deactivatedStaff = await db.update(staffProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();

    // Also deactivate user
    await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, existingStaff[0].userId));

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'STAFF_DEACTIVATED',
      entityType: 'STAFF',
      entityId: id,
      details: {
        staffName: existingStaff[0].name,
      },
      outletId: userOutletId,
    });

    res.json(deactivatedStaff[0]);
  } catch (error) {
    console.error('Deactivate staff error:', error);
    res.status(500).json({ message: 'Failed to deactivate staff' });
  }
});

export default router;