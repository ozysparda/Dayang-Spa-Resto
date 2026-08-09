import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, staffProfiles, activityLogs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and DEVELOPER role
router.use(authenticate, authorize('DEVELOPER'));

// GET /api/users - Get all users
router.get('/', async (req: any, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      staffId: users.staffId,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
      .from(users)
      .orderBy(users.username);

    res.json(allUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get single user
router.get('/:id', async (req: any, res) => {
  try {
    const user = await db.select({
      id: users.id,
      staffId: users.staffId,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req: any, res) => {
  try {
    const { username, password, role, staffId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if username already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.insert(users).values({
      id: uuidv4(),
      staffId: staffId || `USR-${Date.now()}`,
      username,
      password: hashedPassword,
      role: role || 'STAFF',
      isActive: true,
    }).returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser[0].id,
      details: {
        username,
        role: role || 'STAFF',
      },
      outletId: req.user.outletId,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser[0];
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existingUser.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // Update user
    const updatedUser = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      details: {
        username: existingUser[0].username,
        updates,
      },
      outletId: req.user.outletId,
    });

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser[0];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existingUser.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Deactivate user
    const deactivatedUser = await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    // Also deactivate staff profile if exists
    await db.update(staffProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(staffProfiles.userId, id));

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: id,
      details: {
        username: existingUser[0].username,
      },
      outletId: req.user.outletId,
    });

    // Return user without password
    const { password, ...userWithoutPassword } = deactivatedUser[0];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
});

export default router;