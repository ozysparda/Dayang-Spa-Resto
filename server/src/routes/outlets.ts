import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { outlets, activityLogs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and DEVELOPER role
router.use(authenticate, authorize('DEVELOPER'));

// GET /api/outlets - Get all outlets
router.get('/', async (req: any, res) => {
  try {
    const allOutlets = await db.select()
      .from(outlets)
      .orderBy(outlets.name);

    res.json(allOutlets);
  } catch (error) {
    console.error('Get outlets error:', error);
    res.status(500).json({ message: 'Failed to fetch outlets' });
  }
});

// GET /api/outlets/:id - Get single outlet
router.get('/:id', async (req: any, res) => {
  try {
    const outlet = await db.select()
      .from(outlets)
      .where(eq(outlets.id, req.params.id))
      .limit(1);

    if (!outlet.length) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    res.json(outlet[0]);
  } catch (error) {
    console.error('Get outlet error:', error);
    res.status(500).json({ message: 'Failed to fetch outlet' });
  }
});

// POST /api/outlets - Create new outlet
router.post('/', async (req: any, res) => {
  try {
    const { name, address, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const newOutlet = await db.insert(outlets).values({
      id: uuidv4(),
      name,
      address,
      phone,
      isActive: true,
    }).returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'OUTLET_CREATED',
      entityType: 'OUTLET',
      entityId: newOutlet[0].id,
      details: {
        outletName: name,
      },
      outletId: newOutlet[0].id,
    });

    res.status(201).json(newOutlet[0]);
  } catch (error) {
    console.error('Create outlet error:', error);
    res.status(500).json({ message: 'Failed to create outlet' });
  }
});

// PATCH /api/outlets/:id - Update outlet
router.patch('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if outlet exists
    const existingOutlet = await db.select()
      .from(outlets)
      .where(eq(outlets.id, id))
      .limit(1);

    if (!existingOutlet.length) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    // Update outlet
    const updatedOutlet = await db.update(outlets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(outlets.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'OUTLET_UPDATED',
      entityType: 'OUTLET',
      entityId: id,
      details: {
        outletName: existingOutlet[0].name,
        updates,
      },
      outletId: id,
    });

    res.json(updatedOutlet[0]);
  } catch (error) {
    console.error('Update outlet error:', error);
    res.status(500).json({ message: 'Failed to update outlet' });
  }
});

// DELETE /api/outlets/:id - Deactivate outlet
router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if outlet exists
    const existingOutlet = await db.select()
      .from(outlets)
      .where(eq(outlets.id, id))
      .limit(1);

    if (!existingOutlet.length) {
      return res.status(404).json({ message: 'Outlet not found' });
    }

    // Deactivate outlet (soft delete)
    const deactivatedOutlet = await db.update(outlets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(outlets.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'OUTLET_DEACTIVATED',
      entityType: 'OUTLET',
      entityId: id,
      details: {
        outletName: existingOutlet[0].name,
      },
      outletId: id,
    });

    res.json(deactivatedOutlet[0]);
  } catch (error) {
    console.error('Deactivate outlet error:', error);
    res.status(500).json({ message: 'Failed to deactivate outlet' });
  }
});

export default router;