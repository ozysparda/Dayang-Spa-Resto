import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  inventory,
  inventoryMovements,
  inventoryReconciliations,
  suppliers,
  recipes,
  recipeItems,
  treatmentRecipes,
  stockOpnames,
  stockOpnameItems,
  inventoryImports,
  inventoryImportRows,
  outlets,
  treatments,
  activityLogs,
} from '../db/schema.js';
import { resolveInventoryReconciliation } from '../utils/recipe.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';

const router = Router();

// All routes require authentication and ADMIN or DEVELOPER role
router.use(authenticate, authorize('ADMIN', 'DEVELOPER'));

// GET /api/inventory - Get inventory items
router.get('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { category, search } = req.query;

    let conditions = [eq(inventory.outletId, userOutletId)];

    if (category) {
      conditions.push(eq(inventory.category, category as string));
    }

    if (search) {
      conditions.push(sql`${inventory.productName} ILIKE ${`%${search}%`}`);
    }

    const items = await db.select()
      .from(inventory)
      .where(and(...conditions))
      .orderBy(inventory.productName);
    res.json(items);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
});

// GET /api/inventory/:id - Get single inventory item
// UUID format guard: lets named sub-routes (/low-stock, /summary, /movements,
// /imports, /suppliers, /recipes) registered later fall through instead of
// being swallowed by this :id handler (Express matches in registration order).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:id', async (req: any, res, next) => {
  if (!UUID_RE.test(req.params.id)) return next();
  try {
    const userOutletId = req.user.outletId;
    const item = await db.select()
      .from(inventory)
      .where(and(
        eq(inventory.id, req.params.id),
        eq(inventory.outletId, userOutletId)
      ))
      .limit(1);

    if (!item.length) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json(item[0]);
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory item' });
  }
});

// POST /api/inventory - Create inventory item
router.post('/', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const {
      sku,
      productName,
      category,
      itemType,
      isReusable,
      quantity,
      unit,
      cost,
      sellingPrice,
      minimumStock,
      purchaseUnit,
      usageUnit,
      conversion,
      purchasePrice,
      supplier,
      isActive,
      notes,
    } = req.body;

    if (!sku || !productName) {
      return res.status(400).json({ message: 'SKU and product name are required' });
    }

    // Check if SKU already exists in this outlet (SKU is unique per outlet).
    const existingItem = await db.select().from(inventory)
      .where(and(eq(inventory.sku, sku), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (existingItem.length > 0) {
      return res.status(400).json({ message: 'SKU already exists in this outlet' });
    }

    const id = uuidv4();
    await db.insert(inventory).values({
      id,
      sku,
      productName,
      category,
      itemType: itemType ?? 'OTHER',
      isReusable: itemType === 'REUSABLE' ? true : !!isReusable,
      reusableAvailable: 0,
      reusableInUse: 0,
      quantity: quantity ?? 0,
      unit,
      cost,
      sellingPrice,
      minimumStock,
      purchaseUnit,
      usageUnit,
      conversion: conversion != null ? String(conversion) : '1',
      purchasePrice,
      supplier,
      isActive: isActive !== false,
      notes,
      outletId: userOutletId,
    } as any);

        // Record an OPENING movement so the ledger has a traceable starting point.
    const created = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, id))
      .limit(1);
    if (num(quantity) > 0) {
      // recordMovement persists quantity on insert, so just log the opening
      // movement for the ledger history.
      await db.insert(inventoryMovements).values({
        id: uuidv4(),
        inventoryId: id,
        outletId: userOutletId,
        type: 'OPENING',
        quantity: num(quantity),
        unit: usageUnit || unit,
        beforeStock: 0,
        afterStock: num(quantity),
        notes: 'Initial stock on item creation',
      } as any);
    }

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'INVENTORY_CREATED',
      entityType: 'INVENTORY',
      entityId: id,
      details: { sku, productName },
      outletId: userOutletId,
    });

        res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ message: 'Failed to create inventory item' });
  }
});

