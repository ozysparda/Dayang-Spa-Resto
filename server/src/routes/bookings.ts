import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, staffStatus, treatments, staffProfiles, outlets, users, notifications, activityLogs, staffStatusHistory, treatmentTransactions } from '../db/schema.js';
import { eq, and, gte, lt, lte, desc, sql, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { dispatchPushToUser } from '../routes/push.js';

// Utility: add minutes to a Date/string timestamp, correctly handling day boundaries.
function addMinutes(startTime: string | Date, minutes: number): Date {
  const d = new Date(startTime);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// Utility: round a Date to the nearest minute (drop seconds/ms).
function toMinutePrecision(date: Date): Date {
  date.setSeconds(0, 0);
  return date;
}

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper to check if user is ADMIN/DEVELOPER
const isAdmin = (req: any) => ['ADMIN', 'DEVELOPER'].includes(req.user.role);

// GET /api/bookings - Get bookings (STAFF sees their own, ADMIN sees all)
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { date, status, therapistId } = req.query;
    const admin = isAdmin(req);

    let allBookings;
    
    if (date) {
      const dateObj = new Date(date as string);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      
      let whereConditions = [
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, dateObj),
        lte(bookings.date, nextDay)
      ];

      // If not admin, only show bookings where user is the therapist
      if (!admin) {
        const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);
        if (staffProfile.length > 0) {
          whereConditions.push(eq(bookings.therapistId, staffProfile[0].id));
        } else {
          return res.json([]);
        }
      }
      
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
        .where(and(...whereConditions))
        .orderBy(desc(bookings.startTime));
    } else if (status) {
      let whereConditions = [
        eq(bookings.outletId, userOutletId),
        sql`${bookings.status} = ${status as string}`
      ];

      if (!admin) {
        const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);
        if (staffProfile.length > 0) {
          whereConditions.push(eq(bookings.therapistId, staffProfile[0].id));
        } else {
          return res.json([]);
        }
      }
      
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
        .where(and(...whereConditions))
        .orderBy(desc(bookings.startTime));
    } else {
      let whereConditions = [eq(bookings.outletId, userOutletId)];

      if (!admin) {
        const staffProfile = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id)).limit(1);
        if (staffProfile.length > 0) {
          whereConditions.push(eq(bookings.therapistId, staffProfile[0].id));
        } else {
          return res.json([]);
        }
      }
      
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
        .where(and(...whereConditions))
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

