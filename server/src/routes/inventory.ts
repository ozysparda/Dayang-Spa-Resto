import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { inventory, inventoryImports, inventoryImportRows, outlets, activityLogs } from '../db/schema.js';
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
    const { sku, productName, category, quantity, unit, cost, sellingPrice } = req.body;

    if (!sku || !productName) {
      return res.status(400).json({ message: 'SKU and product name are required' });
    }

    // Check if SKU already exists
    const existingItem = await db.select().from(inventory).where(eq(inventory.sku, sku)).limit(1);
    if (existingItem.length > 0) {
      return res.status(400).json({ message: 'SKU already exists' });
    }

    const newItem = await db.insert(inventory).values({
      id: uuidv4(),
      sku,
      productName,
      category,
      quantity: quantity || 0,
      unit,
      cost,
      sellingPrice,
      outletId: userOutletId,
    }).returning();

    // Create activity log
    await db.insert(activityLogs).values({
      id: uuidv4(),
      userId: req.user.id,
      userName: req.user.username,
      action: 'INVENTORY_CREATED',
      entityType: 'INVENTORY',
      entityId: newItem[0].id,
      details: {
        sku,
        productName,
      },
      outletId: userOutletId,
    });

    res.status(201).json(newItem[0]);
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

export default router;