// PATCH /api/inventory/:id - Update inventory item
router.patch('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { id } = req.params;
    const updates = req.body;

    // Check if item exists
    const existingItem = await db.select()
      .from(inventory)
      .where(and(
        eq(inventory.id, id),
        eq(inventory.outletId, userOutletId)
      ))
      .limit(1);

    if (!existingItem.length) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

        // Update item with explicit fields
    const updatedItem = await db.update(inventory)
      .set({
        productName: updates.productName || existingItem[0].productName,
        category: updates.category !== undefined ? updates.category : existingItem[0].category,
        quantity: updates.quantity !== undefined ? updates.quantity : existingItem[0].quantity,
        unit: updates.unit !== undefined ? updates.unit : existingItem[0].unit,
        cost: updates.cost !== undefined ? updates.cost : existingItem[0].cost,
        sellingPrice: updates.sellingPrice !== undefined ? updates.sellingPrice : existingItem[0].sellingPrice,
        minimumStock: updates.minimumStock !== undefined ? updates.minimumStock : existingItem[0].minimumStock,
        purchaseUnit: updates.purchaseUnit !== undefined ? updates.purchaseUnit : existingItem[0].purchaseUnit,
        usageUnit: updates.usageUnit !== undefined ? updates.usageUnit : existingItem[0].usageUnit,
        conversion: updates.conversion !== undefined ? String(updates.conversion) : existingItem[0].conversion,
        purchasePrice: updates.purchasePrice !== undefined ? updates.purchasePrice : existingItem[0].purchasePrice,
        supplier: updates.supplier !== undefined ? updates.supplier : existingItem[0].supplier,
        isActive: updates.isActive !== undefined ? updates.isActive : existingItem[0].isActive,
        notes: updates.notes !== undefined ? updates.notes : existingItem[0].notes,
        lastUpdated: new Date(),
      })
      .where(eq(inventory.id, id))
      .returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'INVENTORY_UPDATED',
      entityType: 'INVENTORY',
      entityId: id,
      details: {
        sku: existingItem[0].sku,
        productName: existingItem[0].productName,
        updates,
      },
      outletId: userOutletId,
    });

    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Failed to update inventory item' });
  }
});

// POST /api/inventory/import - Import inventory from CSV
router.post('/import', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { csvData, fileName } = req.body;

    if (!csvData || !fileName) {
      return res.status(400).json({ message: 'CSV data and file name are required' });
    }

    // Parse CSV
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      return res.status(400).json({ message: 'CSV parsing error', errors: parsed.errors });
    }

    // Create import record
    const importRecord = await db.insert(inventoryImports).values({
      id: uuidv4(),
      fileName,
      importedBy: req.user.id,
      totalRows: parsed.data.length,
      successRows: 0,
      failedRows: 0,
      errors: [],
    }).returning();

    const importId = importRecord[0].id;
    let successCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    // Process each row
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as any;
      const rowNumber = i + 1;

      try {
        // Validate required fields
        if (!row.SKU || !row['Product Name']) {
          throw new Error('SKU and Product Name are required');
        }

        // Check if SKU exists
        const existingItem = await db.select().from(inventory).where(eq(inventory.sku, row.SKU)).limit(1);

        if (existingItem.length > 0) {
          // Update existing item
          await db.update(inventory)
            .set({
              productName: row['Product Name'],
              category: row.Category,
              quantity: parseInt(row.Quantity) || 0,
              unit: row.Unit,
              cost: row.Cost ? String(parseFloat(row.Cost)) : undefined,
              sellingPrice: row['Selling Price'] ? String(parseFloat(row['Selling Price'])) : undefined,
              lastUpdated: new Date(),
            })
            .where(eq(inventory.id, existingItem[0].id));

          // Create import row record
          await db.insert(inventoryImportRows).values({
            id: uuidv4(),
            importId,
            rowNumber,
            sku: row.SKU,
            productName: row['Product Name'],
            quantity: parseInt(row.Quantity) || 0,
            status: 'SUCCESS',
            inventoryId: existingItem[0].id,
          });

          successCount++;
        } else {
          // Create new item
          const newItem = await db.insert(inventory).values({
            id: uuidv4() as any,
            sku: row.SKU,
            productName: row['Product Name'],
            category: row.Category,
            quantity: parseInt(row.Quantity) || 0,
            unit: row.Unit,
            cost: row.Cost ? String(parseFloat(row.Cost)) : undefined,
            sellingPrice: row['Selling Price'] ? String(parseFloat(row['Selling Price'])) : undefined,
            outletId: userOutletId,
          } as any).returning();

          // Create import row record
          await db.insert(inventoryImportRows).values({
            id: uuidv4() as any,
            importId,
            rowNumber,
            sku: row.SKU,
            productName: row['Product Name'],
            quantity: String(parseInt(row.Quantity) || 0),
            status: 'SUCCESS',
            inventoryId: newItem[0].id,
          } as any);

          successCount++;
        }
      } catch (error: any) {
        // Record failed row
        await db.insert(inventoryImportRows).values({
          id: uuidv4() as any,
          importId,
          rowNumber,
          sku: row.SKU || '',
          productName: row['Product Name'] || '',
          quantity: String(parseInt(row.Quantity) || 0),
          status: 'FAILED',
          errorMessage: error.message,
        } as any);

        failedCount++;
        errors.push({
          row: rowNumber,
          error: error.message,
          data: row,
        });
      }
    }

    // Update import record
    await db.update(inventoryImports)
      .set({
        successRows: successCount,
        failedRows: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      })
      .where(eq(inventoryImports.id, importId));

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'INVENTORY_IMPORTED',
      entityType: 'INVENTORY',
      entityId: importId,
      details: {
        fileName,
        totalRows: parsed.data.length,
        successRows: successCount,
        failedRows: failedCount,
      },
      outletId: userOutletId,
    });

    res.json({
      importId,
      fileName,
      totalRows: parsed.data.length,
      successRows: successCount,
      failedRows: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import inventory error:', error);
    res.status(500).json({ message: 'Failed to import inventory' });
  }
});

