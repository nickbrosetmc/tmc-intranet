// Everything the Finance pages read, in one load. Shared by the admin
// dashboard endpoint and the feed the TMC Finance app reads, so the two can't
// drift apart.

import type { DB } from "../db";
import {
  getFinanceSettings,
  listExpenseCategories,
  listOneOffInvoices,
  listOneTimeExpenses,
  listPaymentMethods,
  listRecurringClients,
  listRecurringExpenses,
} from "../db/finance";
import { listRateChanges } from "../db/rateChanges";
import { listProjects } from "../db/projects";

export async function loadFinanceData(db: DB) {
  const [
    settings,
    paymentMethods,
    categories,
    clients,
    recurring,
    oneTime,
    invoices,
    rateChanges,
    projects,
  ] = await Promise.all([
    getFinanceSettings(db),
    listPaymentMethods(db),
    listExpenseCategories(db),
    listRecurringClients(db),
    listRecurringExpenses(db),
    listOneTimeExpenses(db),
    listOneOffInvoices(db),
    listRateChanges(db),
    listProjects(db),
  ]);

  return {
    settings,
    paymentMethods,
    categories,
    recurringClients: clients,
    recurringExpenses: recurring,
    oneTimeExpenses: oneTime,
    oneOffInvoices: invoices,
    rateChanges,
    projects,
  };
}
