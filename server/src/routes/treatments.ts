import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { treatments, activityLogs, bookings, staffProfiles, outlets } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
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

// Staff-specific endpoints (no ADMIN/DEVELOPER restriction)
router.use(authenticate);

// GET /api/treatments/my-history - Get current user's treatment history
router.get('/my-history', async (req: any, res) => {
  try {
    // Get current user's staff profile
    const staffProfile = await db.select()
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, req.user.id))
      .limit(1);

    if (!staffProfile.length) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const { startDate, endDate } = req.query;
    let conditions = [
      eq(bookings.therapistId, staffProfile[0].id),
      eq(bookings.outletId, staffProfile[0].outletId),
      sql`${bookings.status} != 'CANCELLED'`
    ];

    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(bookings.date, start));
    }

    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(bookings.date, end));
    }

    const history = await db.select({
      id: bookings.id,
      bookingId: bookings.bookingId,
      customerName: bookings.customerName,
      date: bookings.date,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      duration: bookings.duration,
      price: bookings.price,
      commission: bookings.commission,
      status: bookings.status,
      treatmentName: treatments.name,
      outletName: outlets.name,
    })
      .from(bookings)
      .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
      .leftJoin(outlets, eq(bookings.outletId, outlets.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.date), desc(bookings.startTime));

    res.json(history);
  } catch (error) {
    console.error('Get treatment history error:', error);
    res.status(500).json({ message: 'Failed to fetch treatment history' });
  }
});