// GET /api/inventory/imports - Get import history
router.get('/imports', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const limit = parseInt(req.query.limit as string) || 20;

    const imports = await db.select({
      id: inventoryImports.id,
      fileName: inventoryImports.fileName,
      importedBy: inventoryImports.importedBy,
      totalRows: inventoryImports.totalRows,
      successRows: inventoryImports.successRows,
      failedRows: inventoryImports.failedRows,
      createdAt: inventoryImports.createdAt,
    })
      .from(inventoryImports)
      .where(eq(inventoryImports.importedBy, req.user.id))
      .orderBy(desc(inventoryImports.createdAt))
      .limit(limit);

    res.json(imports);
  } catch (error) {
    console.error('Get imports error:', error);
    res.status(500).json({ message: 'Failed to fetch imports' });
  }
});

// ---- helpers (shared by stock operations & recipes) ---------------------

function num(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

// Core ledger application on an explicit transaction client — used directly
// by multi-step flows (transfer) that need several movements to be atomic.
async function applyMovement(
  tx: any,
  inv: any,
  type: Parameters<typeof recordMovement>[1],
  delta: number,
  refId: string | undefined,
  notes?: string,
  referenceType?: string,
) {
  const before = num(inv?.quantity);
  let updated: { quantity: number }[];
  if (delta < 0) {
    updated = await tx
      .update(inventory)
      .set({ quantity: sql`${inventory.quantity} + ${delta}`, lastUpdated: new Date() })
      .where(and(eq(inventory.id, inv.id), gte(inventory.quantity, Math.abs(delta))))
      .returning({ quantity: inventory.quantity });
    if (!updated.length) {
      throw new Error(`INSUFFICIENT_STOCK:${inv.productName ?? inv.id}`);
    }
  } else {
    updated = await tx
      .update(inventory)
      .set({ quantity: Math.round((before + delta) * 1000) / 1000, lastUpdated: new Date() })
      .where(eq(inventory.id, inv.id))
      .returning({ quantity: inventory.quantity });
    if (!updated.length) throw new Error('INVENTORY_ROW_MISSING');
  }
  const actualAfter = num(updated[0].quantity);
  await tx.insert(inventoryMovements).values({
    id: uuidv4(),
    inventoryId: inv.id,
    outletId: inv.outletId,
    type,
    quantity: delta,
    unit: inv.usageUnit || inv.unit,
    beforeStock: before,
    afterStock: actualAfter,
    referenceType,
    referenceId: refId,
    notes,
  } as any);
}

// Write an immutable movement row AND mutate the inventory balance in `quantity`
// inside ONE database transaction — no partial updates possible.
// `delta` is expressed in the item's usage_unit (what `quantity` counts).
// Negative deltas are guarded at the SQL level: the decrement only applies when
// sufficient stock exists, otherwise INSUFFICIENT_STOCK is thrown and the whole
// transaction rolls back.
async function recordMovement(
  inv: any,
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RECIPE_CONSUMPTION' | 'OPENING' | 'OPNAME' | 'REVERSAL'
    | 'PURCHASE' | 'RETAIL_SALE' | 'WASTE' | 'RETURN' | 'TRANSFER',
  delta: number,
  refId: string | undefined,
  notes?: string,
  referenceType?: string,
) {
  if (Math.abs(delta) < 1e-9) return;
  await db.transaction(async (tx) => {
    await applyMovement(tx, inv, type, delta, refId, notes, referenceType);
  });
}

/** Map a ledger failure to the right HTTP status (400 for stock issues). */
function isStockGuardError(err: unknown): boolean {
  return String((err as Error)?.message || '').startsWith('INSUFFICIENT_STOCK');
}

// DELETE /api/inventory/:id - soft delete
router.delete('/:id', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const existing = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, req.params.id), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!existing.length) return res.status(404).json({ message: 'Inventory item not found' });
    await db
      .update(inventory)
      .set({ isActive: false, lastUpdated: new Date() })
      .where(eq(inventory.id, req.params.id));
    res.json({ message: 'Inventory item deleted' });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({ message: 'Failed to delete inventory item' });
  }
});

// POST /api/inventory/stock-in - receive stock
router.post('/stock-in', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, notes } = req.body;
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    await recordMovement(item[0], 'IN', num(quantity), undefined, notes);
    const refreshed = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, inventoryId))
      .limit(1);
    const mov = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.inventoryId, inventoryId))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(1);
    res.status(201).json({ ...refreshed[0], lastMovement: mov[0] });
  } catch (error) {
    console.error('Stock in error:', error);
    res.status(500).json({ message: 'Failed to add stock' });
  }
});

// POST /api/inventory/stock-out - issue stock (consumption/use)
router.post('/stock-out', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, reason, notes } = req.body;
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    await recordMovement(item[0], 'OUT', -num(quantity), undefined, notes || reason);
    const refreshed = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, inventoryId))
      .limit(1);
    res.status(201).json(refreshed[0]);
  } catch (error) {
    if (isStockGuardError(error)) return res.status(400).json({ message: 'Not enough stock' });
    console.error('Stock out error:', error);
    res.status(500).json({ message: 'Failed to issue stock' });
  }
});

