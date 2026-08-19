import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  bills,
  treatmentTransactions,
  commissions,
  inventoryMovements,
  inventory,
  treatments,
  staffProfiles,
  outlets,
} from '../db/schema.js';
import { eq, and, desc, gte, lte, lt, sql } from 'drizzle-orm';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'DEVELOPER'));

// Apply optional date-range filters, returning the extra WHERE conditions.
function dateFilter(query: any): any[] {
  const { startDate, endDate } = query;
  const conditions: any[] = [];
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    conditions.push(s);
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    conditions.push(e);
  }
  return conditions;
}

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [txSummary, billSummary, consumed] = await Promise.all([
      db
        .select({
          treatmentCount: sql<number>`count(*)`,
          revenue: sql<number>`sum(${treatmentTransactions.price})`,
          commission: sql<number>`sum(${treatmentTransactions.commission})`,
        })
        .from(treatmentTransactions)
        .where(
          and(
            eq(treatmentTransactions.outletId, userOutletId),
            gte(treatmentTransactions.createdAt, dayStart),
            lt(treatmentTransactions.createdAt, dayEnd),
          ),
        )
        .limit(1),
      db
        .select({
          billCount: sql<number>`count(*)`,
          paid: sql<number>`sum(case when ${bills.paymentStatus} = 'PAID' then 1 else 0 end)`,
          unpaid: sql<number>`sum(case when ${bills.paymentStatus} = 'UNPAID' then 1 else 0 end)`,
          revenue: sql<number>`sum(${bills.grandTotal}) filter (where ${bills.paymentStatus} = 'PAID')`,
        })
        .from(bills)
        .where(
          and(
            eq(bills.outletId, userOutletId),
            gte(bills.createdAt, dayStart),
            lt(bills.createdAt, dayEnd),
          ),
        )
        .limit(1),
      db
        .select({
          materialCount: sql<number>`count(*)`,
          totalCost: sql<number>`sum(${inventoryMovements.quantity} * ${inventory.costPerUsageUnit})`,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.outletId, userOutletId),
            eq(inventoryMovements.type, 'RECIPE_CONSUMPTION'),
            gte(inventoryMovements.createdAt, dayStart),
            lt(inventoryMovements.createdAt, dayEnd),
          ),
        )
        .limit(1),
    ]);

    res.json({
      date: dayStart.toISOString().slice(0, 10),
      treatments: txSummary[0],
      bills: billSummary[0],
      rawMaterials: consumed[0],
    });
    } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ message: 'Failed to fetch daily report' });
  }
});

// GET /api/reports/commission?startDate=&endDate=
router.get('/commission', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const conditions: any[] = [eq(treatmentTransactions.outletId, userOutletId)];
    const df = dateFilter(req.query);
    if (df[0]) conditions.push(gte(treatmentTransactions.startTime, df[0]));
    if (df[1]) conditions.push(lte(treatmentTransactions.startTime, df[1]));

    const rows = await db
      .select({
        therapistId: treatmentTransactions.therapistId,
        therapistName: staffProfiles.name,
        treatmentCount: sql<number>`count(*)`,
        revenue: sql<number>`sum(${treatmentTransactions.price})`,
        commission: sql<number>`sum(${treatmentTransactions.commission})`,
      })
      .from(treatmentTransactions)
      .leftJoin(staffProfiles, eq(treatmentTransactions.therapistId, staffProfiles.id))
      .where(and(...conditions))
      .groupBy(treatmentTransactions.therapistId)
      .orderBy(desc(sql`sum(${treatmentTransactions.commission})`));

    res.json(rows);
  } catch (error) {
    console.error('Commission report error:', error);
    res.status(500).json({ message: 'Failed to fetch commission report' });
  }
});

// GET /api/reports/raw-materials?startDate=&endDate=
router.get('/raw-materials', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const conditions: any[] = [
      eq(inventoryMovements.outletId, userOutletId),
      eq(inventoryMovements.type, 'RECIPE_CONSUMPTION'),
    ];
    const df = dateFilter(req.query);
    if (df[0]) conditions.push(gte(inventoryMovements.createdAt, df[0]));
    if (df[1]) conditions.push(lte(inventoryMovements.createdAt, df[1]));

    const rows = await db
      .select({
        inventoryId: inventoryMovements.inventoryId,
        productName: inventory.productName,
        unit: inventoryMovements.unit,
        totalConsumed: sql<number>`sum(${inventoryMovements.quantity})`,
        totalCost: sql<number>`sum(${inventoryMovements.quantity} * ${inventory.costPerUsageUnit})`,
      })
      .from(inventoryMovements)
      .leftJoin(inventory, eq(inventoryMovements.inventoryId, inventory.id))
      .where(and(...conditions))
      .groupBy(inventoryMovements.inventoryId)
      .orderBy(desc(sql`sum(${inventoryMovements.quantity} * ${inventory.costPerUsageUnit})`));

    res.json(rows);
  } catch (error) {
    console.error('Raw materials report error:', error);
    res.status(500).json({ message: 'Failed to fetch raw materials report' });
  }
});

// GET /api/reports/treatments?startDate=&endDate=
router.get('/treatments', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const conditions: any[] = [eq(treatmentTransactions.outletId, userOutletId)];
    const df = dateFilter(req.query);
    if (df[0]) conditions.push(gte(treatmentTransactions.startTime, df[0]));
    if (df[1]) conditions.push(lte(treatmentTransactions.startTime, df[1]));

    const rows = await db
      .select({
        treatmentId: treatmentTransactions.treatmentId,
        treatmentName: treatments.name,
        treatmentCount: sql<number>`count(*)`,
        revenue: sql<number>`sum(${treatmentTransactions.price})`,
        commission: sql<number>`sum(${treatmentTransactions.commission})`,
      })
      .from(treatmentTransactions)
      .leftJoin(treatments, eq(treatmentTransactions.treatmentId, treatments.id))
      .where(and(...conditions))
      .groupBy(treatmentTransactions.treatmentId, treatments.name)
      .orderBy(desc(sql`sum(${treatmentTransactions.price})`));

    res.json(rows);
  } catch (error) {
    console.error('Treatment report error:', error);
    res.status(500).json({ message: 'Failed to fetch treatment report' });
  }
});

export default router;