// POST /api/bookings - Create new booking (ADMIN/DEVELOPER only)
router.post('/', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
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
      duration,
    } = req.body;

    // Validate required fields
    if (!customerName || !treatmentId || !therapistId || !date || !startTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get treatment details
    const treatment = await db.select().from(treatments).where(eq(treatments.id, treatmentId)).limit(1);
    if (!treatment.length) {
      return res.status(404).json({ message: 'Treatment not found' });
    }

    // Parse dates
    const startDateTime = toMinutePrecision(new Date(startTime));
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    // Use provided duration, otherwise derive from treatment
    const treatmentDuration = typeof duration === 'number' ? duration : treatment[0].duration;
    const expectedEndTime = addMinutes(startDateTime, treatmentDuration);

    // If client provided endTime, validate it matches the calculated time (±1 min tolerance)
    if (endTime) {
      const clientEnd = toMinutePrecision(new Date(endTime));
      const diffMs = Math.abs(clientEnd.getTime() - expectedEndTime.getTime());
      const diffMin = diffMs / (1000 * 60);
      if (diffMin > 1) {
        return res.status(400).json({
          message: `End time does not match treatment duration. Expected ${expectedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${treatmentDuration} minutes from ${startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          expectedEndTime: expectedEndTime.toISOString(),
        });
      }
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
            lt(bookings.startTime, expectedEndTime)
          ),
          and(
            gte(bookings.endTime, startDateTime),
            lt(bookings.endTime, expectedEndTime)
          ),
          and(
            lte(bookings.startTime, startDateTime),
            gte(bookings.endTime, expectedEndTime)
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
      endTime: expectedEndTime,
      duration: treatmentDuration,
      treatmentId,
      therapistId,
      room,
      price: price || treatment[0].price,
      commission: commission || treatment[0].defaultCommission,
      status: 'PENDING',
      notes,
      createdBy: req.user.id,
    }).returning();

    // Phase 3: Staff availability is NOT automatically changed on booking creation
    // Staff remains available (FREE, IN_CHARGE, etc.) until booking status changes to IN_TREATMENT
    // The automatic status updates happen in the PATCH endpoint when booking status changes

    // Get therapist and outlet info for notification
    const therapist = await db.select().from(staffProfiles).where(eq(staffProfiles.id, therapistId)).limit(1);
    const outlet = await db.select().from(outlets).where(eq(outlets.id, userOutletId)).limit(1);

    // Phase 5: Create enhanced notification for therapist with treatment assignment details
    if (therapist.length > 0) {
      const therapistUser = await db.select().from(users).where(eq(users.id, therapist[0].userId)).limit(1);
      
      const startTimeStr = startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const endTimeStr = expectedEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const title = '🔔 NEW TREATMENT';
      const message = `Customer:\n${customerName}\n\nTreatment:\n${treatment[0].name}\n\nTime:\n${startTimeStr} - ${endTimeStr}\n\nOutlet:\n${outlet[0]?.name || ''}\n\nRoom:\n${room}`;

      if (therapistUser.length > 0) {
        // Create in-app notification
        await db.insert(notifications).values({
          id: uuidv4(),
          userId: therapistUser[0].id,
          title,
          message,
          type: 'TREATMENT_ASSIGNED',
          relatedId: newBooking[0].id,
        });

        // Dispatch browser push notification (Phase 6)
        await dispatchPushToUser(therapistUser[0].id, {
          type: 'TREATMENT_ASSIGNED',
          title: 'Dayang Spa Resto - New Treatment',
          body: `New treatment assigned to you.\n\n${customerName}\n${treatment[0].name}\n${startTimeStr} - ${endTimeStr}`,
          data: {
            bookingId: newBooking[0].bookingId,
            relatedId: newBooking[0].id,
            route: '/bookings',
            customer: customerName,
            treatment: treatment[0].name,
            time: `${startTimeStr} - ${endTimeStr}`,
            outlet: outlet[0]?.name || '',
            room: room,
          },
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
        endTime: expectedEndTime,
        duration: treatmentDuration,
      },
      outletId: userOutletId,
    });

    res.status(201).json(newBooking[0]);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Failed to create booking' });
  }
});

// PATCH /api/bookings/:id - Update booking (ADMIN/DEVELOPER only)
router.patch('/:id', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
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
      const startTime = updates.startTime ? toMinutePrecision(new Date(updates.startTime)) : existingBooking[0].startTime;
      
      // If treatment duration changed or start time changed, recalculate end time
      let endTime = updates.endTime ? toMinutePrecision(new Date(updates.endTime)) : existingBooking[0].endTime;
      if (updates.duration || updates.startTime || updates.treatmentId) {
        const treatmentId = updates.treatmentId || existingBooking[0].treatmentId;
        const treatment = await db.select().from(treatments).where(eq(treatments.id, treatmentId)).limit(1);
        if (treatment.length) {
          const dur = typeof updates.duration === 'number' ? updates.duration : treatment[0].duration;
          endTime = addMinutes(startTime, dur);
          updates.duration = dur;
          updates.endTime = endTime.toISOString();
        }
      }

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

    // Update staff status based on booking status
    if (updates.status) {
      const therapistId = existingBooking[0].therapistId;
      
      if (updates.status === 'IN_TREATMENT') {
        // Set therapist to IN_TREATMENT
        const currentStatus = await db.select().from(staffStatus).where(eq(staffStatus.staffId, therapistId)).limit(1);
        const oldStatus = currentStatus.length > 0 ? currentStatus[0].status : null;
        
        if (currentStatus.length > 0) {
          await db.update(staffStatus)
            .set({ status: 'IN_TREATMENT', currentTreatmentId: id, updatedAt: new Date() })
            .where(eq(staffStatus.id, currentStatus[0].id));
        } else {
          await db.insert(staffStatus).values({
            id: uuidv4(),
            staffId: therapistId,
            status: 'IN_TREATMENT',
            currentTreatmentId: id,
            outletId: existingBooking[0].outletId,
          });
        }
        
        if (oldStatus && oldStatus !== 'IN_TREATMENT') {
          await db.insert(staffStatusHistory).values({
            id: uuidv4(),
            staffId: therapistId,
            oldStatus,
            newStatus: 'IN_TREATMENT',
            changedBy: req.user.id,
            outletId: existingBooking[0].outletId,
          });
        }
      } else if (updates.status === 'COMPLETED' || updates.status === 'CANCELLED') {
        // Check if therapist has other active bookings
        const otherActiveBookings = await db.select({ count: sql<number>`count(*)` })
          .from(bookings)
          .where(and(
            eq(bookings.therapistId, therapistId),
            eq(bookings.outletId, userOutletId),
            sql`${bookings.status} != 'CANCELLED'`
          ));

        if (Number(otherActiveBookings[0]?.count || 0) === 0) {
          const currentStatus = await db.select().from(staffStatus).where(eq(staffStatus.staffId, therapistId)).limit(1);
          if (currentStatus.length > 0 && currentStatus[0].status === 'IN_TREATMENT') {
            const oldStatus = currentStatus[0].status;
            await db.update(staffStatus)
              .set({ status: 'FREE', currentTreatmentId: null, updatedAt: new Date() })
              .where(eq(staffStatus.id, currentStatus[0].id));
            
            await db.insert(staffStatusHistory).values({
              id: uuidv4(),
              staffId: therapistId,
              oldStatus,
              newStatus: 'FREE',
              changedBy: req.user.id,
              outletId: existingBooking[0].outletId,
            });
          }
        }
      }
    }

    // Generate commission/treatment-transaction when booking is COMPLETED
    if (updates.status === 'COMPLETED') {
      try {
        const existingTx = await db.select()
          .from(treatmentTransactions)
          .where(eq(treatmentTransactions.bookingId, existingBooking[0].bookingId))
          .limit(1);

        if (existingTx.length === 0) {
          await db.insert(treatmentTransactions).values({
            id: uuidv4(),
            bookingId: existingBooking[0].bookingId,
            outletId: existingBooking[0].outletId,
            therapistId: existingBooking[0].therapistId,
            treatmentId: existingBooking[0].treatmentId,
            customerName: existingBooking[0].customerName,
            startTime: existingBooking[0].startTime,
            endTime: existingBooking[0].endTime,
            price: String(existingBooking[0].price),
            commission: String(existingBooking[0].commission ?? 0),
            room: existingBooking[0].room,
            notes: existingBooking[0].notes,
            recordedBy: req.user.id,
          });
        }
      } catch (txError) {
        console.error('Error generating commission transaction:', txError);
      }
    }

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

// DELETE /api/bookings/:id - Cancel booking (ADMIN/DEVELOPER only)
router.delete('/:id', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
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

    // Reset therapist status to FREE if no other active bookings
    const therapistId = existingBooking[0].therapistId;
    const otherActiveBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.therapistId, therapistId),
        eq(bookings.outletId, userOutletId),
        sql`${bookings.status} != 'CANCELLED'`
      ));

    if (Number(otherActiveBookings[0]?.count || 0) === 0) {
      const currentStatus = await db.select().from(staffStatus).where(eq(staffStatus.staffId, therapistId)).limit(1);
      if (currentStatus.length > 0) {
        await db.update(staffStatus)
          .set({ status: 'FREE', updatedAt: new Date() })
          .where(eq(staffStatus.id, currentStatus[0].id));
        
        await db.insert(staffStatusHistory).values({
          id: uuidv4(),
          staffId: therapistId,
          oldStatus: currentStatus[0].status,
          newStatus: 'FREE',
          changedBy: req.user.id,
          outletId: userOutletId,
        });
      }
    }

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
        therapistId,
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

    const startDateTime = toMinutePrecision(new Date(startTime as string));
    const endDateTime = toMinutePrecision(new Date(endTime as string));

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

// GET /api/bookings/availability - Grouped staff availability for a time slot.
//
// Queries:
//   startTime   ISO string (e.g. "2026-08-11T10:10:00") of the slot start
//   duration    slot length in minutes (optional; defaults to 60)
//   treatmentId when given, the duration is taken from the treatment master
//
// Returns:
//   {
//     startTime, endTime, duration, treatmentName?,
//     available: [{ id, name, status }],
//     busy:    [{ id, name, status, bookings: [{ customerName, treatmentName, startTime, endTime, status }] }],
//     offAir:   [{ id, name }]
//   }
//
// This is THE core scheduling feature: a cashier picks date/time + treatment
// and immediately sees who is FREE to take it, who is BUSY (with the
// conflicting booking details), and who is OFF AIR.
router.get('/availability', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { startTime, duration, treatmentId } = req.query;

    if (!startTime) {
      return res.status(400).json({ message: 'startTime is required' });
    }

    // Resolve duration (and treatment name) from the selected treatment,
    // otherwise fall back to the query param or a default of 60 min.
    let slotMinutes = 60;
    let treatmentName = '';
    if (treatmentId) {
      const t = await db
        .select({ duration: treatments.duration, name: treatments.name })
        .from(treatments)
        .where(eq(treatments.id, treatmentId as string))
        .limit(1);
      if (!t.length) {
        return res.status(404).json({ message: 'Treatment not found' });
      }
      slotMinutes = t[0].duration;
      treatmentName = t[0].name;
    } else if (duration) {
      const n = Number(duration);
      if (Number.isNaN(n) || n <= 0) {
        return res.status(400).json({ message: 'Invalid duration' });
      }
      slotMinutes = n;
    }

    const startDateTime = new Date(startTime as string);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + slotMinutes);

    // All active staff at the user's outlet with their current live status.
    const allStaff = await db
      .select({
        id: staffProfiles.id,
        name: staffProfiles.name,
        status: staffStatus.status,
      })
      .from(staffProfiles)
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .where(and(eq(staffProfiles.outletId, userOutletId), eq(staffProfiles.isActive, true)));

    // Bookings that overlap the requested slot — same three overlap cases used
    // everywhere else in the app so availability matches creation logic.
    const overlapping = await db
      .select({
        therapistId: bookings.therapistId,
        customerName: bookings.customerName,
        treatmentName: treatments.name,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
      })
      .from(bookings)
      .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
      .where(
        and(
          eq(bookings.outletId, userOutletId),
          sql`${bookings.status} != 'CANCELLED'`,
          or(
            and(gte(bookings.startTime, startDateTime), lt(bookings.startTime, endDateTime)),
            and(gte(bookings.endTime, startDateTime), lt(bookings.endTime, endDateTime)),
            and(lte(bookings.startTime, startDateTime), gte(bookings.endTime, endDateTime))
          )
        )
      );

    const overlapByTherapist: Record<string, any[]> = {};
    overlapping.forEach((o) => {
      (overlapByTherapist[o.therapistId] = overlapByTherapist[o.therapistId] || []).push(o);
    });

    const available: any[] = [];
    const busy: any[] = [];
    const offAir: any[] = [];

    for (const s of allStaff) {
      const conflicts = overlapByTherapist[s.id] || [];
      if (conflicts.length > 0) {
        busy.push({ ...s, bookings: conflicts });
      } else if (s.status === 'OFF') {
        offAir.push({ ...s });
      } else {
        available.push({ ...s });
      }
    }

    res.json({
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      duration: slotMinutes,
      treatmentName,
      available,
      busy,
      offAir,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ message: 'Failed to fetch availability' });
  }
});

// GET /api/bookings/schedule - Get schedule grid for a date
// Returns time slots (09:00-21:00) x staff matrix with status for each slot
router.get('/schedule', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    }

    const slotDate = new Date(dateStr);
    slotDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(slotDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // operating hours: 09:00 to 21:00, 30-minute slots
    const slots: string[] = [];
    for (let h = 9; h <= 20; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }

    // all active staff at outlet
    const allStaff = await db
      .select({
        id: staffProfiles.id,
        name: staffProfiles.name,
        status: staffStatus.status,
      })
      .from(staffProfiles)
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .where(and(eq(staffProfiles.outletId, userOutletId), eq(staffProfiles.isActive, true)))
      .orderBy(staffProfiles.name);

    // all non-cancelled bookings for the date at this outlet
    const dayBookings = await db
      .select({
        therapistId: bookings.therapistId,
        customerName: bookings.customerName,
        treatmentName: treatments.name,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
      })
      .from(bookings)
      .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
      .where(
        and(
          eq(bookings.outletId, userOutletId),
          gte(bookings.date, slotDate),
          lt(bookings.date, nextDay),
          sql`${bookings.status} != 'CANCELLED'`
        )
      );

    // Build matrix: staff -> slot label -> { status, booking? }
    const matrix: Record<string, Record<string, { status: string; booking?: any }>> = {};
    for (const s of allStaff) {
      matrix[s.id] = {};
      for (const slot of slots) {
        const [h, m] = slot.split(':').map(Number);
        const slotStart = new Date(slotDate);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

        const overlapping = dayBookings.filter((b) => {
          if (b.therapistId !== s.id) return false;
          const bs = new Date(b.startTime);
          const be = new Date(b.endTime);
          return bs < slotEnd && be > slotStart;
        });

        if (overlapping.length > 0) {
          matrix[s.id][slot] = { status: 'BUSY', booking: overlapping[0] };
        } else if (s.status === 'OFF') {
          matrix[s.id][slot] = { status: 'OFF' };
        } else if (s.status === 'ON_BREAK') {
          matrix[s.id][slot] = { status: 'BREAK' };
        } else if (s.status === 'IN_CHARGE') {
          matrix[s.id][slot] = { status: 'IN_CHARGE' };
        } else {
          matrix[s.id][slot] = { status: 'FREE' };
        }
      }
    }

    res.json({ date: dateStr, slots, staff: allStaff, matrix });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ message: 'Failed to fetch schedule' });
  }
});

export default router;