// POST /api/inventory/adjustment - set balance to a precise value (physical count)
router.post('/adjustment', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, notes } = req.body;
    if (!inventoryId) return res.status(400).json({ message: 'inventoryId is required' });
    if (num(quantity) < 0) return res.status(400).json({ message: 'Quantity cannot be negative' });
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    const current = num(item[0].quantity);
    const target = num(quantity);
    await recordMovement(item[0], 'ADJUSTMENT', target - current, undefined, notes);
    const refreshed = await db
      .select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    res.json(refreshed[0]);
  } catch (error) {
    console.error('Adjustment error:', error);
    res.status(500).json({ message: 'Failed to adjust stock' });
  }
});

// POST /api/inventory/purchase - receive stock as a typed purchase (ledger PURCHASE)
router.post('/purchase', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, supplier, purchasePrice, notes, referenceId } = req.body;
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });

    // Optionally update the item's supplier / purchasePrice from this purchase.
    const patch: any = {};
    if (supplier) patch.supplier = supplier;
    if (purchasePrice && num(purchasePrice) > 0) {
      patch.purchasePrice = String(num(purchasePrice));
      // Drive usage-unit cost from purchase unit → usage unit conversion.
      const conv = num(item[0].conversion) || 1;
      patch.costPerUsageUnit = String(Math.round((num(purchasePrice) / conv) * 10000) / 10000);
    }
    if (item[0].isReusable) {
      // Reusable stock is tracked by the lifecycle counters, NOT by `quantity`
      // (which stays reserved for consumable balances so the ledger sum always
      // reconciles). Record a zero-delta PURCHASE row describing the intake.
      const available = num(item[0].reusableAvailable) + num(quantity);
      await db
        .update(inventory)
        .set({ reusableAvailable: String(available), ...patch, lastUpdated: new Date() })
        .where(eq(inventory.id, inventoryId));
      await db.insert(inventoryMovements).values({
        id: uuidv4(),
        inventoryId,
        outletId: userOutletId,
        type: 'PURCHASE',
        quantity: 0,
        unit: item[0].usageUnit || item[0].unit,
        beforeStock: num(item[0].quantity),
        afterStock: num(item[0].quantity),
        referenceType: 'PURCHASE',
        referenceId,
        notes: `Reusable purchase x${num(quantity)} — reusable_available ${num(item[0].reusableAvailable)} → ${available}`,
      } as any);
    } else {
      await db
        .update(inventory)
        .set({ ...patch, lastUpdated: new Date() })
        .where(eq(inventory.id, inventoryId));
      // Consumable only: increment balance + write PURCHASE ledger row.
      await recordMovement(item[0], 'PURCHASE', num(quantity), referenceId, notes || 'Purchase', 'PURCHASE');
    }
    const refreshed = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    res.status(201).json(refreshed[0]);
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ message: 'Failed to record purchase' });
  }
});

// POST /api/inventory/retail-sale - sell a retail product (ledger RETAIL_SALE)
router.post('/retail-sale', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, sellingPrice, notes, referenceId } = req.body;
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    if (num(item[0].quantity) < num(quantity)) {
      return res.status(400).json({ message: 'Not enough stock for this retail sale' });
    }
    if (sellingPrice && num(sellingPrice) > 0) {
      await db
        .update(inventory)
        .set({ sellingPrice: String(num(sellingPrice)) })
        .where(eq(inventory.id, inventoryId));
    }
    await recordMovement(item[0], 'RETAIL_SALE', -num(quantity), referenceId, notes || 'Retail product sale', 'RETAIL_SALE');
    const refreshed = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    res.status(201).json(refreshed[0]);
  } catch (error) {
    if (isStockGuardError(error)) return res.status(400).json({ message: 'Not enough stock for this retail sale' });
    console.error('Retail sale error:', error);
    res.status(500).json({ message: 'Failed to record retail sale' });
  }
});

// POST /api/inventory/waste - record wastage (ledger WASTE, reason required)
router.post('/waste', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, reason, notes } = req.body;
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reason is required for waste' });
    }
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    if (num(item[0].quantity) < num(quantity)) {
      return res.status(400).json({ message: 'Cannot waste more than current stock' });
    }
    await recordMovement(item[0], 'WASTE', -num(quantity), undefined, `${reason}${notes ? ' — ' + notes : ''}`, 'WASTE');
    const refreshed = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    res.status(201).json(refreshed[0]);
  } catch (error) {
    if (isStockGuardError(error)) return res.status(400).json({ message: 'Cannot waste more than current stock' });
    console.error('Waste error:', error);
    res.status(500).json({ message: 'Failed to record waste' });
  }
});

