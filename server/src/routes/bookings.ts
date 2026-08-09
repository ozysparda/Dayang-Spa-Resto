import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, staffStatus, treatments, staffProfiles, outlets, users, notifications, activityLogs } from '../db/schema.js';
import { eq, and, gte, lt, lte, desc, sql, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication and ADMIN or DEVELOPER role
router.use(authenticate, authorize('ADMIN', 'DEVELOPER'));

// GET /api/bookings - Get all bookings
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { date, status, therapistId } = req.query;

    let allBookings;
    
    if (date) {
      const dateObj = new Date(date as string);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      
      allBookings = await db.select({
        id: bookings.id,
        bookingId: bookings.bookingId,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        duration: bookings.duration,
        room: bookings.room,
        price: bookings.price,
        commission: bookings.commission,
        status: bookings.status,
        notes: bookings.notes,
        treatmentName: treatments.name,
        therapistName: staffProfiles.name,
        outletName: outlets.name,
        createdAt: bookings.createdAt,
      })
        .from(bookings)
        .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
        .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
        .leftJoin(outlets, eq(bookings.outletId, outlets.id))
        .where(and(
          eq(bookings.outletId, userOutletId),
          gte(bookings.date, dateObj),
          lte(bookings.date, nextDay)
        ))
        .orderBy(desc(bookings.startTime));
    } else if (status) {
      allBookings = await db.select({
        id: bookings.id,
        bookingId: bookings.bookingId,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        duration: bookings.duration,
        room: bookings.room,
        price: bookings.price,
        commission: bookings.commission,
        status: bookings.status,
        notes: bookings.notes,
        treatmentName: treatments.name,
        therapistName: staffProfiles.name,
        outletName: outlets.name,
        createdAt: bookings.createdAt,
      })
        .from(bookings)
        .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
        .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
        .leftJoin(outlets, eq(bookings.outletId, outlets.id))
        .where(and(
          eq(bookings.outletId, userOutletId),
          sql`${bookings.status} = ${status as string}`
        ))
        .orderBy(desc(bookings.startTime));
    } else if (therapistId) {
      allBookings = await db.select({
        id: bookings.id,
        bookingId: bookings.bookingId,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        duration: bookings.duration,
        room: bookings.room,
        price: bookings.price,
        commission: bookings.commission,
        status: bookings.status,
        notes: bookings.notes,
        treatmentName: treatments.name,
        therapistName: staffProfiles.name,
        outletName: outlets.name,
        createdAt: bookings.createdAt,
      })
        .from(bookings)
        .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
        .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
        .leftJoin(outlets, eq(bookings.outletId, outlets.id))
        .where(and(
          eq(bookings.outletId, userOutletId),
          eq(bookings.therapistId, therapistId as string)
        ))
        .orderBy(desc(bookings.startTime));
    } else {
      allBookings = await db.select({
        id: bookings.id,
        bookingId: bookings.bookingId,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        date: bookings.date,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        duration: bookings.duration,
        room: bookings.room,
        price: bookings.price,
        commission: bookings.commission,
        status: bookings.status,
        notes: bookings.notes,
        treatmentName: treatments.name,
        therapistName: staffProfiles.name,
        outletName: outlets.name,
        createdAt: bookings.createdAt,
      })
        .from(bookings)
        .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
        .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
        .leftJoin(outlets, eq(bookings.outletId, outlets.id))
        .where(eq(bookings.outletId, userOutletId))
        .orderBy(desc(bookings.startTime));
    }
    res.json(allBookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/:id - Get single booking
router.get('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const booking = await db.select({
      id: bookings.id,
      bookingId: bookings.bookingId,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      date: bookings.date,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      duration: bookings.duration,
      room: bookings.room,
      price: bookings.price,
      commission: bookings.commission,
      status: bookings.status,
      notes: bookings.notes,
      treatmentId: bookings.treatmentId,
      treatmentName: treatments.name,
      therapistId: bookings.therapistId,
      therapistName: staffProfiles.name,
      outletId: bookings.outletId,
      outletName: outlets.name,
      createdAt: bookings.createdAt,
    })
      .from(bookings)
      .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
      .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
      .leftJoin(outlets, eq(bookings.outletId, outlets.id))
      .where(and(
        eq(bookings.id, req.params.id),
        eq(bookings.outletId, userOutletId)
      ))
      .limit(1);

    if (!booking.length) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking[0]);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ message: 'Failed to fetch booking' });
  }
});

