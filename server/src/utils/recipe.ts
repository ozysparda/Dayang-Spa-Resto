// Centralised helper: when a treatment is completed, look up its linked
// recipe and consume the raw-material ingredient lines. Every consumption is
// recorded as an immutable inventory_movement row (RECIPE_CONSUMPTION) so the
// stock balance stays fully auditable. Used by both the booking-completion
// flow (bookings.ts) and the walk-in treatment-input flow (treatments.ts).
import { db } from '../db/index.js';
import { inventory, inventoryMovements, recipeItems, treatmentRecipes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
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
export async function consumeRecipeForTreatment(
  treatmentId: string,
  outletId: string,
  refId: string,
): Promise<ConsumptionLog[]> {
  // A treatment may have at most one recipe (UNIQUE treatment_id).
  const links = await db
    .select()
    .from(treatmentRecipes)
    .where(eq(treatmentRecipes.treatmentId, treatmentId));
  if (!links.length) return [];

  const recipeId = links[0].recipeId;
  const ingredients = await db
    .select()
    .from(recipeItems)
    .where(eq(recipeItems.recipeId, recipeId));

  const consumed: ConsumptionLog[] = [];
  for (const ing of ingredients) {
    const inv = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.id, ing.inventoryId), eq(inventory.outletId, outletId)))
      .limit(1);
    if (!inv.length) continue;

    const before = num(inv[0].quantity);
    const take = num(ing.quantity);
    const after = Math.max(0, Math.round((before - take) * 1000) / 1000);

    await db
      .update(inventory)
      .set({ quantity: Math.round(after), lastUpdated: new Date() })
      .where(eq(inventory.id, ing.inventoryId));

    await db.insert(inventoryMovements).values({
      id: uuidv4(),
      inventoryId: ing.inventoryId,
      outletId,
      type: 'RECIPE_CONSUMPTION',
      quantity: -take,
      unit: inv[0].usageUnit || inv[0].unit || ing.unit,
      beforeStock: before,
      afterStock: after,
      referenceId: refId,
      notes: 'Recipe consumption on treatment completion',
    } as any);

    consumed.push({
      inventoryId: ing.inventoryId,
      productName: inv[0].productName,
      consumed: take,
      unit: inv[0].usageUnit || inv[0].unit || ing.unit,
      beforeStock: before,
      afterStock: after,
    });
  }
  return consumed;
}