// POST /api/inventory/transfer - transfer stock out to another outlet (ledger TRANSFER)
router.post('/transfer', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, quantity, targetOutletId, notes } = req.body;
    if (!inventoryId || num(quantity) <= 0 || !targetOutletId) {
      return res.status(400).json({ message: 'inventoryId, quantity and targetOutletId are required' });
    }
    if (targetOutletId === userOutletId) {
      return res.status(400).json({ message: 'Target outlet must differ from source outlet' });
    }
    const targetOutlet = await db.select().from(outlets).where(eq(outlets.id, targetOutletId)).limit(1);
    if (!targetOutlet.length) return res.status(404).json({ message: 'Target outlet not found' });
    const item = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, inventoryId), eq(inventory.outletId, userOutletId)))
      .limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    if (num(item[0].quantity) < num(quantity)) {
      return res.status(400).json({ message: 'Not enough stock to transfer' });
    }

    // Find or create the same SKU at the target outlet so both sides of the
    // transfer have a real inventory row + ledger history.
    let target = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.sku, item[0].sku), eq(inventory.outletId, targetOutletId)))
      .limit(1);
    if (!target.length) {
      const {
        id: _omitId, outletId: _omitOutlet, quantity: _omitQty,
        createdAt: _c, lastUpdated: _l,
        ...cloneFields
      } = item[0];
      target = await db
        .insert(inventory)
        .values({ ...cloneFields, id: uuidv4(), outletId: targetOutletId, quantity: 0 } as any)
        .returning();
    }

    // One shared reference for BOTH ledger rows so the pair is auditable as a
    // single stock movement across outlets. Both sides are applied in ONE
    // database transaction — a failure rolls back source AND target.
    const transferRef = uuidv4();
    await db.transaction(async (tx) => {
      await applyMovement(tx, item[0], 'TRANSFER', -num(quantity), transferRef, notes || `Transfer out (${transferRef})`, 'TRANSFER');
      await applyMovement(tx, target[0], 'TRANSFER', num(quantity), transferRef, notes || `Transfer in (${transferRef})`, 'TRANSFER');
    });

    const refreshed = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    res.status(201).json({ source: refreshed[0], targetOutletId, targetInventoryId: target[0].id, transferRef });
  } catch (error) {
    if (isStockGuardError(error)) return res.status(400).json({ message: 'Not enough stock to transfer' });
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Failed to record transfer' });
  }
});

// GET /api/inventory/dashboard - inventory overview stats (SPA accounting focus)
router.get('/dashboard', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totals = await db
      .select({
        totalItems: sql<number>`count(*)`,
        totalValue: sql<number>`coalesce(sum(${inventory.quantity} * ${inventory.costPerUsageUnit}), 0)`,
        lowStock: sql<number>`count(*) filter (where ${inventory.minimumStock} is not null and ${inventory.quantity} > 0 and ${inventory.quantity} <= ${inventory.minimumStock})`,
        outOfStock: sql<number>`count(*) filter (where ${inventory.quantity} <= 0)`,
      })
      .from(inventory)
      .where(and(eq(inventory.outletId, userOutletId), eq(inventory.isActive, true)))
      .limit(1);

    const todaysUsage = await db
      .select({ total: sql<number>`coalesce(sum(abs(quantity)), 0)` })
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.outletId, userOutletId),
        eq(inventoryMovements.type, 'RECIPE_CONSUMPTION'),
        gte(inventoryMovements.createdAt, today),
      ));
    const todaysRetail = await db
      .select({ total: sql<number>`coalesce(sum(abs(quantity)), 0)` })
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.outletId, userOutletId),
        eq(inventoryMovements.type, 'RETAIL_SALE'),
        gte(inventoryMovements.createdAt, today),
      ));
    const todaysWaste = await db
      .select({ total: sql<number>`coalesce(sum(abs(quantity)), 0)` })
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.outletId, userOutletId),
        eq(inventoryMovements.type, 'WASTE'),
        gte(inventoryMovements.createdAt, today),
      ));

    // Admin-visibility count of failed recipe consumptions awaiting retry.
    const pendingRec = await db
      .select({ c: sql<number>`count(*)` })
      .from(inventoryReconciliations)
      .where(and(
        eq(inventoryReconciliations.outletId, userOutletId),
        eq(inventoryReconciliations.status, 'PENDING_RECONCILIATION'),
      ));
    const pendingReconciliations = num(pendingRec[0]?.c) || 0;

    const recent = await db
      .select({
        id: inventoryMovements.id,
        productName: inventory.productName,
        type: inventoryMovements.type,
        quantity: inventoryMovements.quantity,
        unit: inventoryMovements.unit,
        notes: inventoryMovements.notes,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .innerJoin(inventory, eq(inventoryMovements.inventoryId, inventory.id))
      .where(eq(inventoryMovements.outletId, userOutletId))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(10);

    res.json({
      totals: totals[0] || { totalItems: 0, totalValue: 0, lowStock: 0, outOfStock: 0 },
      todaysUsage: todaysUsage[0]?.total || 0,
      todaysRetail: todaysRetail[0]?.total || 0,
      todaysWaste: todaysWaste[0]?.total || 0,
      pendingReconciliations,
      recent,
    });
  } catch (error) {
    console.error('Inventory dashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory dashboard' });
  }
});

