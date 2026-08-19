import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { treatments, activityLogs, bookings, staffProfiles, outlets, treatmentTransactions, notifications, staffStatus, staffStatusHistory, users, commissions } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { dispatchPushToUser } from '../routes/push.js';
import { consumeRecipeForTreatment } from '../utils/recipe.js';

const router = Router();

// All routes require authentication and ADMIN, DEVELOPER, or CASHIER role.
// (UI pages remain gated to ADMIN/DEVELOPER; CASHIER gets read access for
// viewing treatments/treatment history during settlement.)
router.use(authenticate, authorize('ADMIN', 'DEVELOPER', 'CASHIER'));

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
        const { name, description, duration, price, defaultCommission, commissionPercent } = req.body;

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
      commissionPercent: commissionPercent != null ? commissionPercent : 20,
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

// POST /api/treatments/input - Record completed treatment (cashier input)
router.post('/input', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
        const { therapistId, customerId, treatmentId, bookingId, startTime, endTime, duration, price, commission, room, notes, customerName, idempotencyKey } = req.body;

    if (!therapistId || !treatmentId || !startTime || !endTime || !price) {
      return res.status(400).json({ message: 'Missing required fields: therapist, treatment, start/end time, price' });
    }

    // The timestamp columns expect real Date objects (drizzle's timestamp
    // mapper calls .toISOString()), so parse the client-supplied string times.
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end time' });
    }

    const therapist = await db.select().from(staffProfiles)
      .where(and(eq(staffProfiles.id, therapistId), eq(staffProfiles.outletId, userOutletId))).limit(1);
    if (!therapist.length) return res.status(400).json({ message: 'Invalid therapist' });

    const treatment = await db.select().from(treatments)
      .where(eq(treatments.id, treatmentId)).limit(1);
    if (!treatment.length) return res.status(400).json({ message: 'Invalid treatment' });

    // Idempotency: if the client supplied an idempotency key (generated when the
    // cashier began filling the form), return the previously recorded transaction
    // instead of creating a duplicate. This survives double-clicks, slow
    // networks, page refreshes, and retries — the server enforces it, not just
    // the disabled button.
    if (idempotencyKey) {
      const existing = await db.select().from(treatmentTransactions)
        .where(eq(treatmentTransactions.idempotencyKey, idempotencyKey)).limit(1);
      if (existing.length > 0) {
        const prevTx = existing[0];
        return res.status(200).json({
          ...prevTx,
          treatmentName: treatment[0].name,
          therapistName: therapist[0].name,
          idempotent: true,
        });
      }
    }



    // Booking-linked duplicate prevention (walk-ins rely on the idempotency key).
    if (bookingId) {
      const existing = await db.select().from(treatmentTransactions)
        .where(eq(treatmentTransactions.bookingId, bookingId)).limit(1);
      if (existing.length > 0) return res.status(409).json({ message: 'Transaction already recorded for this booking', existing: existing[0] });
    }

    const txId = uuidv4();
    // Calculate commission if not provided: commission = price × commissionPercent / 100
    const treatmentPercent = treatment[0].commissionPercent || 20; // default 20%
    const calculatedCommission = Number(price) * treatmentPercent / 100;
    const commissionToUse = commission !== undefined && commission !== '' ? Number(commission) : calculatedCommission;
    const effDuration = duration || treatment[0].duration;
        const newTx = await db.insert(treatmentTransactions).values({
      id: txId,
      bookingId: bookingId || undefined,
      treatmentId,
      therapistId,
      customerName: customerName || therapist[0].name,
      startTime: parsedStart,
      endTime: parsedEnd,
      price: String(price),
      commission: String(commissionToUse),
      room,
      notes: notes || '',
      idempotencyKey: idempotencyKey || undefined,
      outletId: userOutletId,
      recordedBy: req.user.id,
    }).returning();

    // In-app notification to therapist
    await db.insert(notifications).values({
      id: uuidv4(),
      userId: therapist[0].userId || '',
      title: 'New Treatment',
            message: `Treatment: ${treatment[0].name} (${effDuration} min) - ${room || ''}`,
      type: 'TREATMENT_ASSIGNED',
      isRead: false,
      createdAt: new Date(),
    });

    // Consume raw materials linked to this treatment via its recipe.
    try {
      await consumeRecipeForTreatment(treatmentId, userOutletId, txId);
    } catch (recipeErr) {
      console.error('Recipe consumption failed (non-blocking):', recipeErr);
    }

    // Push notification
    try {
      const therapistUser = await db.select({ id: users.id })
        .from(users).where(eq(users.id, therapist[0].userId || '')).limit(1);
      if (therapistUser.length) {
        await dispatchPushToUser(therapistUser[0].id, {
          title: 'Dayang Spa Resto',
          body: `New treatment: ${treatment[0].name}`,
          data: { type: 'TREATMENT_ASSIGNED', treatmentId, therapistId, startTime, endTime },
        });
      }
    } catch (e) { console.warn('Push failed:', e); }

    // Activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'TREATMENT_RECORDED',
      entityType: 'TREATMENT_TRANSACTION',
      entityId: txId,
      details: { therapistName: therapist[0].name, treatmentName: treatment[0].name, price, commission, startTime, endTime, room },
      outletId: userOutletId,
    });

    // Update therapist status to IN_TREATMENT (both booking-linked and walk-in
    // cashier input). If this treatment is tied to a booking, advance the
    // booking to IN_TREATMENT as well so schedule/dashboard stay in sync.
    const targetBookingId = bookingId || null;
    const currentStatus = await db.select()
      .from(staffStatus)
      .where(eq(staffStatus.staffId, therapist[0].id))
      .limit(1);
    const oldStatus = currentStatus.length > 0 ? currentStatus[0].status : 'OFF';

    if (targetBookingId) {
      await db.update(bookings)
        .set({ status: 'IN_TREATMENT', updatedAt: new Date() })
        .where(eq(bookings.id, targetBookingId));
    }

    if (currentStatus.length > 0) {
      await db.update(staffStatus)
        .set({ status: 'IN_TREATMENT', currentTreatmentId: targetBookingId, updatedAt: new Date() })
        .where(eq(staffStatus.id, currentStatus[0].id));
    } else {
      await db.insert(staffStatus).values({
        id: uuidv4(),
        staffId: therapist[0].id,
        status: 'IN_TREATMENT',
        currentTreatmentId: targetBookingId,
        outletId: userOutletId,
      });
    }

    if (oldStatus !== 'IN_TREATMENT') {
      await db.insert(staffStatusHistory).values({
        id: uuidv4(),
        staffId: therapist[0].id,
        oldStatus,
        newStatus: 'IN_TREATMENT',
        changedBy: req.user.id,
        outletId: userOutletId,
      });
    }

    res.status(201).json({ ...newTx[0], treatmentName: treatment[0].name, therapistName: therapist[0].name });
  
    // Create commission record
    try {
      const existingCommission = await db.select().from(commissions)
        .where(eq(commissions.treatmentTransactionId, txId));
      if (!existingCommission.length) {
        await db.insert(commissions).values({
          id: uuidv4(),
          treatmentTransactionId: txId,
          therapistId,
          outletId: userOutletId,
          customerId: customerId || undefined,
          treatmentName: treatment[0].name,
          treatmentPrice: String(Number(price)),
          commissionPercent: treatment[0].commissionPercent || 20,
          commissionAmount: String(Number(commissionToUse)),
          status: 'PENDING',
        });
      }
    } catch (e) {
      console.warn('Commission record creation warning:', e);
    }
  } catch (error) {
    console.error('Treatment input error:', error);
    res.status(500).json({ message: 'Failed to record treatment' });
  }
});

