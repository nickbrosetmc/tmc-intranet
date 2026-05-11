// Finance dashboard — types, API wrapper, and pure cashflow projection.

export interface PaymentMethod {
  id: number;
  name: string;
  feePct: number;             // e.g. 0.029 — initial processing fee on gross
  feeFlat: number;            // CENTS, e.g. 30 = $0.30
  instantPayoutPct: number;   // e.g. 0.01 — compounds on the remaining after initial fee
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  monthlyBudget: number | null;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface RecurringClient {
  id: number;
  name: string;
  monthlyAmount: number;
  paymentMethodId: number | null;
  invoiceDay: number | null;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
  /** Posts/week target; null = not in content pipeline. */
  weeklyPostTarget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: number;
  name: string;
  categoryId: number | null;
  monthlyAmount: number;
  paymentDay: number | null;
  isActive: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OneOffInvoice {
  id: number;
  clientName: string;
  grossAmount: number;
  paymentMethodId: number | null;
  payoutDate: string;
  instantPayout: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OneTimeExpense {
  id: number;
  name: string;
  categoryId: number | null;
  amount: number;
  status: "planned" | "paid";
  plannedDate: string | null;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSettings {
  id: number;
  currentBalance: number;
  balanceUpdatedAt: string;
  notes: string | null;
  updatedBy: number | null;
}

export interface FinanceDashboard {
  settings: FinanceSettings;
  paymentMethods: PaymentMethod[];
  categories: ExpenseCategory[];
  recurringClients: RecurringClient[];
  recurringExpenses: RecurringExpense[];
  oneTimeExpenses: OneTimeExpense[];
  oneOffInvoices: OneOffInvoice[];
}

// ─── Calculations ────────────────────────────────────────────────────────

/**
 * Net amount received after payment processor fees.
 *
 * Two-step compounded fee:
 *   remaining = gross - (gross × fee_pct) - (fee_flat / 100)
 *   net       = remaining × (1 - instant_payout_pct)
 *
 * Example (V/MC/Disc on $1,000 with 2.9% + 1% instant):
 *   $1000 - $29 = $971 remaining
 *   $971 × (1 - 0.01) = $961.29 net
 */
export function netAfterFees(
  monthlyAmount: number,
  pm: PaymentMethod | null | undefined,
): number {
  if (!pm) return monthlyAmount;
  const initialFee = monthlyAmount * pm.feePct + pm.feeFlat / 100;
  const remaining = monthlyAmount - initialFee;
  const net = remaining * (1 - pm.instantPayoutPct);
  return Math.round(net * 100) / 100;
}

/**
 * Net for a one-off invoice. Like netAfterFees but the instant payout
 * fee only applies if the invoice's instantPayout flag is set —
 * recurring clients always do instant payout, but one-off invoices are
 * per-invoice.
 */
export function invoiceNetAmount(
  gross: number,
  pm: PaymentMethod | null | undefined,
  instantPayout: boolean,
): number {
  if (!pm) return gross;
  const initialFee = gross * pm.feePct + pm.feeFlat / 100;
  const remaining = gross - initialFee;
  const instantPct = instantPayout ? pm.instantPayoutPct : 0;
  const net = remaining * (1 - instantPct);
  return Math.round(net * 100) / 100;
}

/** Detailed breakdown for an invoice — useful for the form UI. */
export function invoiceFeeBreakdown(
  gross: number,
  pm: PaymentMethod | null | undefined,
  instantPayout: boolean,
): { initialFee: number; remaining: number; instantFee: number; net: number } {
  if (!pm) {
    return { initialFee: 0, remaining: gross, instantFee: 0, net: gross };
  }
  const initialFee = gross * pm.feePct + pm.feeFlat / 100;
  const remaining = gross - initialFee;
  const instantFee = instantPayout ? remaining * pm.instantPayoutPct : 0;
  const net = remaining - instantFee;
  return {
    initialFee: Math.round(initialFee * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    instantFee: Math.round(instantFee * 100) / 100,
    net: Math.round(net * 100) / 100,
  };
}

export interface DayPoint {
  day: number;          // 1..N (days in month)
  date: string;         // ISO YYYY-MM-DD
  income: number;       // total income that day (net)
  expense: number;      // total expense that day
  balance: number;      // running balance after this day
}

/**
 * Number of days in a given month. monthIso is "YYYY-MM".
 */
export function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Map a day-of-month value (e.g. 31) to the actual day this month (clamped). */
function clampDay(day: number, monthIso: string): number {
  return Math.min(Math.max(1, day | 0), daysInMonth(monthIso));
}

function isoDate(monthIso: string, day: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = clampDay(day, monthIso);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ProjectionInput {
  monthIso: string;            // "YYYY-MM"
  startBalance: number;        // dollars at start of month
  clients: RecurringClient[];
  recurringExpenses: RecurringExpense[];
  oneTimeExpenses: OneTimeExpense[];
  oneOffInvoices: OneOffInvoice[];
  paymentMethods: PaymentMethod[];
}

/**
 * Compute a day-by-day balance projection for the given month.
 * Income from a recurring client lands on its invoiceDay (net of fees).
 * One-off invoices land on their payoutDate (net of fees, with instant
 * payout fee applied if flagged).
 * Recurring expenses hit on paymentDay. One-time expenses hit on
 * plannedDate (if planned and within month) or paidDate (if paid).
 */
export function projectMonth(input: ProjectionInput): DayPoint[] {
  const { monthIso, startBalance, clients, recurringExpenses, oneTimeExpenses, oneOffInvoices, paymentMethods } = input;
  const days = daysInMonth(monthIso);
  const pmById = new Map(paymentMethods.map((p) => [p.id, p]));

  const incomeByDay = new Array(days + 1).fill(0);
  const expenseByDay = new Array(days + 1).fill(0);

  for (const c of clients) {
    if (!c.isActive || c.invoiceDay == null) continue;
    const d = clampDay(c.invoiceDay, monthIso);
    const pm = c.paymentMethodId != null ? pmById.get(c.paymentMethodId) : null;
    incomeByDay[d] += netAfterFees(c.monthlyAmount, pm);
  }

  const monthPrefix = `${monthIso}-`;

  for (const inv of oneOffInvoices) {
    if (!inv.payoutDate.startsWith(monthPrefix)) continue;
    const day = Number(inv.payoutDate.slice(8, 10));
    if (!Number.isFinite(day)) continue;
    const pm = inv.paymentMethodId != null ? pmById.get(inv.paymentMethodId) : null;
    incomeByDay[clampDay(day, monthIso)] += invoiceNetAmount(inv.grossAmount, pm, inv.instantPayout);
  }

  for (const e of recurringExpenses) {
    if (!e.isActive || e.paymentDay == null) continue;
    const d = clampDay(e.paymentDay, monthIso);
    expenseByDay[d] += e.monthlyAmount;
  }

  for (const e of oneTimeExpenses) {
    const dateStr = e.status === "paid" ? e.paidDate : e.plannedDate;
    if (!dateStr) continue;
    if (!dateStr.startsWith(monthPrefix)) continue;
    const day = Number(dateStr.slice(8, 10));
    if (!Number.isFinite(day)) continue;
    expenseByDay[clampDay(day, monthIso)] += e.amount;
  }

  const out: DayPoint[] = [];
  let balance = startBalance;
  for (let d = 1; d <= days; d++) {
    balance += incomeByDay[d] - expenseByDay[d];
    out.push({
      day: d,
      date: isoDate(monthIso, d),
      income: incomeByDay[d],
      expense: expenseByDay[d],
      balance: Math.round(balance * 100) / 100,
    });
  }
  return out;
}

// ─── Summary numbers ─────────────────────────────────────────────────────

export interface DashboardSummary {
  mrrGross: number;
  mrrNet: number;
  monthlyExpenses: number;          // total recurring (payroll + operating)
  monthlyPayroll: number;
  monthlyOperating: number;
  oneTimePlannedThisMonth: number;
  oneOffNetThisMonth: number;       // sum of one-off invoice nets for the current month
  projectedNet: number;             // mrrNet + one-off net - expenses
}

/** Find the Payroll category id by canonical name. Case-insensitive. */
export function payrollCategoryId(d: FinanceDashboard): number | null {
  return (
    d.categories.find((c) => c.name.toLowerCase() === "payroll")?.id ?? null
  );
}

export function computeSummary(d: FinanceDashboard, monthIso: string): DashboardSummary {
  const pmById = new Map(d.paymentMethods.map((p) => [p.id, p]));
  let mrrGross = 0;
  let mrrNet = 0;
  for (const c of d.recurringClients) {
    if (!c.isActive) continue;
    mrrGross += c.monthlyAmount;
    const pm = c.paymentMethodId != null ? pmById.get(c.paymentMethodId) : null;
    mrrNet += netAfterFees(c.monthlyAmount, pm);
  }
  const payrollId = payrollCategoryId(d);
  let monthlyPayroll = 0;
  let monthlyOperating = 0;
  for (const e of d.recurringExpenses) {
    if (!e.isActive) continue;
    if (payrollId != null && e.categoryId === payrollId) {
      monthlyPayroll += e.monthlyAmount;
    } else {
      monthlyOperating += e.monthlyAmount;
    }
  }
  const monthlyExpenses = monthlyPayroll + monthlyOperating;
  const monthPrefix = `${monthIso}-`;
  let oneTimePlannedThisMonth = 0;
  for (const e of d.oneTimeExpenses) {
    const dateStr = e.status === "paid" ? e.paidDate : e.plannedDate;
    if (dateStr?.startsWith(monthPrefix)) oneTimePlannedThisMonth += e.amount;
  }
  let oneOffNetThisMonth = 0;
  for (const inv of d.oneOffInvoices) {
    if (!inv.payoutDate.startsWith(monthPrefix)) continue;
    const pm = inv.paymentMethodId != null ? pmById.get(inv.paymentMethodId) : null;
    oneOffNetThisMonth += invoiceNetAmount(inv.grossAmount, pm, inv.instantPayout);
  }
  return {
    mrrGross,
    mrrNet,
    monthlyExpenses,
    monthlyPayroll,
    monthlyOperating,
    oneTimePlannedThisMonth,
    oneOffNetThisMonth,
    projectedNet: mrrNet + oneOffNetThisMonth - monthlyExpenses - oneTimePlannedThisMonth,
  };
}

export interface CategoryBudgetStatus {
  category: ExpenseCategory;
  spent: number;          // recurring + one-time within month
  budget: number | null;
  percentUsed: number | null;
}

export function categoryBudgetStatus(
  d: FinanceDashboard,
  monthIso: string,
): CategoryBudgetStatus[] {
  const monthPrefix = `${monthIso}-`;
  return d.categories.map((cat) => {
    let spent = 0;
    for (const e of d.recurringExpenses) {
      if (e.isActive && e.categoryId === cat.id) spent += e.monthlyAmount;
    }
    for (const e of d.oneTimeExpenses) {
      if (e.categoryId !== cat.id) continue;
      const dateStr = e.status === "paid" ? e.paidDate : e.plannedDate;
      if (dateStr?.startsWith(monthPrefix)) spent += e.amount;
    }
    return {
      category: cat,
      spent,
      budget: cat.monthlyBudget,
      percentUsed: cat.monthlyBudget && cat.monthlyBudget > 0
        ? Math.round((spent / cat.monthlyBudget) * 100)
        : null,
    };
  });
}

export function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  const sign = opts.sign && n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
}

export function thisMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── API wrapper ─────────────────────────────────────────────────────────

async function jsonReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const finance = {
  dashboard: () => jsonReq<FinanceDashboard>("/api/admin/finance/dashboard"),
  setBalance: (currentBalance: number) =>
    jsonReq<FinanceSettings>("/api/admin/finance/balance", {
      method: "PATCH",
      body: JSON.stringify({ currentBalance }),
    }),

  // Clients
  createClient: (data: Partial<RecurringClient>) =>
    jsonReq<{ client: RecurringClient }>("/api/admin/finance/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClient: (id: number, data: Partial<RecurringClient>) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteClient: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/clients/${id}`, { method: "DELETE" }),

  // Recurring expenses
  createRecurringExpense: (data: Partial<RecurringExpense>) =>
    jsonReq<{ expense: RecurringExpense }>("/api/admin/finance/recurring-expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRecurringExpense: (id: number, data: Partial<RecurringExpense>) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/recurring-expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteRecurringExpense: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/recurring-expenses/${id}`, {
      method: "DELETE",
    }),

  // One-time expenses
  createOneTime: (data: Partial<OneTimeExpense>) =>
    jsonReq<{ expense: OneTimeExpense }>("/api/admin/finance/one-time-expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOneTime: (id: number, data: Partial<OneTimeExpense>) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/one-time-expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOneTime: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/one-time-expenses/${id}`, {
      method: "DELETE",
    }),

  // One-off invoices
  createInvoice: (data: Partial<OneOffInvoice>) =>
    jsonReq<{ invoice: OneOffInvoice }>("/api/admin/finance/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInvoice: (id: number, data: Partial<OneOffInvoice>) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteInvoice: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/invoices/${id}`, { method: "DELETE" }),

  // Categories
  createCategory: (data: Partial<ExpenseCategory>) =>
    jsonReq<{ category: ExpenseCategory }>("/api/admin/finance/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: Partial<ExpenseCategory>) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/finance/categories/${id}`, { method: "DELETE" }),
};