// GET /api/inventory/reconciliations — failed recipe consumptions awaiting
// administrative attention (PENDING) plus recently resolved rows.
router.get('/reconciliations', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const pending = await db
      .select()
      .from(inventoryReconciliations)
      .where(and(
        eq(inventoryReconciliations.outletId, userOutletId),
        eq(inventoryReconciliations.status, 'PENDING_RECONCILIATION'),
      ))
      .orderBy(desc(inventoryReconciliations.createdAt));
    const resolved = await db
      .select()
      .from(inventoryReconciliations)
      .where(and(
        eq(inventoryReconciliations.outletId, userOutletId),
        eq(inventoryReconciliations.status, 'RESOLVED'),
      ))
      .orderBy(desc(inventoryReconciliations.createdAt))
      .limit(20);
    res.json({ pending, resolved, pendingCount: pending.length });
  } catch (error) {
    console.error('Get inventory reconciliations error:', error);
    res.status(500).json({ message: 'Failed to fetch reconciliations' });
  }
});

// POST /api/inventory/reconciliations/:id/resolve — retry a failed recipe
// consumption. Idempotent: a second call returns already-resolved and never
// deducts twice. Only ADMIN/DEVELOPER (router-level guard above).
router.post('/reconciliations/:id/resolve', async (req: any, res) => {
  try {
    const outcome = await resolveInventoryReconciliation(req.params.id, req.user.id);
    if (outcome.status === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Reconciliation not found' });
    }
    if (outcome.status === 'ALREADY_RESOLVED') {
      return res.status(200).json({ message: 'Already resolved', ...outcome });
    }
    res.json({ message: 'Reconciliation resolved', ...outcome });
  } catch (error) {
    console.error('Resolve inventory reconciliation error:', error);
    res.status(500).json({ message: 'Failed to resolve reconciliation' });
  }
});

// GET /api/inventory/low-stock
router.get('/low-stock', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const items = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.outletId, userOutletId),
          sql`${inventory.minimumStock} IS NOT NULL`,
          sql`${inventory.quantity} <= ${inventory.minimumStock}`,
          eq(inventory.isActive, true),
        ),
      )
      .orderBy(inventory.productName);
    res.json(items);
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ message: 'Failed to fetch low stock' });
  }
});

// GET /api/inventory/summary - dashboard tiles
router.get('/summary', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const totals = await db
      .select({
        totalItems: sql<number>`count(*)`,
        totalValue: sql<number>`coalesce(sum(${inventory.quantity} * ${inventory.costPerUsageUnit}), 0)`,
        belowMin: sql<number>`count(*) filter (where ${inventory.minimumStock} is not null and ${inventory.quantity} <= ${inventory.minimumStock})`,
      })
      .from(inventory)
      .where(eq(inventory.outletId, userOutletId))
      .limit(1);
    res.json({ totals: totals[0] || { totalItems: 0, totalValue: 0, belowMin: 0 } });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: 'Failed to fetch summary' });
  }
});

// GET /api/inventory/movements - ledger
router.get('/movements', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const { inventoryId, type, limit } = req.query;
    let conditions: any[] = [eq(inventoryMovements.outletId, userOutletId)];
    if (inventoryId) conditions.push(eq(inventoryMovements.inventoryId, inventoryId as string));
    if (type) conditions.push(eq(inventoryMovements.type, type as any));
    const rows = await db
      .select({
        id: inventoryMovements.id,
        inventoryId: inventoryMovements.inventoryId,
        productName: inventory.productName,
        type: inventoryMovements.type,
        quantity: inventoryMovements.quantity,
        unit: inventoryMovements.unit,
        beforeStock: inventoryMovements.beforeStock,
        afterStock: inventoryMovements.afterStock,
        reason: inventoryMovements.reason,
        notes: inventoryMovements.notes,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .leftJoin(inventory, eq(inventoryMovements.inventoryId, inventory.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(Number(limit) || 100);
    res.json(rows);
  } catch (error) {
    console.error('Movements error:', error);
    res.status(500).json({ message: 'Failed to fetch movements' });
  }
});

// ---- Suppliers -----------------------------------------------------------

// GET /api/inventory/suppliers
router.get('/suppliers', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
        const items = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.isActive, true))
      .orderBy(suppliers.name);
    res.json(items);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Failed to fetch suppliers' });
  }
});

// POST /api/inventory/suppliers
router.post('/suppliers', async (req: any, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required' });
    const existing = await db.select().from(suppliers).where(eq(suppliers.name, name)).limit(1);
    if (existing.length > 0) return res.status(400).json({ message: 'Supplier name already exists' });
    const created = await db
      .insert(suppliers)
      .values({ id: uuidv4(), name, phone, email, address, notes, isActive: true } as any)
      .returning();
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Failed to create supplier' });
  }
});