// POST /api/bookings - Create new booking
router.post('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const {
      customerName,
      customerPhone,
      treatmentId,
      therapistId,
      date,
      startTime,
      endTime,
      room,
      price,
      commission,
      notes,
    } = req.body;

    // Validate required fields
    if (!customerName || !treatmentId || !therapistId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get treatment details
    const treatment = await db.select().from(treatments).where(eq(treatments.id, treatmentId)).limit(1);
    if (!treatment.length) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    // Parse dates
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    const bookingDate = new Date(date);

    // Calculate duration
    const duration = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

    if (duration <= 0) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    // Check for booking conflicts
    const conflictingBooking = await db.select()
      .from(bookings)
      .where(and(
        eq(bookings.therapistId, therapistId),
        eq(bookings.outletId, userOutletId),
        sql`${bookings.status} != 'CANCELLED'`,
        or(
          and(
            gte(bookings.startTime, startDateTime),
            lt(bookings.startTime, endDateTime)
          ),
          and(
            gte(bookings.endTime, startDateTime),
            lt(bookings.endTime, endDateTime)
          ),
          and(
            lte(bookings.startTime, startDateTime),
            gte(bookings.endTime, endDateTime)
          )
        )
      ))
      .limit(1);

    if (conflictingBooking.length > 0) {
      return res.status(409).json({ 
        message: 'Therapist is already booked during this time',
        conflictingBooking: conflictingBooking[0]
      });
    }

    // Generate booking ID
    const bookingId = `BK-${Date.now()}-${Math.random().toString(36).substr(0, 9)}`;
    const bookingIdNum = uuidv4();

    // Create booking
    const newBooking = await db.insert(bookings).values({
      id: bookingIdNum,
      bookingId,
      customerName,
      customerPhone,
      outletId: userOutletId,
      date: bookingDate,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      treatmentId,
      therapistId,
      room,
      price: price || treatment[0].price,
      commission: commission || treatment[0].defaultCommission,
      status: 'PENDING',
      notes,
      createdBy: req.user.id,
    }).returning();

    // Get therapist and outlet info for notification
    const therapist = await db.select().from(staffProfiles).where(eq(staffProfiles.id, therapistId)).limit(1);
    const outlet = await db.select().from(outlets).where(eq(outlets.id, userOutletId)).limit(1);

    // Create notification for therapist
    if (therapist.length > 0) {
      const therapistUser = await db.select().from(users).where(eq(users.id, therapist[0].userId)).limit(1);
      
      if (therapistUser.length > 0) {
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: therapistUser[0].id,
          title: 'New Treatment Assignment',
          message: `You have been assigned to ${customerName} for ${treatment[0].name} at ${outlet[0]?.name}`,
          type: 'TREATMENT_ASSIGNED',
          relatedId: newBooking[0].id,
        });
      }
    }

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'BOOKING_CREATED',
      entityType: 'BOOKING',
      entityId: newBooking[0].id,
      details: {
        bookingId: newBooking[0].bookingId,
        customerName,
        therapistName: therapist[0]?.name,
        treatmentName: treatment[0].name,
        startTime: startDateTime,
        endTime: endDateTime,
      },
      outletId: userOutletId,
    });

    res.status(201).json(newBooking[0]);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Failed to create booking' });
  }
});

