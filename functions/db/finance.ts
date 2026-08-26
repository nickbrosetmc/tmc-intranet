import { asc, eq, sql } from "drizzle-orm";
import {
  contentPosts,
  contentSeedLog,
  expenseCategories,
  financeSettings,
  oneOffInvoices,
  oneTimeExpenses,
  paymentMethods,
  recurringClients,
  recurringExpenses,
  type ExpenseCategoryRow,
  type FinanceSettingsRow,
  type NewExpenseCategoryRow,
  type NewOneOffInvoiceRow,
  type NewOneTimeExpenseRow,
  type NewRecurringClientRow,
  type NewRecurringExpenseRow,
  type OneOffInvoiceRow,
  type OneTimeExpenseRow,
  type PaymentMethodRow,
  type RecurringClientRow,
  type RecurringExpenseRow,
} from "./schema";
import type { DB } from "./index";

// ─── Reads ───────────────────────────────────────────────────────────────

export async function listPaymentMethods(db: DB): Promise<PaymentMethodRow[]> {
  return db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder)).all();
}

export async function listExpenseCategories(
  db: DB,
): Promise<ExpenseCategoryRow[]> {
  return db
    .select()
    .from(expenseCategories)
    .orderBy(asc(expenseCategories.sortOrder))
    .all();
}

export async function listRecurringClients(db: DB): Promise<RecurringClientRow[]> {
  return db
    .select()
    .from(recurringClients)
    .orderBy(asc(recurringClients.sortOrder), asc(recurringClients.name))
    .all();
}

export async function listRecurringExpenses(
  db: DB,
): Promise<RecurringExpenseRow[]> {
  return db
    .select()
    .from(recurringExpenses)
    .orderBy(asc(recurringExpenses.sortOrder), asc(recurringExpenses.name))
    .all();
}

export async function listOneTimeExpenses(db: DB): Promise<OneTimeExpenseRow[]> {
  return db
    .select()
    .from(oneTimeExpenses)
    .orderBy(asc(oneTimeExpenses.plannedDate), asc(oneTimeExpenses.name))
    .all();
}

export async function listOneOffInvoices(db: DB): Promise<OneOffInvoiceRow[]> {
  return db
    .select()
    .from(oneOffInvoices)
    .orderBy(asc(oneOffInvoices.payoutDate), asc(oneOffInvoices.clientName))
    .all();
}

export async function createOneOffInvoice(
  db: DB,
  data: NewOneOffInvoiceRow,
): Promise<OneOffInvoiceRow> {
  return db.insert(oneOffInvoices).values(data).returning().get();
}

export async function updateOneOffInvoice(
  db: DB,
  id: number,
  data: Partial<NewOneOffInvoiceRow>,
): Promise<void> {
  await db
    .update(oneOffInvoices)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(oneOffInvoices.id, id))
    .run();
}

export async function deleteOneOffInvoice(db: DB, id: number): Promise<void> {
  await db.delete(oneOffInvoices).where(eq(oneOffInvoices.id, id)).run();
}

export async function getFinanceSettings(db: DB): Promise<FinanceSettingsRow> {
  const row = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.id, 1))
    .get();
  if (!row) throw new Error("finance_settings missing — migration 0009 not applied?");
  return row;
}

// ─── Writes ──────────────────────────────────────────────────────────────

export async function updateFinanceSettings(
  db: DB,
  updates: { currentBalance?: number; notes?: string | null; updatedBy?: number },
): Promise<void> {
  await db
    .update(financeSettings)
    .set({
      ...updates,
      balanceUpdatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(financeSettings.id, 1))
    .run();
}

// Categories
export async function createCategory(
  db: DB,
  data: NewExpenseCategoryRow,
): Promise<ExpenseCategoryRow> {
  return db.insert(expenseCategories).values(data).returning().get();
}
export async function updateCategory(
  db: DB,
  id: number,
  data: Partial<NewExpenseCategoryRow>,
): Promise<void> {
  await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id)).run();
}
export async function deleteCategory(db: DB, id: number): Promise<void> {
  // Null out FKs in expenses so we don't cascade-destroy data
  await db.update(recurringExpenses).set({ categoryId: null }).where(eq(recurringExpenses.categoryId, id)).run();
  await db.update(oneTimeExpenses).set({ categoryId: null }).where(eq(oneTimeExpenses.categoryId, id)).run();
  await db.delete(expenseCategories).where(eq(expenseCategories.id, id)).run();
}

// Recurring clients
export async function createRecurringClient(
  db: DB,
  data: NewRecurringClientRow,
): Promise<RecurringClientRow> {
  return db.insert(recurringClients).values(data).returning().get();
}
export async function updateRecurringClient(
  db: DB,
  id: number,
  data: Partial<NewRecurringClientRow>,
): Promise<void> {
  await db
    .update(recurringClients)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(recurringClients.id, id))
    .run();
}
export type DeleteClientResult =
  | { ok: true }
  | { ok: false; reason: "has_posts"; posts: number };

/**
 * Remove a recurring client.
 *
 * content_posts.client_id and content_seed_log.client_id both reference this
 * table and D1 enforces foreign keys, so a bare DELETE on a client with any
 * content throws a constraint failure. Refusing up front with a count is more
 * useful than a 500, and protects real content history: a finance client and
 * a content-planner client are the same row, so deleting one to tidy the MRR
 * table would take the posts with it.
 *
 * The seed log is internal bookkeeping about which weeks were auto-seeded, so
 * it is cleared alongside the client rather than blocking the delete.
 */
export async function deleteRecurringClient(
  db: DB,
  id: number,
): Promise<DeleteClientResult> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(contentPosts)
    .where(eq(contentPosts.clientId, id))
    .get();
  const posts = row?.c ?? 0;
  if (posts > 0) return { ok: false, reason: "has_posts", posts };

  await db.delete(contentSeedLog).where(eq(contentSeedLog.clientId, id)).run();
  await db.delete(recurringClients).where(eq(recurringClients.id, id)).run();
  return { ok: true };
}

// Recurring expenses
export async function createRecurringExpense(
  db: DB,
  data: NewRecurringExpenseRow,
): Promise<RecurringExpenseRow> {
  return db.insert(recurringExpenses).values(data).returning().get();
}
export async function updateRecurringExpense(
  db: DB,
  id: number,
  data: Partial<NewRecurringExpenseRow>,
): Promise<void> {
  await db
    .update(recurringExpenses)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(recurringExpenses.id, id))
    .run();
}
export async function deleteRecurringExpense(db: DB, id: number): Promise<void> {
  await db.delete(recurringExpenses).where(eq(recurringExpenses.id, id)).run();
}

// One-time expenses
export async function createOneTimeExpense(
  db: DB,
  data: NewOneTimeExpenseRow,
): Promise<OneTimeExpenseRow> {
  return db.insert(oneTimeExpenses).values(data).returning().get();
}
export async function updateOneTimeExpense(
  db: DB,
  id: number,
  data: Partial<NewOneTimeExpenseRow>,
): Promise<void> {
  await db
    .update(oneTimeExpenses)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(oneTimeExpenses.id, id))
    .run();
}
export async function deleteOneTimeExpense(db: DB, id: number): Promise<void> {
  await db.delete(oneTimeExpenses).where(eq(oneTimeExpenses.id, id)).run();
}
