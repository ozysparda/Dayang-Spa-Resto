import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  bookings,
  treatments,
  staffProfiles,
  treatmentTransactions,
  commissions,
  activityLogs,
} from '../db/schema.js';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All settlement routes require authentication.
router.use(authenticate);

// GET /api/settlements - List bookings needing payment (status = PENDING_PAYMENT).
//
// Accessible by CASHIER / ADMIN / DEVELOPER.
//
// Query:
//   date  optional ISO date (YYYY-MM-DD). When omitted, today's bookings are returned.
router.get(
  '/',
  authorize('CASHIER', 'ADMIN', 'DEVELOPER'),
  async (req: any, res) => {
    try {
      const userOutletId = req.user.outletId;
      const { date } = req.query;

      let dayStart: Date;
      if (date) {
        const parsed = new Date(date as string);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: 'Invalid date' });
        }
        dayStart = new Date(parsed);
        dayStart.setHours(0, 0, 0, 0);
      } else {
        dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const pendingBookings = await db
        .select({
          bookingId: bookings.bookingId,
          customerName: bookings.customerName,
          customerPhone: bookings.customerPhone,
          treatmentId: bookings.treatmentId,
          therapistId: bookings.therapistId,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          price: bookings.price,
          commission: bookings.commission,
          room: bookings.room,
          treatmentName: treatments.name,
          therapistName: staffProfiles.name,
        })
        .from(bookings)
        .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
        .leftJoin(staffProfiles, eq(bookings.therapistId, staffProfiles.id))
        .where(
          and(
            eq(bookings.outletId, userOutletId),
            eq(bookings.status, 'PENDING_PAYMENT'),
            gte(bookings.startTime, dayStart),
            lt(bookings.startTime, dayEnd),
          ),
        )
        .orderBy(bookings.startTime);

      res.json(pendingBookings);
    } catch (error) {
      console.error('Get settlements error:', error);
      res.status(500).json({ message: 'Failed to fetch settlements' });
    }
  },
);

