import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { treatments, activityLogs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and ADMIN or DEVELOPER role
router.use(authenticate, authorize('ADMIN', 'DEVELOPER'));

// GET /api/treatments - Get all treatments
router.get('/', async (req: any, res) => {
  try {
    const allTreatments = await db.select()
      .from(treatments)
      .where(eq(treatments.isActive, true))
      .orderBy(treatments.name);

    res.json(allTreatments);
  } catch (error) {
    console.error('Get treatments error:', error);
    res.status(500).json({ message: 'Failed to fetch treatments' });
  }
});

// GET /api/treatments/:id - Get single treatment
router.get('/:id', async (req: any, res) => {
  try {
    const treatment = await db.select()
      .from(treatments)
      .where(eq(treatments.id, req.params.id))
      .limit(1);

    if (!treatment.length) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    res.json(treatment[0]);
  } catch (error) {
    console.error('Get treatment error:', error);
    res.status(500).json({ message: 'Failed to fetch treatment' });
  }
});

// POST /api/treatments - Create new treatment
router.post('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { name, description, duration, price, defaultCommission } = req.body;

    if (!name || !duration || !price) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newTreatment = await db.insert(treatments).values({
      id: uuidv4(),
      name,
      description,
      duration,
      price,
      defaultCommission,
      isActive: true,
    }).returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'TREATMENT_CREATED',
      entityType: 'TREATMENT',
      entityId: newTreatment[0].id,
      details: {
        treatmentName: name,
        duration,
        price,
      },
      outletId: userOutletId,
    });

    res.status(201).json(newTreatment[0]);
  } catch (error) {
    console.error('Create treatment error:', error);
    res.status(500).json({ message: 'Failed to create treatment' });
  }
});

// PATCH /api/treatments/:id - Update treatment
router.patch('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const updates = req.body;

    // Check if treatment exists
    const existingTreatment = await db.select()
      .from(treatments)
      .where(eq(treatments.id, id))
      .limit(1);

    if (!existingTreatment.length) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    // Update treatment
    const updatedTreatment = await db.update(treatments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(treatments.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'TREATMENT_UPDATED',
      entityType: 'TREATMENT',
      entityId: id,
      details: {
        treatmentName: existingTreatment[0].name,
        updates,
      },
      outletId: userOutletId,
    });

    res.json(updatedTreatment[0]);
  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({ message: 'Failed to update treatment' });
  }
});

// DELETE /api/treatments/:id - Deactivate treatment
router.delete('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;

    // Check if treatment exists
    const existingTreatment = await db.select()
      .from(treatments)
      .where(eq(treatments.id, id))
      .limit(1);

    if (!existingTreatment.length) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    // Deactivate treatment (soft delete)
    const deactivatedTreatment = await db.update(treatments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(treatments.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'TREATMENT_DEACTIVATED',
      entityType: 'TREATMENT',
      entityId: id,
      details: {
        treatmentName: existingTreatment[0].name,
      },
      outletId: userOutletId,
    });

    res.json(deactivatedTreatment[0]);
  } catch (error) {
    console.error('Deactivate treatment error:', error);
    res.status(500).json({ message: 'Failed to deactivate treatment' });
  }
});

export default router;