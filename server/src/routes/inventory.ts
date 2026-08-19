import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  inventory,
  inventoryMovements,
  suppliers,
  recipes,
  recipeItems,
  treatmentRecipes,
  stockOpnames,
  stockOpnameItems,
  inventoryImports,
  inventoryImportRows,
  outlets,
  activityLogs,
} from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
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
router.get('/:id', async (req: any, res) => {
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

    // Check if SKU already exists
    const existingItem = await db.select().from(inventory).where(eq(inventory.sku, sku)).limit(1);
    if (existingItem.length > 0) {
      return res.status(400).json({ message: 'SKU already exists' });
    }

    const id = uuidv4();
    await db.insert(inventory).values({
      id,
      sku,
      productName,
      category,
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

// Write an immutable movement row AND mutate the inventory balance in `quantity`.
// `delta` is expressed in the item's usage_unit (what `quantity` counts).
async function recordMovement(
  inv: any,
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RECIPE_CONSUMPTION' | 'OPENING' | 'OPNAME' | 'REVERSAL',
  delta: number,
  refId: string | undefined,
  notes?: string,
) {
  if (Math.abs(delta) < 1e-9) return;
  const before = num(inv?.quantity);
  const after = Math.round((before + delta) * 1000) / 1000;
  await db
    .update(inventory)
    .set({ quantity: Math.round(after), lastUpdated: new Date() })
    .where(eq(inventory.id, inv.id));

  await db.insert(inventoryMovements).values({
    id: uuidv4(),
    inventoryId: inv.id,
    outletId: inv.outletId,
    type,
    quantity: delta,
    unit: inv.usageUnit || inv.unit,
    beforeStock: before,
    afterStock: after,
    referenceId: refId,
    notes,
  } as any);
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

    // Optional: accept updated physical counts in the body and persist before apply
    const updates = req.body?.items || {};
    for (const it of items) {
      const inv = await db.select().from(inventory).where(eq(inventory.id, it.inventoryId)).limit(1);
      if (!inv.length) continue;
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