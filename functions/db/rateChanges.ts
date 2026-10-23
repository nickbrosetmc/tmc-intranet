// Changes to what clients pay, and keeping each client's current rate
// (recurring_clients.monthly_amount, which MRR and cash flow read) in step
// with the change in effect today.

import { and, eq } from "drizzle-orm";
import { clientRateChanges, recurringClients, type ClientRateChangeRow } from "./schema";
import type { DB } from "./index";
import { changeInEffect, rateOn } from "../../src/lib/rates";

export async function listRateChanges(db: DB, clientId?: number): Promise<ClientRateChangeRow[]> {
  const q = db.select().from(clientRateChanges);
  return (clientId != null ? q.where(eq(clientRateChanges.clientId, clientId)) : q).all();
}

/** What the client was paying the day before `date`, from their history. */
export async function rateBefore(
  db: DB,
  clientId: number,
  date: string,
  currentAmount: number,
): Promise<number> {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return rateOn(d.toISOString().slice(0, 10), await listRateChanges(db, clientId), currentAmount);
}

export async function recordRateChange(
  db: DB,
  data: {
    clientId: number;
    effectiveDate: string;
    fromAmount: number;
    toAmount: number;
    note: string | null;
  },
  today: string,
): Promise<ClientRateChangeRow> {
  const row = await db.insert(clientRateChanges).values(data).returning().get();
  await syncCurrentRate(db, data.clientId, today);
  return row;
}

export async function deleteRateChange(db: DB, clientId: number, id: number): Promise<boolean> {
  const res = await db
    .delete(clientRateChanges)
    .where(and(eq(clientRateChanges.id, id), eq(clientRateChanges.clientId, clientId)))
    .run();
  // Deleting history corrects how past months are valued; it never moves the
  // current rate back, which stays whatever it was last set to.
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Sets the client's current rate to the change in effect today, if one is.
 * Returns the new rate when it changed, null otherwise.
 */
export async function syncCurrentRate(db: DB, clientId: number, today: string): Promise<number | null> {
  const [client, changes] = await Promise.all([
    db.select().from(recurringClients).where(eq(recurringClients.id, clientId)).get(),
    listRateChanges(db, clientId),
  ]);
  const current = changeInEffect(changes, today);
  if (!client || !current || current.toAmount === client.monthlyAmount) return null;
  await db
    .update(recurringClients)
    .set({ monthlyAmount: current.toAmount })
    .where(eq(recurringClients.id, clientId))
    .run();
  return current.toAmount;
}

/** The daily job: changes dated ahead take effect on their day. */
export async function applyDueRateChanges(
  db: DB,
  today: string,
): Promise<{ clientId: number; monthlyAmount: number }[]> {
  const all = await listRateChanges(db);
  const clientIds = [...new Set(all.map((c) => c.clientId))];
  const applied: { clientId: number; monthlyAmount: number }[] = [];
  for (const clientId of clientIds) {
    const amount = await syncCurrentRate(db, clientId, today);
    if (amount != null) applied.push({ clientId, monthlyAmount: amount });
  }
  return applied;
}
