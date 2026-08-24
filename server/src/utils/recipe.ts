// Centralised helper: when a treatment is completed, look up its linked
// recipe and consume the raw-material ingredient lines. Every consumption is
// recorded as an immutable inventory_movement row (RECIPE_CONSUMPTION) so the
// stock balance stays fully auditable. Used by both the booking-completion
// flow (bookings.ts) and the walk-in treatment-input flow (treatments.ts).
import { db } from '../db/index.js';
import {
  inventory,
  inventoryMovements,
  recipeItems,
  treatmentRecipes,
  inventoryReconciliations,
} from '../db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

function num(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export interface ConsumptionLog {
  inventoryId: string;
  productName: string;
  consumed: number;
  unit: string;
  beforeStock: number;
  afterStock: number;
}

// Consume the recipe linked to a treatment.
// - treatmentId: the finished treatment
// - outletId:    outlet scoping inventory rows
// - refId:       id of the treatment-transaction (for the movement ledger)
// - tx (optional): a caller-provided transaction to run inside (used by the
//   reconciliation resolver so the whole retry is atomic + serialized by an
//   advisory lock). When omitted, this function opens its OWN transaction so
//   the entire recipe is all-or-nothing: if any ingredient line fails (e.g.
//   insufficient stock) EVERYTHING rolls back and no partial movement row is
//   left behind. That is what makes a later reconciliation retry clean and
//   idempotent (partial rows would otherwise block the idempotency guard).
export async function consumeRecipeForTreatment(
  treatmentId: string,
  outletId: string,
  refId: string,
  tx?: any,
): Promise<ConsumptionLog[]> {
  const q = tx ?? db;
  // IDEMPOTENCY GUARD: if this treatment-transaction already produced
  // RECIPE_CONSUMPTION rows, never consume again (protects against double
  // completion / concurrent retries for the same booking).
  const prior = await q
    .select({ id: inventoryMovements.id })
    .from(inventoryMovements)
    .where(and(
      eq(inventoryMovements.referenceId, refId),
      eq(inventoryMovements.type, 'RECIPE_CONSUMPTION'),
    ))
    .limit(1);
  if (prior.length) return [];

  // A treatment may have at most one recipe (UNIQUE treatment_id).
  const links = await q
    .select()
    .from(treatmentRecipes)
    .where(eq(treatmentRecipes.treatmentId, treatmentId));
  if (!links.length) return [];

  const recipeId = links[0].recipeId;
  const ingredients = await q
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipeId));

  const consumed: ConsumptionLog[] = [];
  const run = async (executor: any) => {
    for (const ing of ingredients) {
      const inv = await executor
        .select()
        .from(inventory)
        .where(and(eq(inventory.id, ing.inventoryId), eq(inventory.outletId, outletId)))
        .limit(1);
      if (!inv.length) continue;

      const before = num(inv[0].quantity);
      const take = num(ing.quantity);
      const isReusable = !!inv[0].isReusable;

      if (isReusable) {
        const inUseBefore = num(inv[0].reusableInUse);
        const inUseAfter = Math.round((inUseBefore + take) * 1000) / 1000;
        const availAfter = Math.max(0, num(inv[0].reusableAvailable) - take);
        await executor
          .update(inventory)
          .set({
            reusableInUse: String(inUseAfter),
            reusableAvailable: String(availAfter),
            lastUpdated: new Date(),
          })
          .where(eq(inventory.id, ing.inventoryId));
        await executor.insert(inventoryMovements).values({
          id: uuidv4(),
          inventoryId: ing.inventoryId,
          outletId,
          type: 'RECIPE_CONSUMPTION',
          quantity: 0,
          unit: inv[0].usageUnit || inv[0].unit || ing.unit,
          beforeStock: before,
          afterStock: before,
          referenceType: 'TREATMENT',
          referenceId: refId,
          notes: `REUSABLE usage x${take} (0 stock delta; see reusable counters)`,
        } as any);
        consumed.push({
          inventoryId: ing.inventoryId,
          productName: inv[0].productName,
          consumed: take,
          unit: inv[0].usageUnit || inv[0].unit || ing.unit || '',
          beforeStock: inUseBefore,
          afterStock: inUseAfter,
        });
        continue;
      }

      let after = before;
      const updated = await executor
        .update(inventory)
        .set({ quantity: sql`${inventory.quantity} - ${take}`, lastUpdated: new Date() })
        .where(and(eq(inventory.id, ing.inventoryId), gte(inventory.quantity, take)))
        .returning({ quantity: inventory.quantity });
      if (!updated.length) {
        throw new Error(`INSUFFICIENT_STOCK:${inv[0].productName}`);
      }
      after = num(updated[0].quantity);
      await executor.insert(inventoryMovements).values({
        id: uuidv4(),
        inventoryId: ing.inventoryId,
        outletId,
        type: 'RECIPE_CONSUMPTION',
        quantity: -take,
        unit: inv[0].usageUnit || inv[0].unit || ing.unit,
        beforeStock: before,
        afterStock: after,
        referenceType: 'TREATMENT',
        referenceId: refId,
        notes: 'Recipe consumption on treatment completion',
      } as any);
      consumed.push({
        inventoryId: ing.inventoryId,
        productName: inv[0].productName,
        consumed: take,
        unit: inv[0].usageUnit || inv[0].unit || ing.unit || '',
        beforeStock: before,
        afterStock: after,
      });
    }
  };

  if (tx) {
    await run(tx);
  } else {
    await db.transaction(async (t) => run(t));
  }
  return consumed;
}
// Record a FAILED recipe consumption so an admin can see and retry it. The
// treatment itself stays COMPLETED (never cancelled because inventory failed);
// this marker simply makes the missing deduction visible + auditable. It never
// throws — a failure to write the marker must not break the treatment flow.
export async function recordInventoryReconciliation(opts: {
  treatmentId: string;
  outletId: string;
  referenceId: string;
  reason: string;
  bookingId?: string | null;
}): Promise<void> {
  try {
    await db.insert(inventoryReconciliations).values({
      id: uuidv4(),
      bookingId: opts.bookingId || undefined,
      treatmentId: opts.treatmentId,
      outletId: opts.outletId,
      referenceId: opts.referenceId,
      reason: (opts.reason || '').slice(0, 2000),
      status: 'PENDING_RECONCILIATION',
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('Failed to record inventory reconciliation marker:', e);
  }
}

// Retry a pending inventory reconciliation. Idempotent + concurrency-safe:
//   - The row is locked FOR UPDATE inside a transaction (serialized by a
//     Postgres advisory xact lock), so two admins resolving the same pending
//     row cannot both deduct.
//   - Consumption runs exactly once: after success the RECIPE_CONSUMPTION
//     ledger rows exist and the idempotency guard in consumeRecipeForTreatment
//     returns [] on any later attempt.
// Returns the outcome; never throws a double-deduction.
export async function resolveInventoryReconciliation(
  reconciliationId: string,
  resolvedBy?: string,
): Promise<{ status: 'RESOLVED' | 'ALREADY_RESOLVED' | 'NOT_FOUND'; consumedLines: number }> {
  let outcome: { status: 'RESOLVED' | 'ALREADY_RESOLVED' | 'NOT_FOUND'; consumedLines: number } = {
    status: 'NOT_FOUND',
    consumedLines: 0,
  };
  await db.transaction(async (tx) => {
    // Serialize concurrent resolves for the same reconciliation.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reconciliationId}))`);

    // Use the Drizzle query-builder path (tx.select), NOT tx.execute with a raw
    // SQL SELECT: the latter hangs/returns no rows inside a transaction for
    // some postgres.js builds.
    const locked = await tx
      .select()
      .from(inventoryReconciliations)
      .where(eq(inventoryReconciliations.id, reconciliationId))
      .limit(1);
    if (!locked.length) {
      outcome = { status: 'NOT_FOUND', consumedLines: 0 };
      return;
    }
    const rec = locked[0];
    if (rec.status !== 'PENDING_RECONCILIATION') {
      outcome = { status: 'ALREADY_RESOLVED', consumedLines: 0 };
      return;
    }
    // Consume inside the same locked transaction so the deduction is atomic
    // with the status flip to RESOLVED.
    const logs = await consumeRecipeForTreatment(
      rec.treatmentId,
      rec.outletId,
      rec.referenceId || '',
      tx,
    );
    await tx
      .update(inventoryReconciliations)
      .set({ status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: resolvedBy || null })
      .where(eq(inventoryReconciliations.id, reconciliationId));
    outcome = { status: 'RESOLVED', consumedLines: logs.length };
  });
  return outcome;
}

// Estimate the material (HPP) cost of a treatment from its linked recipe.
// Returns the per-ingredient breakdown, the total material cost, and - given
// an optional price - the material-cost ratio (%). Staff commission is never
// counted as inventory material cost (kept as a separate cost component).
export async function estimateTreatmentMaterialCost(
  treatmentId: string,
  outletId: string,
): Promise<{
  items: { inventoryId: string; productName: string; quantity: number; unit: string; costPerUnit: number; lineCost: number }[];
  totalCost: number;
}> {
  const links = await db
    .select()
    .from(treatmentRecipes)
    .where(eq(treatmentRecipes.treatmentId, treatmentId));
  if (!links.length) return { items: [], totalCost: 0 };

  const ingredients = await db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, links[0].recipeId));

  const items: Awaited<ReturnType<typeof estimateTreatmentMaterialCost>>['items'] = [];
  let totalCost = 0;
  for (const ing of ingredients) {
    const inv = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, ing.inventoryId), eq(inventory.outletId, outletId)))
      .limit(1);
    if (!inv.length) continue;
    const qty = num(ing.quantity);
    const costPerUnit = num(inv[0].costPerUsageUnit ?? inv[0].purchasePrice);
    const lineCost = Math.round(qty * costPerUnit * 100) / 100;
    totalCost = Math.round((totalCost + lineCost) * 100) / 100;
    items.push({
      inventoryId: ing.inventoryId,
      productName: inv[0].productName,
      quantity: qty,
      unit: inv[0].usageUnit || inv[0].unit || ing.unit || '',
      costPerUnit,
      lineCost,
    });
  }
  return { items, totalCost };
}