// Staff-specific endpoints
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

// GET /api/treatments/my-commissions - Staff see their own commissions
router.get('/my-commissions', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const staffProfile = await db.select().from(staffProfiles)
      .where(eq(staffProfiles.userId, req.user.id)).limit(1);
    if (!staffProfile.length) return res.status(404).json({ message: 'Staff profile not found' });

    const { startDate, endDate } = req.query;
    let conditions = [
      eq(treatmentTransactions.therapistId, staffProfile[0].id),
      eq(treatmentTransactions.outletId, userOutletId),
    ];
    if (startDate) {
      const start = new Date(startDate as string); start.setHours(0, 0, 0, 0);
      conditions.push(gte(treatmentTransactions.createdAt, start));
    }
    if (endDate) {
      const end = new Date(endDate as string); end.setHours(23, 59, 59, 999);
      conditions.push(lte(treatmentTransactions.createdAt, end));
    }

    const records = await db.select({
      id: treatmentTransactions.id,
      customerName: treatmentTransactions.customerName,
      treatmentName: treatments.name,
      startTime: treatmentTransactions.startTime,
      endTime: treatmentTransactions.endTime,
      price: treatmentTransactions.price,
      commission: treatmentTransactions.commission,
      room: treatmentTransactions.room,
      createdAt: treatmentTransactions.createdAt,
    }).from(treatmentTransactions)
      .leftJoin(treatments, eq(treatmentTransactions.treatmentId, treatments.id))
      .where(and(...conditions))
      .orderBy(desc(treatmentTransactions.createdAt));

    const summaryResult = await db.select({
      totalRevenue: sql<number>`sum(${treatmentTransactions.price})`,
      totalCommission: sql<number>`sum(${treatmentTransactions.commission})`,
      count: sql<number>`count(*)`,
    }).from(treatmentTransactions).where(and(...conditions));

    res.json({
      records,
      summary: {
        totalRevenue: Number(summaryResult[0]?.totalRevenue || 0),
        totalCommission: Number(summaryResult[0]?.totalCommission || 0),
        count: Number(summaryResult[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get my commissions error:', error);
    res.status(500).json({ message: 'Failed to fetch commissions' });
  }
});

export default router;