// Finance dashboard — types, API wrapper, and pure cashflow projection.

export interface PaymentMethod {
  id: number;
  name: string;
  feePct: number;       // e.g. 0.029
  feeFlat: number;      // CENTS, e.g. 30 = $0.30
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
}

// ─── Calculations ────────────────────────────────────────────────────────

/**
 * Net amount received after payment processor fees.
 * monthlyAmount is in dollars; fee_flat is in cents.
 */
export function netAfterFees(
  monthlyAmount: number,
  pm: PaymentMethod | null | undefined,
): number {
  if (!pm) return monthlyAmount;
  const pctFee = monthlyAmount * pm.feePct;
  const flatFee = pm.feeFlat / 100;
  return Math.round((monthlyAmount - pctFee - flatFee) * 100) / 100;
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
  paymentMethods: PaymentMethod[];
}

/**
 * Compute a day-by-day balance projection for the given month.
 * Income from a recurring client lands on its invoiceDay (net of fees).
 * Recurring expenses hit on paymentDay. One-time expenses hit on
 * plannedDate (if planned and within month) or paidDate (if paid).
 */
export function projectMonth(input: ProjectionInput): DayPoint[] {
  const { monthIso, startBalance, clients, recurringExpenses, oneTimeExpenses, paymentMethods } = input;
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

  for (const e of recurringExpenses) {
    if (!e.isActive || e.paymentDay == null) continue;
    const d = clampDay(e.paymentDay, monthIso);
    expenseByDay[d] += e.monthlyAmount;
  }

  const monthPrefix = `${monthIso}-`;
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
  monthlyExpenses: number;
  oneTimePlannedThisMonth: number;
  projectedNet: number;          // mrrNet - monthlyExpenses - one-time planned this month
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
  let monthlyExpenses = 0;
  for (const e of d.recurringExpenses) {
    if (e.isActive) monthlyExpenses += e.monthlyAmount;
  }
  const monthPrefix = `${monthIso}-`;
  let oneTimePlannedThisMonth = 0;
  for (const e of d.oneTimeExpenses) {
    const dateStr = e.status === "paid" ? e.paidDate : e.plannedDate;
    if (dateStr?.startsWith(monthPrefix)) oneTimePlannedThisMonth += e.amount;
  }
  return {
    mrrGross,
    mrrNet,
    monthlyExpenses,
    oneTimePlannedThisMonth,
    projectedNet: mrrNet - monthlyExpenses - oneTimePlannedThisMonth,
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