// PATCH /api/inventory/suppliers/:id
router.patch('/suppliers/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ message: 'Supplier not found' });
    await db.update(suppliers).set({ ...req.body, updatedAt: new Date() }).where(eq(suppliers.id, id));
    const updated = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Failed to update supplier' });
  }
});

// DELETE /api/inventory/suppliers/:id (soft)
router.delete('/suppliers/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ message: 'Supplier not found' });
    await db.update(suppliers).set({ isActive: false, updatedAt: new Date() }).where(eq(suppliers.id, id));
    res.json({ message: 'Supplier deleted' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Failed to delete supplier' });
  }
});

// ---- Recipes -------------------------------------------------------------

// POST /api/inventory/recipes/:id/link-treatment - attach a recipe to a
// treatment (treatment_recipes is UNIQUE per treatment; upsert semantics).
router.post('/recipes/:id/link-treatment', async (req: any, res) => {
  try {
    const { treatmentId } = req.body;
    if (!treatmentId) return res.status(400).json({ message: 'treatmentId is required' });
    const recipe = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    const treatment = await db.select().from(treatments).where(eq(treatments.id, treatmentId)).limit(1);
    if (!treatment.length) return res.status(404).json({ message: 'Treatment not found' });

    // Replace any existing link for this treatment (UNIQUE treatment_id).
    await db.delete(treatmentRecipes).where(eq(treatmentRecipes.treatmentId, treatmentId));
    await db.insert(treatmentRecipes).values({
      id: uuidv4(),
      treatmentId,
      recipeId: recipe[0].id,
    } as any);
    res.json({ message: 'Recipe linked to treatment', treatmentId, recipeId: recipe[0].id });
  } catch (error) {
    console.error('Link treatment error:', error);
    res.status(500).json({ message: 'Failed to link recipe to treatment' });
  }
});

// GET /api/inventory/recipes - list recipes (with item count)
router.get('/recipes', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const rows = await db
      .select({
        id: recipes.id,
        code: recipes.code,
        name: recipes.name,
        description: recipes.description,
        notes: recipes.notes,
        isActive: recipes.isActive,
        itemCount: sql<number>`count(${recipeItems.id})`,
        createdAt: recipes.createdAt,
      })
      .from(recipes)
      .leftJoin(recipeItems, eq(recipeItems.recipeId, recipes.id))
      .where(eq(recipes.isActive, true))
      .groupBy(recipes.id)
      .orderBy(recipes.name);
        res.json(rows);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
});

// POST /api/inventory/recipes - create recipe
router.post('/recipes', async (req: any, res) => {
  try {
    const { code, name, description, notes } = req.body;
    if (!code || !name) return res.status(400).json({ message: 'Code and name are required' });
    const existing = await db.select().from(recipes).where(eq(recipes.code, code)).limit(1);
    if (existing.length > 0) return res.status(400).json({ message: 'Recipe code already exists' });
    const created = await db
      .insert(recipes)
      .values({ id: uuidv4(), code, name, description, notes, isActive: true } as any)
      .returning();
    res.status(201).json({ ...created[0], items: [] });
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ message: 'Failed to create recipe' });
  }
});

