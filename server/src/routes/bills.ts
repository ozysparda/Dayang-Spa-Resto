import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bills, bookings, treatments, outlets, users } from '../db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Cashier (and ADMIN/DEVELOPER) flows: list, checkout, pay, print.
router.use(authenticate, authorize('ADMIN', 'DEVELOPER', 'CASHIER'));

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// POST /api/bills - create a bill (cashier checkout). `bookingId` is optional
// (supports walk-in customers). Totals are computed server-side so the client
// cannot tamper with the grand total.
router.post('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const {
      bookingId,
      customerName,
      customerPhone,
      treatmentId,
      treatmentName,
      treatmentPrice,
      addOns,
      discount,
      tax,
      serviceCharge,
      paymentMethod,
    } = req.body;

    const bookingRef = bookingId
      ? await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
      : [];

    let resolvedName = customerName;
    let resolvedTreatmentId = treatmentId;
    let resolvedTreatmentName = treatmentName;
    let price = num(treatmentPrice);

    if (bookingRef.length > 0) {
      const b = bookingRef[0];
      resolvedName = resolvedName || b.customerName;
      resolvedTreatmentId = resolvedTreatmentId || b.treatmentId;
      if (!resolvedTreatmentName) {
        const t = await db.select({ name: treatments.name }).from(treatments).where(eq(treatments.id, b.treatmentId)).limit(1);
        resolvedTreatmentName = t[0]?.name || '';
      }
      price = price || num(b.price);
    }

    if (!resolvedName || !price) {
      return res.status(400).json({ message: 'customerName and a treatmentPrice (or bookingId) are required' });
    }

    const addOnsTotal = (addOns || []).reduce((sum: number, a: any) => sum + num(a.price) * num(a.quantity), 0);
    const discountVal = num(discount);
    const taxVal = num(tax);
    const serviceVal = num(serviceCharge);
    const grandTotal = Math.round((price + addOnsTotal - discountVal + taxVal + serviceVal) * 100) / 100;

    const receiptNumber = `RE-${fmtDate(new Date())}-${uuidv4().slice(0, 8)}`;
    const id = uuidv4();

    await db.insert(bills).values({
      id,
      receiptNumber,
      bookingId: bookingId || undefined,
      outletId: userOutletId,
      customerName: resolvedName,
      customerPhone,
      treatmentName: resolvedTreatmentName,
      treatmentPrice: String(price),
      addOns: (addOns || []),
      discount: String(discountVal),
      tax: String(taxVal),
      serviceCharge: String(serviceVal),
      grandTotal: String(grandTotal),
      paymentMethod: paymentMethod || 'CASH',
      paymentStatus: 'UNPAID',
      cashierId: req.user.id,
    } as any);

    const created = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Failed to create bill' });
  }
});

// GET /api/bills - list bills with optional filters
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { startDate, endDate, paymentMethod, paymentStatus, search } = req.query;
    let conditions: any[] = [eq(bills.outletId, userOutletId)];

    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(bills.createdAt, start));
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(bills.createdAt, end));
    }
    if (paymentMethod) conditions.push(eq(bills.paymentMethod, paymentMethod as any));
    if (paymentStatus) conditions.push(eq(bills.paymentStatus, paymentStatus as any));
    if (search) conditions.push(sql`${bills.customerName} ILIKE ${`%${search}%`}`);

    const rows = await db
      .select({
        id: bills.id,
        receiptNumber: bills.receiptNumber,
        bookingId: bills.bookingId,
        customerName: bills.customerName,
        customerPhone: bills.customerPhone,
        treatmentName: bills.treatmentName,
        treatmentPrice: bills.treatmentPrice,
        addOns: bills.addOns,
        discount: bills.discount,
        tax: bills.tax,
        serviceCharge: bills.serviceCharge,
        grandTotal: bills.grandTotal,
        paymentMethod: bills.paymentMethod,
        paymentStatus: bills.paymentStatus,
        paidAt: bills.paidAt,
        cashierName: users.username,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .leftJoin(users, eq(bills.cashierId, users.id))
      .where(and(...conditions))
      .orderBy(desc(bills.createdAt))
      .limit(Number(req.query.limit) || 100);

    res.json(rows);
  } catch (error) {
    console.error('List bills error:', error);
    res.status(500).json({ message: 'Failed to fetch bills' });
  }
});

// GET /api/bills/:id
router.get('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const row = await db
      .select({
        id: bills.id,
        receiptNumber: bills.receiptNumber,
        bookingId: bills.bookingId,
        customerName: bills.customerName,
        customerPhone: bills.customerPhone,
        treatmentName: bills.treatmentName,
        treatmentPrice: bills.treatmentPrice,
        addOns: bills.addOns,
        discount: bills.discount,
        tax: bills.tax,
        serviceCharge: bills.serviceCharge,
        grandTotal: bills.grandTotal,
        paymentMethod: bills.paymentMethod,
        paymentStatus: bills.paymentStatus,
        paidAt: bills.paidAt,
        notes: bills.notes,
        cashierName: users.username,
        outletName: outlets.name,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .leftJoin(users, eq(bills.cashierId, users.id))
      .leftJoin(outlets, eq(bills.outletId, outlets.id))
      .where(and(eq(bills.id, req.params.id), eq(bills.outletId, userOutletId)))
      .limit(1);

    if (!row.length) return res.status(404).json({ message: 'Bill not found' });
    res.json(row[0]);
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ message: 'Failed to fetch bill' });
  }
});

// POST /api/bills/:id/pay - record payment (cashier action)
router.post('/:id/pay', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { paymentMethod } = req.body;
    const existing = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, req.params.id), eq(bills.outletId, userOutletId)))
      .limit(1);
    if (!existing.length) return res.status(404).json({ message: 'Bill not found' });

    await db
      .update(bills)
      .set({
        paymentMethod: paymentMethod || existing[0].paymentMethod,
        paymentStatus: 'PAID',
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bills.id, req.params.id));

    const updated = await db
      .select()
      .from(bills)
      .where(eq(bills.id, req.params.id))
      .limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Pay bill error:', error);
    res.status(500).json({ message: 'Failed to record payment' });
  }
});

// GET /api/bills/:id/print - printable receipt payload
router.get('/:id/print', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const row = await db
      .select({
        receiptNumber: bills.receiptNumber,
        customerName: bills.customerName,
        customerPhone: bills.customerPhone,
        treatmentName: bills.treatmentName,
        treatmentPrice: bills.treatmentPrice,
        addOns: bills.addOns,
        discount: bills.discount,
        tax: bills.tax,
        serviceCharge: bills.serviceCharge,
        grandTotal: bills.grandTotal,
        paymentMethod: bills.paymentMethod,
        paymentStatus: bills.paymentStatus,
        createdAt: bills.createdAt,
        outletName: outlets.name,
      })
      .from(bills)
      .leftJoin(outlets, eq(bills.outletId, outlets.id))
      .where(and(eq(bills.id, req.params.id), eq(bills.outletId, userOutletId)))
      .limit(1);

    if (!row.length) return res.status(404).json({ message: 'Bill not found' });
    res.json(row[0]);
  } catch (error) {
    console.error('Print bill error:', error);
    res.status(500).json({ message: 'Failed to fetch bill' });
  }
});

export default router;
