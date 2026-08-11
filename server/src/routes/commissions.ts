import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { treatmentTransactions, staffProfiles, treatments, outlets, users } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql, like } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/commissions - Get commission records with filters
router.get('/', authorize('ADMIN', 'DEVELOPER'), async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const userRole = req.user.role;
    const isDev = userRole === 'DEVELOPER';

    const staffId = req.query.staffId as string | undefined;
    const treatmentId = req.query.treatmentId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const conditions = [eq(treatmentTransactions.outletId, userOutletId)];

    if (!isDev && staffId) {
      conditions.push(eq(treatmentTransactions.therapistId, staffId));
    }
    if (treatmentId) {
      conditions.push(eq(treatmentTransactions.treatmentId, treatmentId));
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      conditions.push(gte(treatmentTransactions.createdAt, from));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(treatmentTransactions.createdAt, to));
    }
    if (search) {
      conditions.push(like(treatmentTransactions.customerName, `%${search}%`));
    }

    const records = await db.select({
      id: treatmentTransactions.id,
      bookingId: treatmentTransactions.bookingId,
      customerName: treatmentTransactions.customerName,
      therapistName: staffProfiles.name,
      therapistId: treatmentTransactions.therapistId,
      treatmentName: treatments.name,
      treatmentId: treatmentTransactions.treatmentId,
      startTime: treatmentTransactions.startTime,
      endTime: treatmentTransactions.endTime,
      price: treatmentTransactions.price,
      commission: treatmentTransactions.commission,
      room: treatmentTransactions.room,
      notes: treatmentTransactions.notes,
      recordedBy: users.username,
      createdAt: treatmentTransactions.createdAt,
    })
      .from(treatmentTransactions)
      .leftJoin(staffProfiles, eq(treatmentTransactions.therapistId, staffProfiles.id))
      .leftJoin(treatments, eq(treatmentTransactions.treatmentId, treatments.id))
      .leftJoin(users, eq(treatmentTransactions.recordedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(treatmentTransactions.createdAt))
      .limit(limit);

    // summary
    const summaryResult = await db.select({
      totalRevenue: sql<number>`sum(${treatmentTransactions.price})`,
      totalCommission: sql<number>`sum(${treatmentTransactions.commission})`,
      count: sql<number>`count(*)`,
    })
      .from(treatmentTransactions)
      .where(and(...conditions));

    res.json({
      records,
      summary: {
        totalRevenue: Number(summaryResult[0]?.totalRevenue || 0),
        totalCommission: Number(summaryResult[0]?.totalCommission || 0),
        count: Number(summaryResult[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ message: 'Failed to fetch commissions' });
  }
});

export default router;