// GET /api/inventory/recipes/:id - single recipe with items
router.get('/recipes/:id', async (req: any, res) => {
  try {
    const recipe = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    const items = await db
      .select({
        id: recipeItems.id,
        inventoryId: recipeItems.inventoryId,
        productName: inventory.productName,
        quantity: recipeItems.quantity,
        unit: recipeItems.unit,
      })
      .from(recipeItems)
      .leftJoin(inventory, eq(recipeItems.inventoryId, inventory.id))
      .where(eq(recipeItems.recipeId, recipe[0].id));
    res.json({ ...recipe[0], items });
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

// PATCH /api/inventory/recipes/:id
router.patch('/recipes/:id', async (req: any, res) => {
  try {
    const recipe = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    await db.update(recipes).set({ ...req.body, updatedAt: new Date() }).where(eq(recipes.id, req.params.id));
    const updated = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ message: 'Failed to update recipe' });
  }
});

// DELETE /api/inventory/recipes/:id (soft)
router.delete('/recipes/:id', async (req: any, res) => {
  try {
    const recipe = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    await db.update(recipes).set({ isActive: false, updatedAt: new Date() }).where(eq(recipes.id, req.params.id));
    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});

// POST /api/inventory/recipes/:id/items - add ingredient line
router.post('/recipes/:id/items', async (req: any, res) => {
  try {
    const { inventoryId, quantity, unit } = req.body;
    const recipe = await db.select().from(recipes).where(eq(recipes.id, req.params.id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    if (!inventoryId || num(quantity) <= 0) {
      return res.status(400).json({ message: 'inventoryId and a positive quantity are required' });
    }
    const item = await db.select().from(inventory).where(eq(inventory.id, inventoryId)).limit(1);
    if (!item.length) return res.status(404).json({ message: 'Inventory item not found' });
    const created = await db
      .insert(recipeItems)
      .values({
        id: uuidv4(),
        recipeId: recipe[0].id,
        inventoryId,
        quantity: String(quantity),
        unit: unit || item[0].usageUnit || item[0].unit,
      } as any)
      .returning();
    res.status(201).json(created[0]);
  } catch (error) {
    console.error('Add recipe item error:', error);
    res.status(500).json({ message: 'Failed to add recipe item' });
  }
});

// DELETE /api/inventory/recipes/:id/items/:itemId
router.delete('/recipes/:id/items/:itemId', async (req: any, res) => {
  try {
    const { id, itemId } = req.params;
    const recipe = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    if (!recipe.length) return res.status(404).json({ message: 'Recipe not found' });
    await db.delete(recipeItems).where(eq(recipeItems.id, itemId));
    res.json({ message: 'Recipe item removed' });
  } catch (error) {
    console.error('Remove recipe item error:', error);
    res.status(500).json({ message: 'Failed to remove recipe item' });
  }
});

// ---- Stock Opname --------------------------------------------------------

// POST /api/inventory/opnames - create a draft stock opname (system stock snapshot)
router.post('/opnames', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const id = uuidv4();
    await db
      .insert(stockOpnames)
      .values({
        id,
        outletId: userOutletId,
        createdBy: req.user.id,
        notes: req.body?.notes,
      } as any);

    // Snapshot all active inventory for this outlet
    const items = await db
      .select({ id: inventory.id, quantity: inventory.quantity, unit: inventory.usageUnit })
      .from(inventory)
      .where(and(eq(inventory.outletId, userOutletId), eq(inventory.isActive, true)));

    for (const it of items) {
      await db.insert(stockOpnameItems).values({
        id: uuidv4(),
        opnameId: id,
        inventoryId: it.id,
        systemStock: num(it.quantity),
        physicalStock: num(it.quantity),
        difference: 0,
        unit: it.unit,
      } as any);
    }

    const full = await db
      .select({
        id: stockOpnames.id,
        opnameDate: stockOpnames.opnameDate,
        status: stockOpnames.status,
        notes: stockOpnames.notes,
        items: sql<any[]>`json_agg(json_build_object('inventoryId', ${stockOpnameItems.inventoryId}, 'systemStock', ${stockOpnameItems.systemStock}, 'physicalStock', ${stockOpnameItems.physicalStock}, 'difference', ${stockOpnameItems.difference}, 'unit', ${stockOpnameItems.unit}))`,
      })
      .from(stockOpnames)
      .leftJoin(stockOpnameItems, eq(stockOpnameItems.opnameId, stockOpnames.id))
      .where(eq(stockOpnames.id, id))
      .groupBy(stockOpnames.id)
      .limit(1);

    res.status(201).json(full[0]);
  } catch (error) {
    console.error('Create opname error:', error);
    res.status(500).json({ message: 'Failed to create stock opname' });
  }
});

// POST /api/inventory/opnames/:id/confirm - confirm opname, apply differences
router.post('/opnames/:id/confirm', async (req: any, res) => {
  try {
    const userOutletId = req.user.outletId;
    const opname = await db
      .select()
      .from(stockOpnames)
      .where(and(eq(stockOpnames.id, req.params.id), eq(stockOpnames.outletId, userOutletId)))
      .limit(1);
    if (!opname.length) return res.status(404).json({ message: 'Opname not found' });
    if (opname[0].status === 'CONFIRMED') return res.status(400).json({ message: 'Opname already confirmed' });

        const items = await db
      .select()
      .from(stockOpnameItems)
      .where(eq(stockOpnameItems.opnameId, req.params.id));

    // Accept updated physical counts in the body and persist them before applying,
    // so the client can edit physical counts during a stocktake and have the
    // differences actually carried through on confirm.
    const bodyItems = (Array.isArray(req.body?.items) ? req.body.items : []) as Array<{
      inventoryId: string;
      physicalStock?: any;
    }>;
    const updatesByInv = new Map(bodyItems.map((u: any) => [u.inventoryId, u]));
    for (const it of items) {
      const inv = await db.select().from(inventory).where(eq(inventory.id, it.inventoryId)).limit(1);
      if (!inv.length) continue;
      const upd: any = updatesByInv.get(it.inventoryId);
      if (upd) {
        const physical = num(upd.physicalStock ?? it.systemStock);
        await db
          .update(stockOpnameItems)
          .set({ physicalStock: String(physical), difference: String(physical - num(it.systemStock)) })
          .where(eq(stockOpnameItems.id, it.id));
        it.physicalStock = String(physical);
        it.difference = String(physical - num(it.systemStock));
      }
      await recordMovement(inv[0], 'OPNAME', num(it.difference), req.params.id, 'Stock opname confirmation');
    }

    await db
      .update(stockOpnames)
      .set({ status: 'CONFIRMED', confirmedBy: req.user.id, confirmedAt: new Date() })
      .where(eq(stockOpnames.id, req.params.id));

    res.json({ message: 'Stock opname confirmed', id: req.params.id });
  } catch (error) {
    console.error('Confirm opname error:', error);
    res.status(500).json({ message: 'Failed to confirm stock opname' });
  }
});

export default router;