// Changes to what clients pay (and on what term), and keeping each client's
// current rate and term (recurring_clients.monthly_amount, which MRR and
// cash flow read, and term_months, which renewals read) in step with the
// changes in effect today.

import { and, eq } from "drizzle-orm";
import { clientRateChanges, recurringClients, type ClientRateChangeRow } from "./schema";
import type { DB } from "./index";
import { changeInEffect, rateOn, termInEffect } from "../../src/lib/rates";

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
    termMonths: number | null;
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

export interface Synced {
  monthlyAmount?: number;
  termMonths?: number;
}

/**
 * Sets the client's current rate and term to the changes in effect today,
 * where one is. Returns what changed, or null if nothing did.
 */
export async function syncCurrentRate(db: DB, clientId: number, today: string): Promise<Synced | null> {
  const [client, changes] = await Promise.all([
    db.select().from(recurringClients).where(eq(recurringClients.id, clientId)).get(),
    listRateChanges(db, clientId),
  ]);
  if (!client) return null;
  const patch: Synced = {};
  const current = changeInEffect(changes, today);
  if (current && current.toAmount !== client.monthlyAmount) patch.monthlyAmount = current.toAmount;
  const term = termInEffect(changes, today);
  if (term != null && term !== client.termMonths) patch.termMonths = term;
  if (Object.keys(patch).length === 0) return null;
  await db.update(recurringClients).set(patch).where(eq(recurringClients.id, clientId)).run();
  return patch;
}

/** The daily job: changes dated ahead take effect on their day. */
export async function applyDueRateChanges(
  db: DB,
  today: string,
): Promise<({ clientId: number } & Synced)[]> {
  const all = await listRateChanges(db);
  const clientIds = [...new Set(all.map((c) => c.clientId))];
  const applied: ({ clientId: number } & Synced)[] = [];
  for (const clientId of clientIds) {
    const synced = await syncCurrentRate(db, clientId, today);
    if (synced) applied.push({ clientId, ...synced });
  }
  return applied;
}