// PATCH /api/bookings/:id - Update booking
router.patch('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const updates = req.body;

    // Check if booking exists
    const existingBooking = await db.select()
      .from(bookings)
      .where(and(
        eq(bookings.id, id),
        eq(bookings.outletId, userOutletId)
      ))
      .limit(1);

    if (!existingBooking.length) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // If therapist or time is being changed, check for conflicts
    if (updates.therapistId || updates.startTime || updates.endTime) {
      const therapistId = updates.therapistId || existingBooking[0].therapistId;
      const startTime = updates.startTime ? new Date(updates.startTime) : existingBooking[0].startTime;
      const endTime = updates.endTime ? new Date(updates.endTime) : existingBooking[0].endTime;

      const conflictingBooking = await db.select()
        .from(bookings)
        .where(and(
          eq(bookings.therapistId, therapistId),
          eq(bookings.outletId, userOutletId),
          sql`${bookings.id} != '${id}'`,
          sql`${bookings.status} != 'CANCELLED'`,
          or(
            and(
              gte(bookings.startTime, startTime),
              lt(bookings.startTime, endTime)
            ),
            and(
              gte(bookings.endTime, startTime),
              lt(bookings.endTime, endTime)
            ),
            and(
              lte(bookings.startTime, startTime),
              gte(bookings.endTime, endTime)
            )
          )
        ))
        .limit(1);

      if (conflictingBooking.length > 0) {
        return res.status(409).json({ 
          message: 'Therapist is already booked during this time',
          conflictingBooking: conflictingBooking[0]
        });
      }
    }

    // Update booking
    const updatedBooking = await db.update(bookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'BOOKING_UPDATED',
      entityType: 'BOOKING',
      entityId: id,
      details: {
        bookingId: existingBooking[0].bookingId,
        updates,
      },
      outletId: userOutletId,
    });

    res.json(updatedBooking[0]);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - Cancel booking
router.delete('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;

    // Check if booking exists
    const existingBooking = await db.select()
      .from(bookings)
      .where(and(
        eq(bookings.id, id),
        eq(bookings.outletId, userOutletId)
      ))
      .limit(1);

    if (!existingBooking.length) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Cancel booking (soft delete)
    const cancelledBooking = await db.update(bookings)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'BOOKING_CANCELLED',
      entityType: 'BOOKING',
      entityId: id,
      details: {
        bookingId: existingBooking[0].bookingId,
        customerName: existingBooking[0].customerName,
      },
      outletId: userOutletId,
    });

    res.json(cancelledBooking[0]);
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

// GET /api/bookings/available-therapists - Get available therapists for a time slot
router.get('/available-therapists', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { startTime, endTime, date } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'startTime and endTime are required' });
    }

    const startDateTime = new Date(startTime as string);
    const endDateTime = new Date(endTime as string);

    // Get all active staff in the outlet
    const allStaff = await db.select({
      id: staffProfiles.id,
      name: staffProfiles.name,
      status: staffStatus.status,
    })
      .from(staffProfiles)
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .where(and(
        eq(staffProfiles.outletId, userOutletId),
        eq(staffProfiles.isActive, true)
      ));

    // Get therapists with conflicting bookings
    const conflictingTherapists = await db.select({ therapistId: bookings.therapistId })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        sql`${bookings.status} != 'CANCELLED'`,
        or(
          and(
            gte(bookings.startTime, startDateTime),
            lt(bookings.startTime, endDateTime)
          ),
          and(
            gte(bookings.endTime, startDateTime),
            lt(bookings.endTime, endDateTime)
          ),
          and(
            lte(bookings.startTime, startDateTime),
            gte(bookings.endTime, endDateTime)
          )
        )
      ));

    const conflictingTherapistIds = new Set(conflictingTherapists.map(t => t.therapistId));

    // Filter out conflicting therapists
    const availableTherapists = allStaff.filter(staff => !conflictingTherapistIds.has(staff.id));

    res.json(availableTherapists);
  } catch (error) {
    console.error('Get available therapists error:', error);
    res.status(500).json({ message: 'Failed to fetch available therapists' });
  }
});

export default router;