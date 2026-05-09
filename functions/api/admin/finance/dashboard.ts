import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import {
  getFinanceSettings,
  listExpenseCategories,
  listOneOffInvoices,
  listOneTimeExpenses,
  listPaymentMethods,
  listRecurringClients,
  listRecurringExpenses,
} from "../../../db/finance";

/**
 * One-shot dashboard payload. Cashflow projection is computed client-side
 * so adjusting the starting balance doesn't require a roundtrip.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const [
    settings,
    paymentMethods,
    categories,
    clients,
    recurring,
    oneTime,
    invoices,
  ] = await Promise.all([
    getFinanceSettings(db),
    listPaymentMethods(db),
    listExpenseCategories(db),
    listRecurringClients(db),
    listRecurringExpenses(db),
    listOneTimeExpenses(db),
    listOneOffInvoices(db),
  ]);

  return Response.json({
    settings,
    paymentMethods,
    categories,
    recurringClients: clients,
    recurringExpenses: recurring,
    oneTimeExpenses: oneTime,
    oneOffInvoices: invoices,
  });
};