// POST /api/settlements/complete - Bulk mark pending-payment bookings as COMPLETED.
//
// Accessible by CASHIER / ADMIN / DEVELOPER.
//
// Body: { bookingIds: string[] }
//
// For each booking: reuses/creates its treatment transaction, creates a PAID
// commission row for the therapist, flips the booking to COMPLETED, and writes
// an activity log. All operations run in a single DB transaction.
router.post(
  '/complete',
  authorize('CASHIER', 'ADMIN', 'DEVELOPER'),
  async (req: any, res) => {
    try {
      const userOutletId = req.user.outletId;
      const { bookingIds } = req.body as { bookingIds: string[] };

      if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
        return res.status(400).json({ message: 'bookingIds array is required' });
      }

      const completed = await db.transaction(async (tx) => {
        const processed: string[] = [];

        for (const bookingId of bookingIds) {
          // Fetch the full booking (with treatment name) so we can populate the
          // commission row and skip non-pending bookings.
          const [existing] = await tx
            .select({
              status: bookings.status,
              bookingId: bookings.bookingId,
              customerName: bookings.customerName,
              therapistId: bookings.therapistId,
              treatmentId: bookings.treatmentId,
              startTime: bookings.startTime,
              endTime: bookings.endTime,
              price: bookings.price,
              commission: bookings.commission,
              room: bookings.room,
              treatmentName: treatments.name,
            })
            .from(bookings)
            .leftJoin(treatments, eq(bookings.treatmentId, treatments.id))
            .where(
              and(
                eq(bookings.bookingId, bookingId),
                eq(bookings.outletId, userOutletId),
              ),
            )
            .limit(1);

          if (!existing) {
            continue;
          }

          // Only settle bookings that are awaiting payment.
          if (existing.status !== 'PENDING_PAYMENT') {
            continue;
          }

          // Reuse an existing treatment transaction if one was already recorded
          // (e.g. via /api/treatments/input); otherwise create it now so the
          // commission row has a valid FK target.
          const [existingTx] = await tx
            .select({ id: treatmentTransactions.id })
            .from(treatmentTransactions)
            .where(eq(treatmentTransactions.bookingId, bookingId))
            .limit(1);

          let txId = existingTx?.id;
          if (!txId) {
            txId = uuidv4();
            await tx.insert(treatmentTransactions).values({
              id: txId,
              bookingId,
              treatmentId: existing.treatmentId,
              therapistId: existing.therapistId,
              customerName: existing.customerName,
              startTime: existing.startTime,
              endTime: existing.endTime,
              price: existing.price ?? '0',
              commission: existing.commission ?? '0',
              room: existing.room,
              notes: 'Settled via cashier settlement',
              outletId: userOutletId,
              recordedBy: req.user.id,
            });
          }

          // Create the therapist's commission record as PAID (payment collected).
          await tx.insert(commissions).values({
            id: uuidv4(),
            treatmentTransactionId: txId,
            therapistId: existing.therapistId,
            outletId: userOutletId,
            customerId: null,
            treatmentName: existing.treatmentName || '',
            treatmentPrice: existing.price ?? '0',
            commissionPercent: 0,
            commissionAmount: existing.commission ?? '0',
            status: 'PAID',
            paidAt: new Date(),
            approvedBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Mark the booking paid/completed.
          await tx
            .update(bookings)
            .set({
              status: 'COMPLETED',
              updatedAt: new Date(),
            })
            .where(eq(bookings.bookingId, bookingId));

          // Audit trail for the settlement.
          await tx.insert(activityLogs).values({
            id: uuidv4(),
            userId: req.user.id,
            userName: req.user.username,
            action: 'PAYMENT_COMPLETED',
            entityType: 'BOOKING',
            entityId: bookingId,
            details: {
              customerName: existing.customerName,
              price: existing.price,
              commission: existing.commission,
            },
            outletId: userOutletId,
          });

          processed.push(bookingId);
        }

        return processed;
      });

      res.json({ completed: completed, count: completed.length });
    } catch (error) {
      console.error('Complete settlement error:', error);
      res.status(500).json({ message: 'Failed to complete settlements' });
    }
  },
);


// GET /api/settlements/report - End-of-day settlement summary.
//
// Accessible by CASHIER / ADMIN / DEVELOPER.
//
// Query:
//   date  optional ISO date (YYYY-MM-DD). When omitted, today is used.
router.get(
  '/report',
  authorize('CASHIER', 'ADMIN', 'DEVELOPER'),
  async (req: any, res) => {
    try {
      const userOutletId = req.user.outletId;
      const { date } = req.query;

      let dayStart: Date;
      if (date) {
        const parsed = new Date(date as string);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: 'Invalid date' });
        }
        dayStart = new Date(parsed);
        dayStart.setHours(0, 0, 0, 0);
      } else {
        dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Aggregate completed bookings for revenue / commission totals.
      const [totals] = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CAST(${bookings.price} AS REAL)), 0)`,
          totalCommission: sql<number>`COALESCE(SUM(CAST(${bookings.commission} AS REAL)), 0)`,
          completedCount: sql<number>`COUNT(*)`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.outletId, userOutletId),
            eq(bookings.status, 'COMPLETED'),
            gte(bookings.startTime, dayStart),
            lt(bookings.startTime, dayEnd),
          ),
        );

      // Status breakdown across all bookings for the day.
      const [statusCounts] = await db
        .select({
          pending: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'PENDING' THEN 1 END)`,
          confirmed: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'CONFIRMED' THEN 1 END)`,
          inTreatment: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'IN_TREATMENT' THEN 1 END)`,
          pendingPayment: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'PENDING_PAYMENT' THEN 1 END)`,
          completed: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'COMPLETED' THEN 1 END)`,
          cancelled: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'CANCELLED' THEN 1 END)`,
          noShow: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'NO_SHOW' THEN 1 END)`,
          allBookings: sql<number>`COUNT(*)`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.outletId, userOutletId),
            gte(bookings.startTime, dayStart),
            lt(bookings.startTime, dayEnd),
          ),
        );

      const reportDate = dayStart.toISOString().split('T')[0];

      res.json({
        date: reportDate,
        totalRevenue: Number(totals?.totalRevenue || 0),
        totalCommission: Number(totals?.totalCommission || 0),
        treatmentCount: Number(totals?.completedCount || 0),
        completedBookings: Number(totals?.completedCount || 0),
        statusBreakdown: {
          pending: Number(statusCounts?.pending || 0),
          confirmed: Number(statusCounts?.confirmed || 0),
          inTreatment: Number(statusCounts?.inTreatment || 0),
          pendingPayment: Number(statusCounts?.pendingPayment || 0),
          completed: Number(statusCounts?.completed || 0),
          cancelled: Number(statusCounts?.cancelled || 0),
          noShow: Number(statusCounts?.noShow || 0),
          all: Number(statusCounts?.allBookings || 0),
        },
      });
    } catch (error) {
      console.error('Get settlement report error:', error);
      res.status(500).json({ message: 'Failed to generate report' });
    }
  },
);

export default router;

