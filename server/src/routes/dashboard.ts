import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, staffProfiles, staffStatus, activityLogs, treatments, outlets } from '../db/schema.js';
import { eq, desc, and, gte, lt, sql } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const userRole = req.user.role;
    const isAdmin = ['ADMIN', 'DEVELOPER'].includes(userRole);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's bookings
    const todayBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, today),
        lt(bookings.date, tomorrow)
      ));

    // Get staff online (not OFF)
    const staffOnline = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        sql`${staffStatus.status} != 'OFF'`
      ));

    // Get pending bookings
    const pendingBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        eq(bookings.status, 'PENDING')
      ));

    // Get staff on break
    const staffOnBreak = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'ON_BREAK')
      ));

    // Get staff on treatment
    const staffOnTreatment = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'IN_TREATMENT')
      ));

    // Get available therapists (FREE)
    const availableTherapists = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'FREE')
      ));

    // Get in-charge staff
    const inChargeStaff = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'IN_CHARGE')
      ));

    // Get busy staff (IN_TREATMENT)
    const busyStaff = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'IN_TREATMENT')
      ));

    // Get off-air staff
    const offAirStaff = await db.select({ count: sql<number>`count(*)` })
      .from(staffStatus)
      .where(and(
        eq(staffStatus.outletId, userOutletId),
        eq(staffStatus.status, 'OFF')
      ));

    // Get today's revenue from completed bookings
    const todayRevenue = await db.select({ total: sql<string>`COALESCE(SUM(price), 0)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, today),
        lt(bookings.date, tomorrow),
        eq(bookings.status, 'COMPLETED')
      ));

    // Get today's commission from treatment transactions
    const todayCommission = await db.select({ total: sql<string>`COALESCE(SUM(commission), 0)` })
      .from(treatmentTransactions)
      .where(and(
        eq(treatmentTransactions.outletId, userOutletId),
        gte(treatmentTransactions.createdAt, today),
        lt(treatmentTransactions.createdAt, tomorrow)
      ));

    // Get confirmed bookings count
    const confirmedBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, today),
        lt(bookings.date, tomorrow),
        eq(bookings.status, 'CONFIRMED')
      ));

    // Get in-treatment bookings count
    const inTreatmentBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, today),
        lt(bookings.date, tomorrow),
        eq(bookings.status, 'IN_TREATMENT')
      ));

    // Get completed treatments count
    const completedTreatments = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.date, today),
        lt(bookings.date, tomorrow),
        eq(bookings.status, 'COMPLETED')
      ));

    res.json({
      bookingsToday: Number(todayBookings[0]?.count || 0),
      staffOnline: Number(staffOnline[0]?.count || 0),
      pendingBookings: Number(pendingBookings[0]?.count || 0),
      staffOnBreak: Number(staffOnBreak[0]?.count || 0),
      staffOnTreatment: Number(staffOnTreatment[0]?.count || 0),
      availableTherapists: Number(availableTherapists[0]?.count || 0),
      inChargeStaff: Number(inChargeStaff[0]?.count || 0),
      busyStaff: Number(busyStaff[0]?.count || 0),
      offAirStaff: Number(offAirStaff[0]?.count || 0),
      todayRevenue: Number(todayRevenue[0]?.total || 0),
      todayCommission: Number(todayCommission[0]?.total || 0),
      confirmedBookings: Number(confirmedBookings[0]?.count || 0),
      inTreatmentBookings: Number(inTreatmentBookings[0]?.count || 0),
      completedTreatments: Number(completedTreatments[0]?.count || 0),
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/dashboard/staff-status - Get staff status with treatment details
router.get('/staff-status', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const now = new Date();

    const staffList = await db.select({
      id: staffProfiles.id,
      name: staffProfiles.name,
      status: staffStatus.status,
      outletName: outlets.name,
      currentTreatmentId: staffStatus.currentTreatmentId,
    })
      .from(staffProfiles)
      .leftJoin(staffStatus, eq(staffProfiles.id, staffStatus.staffId))
      .leftJoin(outlets, eq(staffProfiles.outletId, outlets.id))
      .where(eq(staffProfiles.outletId, userOutletId))
      .orderBy(staffProfiles.name);

    // Enrich with current treatment details if IN_TREATMENT
    const enrichedList = await Promise.all(
      staffList.map(async (staff) => {
        if (staff.status === 'IN_TREATMENT' && staff.currentTreatmentId) {
          const currentBooking = await db.select({
            id: bookings.id,
            customerName: bookings.customerName,
            startTime: bookings.startTime,
            endTime: bookings.endTime,
            treatmentName: treatments.name,
            room: bookings.room,
          })
            .from(bookings)
            .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
            .where(eq(bookings.id, staff.currentTreatmentId))
            .limit(1);

          if (currentBooking.length > 0) {
            const booking = currentBooking[0];
            const endTime = new Date(booking.endTime);
            const remainingMs = endTime.getTime() - now.getTime();
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));

            return {
              ...staff,
              currentTreatment: booking.treatmentName,
              currentCustomer: booking.customerName,
              startTime: booking.startTime,
              endTime: booking.endTime,
              remainingMinutes,
              room: booking.room,
            };
          }
        }
        return staff;
      })
    );

    res.json(enrichedList);
  } catch (error) {
    console.error('Get staff status error:', error);
    res.status(500).json({ message: 'Failed to fetch staff status' });
  }
});

// GET /api/dashboard/next-bookings - Get upcoming bookings
router.get('/next-bookings', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const limit = parseInt(req.query.limit as string) || 10;

    const now = new Date();
    const upcomingBookings = await db.select({
      id: bookings.id,
      bookingId: bookings.bookingId,
      customerName: bookings.customerName,
      treatmentName: treatments.name,
      therapistName: staffProfiles.name,
      room: bookings.room,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
    })
      .from(bookings)
      .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
      .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
      .where(and(
        eq(bookings.outletId, userOutletId),
        gte(bookings.startTime, now),
        sql`${bookings.status} != 'CANCELLED'`
      ))
      .orderBy(bookings.startTime)
      .limit(limit);

    res.json(upcomingBookings);
  } catch (error) {
    console.error('Get next bookings error:', error);
    res.status(500).json({ message: 'Failed to fetch next bookings' });
  }
});

// GET /api/dashboard/activity - Get recent activity
router.get('/activity', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const limit = parseInt(req.query.limit as string) || 20;

    const activities = await db.select({
      id: activityLogs.id,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      userName: activityLogs.userName,
      details: activityLogs.details,
      createdAt: activityLogs.createdAt,
    })
      .from(activityLogs)
      .where(eq(activityLogs.outletId, userOutletId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
});

export default router;