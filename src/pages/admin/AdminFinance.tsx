import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  categoryBudgetStatus,
  computeSummary,
  finance,
  fmtMoney,
  invoiceFeeBreakdown,
  invoiceNetAmount,
  netAfterFees,
  payrollCategoryId,
  projectMonth,
  thisMonthIso,
  type ExpenseCategory,
  type FinanceDashboard,
  type OneOffInvoice,
  type OneTimeExpense,
  type RecurringClient,
  type RecurringExpense,
  type SentReminder,
} from "@/lib/finance";
import { todayYmd } from "@/lib/tasks";
import {
  clientLifetime,
  formatTenure,
  inSegment,
  lifetimeAverages,
  type ClientLifetime,
  type Segment,
} from "@/lib/clientLifetime";
import { daysBetween } from "@/lib/renewal";
import { AdminPageHeader } from "@/pages/admin/AdminPageHeader";

// ─── Data shared by every Finance page ───────────────────────────────────

interface FinanceState {
  d: FinanceDashboard | null;
  setD: (d: FinanceDashboard) => void;
  refresh: () => Promise<void>;
  /** The month the Cash flow and Budgets pages show, kept across pages. */
  monthIso: string;
  setMonthIso: (m: string) => void;
  startBalanceOverride: number | null;
  setStartBalanceOverride: (n: number | null) => void;
}

const FinanceContext = createContext<FinanceState | null>(null);

/** Loads the finance data once for all the Finance pages beneath it. */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [monthIso, setMonthIso] = useState(thisMonthIso());
  const [startBalanceOverride, setStartBalanceOverride] = useState<number | null>(null);

  async function refresh() {
    try {
      setD(await finance.dashboard());
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        d,
        setD,
        refresh,
        monthIso,
        setMonthIso,
        startBalanceOverride,
        setStartBalanceOverride,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

function useFinance(): FinanceState {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("Finance pages must render inside FinanceProvider");
  return ctx;
}

function FinanceLoading() {
  return <div className="text-muted-foreground text-sm">Loading finance…</div>;
}

// ─── Finance pages ───────────────────────────────────────────────────────

export function FinanceCashflowPage() {
  const f = useFinance();
  const { d, monthIso } = f;
  const startBalance = f.startBalanceOverride ?? d?.settings.currentBalance ?? 0;

  const summary = useMemo(() => (d ? computeSummary(d, monthIso) : null), [d, monthIso]);
  const projection = useMemo(
    () =>
      d
        ? projectMonth({
            monthIso,
            startBalance,
            clients: d.recurringClients,
            recurringExpenses: d.recurringExpenses,
            oneTimeExpenses: d.oneTimeExpenses,
            oneOffInvoices: d.oneOffInvoices,
            paymentMethods: d.paymentMethods,
          })
        : [],
    [d, monthIso, startBalance],
  );
  const budgetStatus = useMemo(
    () => (d ? categoryBudgetStatus(d, monthIso) : []),
    [d, monthIso],
  );

  if (!d || !summary) return <FinanceLoading />;

  const endBalance = projection.length > 0 ? projection[projection.length - 1].balance : startBalance;
  const lowestPoint = projection.length > 0 ? Math.min(...projection.map((p) => p.balance)) : startBalance;

  return (
    <>
      <div className="space-y-6 print:hidden">
        <AdminPageHeader
          title="Cash flow"
          description="Where the money stands this month, and where it's headed."
          actions={
            <>
              <MonthPicker value={monthIso} onChange={f.setMonthIso} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                title="Save the full report as PDF via your browser's print dialog"
              >
                Export PDF
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BalanceCard
            settings={d.settings}
            onUpdate={async (newBal) => {
              const fresh = await finance.setBalance(newBal);
              f.setD({ ...d, settings: fresh });
              f.setStartBalanceOverride(null);
              toast.success("Balance updated");
            }}
          />
          <StatCard
            label="MRR (net)"
            value={fmtMoney(summary.mrrNet)}
            subtitle={
              summary.oneOffNetThisMonth > 0
                ? `+ ${fmtMoney(summary.oneOffNetThisMonth)} one-off this month`
                : summary.mrrGross !== summary.mrrNet
                  ? `gross ${fmtMoney(summary.mrrGross)}`
                  : "after fees"
            }
          />
          <StatCard
            label="Monthly expenses"
            value={fmtMoney(summary.monthlyExpenses)}
            subtitle={`${fmtMoney(summary.monthlyOperating)} operating + ${fmtMoney(summary.monthlyPayroll)} payroll`}
          />
          <StatCard
            label="Projected end balance"
            value={fmtMoney(endBalance)}
            subtitle={`low: ${fmtMoney(lowestPoint)}`}
            tone={endBalance >= startBalance ? "good" : "warn"}
          />
        </div>

        <CashflowCard
          projection={projection}
          startBalance={startBalance}
          currentBalance={d.settings.currentBalance}
          onChangeStart={f.setStartBalanceOverride}
          monthIso={monthIso}
        />
      </div>
      <PrintableReport
        d={d}
        monthIso={monthIso}
        startBalance={startBalance}
        summary={summary}
        projection={projection}
        budgetStatus={budgetStatus}
      />
    </>
  );
}

export function FinanceRevenuePage() {
  const { d, monthIso, refresh } = useFinance();
  const summary = useMemo(() => (d ? computeSummary(d, monthIso) : null), [d, monthIso]);
  if (!d || !summary) return <FinanceLoading />;
  const active = d.recurringClients.filter((c) => c.isActive && c.monthlyAmount > 0).length;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Revenue"
        description="Retainer clients and one-off invoices."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="MRR (gross)" value={fmtMoney(summary.mrrGross)} subtitle="before payment fees" />
        <StatCard label="MRR (net)" value={fmtMoney(summary.mrrNet)} subtitle="after payment fees" />
        <StatCard
          label="Paying clients"
          value={String(active)}
          subtitle={active ? `${fmtMoney(summary.mrrGross / active)} average a month` : "none yet"}
        />
        <StatCard
          label="One-off this month"
          value={fmtMoney(summary.oneOffNetThisMonth)}
          subtitle="net, by payout date"
        />
      </div>
      <RecurringClientsTable d={d} onChanged={refresh} />
      <OneOffInvoicesTable d={d} onChanged={refresh} />
    </div>
  );
}

export function FinanceLifetimePage() {
  const { d, refresh } = useFinance();
  if (!d) return <FinanceLoading />;
  return (
    <div>
      <AdminPageHeader
        title="Client lifetime"
        description="How long retainer clients stay, what each has been worth, and when they renew."
      />
      <ClientLifetimeSection d={d} onChanged={refresh} />
    </div>
  );
}

export function FinanceExpensesPage() {
  const { d, monthIso, refresh } = useFinance();
  const summary = useMemo(() => (d ? computeSummary(d, monthIso) : null), [d, monthIso]);
  if (!d || !summary) return <FinanceLoading />;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Expenses"
        description="What goes out every month: operating costs and payroll."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Monthly expenses" value={fmtMoney(summary.monthlyExpenses)} subtitle="operating + payroll" />
        <StatCard label="Operating" value={fmtMoney(summary.monthlyOperating)} subtitle="a month" />
        <StatCard label="Payroll" value={fmtMoney(summary.monthlyPayroll)} subtitle="a month" />
      </div>
      <RecurringExpensesTable d={d} onChanged={refresh} variant="operating" />
      <RecurringExpensesTable d={d} onChanged={refresh} variant="payroll" />
    </div>
  );
}

export function FinancePlanningPage() {
  const { d, refresh } = useFinance();
  if (!d) return <FinanceLoading />;
  return (
    <div>
      <AdminPageHeader
        title="Planning & gear"
        description="One-time purchases, planned and paid."
      />
      <PlanningSection d={d} onChanged={refresh} />
    </div>
  );
}

export function FinanceBudgetsPage() {
  const { d, monthIso, setMonthIso, refresh } = useFinance();
  const status = useMemo(() => (d ? categoryBudgetStatus(d, monthIso) : []), [d, monthIso]);
  if (!d) return <FinanceLoading />;
  return (
    <div>
      <AdminPageHeader
        title="Budgets"
        description="Spending by category against each category's monthly budget."
        actions={<MonthPicker value={monthIso} onChange={setMonthIso} />}
      />
      <CategoriesTable status={status} onChanged={refresh} />
    </div>
  );
}

// ─── Cards / chart ───────────────────────────────────────────────────────

function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm">Month</Label>
      <Input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44"
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "good" | "warn" | "danger";
}) {
  const ringClass =
    tone === "good"
      ? "ring-1 ring-green-300 bg-green-50/40"
      : tone === "warn"
        ? "ring-1 ring-yellow-300 bg-yellow-50/40"
        : tone === "danger"
          ? "ring-1 ring-red-300 bg-red-50/40"
          : "";
  return (
    <Card className={ringClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums text-tmc-dark">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

function BalanceCard({
  settings,
  onUpdate,
}: {
  settings: FinanceDashboard["settings"];
  onUpdate: (newBalance: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings.currentBalance);
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Cash on hand
        </CardTitle>
        <button
          className="text-[11px] text-tmc-gold-dark hover:underline"
          onClick={() => {
            setDraft(settings.currentBalance);
            setEditing(true);
          }}
        >
          Update
        </button>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums text-tmc-dark">
          {fmtMoney(settings.currentBalance)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          As of {new Date(settings.balanceUpdatedAt.replace(" ", "T") + "Z").toLocaleDateString()}
        </div>
      </CardContent>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update cash on hand</DialogTitle>
            <DialogDescription>
              Pull this from your bank balance — it's the starting number for the
              cashflow projection unless you override it on the chart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Current balance ($)</Label>
            <Input
              type="number"
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value) || 0)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onUpdate(draft);
                  setEditing(false);
                } catch (e) {
                  toast.error(`Failed: ${(e as Error).message}`);
                } finally {
                  setSaving(false);
                }
              }}
              className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CashflowCard({
  projection,
  startBalance,
  currentBalance,
  onChangeStart,
  monthIso,
}: {
  projection: ReturnType<typeof projectMonth>;
  startBalance: number;
  currentBalance: number;
  onChangeStart: (v: number | null) => void;
  monthIso: string;
}) {
  const [draft, setDraft] = useState<number>(startBalance);
  useEffect(() => setDraft(startBalance), [startBalance]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Cashflow — {monthIso}</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Start of month ($)</Label>
            <Input
              type="number"
              value={draft}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setDraft(v);
                onChangeStart(v);
              }}
              className="w-32 text-right tabular-nums"
            />
            {startBalance !== currentBalance && (
              <button
                className="text-[11px] text-tmc-gold-dark hover:underline"
                onClick={() => onChangeStart(null)}
              >
                Reset to {fmtMoney(currentBalance)}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={56}
              />
              <Tooltip
                formatter={(v) => fmtMoney(Number(v))}
                labelFormatter={(d) => `Day ${d}`}
                contentStyle={{ fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="#A03030" strokeDasharray="3 3" />
              <ReferenceLine y={startBalance} stroke="#94a3b8" strokeDasharray="2 4" />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#CFB583"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
          <span>· Gold line = projected balance</span>
          <span>· Gray dashed = start of month</span>
          <span>· Red dashed = $0</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────

function RecurringClientsTable({
  d,
  onChanged,
}: {
  d: FinanceDashboard;
  onChanged: () => void;
}) {
  const pmById = new Map(d.paymentMethods.map((p) => [p.id, p]));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recurring revenue</CardTitle>
        <ClientDialog mode="create" d={d} onSaved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead>Pays via</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Invoice day</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.recurringClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No recurring clients yet. Click "Add client" to add one.
                </TableCell>
              </TableRow>
            ) : (
              // Retired clients drop to the bottom so the live roster reads
              // first; they stay listed because their history is still real.
              [...d.recurringClients]
                .sort((a, b) => Number(b.isActive) - Number(a.isActive))
                .map((c) => {
                const pm = c.paymentMethodId != null ? pmById.get(c.paymentMethodId) : null;
                const net = netAfterFees(c.monthlyAmount, pm);
                return (
                  <TableRow key={c.id} className={!c.isActive ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(c.monthlyAmount)}</TableCell>
                    <TableCell className="text-sm">{pm?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-green-700">
                      {fmtMoney(net)}
                    </TableCell>
                    <TableCell className="text-sm">{c.invoiceDay ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <ActiveToggle client={c} onChanged={onChanged} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <ClientDialog mode="edit" client={c} d={d} onSaved={onChanged} />
                      <DeleteAlert
                        title={`Remove ${c.name}?`}
                        description="Only possible if the client has no posts in the content planner. For a client that has left, set the status to Inactive instead: that keeps the history and takes them out of MRR, cash flow, the planner and task lists."
                        onConfirm={async () => {
                          await finance.deleteClient(c.id);
                          toast.success("Deleted");
                          onChanged();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            <TableRow className="font-bold border-t-2">
              <TableCell>Total MRR</TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtMoney(d.recurringClients.filter((c) => c.isActive).reduce((s, c) => s + c.monthlyAmount, 0))}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right tabular-nums text-green-700">
                {fmtMoney(
                  d.recurringClients
                    .filter((c) => c.isActive)
                    .reduce(
                      (s, c) => s + netAfterFees(c.monthlyAmount, c.paymentMethodId != null ? pmById.get(c.paymentMethodId) ?? null : null),
                      0,
                    ),
                )}
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClientDialog({
  mode,
  client,
  d,
  onSaved,
}: {
  mode: "create" | "edit";
  client?: RecurringClient;
  d: FinanceDashboard;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    monthlyAmount: client?.monthlyAmount ?? 0,
    paymentMethodId: client?.paymentMethodId ?? null,
    invoiceDay: client?.invoiceDay ?? 1,
    isActive: client?.isActive ?? true,
    notes: client?.notes ?? "",
    signedDate: client?.signedDate ?? "",
    termMonths: client?.termMonths ?? null,
    endedDate: client?.endedDate ?? "",
    ltvAdjustment: client?.ltvAdjustment ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.monthlyAmount) {
      toast.error("Name and amount required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        monthlyAmount: form.monthlyAmount,
        paymentMethodId: form.paymentMethodId,
        invoiceDay: form.invoiceDay,
        isActive: form.isActive,
        notes: form.notes || null,
        signedDate: form.signedDate || null,
        termMonths: form.termMonths,
        // Leaving dates the end of their lifetime; coming back clears it.
        endedDate: form.isActive ? null : form.endedDate || todayYmd(),
        ltvAdjustment: form.ltvAdjustment || null,
      };
      if (mode === "create") {
        await finance.createClient(payload);
        toast.success("Client added");
      } else {
        await finance.updateClient(client!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add client
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add recurring client" : `Edit ${client?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Client name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly amount ($)</Label>
            <Input
              type="number"
              value={form.monthlyAmount}
              onChange={(e) => setForm({ ...form, monthlyAmount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice day (1–31)</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={form.invoiceDay}
              onChange={(e) => setForm({ ...form, invoiceDay: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Payment method</Label>
            <Select
              value={form.paymentMethodId != null ? String(form.paymentMethodId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, paymentMethodId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not set —</SelectItem>
                {d.paymentMethods.map((p) => {
                  const parts: string[] = [];
                  if (p.feePct > 0) parts.push(`${(p.feePct * 100).toFixed(2)}%`);
                  if (p.feeFlat > 0) parts.push(`$${(p.feeFlat / 100).toFixed(2)}`);
                  if (p.instantPayoutPct > 0)
                    parts.push(`+${(p.instantPayoutPct * 100).toFixed(1)}% instant`);
                  return (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {parts.length > 0 ? ` (${parts.join(" + ")})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Signed</Label>
            <Input
              type="date"
              value={form.signedDate}
              onChange={(e) => setForm({ ...form, signedDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Term</Label>
            <TermSelect
              value={form.termMonths}
              onChange={(termMonths) => setForm({ ...form, termMonths })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>LTV adjustment ($)</Label>
            <Input
              type="number"
              value={form.ltvAdjustment || ""}
              placeholder="0"
              onChange={(e) => setForm({ ...form, ltvAdjustment: Number(e.target.value) || 0 })}
            />
          </div>
          {!form.isActive && (
            <div className="space-y-1.5">
              <Label>Left on</Label>
              <Input
                type="date"
                value={form.endedDate}
                min={form.signedDate || undefined}
                onChange={(e) => setForm({ ...form, endedDate: e.target.value })}
              />
            </div>
          )}
          <p className="col-span-2 text-xs text-muted-foreground -mt-1">
            Lifetime value is estimated from the monthly amount and months billed,
            plus one-off invoices under this name. Use the adjustment to add or take
            off what that misses, like a past price change, a comped month, or a setup fee.
          </p>
          <label className="flex items-center gap-2 col-span-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (counted in MRR + cashflow)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client lifetime ─────────────────────────────────────────────────────

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "current", label: "Current" },
  { id: "past", label: "Past" },
];

const TENURE_LABEL: Record<Segment, string> = {
  all: "Average tenure",
  current: "Average tenure so far",
  past: "Average lifetime",
};

function ClientLifetimeSection({
  d,
  onChanged,
}: {
  d: FinanceDashboard;
  onChanged: () => void;
}) {
  const today = todayYmd();
  const [segment, setSegment] = useState<Segment>("all");
  const rows = useMemo(
    () => d.recurringClients.map((c) => clientLifetime(c, d.oneOffInvoices, today)),
    [d, today],
  );
  const avg = lifetimeAverages(rows, segment);
  const visible = rows.filter((r) => inSegment(r, segment)).sort(byLifetimeOrder);

  async function save(c: RecurringClient, patch: Partial<RecurringClient>) {
    try {
      await finance.updateClient(c.id, patch);
      onChanged();
    } catch (e) {
      toast.error(`Couldn't save: ${(e as Error).message}`);
      onChanged();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Showing
        </span>
        <div className="inline-flex rounded-md border bg-card p-0.5" role="group" aria-label="Which clients">
          {SEGMENTS.map((sg) => (
            <button
              key={sg.id}
              type="button"
              onClick={() => setSegment(sg.id)}
              aria-pressed={segment === sg.id}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                segment === sg.id
                  ? "bg-tmc-dark text-white"
                  : "text-muted-foreground hover:text-tmc-dark"
              }`}
            >
              {sg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Average LTV"
          value={avg.avgLtv == null ? "—" : fmtMoney(avg.avgLtv)}
          subtitle={avg.medianLtv == null ? "no dated clients yet" : `median ${fmtMoney(avg.medianLtv)}`}
        />
        <StatCard
          label={TENURE_LABEL[segment]}
          value={avg.avgTenure == null ? "—" : formatTenure(avg.avgTenure)}
          subtitle={
            avg.avgTenure == null
              ? "no dated clients yet"
              : `${avg.avgTenure.toFixed(1)} months · median ${formatTenure(avg.medianTenure)}`
          }
        />
        <StatCard
          label="Total lifetime revenue"
          value={fmtMoney(avg.totalLtv)}
          subtitle="gross, across the clients counted"
        />
        <StatCard
          label="Clients counted"
          value={String(avg.counted)}
          subtitle={
            avg.missing > 0
              ? `${avg.missing} more need dates below`
              : segment === "current"
                ? "still adding to both averages"
                : "every client is dated"
          }
          tone={avg.missing > 0 ? "warn" : undefined}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Renews / left</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    {segment === "past" ? "No past clients." : "No clients here yet."}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const c = r.client;
                  return (
                    <TableRow key={c.id} className={!c.isActive ? "bg-muted/30" : undefined}>
                      <TableCell className="font-medium">
                        {c.name}
                        {!c.isActive && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            past
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <InlineDate
                          value={c.signedDate}
                          max={c.endedDate ?? undefined}
                          label={`${c.name} signed date`}
                          onSave={(v) => save(c, { signedDate: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <TermSelect
                          compact
                          value={c.termMonths}
                          onChange={(v) => void save(c, { termMonths: v })}
                        />
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <RenewalCell r={r} today={today} />
                        ) : (
                          <InlineDate
                            value={c.endedDate}
                            min={c.signedDate ?? undefined}
                            label={`${c.name} left on`}
                            onSave={(v) => save(c, { endedDate: v })}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.gap && r.gap !== "no_retainer" ? (
                          <span className="text-xs text-amber-700">{GAP_HINT[r.gap]}</span>
                        ) : r.gap === "no_retainer" ? (
                          <span className="text-xs text-muted-foreground">No retainer</span>
                        ) : (
                          formatTenure(r.tenureMonths)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {fmtMoney(c.monthlyAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.gap ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span title={ltvBreakdown(r)} className="cursor-help">
                            {fmtMoney(r.ltv)}
                            {r.adjustment !== 0 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">adj.</span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ClientDialog mode="edit" client={c} d={d} onSaved={onChanged} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            LTV is the monthly amount times months billed, plus one-off invoices logged under
            the same name, plus any adjustment (hover a figure for the breakdown). Renewals
            follow the Terms: 6- and 12-month terms renew for the same length; notice is due
            30 days before.
          </p>
        </CardContent>
      </Card>

      <RenewalRemindersCard />
    </div>
  );
}

function RenewalRemindersCard() {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState<SentReminder[]>([]);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  useEffect(() => {
    finance
      .renewalReminders()
      .then((r) => {
        setSaved(r.recipients);
        setDraft(r.recipients);
        setRecent(r.recent);
      })
      .catch((e: Error) => toast.error(`Couldn't load reminder settings: ${e.message}`));
  }, []);

  async function save() {
    setBusy("save");
    try {
      const r = await finance.setReminderRecipients(draft);
      setSaved(r.recipients);
      setDraft(r.recipients);
      toast.success(r.recipients ? "Reminder recipients saved" : "Reminders turned off");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    try {
      const r = await finance.testReminder();
      toast.success(`Test sent to ${r.sentTo.join(", ")}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Renewal reminders</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Emailed 45 and 30 days before each renewal, so there's time to send a rate change,
          an updated agreement, or the current Terms before the 30-day notice date. Clients
          need a signed date and a 6- or 12-month term.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[240px]">
            <Label htmlFor="renewal-recipients">Send to</Label>
            <Input
              id="renewal-recipients"
              value={draft}
              disabled={saved == null}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="you@marketingtmc.com"
            />
          </div>
          <Button
            variant="outline"
            onClick={save}
            disabled={busy != null || saved == null || draft.trim() === saved}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={test}
            disabled={busy != null || !saved}
            title="Sends an example reminder for the next client to renew. Nothing is logged."
          >
            {busy === "test" ? "Sending…" : "Send a test"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          {recent.length === 0 ? (
            <p>None sent yet.</p>
          ) : (
            <>
              <p className="font-medium text-tmc-slate">Recently sent</p>
              {recent.map((r) => (
                <p key={`${r.clientName}-${r.renewalDate}-${r.daysBefore}`}>
                  {r.clientName}: {r.daysBefore}-day reminder for the {fmtYmd(r.renewalDate)} renewal,
                  sent {fmtYmd(r.sentAt.slice(0, 10))}
                </p>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const GAP_HINT: Record<Exclude<ClientLifetime["gap"], null | "no_retainer">, string> = {
  no_signed_date: "Add the signed date",
  no_end_date: "Add the date they left",
  not_started: "Not started yet",
};

/** Current clients by soonest renewal, then past clients by most recent exit. */
function byLifetimeOrder(a: ClientLifetime, b: ClientLifetime): number {
  if (a.client.isActive !== b.client.isActive) return a.client.isActive ? -1 : 1;
  if (a.client.isActive) {
    const ra = a.nextRenewal ?? "9999";
    const rb = b.nextRenewal ?? "9999";
    if (ra !== rb) return ra < rb ? -1 : 1;
  } else {
    // Missing an exit date sorts first: it's the row that needs attention.
    const ea = a.client.endedDate ?? "9999";
    const eb = b.client.endedDate ?? "9999";
    if (ea !== eb) return ea > eb ? -1 : 1;
  }
  return a.client.name.localeCompare(b.client.name);
}

function ltvBreakdown(r: ClientLifetime): string {
  const parts = [
    `${r.cyclesBilled} ${r.cyclesBilled === 1 ? "month" : "months"} × ${fmtMoney(r.client.monthlyAmount)} = ${fmtMoney(r.retainerRevenue)}`,
  ];
  if (r.oneOffRevenue) parts.push(`one-off invoices ${fmtMoney(r.oneOffRevenue)}`);
  if (r.adjustment) parts.push(`adjustment ${fmtMoney(r.adjustment, { sign: true })}`);
  return parts.join("\n");
}

function RenewalCell({ r, today }: { r: ClientLifetime; today: string }) {
  const c = r.client;
  if (!c.signedDate) return <span className="text-muted-foreground">—</span>;
  if (c.termMonths === 0) {
    return <span className="text-xs text-muted-foreground">Month-to-month</span>;
  }
  if (c.termMonths == null || !r.nextRenewal) {
    return <span className="text-xs text-amber-700">Set the term</span>;
  }
  const days = daysBetween(today, r.nextRenewal);
  const tone =
    days <= 30
      ? "bg-red-100 text-red-800"
      : days <= 45
        ? "bg-tmc-gold/30 text-tmc-dark"
        : null;
  return (
    <div className="leading-tight">
      <div className="flex items-center gap-1.5 text-sm">
        {fmtYmd(r.nextRenewal)}
        {tone && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tone}`}>
            {days === 0 ? "today" : `${days}d`}
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">notice by {fmtYmd(r.noticeBy!)}</div>
    </div>
  );
}

/** "Mar 1, 2027" from a calendar date, read as a local day. */
function fmtYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TERM_CHOICES: { value: string; label: string; months: number | null }[] = [
  { value: "none", label: "Not set", months: null },
  { value: "6", label: "6 months", months: 6 },
  { value: "12", label: "12 months", months: 12 },
  { value: "0", label: "Month-to-month", months: 0 },
];

function TermSelect({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (months: number | null) => void;
  compact?: boolean;
}) {
  return (
    <Select
      value={value == null ? "none" : String(value)}
      onValueChange={(v) => onChange(TERM_CHOICES.find((t) => t.value === v)?.months ?? null)}
    >
      <SelectTrigger className={compact ? "h-8 w-[136px] text-xs" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TERM_CHOICES.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A date that saves itself. Commits on blur rather than on change: typing a
 * year digit by digit passes through valid dates like 0002-01-15, and each
 * would otherwise be saved.
 */
function InlineDate({
  value,
  onSave,
  min,
  max,
  label,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
  min?: string;
  max?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  function commit() {
    const next = draft || null;
    if (next === value) return;
    void onSave(next);
  }

  return (
    <Input
      type="date"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`h-8 w-[150px] text-xs ${draft ? "" : "border-amber-300"}`}
    />
  );
}

// ─── One-off invoices ────────────────────────────────────────────────────

function OneOffInvoicesTable({
  d,
  onChanged,
}: {
  d: FinanceDashboard;
  onChanged: () => void;
}) {
  const pmById = new Map(d.paymentMethods.map((p) => [p.id, p]));
  const sorted = [...d.oneOffInvoices].sort((a, b) =>
    b.payoutDate.localeCompare(a.payoutDate),
  );
  const total = sorted.reduce(
    (s, i) =>
      s +
      invoiceNetAmount(
        i.grossAmount,
        i.paymentMethodId != null ? pmById.get(i.paymentMethodId) ?? null : null,
        i.instantPayout,
      ),
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">One-off invoices</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Project work, ad-hoc charges, anything outside a monthly retainer.
            Lands on the cashflow chart on its payout date.
          </p>
        </div>
        <InvoiceDialog mode="create" d={d} onSaved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Invoiced</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead className="text-right">Net received</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No one-off invoices yet. Click "Add invoice" to log one.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((inv) => {
                const pm =
                  inv.paymentMethodId != null
                    ? pmById.get(inv.paymentMethodId) ?? null
                    : null;
                const net = invoiceNetAmount(inv.grossAmount, pm, inv.instantPayout);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.clientName}
                      {inv.notes && (
                        <span className="block text-[11px] text-muted-foreground italic">
                          {inv.notes}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(inv.grossAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pm?.name ?? "—"}
                      {inv.instantPayout && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider bg-tmc-gold/30 text-tmc-dark px-1 rounded">
                          instant
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{inv.invoiceDate ?? "—"}</TableCell>
                    <TableCell className="text-sm">{inv.payoutDate}</TableCell>
                    <TableCell className="text-right tabular-nums text-green-700">
                      {fmtMoney(net)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <InvoiceDialog mode="edit" invoice={inv} d={d} onSaved={onChanged} />
                      <DeleteAlert
                        title={`Delete invoice for ${inv.clientName}?`}
                        onConfirm={async () => {
                          await finance.deleteInvoice(inv.id);
                          toast.success("Deleted");
                          onChanged();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {sorted.length > 0 && (
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={5}>Total received</TableCell>
                <TableCell className="text-right tabular-nums text-green-700">
                  {fmtMoney(total)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoiceDialog({
  mode,
  invoice,
  d,
  onSaved,
}: {
  mode: "create" | "edit";
  invoice?: OneOffInvoice;
  d: FinanceDashboard;
  onSaved: () => void;
}) {
  const today = todayYmd();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: invoice?.clientName ?? "",
    grossAmount: invoice?.grossAmount ?? 0,
    paymentMethodId: invoice?.paymentMethodId ?? null,
    invoiceDate: invoice?.invoiceDate ?? invoice?.payoutDate ?? today,
    payoutDate: invoice?.payoutDate ?? today,
    instantPayout: invoice?.instantPayout ?? false,
    notes: invoice?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const pm =
    form.paymentMethodId != null
      ? d.paymentMethods.find((p) => p.id === form.paymentMethodId) ?? null
      : null;
  const breakdown = invoiceFeeBreakdown(form.grossAmount, pm, form.instantPayout);

  async function submit() {
    if (!form.clientName.trim() || !form.grossAmount) {
      toast.error("Client name and amount required");
      return;
    }
    if (!form.invoiceDate || !form.payoutDate) {
      toast.error("Invoice date and payout date required");
      return;
    }
    if (form.payoutDate < form.invoiceDate) {
      toast.error("Payout date can't be before the invoice date");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientName: form.clientName,
        grossAmount: form.grossAmount,
        paymentMethodId: form.paymentMethodId,
        invoiceDate: form.invoiceDate,
        payoutDate: form.payoutDate,
        instantPayout: form.instantPayout,
        notes: form.notes || null,
      };
      if (mode === "create") {
        await finance.createInvoice(payload);
        toast.success(`Invoice for ${form.clientName} added`);
      } else {
        await finance.updateInvoice(invoice!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add invoice
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add one-off invoice" : `Edit invoice — ${invoice?.clientName}`}
          </DialogTitle>
          <DialogDescription>
            For project work, ad-hoc charges, or anything outside a monthly retainer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Client</Label>
            <Input
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="Acme Inc"
              list="recurring-client-names"
            />
            <datalist id="recurring-client-names">
              {d.recurringClients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice amount ($)</Label>
            <Input
              type="number"
              value={form.grossAmount}
              onChange={(e) =>
                setForm({ ...form, grossAmount: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select
              value={form.paymentMethodId != null ? String(form.paymentMethodId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, paymentMethodId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not set —</SelectItem>
                {d.paymentMethods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 col-span-2 text-sm bg-muted rounded p-2">
            <input
              type="checkbox"
              checked={form.instantPayout}
              onChange={(e) => setForm({ ...form, instantPayout: e.target.checked })}
            />
            <span className="font-medium">Instant payout</span>
            <span className="text-xs text-muted-foreground">
              (subtracts {pm ? `${(pm.instantPayoutPct * 100).toFixed(1)}%` : "1%"} from net)
            </span>
          </label>

          <div className="space-y-1.5">
            <Label>Invoice date</Label>
            <Input
              type="date"
              value={form.invoiceDate}
              onChange={(e) => {
                const invoiceDate = e.target.value;
                // Money can't land before it's billed, so carry the payout
                // date forward rather than leave the pair backwards.
                const payoutDate =
                  invoiceDate && form.payoutDate < invoiceDate ? invoiceDate : form.payoutDate;
                setForm({ ...form, invoiceDate, payoutDate });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payout date</Label>
            <Input
              type="date"
              value={form.payoutDate}
              min={form.invoiceDate || undefined}
              onChange={(e) => setForm({ ...form, payoutDate: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Q3 brand video, deposit on launch"
            />
          </div>

          {/* Live breakdown */}
          {form.grossAmount > 0 && (
            <div className="col-span-2 rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Gross invoiced</span>
                <span className="tabular-nums">{fmtMoney(form.grossAmount)}</span>
              </div>
              {pm && pm.feePct > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>− Initial fee ({(pm.feePct * 100).toFixed(2)}%)</span>
                  <span className="tabular-nums">−${breakdown.initialFee.toFixed(2)}</span>
                </div>
              )}
              {pm && form.instantPayout && pm.instantPayoutPct > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>− Instant payout ({(pm.instantPayoutPct * 100).toFixed(1)}% of remaining)</span>
                  <span className="tabular-nums">−${breakdown.instantFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-green-700 border-t pt-1">
                <span>Amount received</span>
                <span className="tabular-nums">${breakdown.net.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground italic pt-1">
                Verify this matches what Wave shows.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recurring expenses ──────────────────────────────────────────────────

function RecurringExpensesTable({
  d,
  onChanged,
  variant,
}: {
  d: FinanceDashboard;
  onChanged: () => void;
  variant: "operating" | "payroll";
}) {
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  const payrollId = payrollCategoryId(d);
  const filtered = d.recurringExpenses.filter((e) => {
    const isPayroll = payrollId != null && e.categoryId === payrollId;
    return variant === "payroll" ? isPayroll : !isPayroll;
  });
  const total = filtered.filter((e) => e.isActive).reduce((s, e) => s + e.monthlyAmount, 0);
  const title = variant === "payroll" ? "Payroll" : "Operating expenses";
  const subtitle =
    variant === "payroll"
      ? "Salaries, payroll fees, workers comp."
      : "Software, services, and other recurring non-payroll costs.";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <RecurringExpenseDialog mode="create" d={d} onSaved={onChanged} defaultPayroll={variant === "payroll"} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead>Pay day</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {variant === "payroll"
                    ? "No payroll items yet."
                    : "No operating expenses yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
                const cat = e.categoryId != null ? catById.get(e.categoryId) : null;
                return (
                  <TableRow key={e.id} className={!e.isActive ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm">
                      {cat ? <CatPill cat={cat} /> : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">
                      {fmtMoney(e.monthlyAmount)}
                    </TableCell>
                    <TableCell className="text-sm">{e.paymentDay ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {e.isActive ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <RecurringExpenseDialog mode="edit" expense={e} d={d} onSaved={onChanged} />
                      <DeleteAlert
                        title={`Remove ${e.name}?`}
                        onConfirm={async () => {
                          await finance.deleteRecurringExpense(e.id);
                          toast.success("Deleted");
                          onChanged();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={2}>
                {variant === "payroll" ? "Total payroll" : "Total operating"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-red-700">{fmtMoney(total)}</TableCell>
              <TableCell colSpan={3}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecurringExpenseDialog({
  mode,
  expense,
  d,
  onSaved,
  defaultPayroll,
}: {
  mode: "create" | "edit";
  expense?: RecurringExpense;
  d: FinanceDashboard;
  onSaved: () => void;
  defaultPayroll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const payrollId = payrollCategoryId(d);
  const [form, setForm] = useState({
    name: expense?.name ?? "",
    monthlyAmount: expense?.monthlyAmount ?? 0,
    categoryId:
      expense?.categoryId ?? (defaultPayroll && payrollId != null ? payrollId : null),
    paymentDay: expense?.paymentDay ?? 1,
    isActive: expense?.isActive ?? true,
    notes: expense?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.monthlyAmount) {
      toast.error("Name and amount required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        monthlyAmount: form.monthlyAmount,
        categoryId: form.categoryId,
        paymentDay: form.paymentDay,
        isActive: form.isActive,
        notes: form.notes || null,
      };
      if (mode === "create") {
        await finance.createRecurringExpense(payload);
        toast.success("Expense added");
      } else {
        await finance.updateRecurringExpense(expense!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add expense
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add recurring expense" : `Edit ${expense?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly amount ($)</Label>
            <Input
              type="number"
              value={form.monthlyAmount}
              onChange={(e) => setForm({ ...form, monthlyAmount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment day (1–31)</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={form.paymentDay}
              onChange={(e) => setForm({ ...form, paymentDay: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId != null ? String(form.categoryId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, categoryId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— uncategorized —</SelectItem>
                {d.categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 col-span-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (counted in monthly expenses + cashflow)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Planning & Gear — combines one-time purchases (planned + paid) into a
 * status-grouped layout. The intent is "what's coming up vs what's already
 * happened" rather than a flat table.
 */
function PlanningSection({
  d,
  onChanged,
}: {
  d: FinanceDashboard;
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthIso = today.slice(0, 7);

  const planned = d.oneTimeExpenses.filter((e) => e.status === "planned");
  const paid = d.oneTimeExpenses.filter((e) => e.status === "paid");

  // Group planned by horizon
  const undated = planned.filter((e) => !e.plannedDate);
  const thisMonth = planned.filter(
    (e) => e.plannedDate && e.plannedDate.startsWith(monthIso) && e.plannedDate >= today,
  );
  const overdue = planned.filter(
    (e) => e.plannedDate && e.plannedDate < today,
  );
  const future = planned.filter(
    (e) =>
      e.plannedDate &&
      !e.plannedDate.startsWith(monthIso) &&
      e.plannedDate >= today,
  );

  // Last 90 days of paid for context
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentPaid = paid.filter(
    (e) => e.paidDate && new Date(e.paidDate) >= ninetyDaysAgo,
  );

  const totalPlanned = planned.reduce((s, e) => s + e.amount, 0);
  const totalThisMonth =
    thisMonth.reduce((s, e) => s + e.amount, 0) +
    overdue.reduce((s, e) => s + e.amount, 0);
  const totalFuture = future.reduce((s, e) => s + e.amount, 0);
  const totalUndated = undated.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Planning & gear</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Plan ahead. The cashflow chart drops on the planned date so you
              can see if a purchase fits before you commit.
            </p>
          </div>
          <OneTimeDialog mode="create" d={d} onSaved={onChanged} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <PlanStat label="Wishlist (no date)" value={totalUndated} count={undated.length} />
            <PlanStat label="This month" value={totalThisMonth} count={thisMonth.length + overdue.length} tone={overdue.length > 0 ? "warn" : undefined} />
            <PlanStat label="Future months" value={totalFuture} count={future.length} />
            <PlanStat label="Total planned" value={totalPlanned} count={planned.length} bold />
          </div>

          {overdue.length > 0 && (
            <PlanningGroup
              title="Past due — needs attention"
              tone="danger"
              items={overdue}
              d={d}
              onChanged={onChanged}
            />
          )}
          <PlanningGroup
            title="This month"
            tone="warn"
            items={thisMonth}
            d={d}
            onChanged={onChanged}
            emptyHint="Nothing planned for this month yet."
          />
          <PlanningGroup
            title="Future months"
            items={future}
            d={d}
            onChanged={onChanged}
            emptyHint="Nothing scheduled past this month."
          />
          <PlanningGroup
            title="Wishlist (no date)"
            tone="muted"
            items={undated}
            d={d}
            onChanged={onChanged}
            emptyHint="Add things you're considering — leave the date blank."
          />

          {recentPaid.length > 0 && (
            <PlanningGroup
              title="Recently paid (last 90 days)"
              tone="muted"
              items={recentPaid}
              d={d}
              onChanged={onChanged}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanStat({
  label,
  value,
  count,
  bold,
  tone,
}: {
  label: string;
  value: number;
  count: number;
  bold?: boolean;
  tone?: "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "ring-1 ring-red-300 bg-red-50/40"
      : tone === "warn"
        ? "ring-1 ring-yellow-300 bg-yellow-50/40"
        : "";
  return (
    <div className={`rounded-md border bg-card p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`tabular-nums mt-1 ${bold ? "text-xl font-bold" : "text-lg font-semibold"}`}>
        {fmtMoney(value)}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {count} item{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function PlanningGroup({
  title,
  tone,
  items,
  d,
  onChanged,
  emptyHint,
}: {
  title: string;
  tone?: "warn" | "danger" | "muted";
  items: OneTimeExpense[];
  d: FinanceDashboard;
  onChanged: () => void;
  emptyHint?: string;
}) {
  if (items.length === 0 && !emptyHint) return null;
  const titleColor =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-yellow-700"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-tmc-dark";
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  return (
    <div className="mb-4">
      <h3 className={`text-xs font-semibold uppercase tracking-widest ${titleColor} mb-2`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-2 py-3">{emptyHint}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableBody>
              {items.map((e) => {
                const cat = e.categoryId != null ? catById.get(e.categoryId) : null;
                const dateStr = e.status === "paid" ? e.paidDate : e.plannedDate;
                return (
                  <TableRow key={e.id} className={tone === "muted" ? "opacity-75" : undefined}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm">{cat ? <CatPill cat={cat} /> : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dateStr ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {fmtMoney(e.amount)}
                    </TableCell>
                    <TableCell className="text-right space-x-1 w-32">
                      <OneTimeDialog mode="edit" expense={e} d={d} onSaved={onChanged} />
                      <DeleteAlert
                        title={`Remove ${e.name}?`}
                        onConfirm={async () => {
                          await finance.deleteOneTime(e.id);
                          toast.success("Deleted");
                          onChanged();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


function OneTimeDialog({
  mode,
  expense,
  d,
  onSaved,
}: {
  mode: "create" | "edit";
  expense?: OneTimeExpense;
  d: FinanceDashboard;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: expense?.name ?? "",
    amount: expense?.amount ?? 0,
    categoryId: expense?.categoryId ?? null,
    status: expense?.status ?? ("planned" as "planned" | "paid"),
    date: expense
      ? expense.status === "paid"
        ? expense.paidDate ?? ""
        : expense.plannedDate ?? ""
      : new Date().toISOString().slice(0, 10),
    notes: expense?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.amount) {
      toast.error("Name and amount required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        amount: form.amount,
        categoryId: form.categoryId,
        status: form.status,
        plannedDate: form.status === "planned" ? form.date || null : null,
        paidDate: form.status === "paid" ? form.date || null : null,
        notes: form.notes || null,
      };
      if (mode === "create") {
        await finance.createOneTime(payload);
        toast.success("Added");
      } else {
        await finance.updateOneTime(expense!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add purchase
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add one-time / gear purchase" : `Edit ${expense?.name}`}</DialogTitle>
          <DialogDescription>
            Planned purchases hit the cashflow chart on their planned date.
            Mark as paid once the money has actually moved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sony FX3 body"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as "planned" | "paid" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{form.status === "paid" ? "Paid date" : "Planned date"}</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.categoryId != null ? String(form.categoryId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, categoryId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— uncategorized —</SelectItem>
                {d.categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTable({
  status,
  onChanged,
}: {
  status: ReturnType<typeof categoryBudgetStatus>;
  onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Categories & monthly budget</CardTitle>
        <CategoryDialog mode="create" onSaved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Spent this month</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  No categories.
                </TableCell>
              </TableRow>
            ) : (
              status.map((s) => (
                <TableRow key={s.category.id}>
                  <TableCell>
                    <CatPill cat={s.category} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(s.spent)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.budget != null ? fmtMoney(s.budget) : <span className="text-muted-foreground italic">— none —</span>}
                  </TableCell>
                  <TableCell>
                    {s.percentUsed != null ? (
                      <BudgetBar pct={s.percentUsed} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <CategoryDialog mode="edit" category={s.category} onSaved={onChanged} />
                    <DeleteAlert
                      title={`Delete ${s.category.name}?`}
                      description="Expenses in this category will be moved to uncategorized but kept."
                      onConfirm={async () => {
                        await finance.deleteCategory(s.category.id);
                        toast.success("Deleted");
                        onChanged();
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BudgetBar({ pct }: { pct: number }) {
  const tone = pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-yellow-500" : "bg-green-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`${tone} h-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-medium ${pct >= 100 ? "text-red-700" : "text-muted-foreground"}`}>
        {pct}%
      </span>
    </div>
  );
}

function CategoryDialog({
  mode,
  category,
  onSaved,
}: {
  mode: "create" | "edit";
  category?: ExpenseCategory;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: category?.name ?? "",
    monthlyBudget: category?.monthlyBudget ?? null as number | null,
    color: category?.color ?? "404E5C",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        monthlyBudget: form.monthlyBudget,
        color: form.color.replace(/^#/, ""),
      };
      if (mode === "create") {
        await finance.createCategory(payload);
        toast.success("Added");
      } else {
        await finance.updateCategory(category!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add category
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New category" : `Edit ${category?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly budget ($) — optional</Label>
            <Input
              type="number"
              value={form.monthlyBudget ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  monthlyBudget: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="leave blank for no budget"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pill color (hex, no #)</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────

function CatPill({ cat }: { cat: ExpenseCategory }) {
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded text-white"
      style={{ backgroundColor: `#${cat.color}` }}
    >
      {cat.name}
    </span>
  );
}

/**
 * One-click retire. A client who has left still owns their content history, so
 * they cannot be deleted; inactive is the real answer and it was buried in the
 * edit dialog. Flipping this drops them out of MRR, the cash-flow calendar,
 * content seeding, planner targets and task placeholders, all of which already
 * key off isActive.
 */
function ActiveToggle({
  client,
  onChanged,
}: {
  client: RecurringClient;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function flip() {
    setBusy(true);
    try {
      // Retiring dates the end of the client's lifetime (today, unless one
      // was already set); reactivating clears it.
      await finance.updateClient(client.id, {
        isActive: !client.isActive,
        endedDate: client.isActive ? client.endedDate ?? todayYmd() : null,
      });
      toast.success(
        client.isActive
          ? `${client.name} moved to inactive. Adjust the date they left under Client lifetime.`
          : `${client.name} reactivated`,
      );
      onChanged();
    } catch (e) {
      toast.error(`Couldn't update: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={busy}
      title={
        client.isActive
          ? "Click to retire this client. Keeps their history, drops them from MRR."
          : "Click to make this client active again."
      }
      className={`px-2 py-0.5 rounded text-xs font-medium transition ${
        client.isActive
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      } disabled:opacity-50`}
    >
      {busy ? "…" : client.isActive ? "Active" : "Inactive"}
    </button>
  );
}

function DeleteAlert({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description?: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // onConfirm was passed straight to onClick, so a rejected delete closed the
  // dialog and vanished as an unhandled rejection: the row stayed put and
  // nothing said why. Every delete on this page goes through here.
  async function run(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={run} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Printable report ───────────────────────────────────────────────────
// Renders all modules stacked for paper. Hidden in screen mode, shown in
// print mode. Minimal styling — print stylesheet handles the rest.

function PrintableReport({
  d,
  monthIso,
  startBalance,
  summary,
  projection,
  budgetStatus,
}: {
  d: FinanceDashboard;
  monthIso: string;
  startBalance: number;
  summary: ReturnType<typeof computeSummary>;
  projection: ReturnType<typeof projectMonth>;
  budgetStatus: ReturnType<typeof categoryBudgetStatus>;
}) {
  const pmById = new Map(d.paymentMethods.map((p) => [p.id, p]));
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  const payrollId = payrollCategoryId(d);
  const operating = d.recurringExpenses.filter(
    (e) => payrollId == null || e.categoryId !== payrollId,
  );
  const payroll = d.recurringExpenses.filter(
    (e) => payrollId != null && e.categoryId === payrollId,
  );
  const invoicesThisMonth = d.oneOffInvoices.filter((i) =>
    i.payoutDate.startsWith(monthIso),
  );
  const otherInvoices = d.oneOffInvoices.filter(
    (i) => !i.payoutDate.startsWith(monthIso),
  );

  const endBalance = projection.length > 0 ? projection[projection.length - 1].balance : startBalance;
  const lowestPoint = projection.length > 0 ? Math.min(...projection.map((p) => p.balance)) : startBalance;

  const monthLabel = new Date(`${monthIso}-01T00:00:00`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  return (
    <div
      className="hidden print:block"
      style={{
        fontFamily: "'Geist Variable', system-ui, -apple-system, sans-serif",
        color: "#0E0F19",
        background: "white",
        fontSize: 10,
        lineHeight: 1.4,
      }}
    >
      {/* Title */}
      <div
        style={{
          borderBottom: "2px solid #CFB583",
          paddingBottom: 8,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#404E5C" }}>
            TMC Marketing — Finance Report
          </div>
          <div style={{ color: "#6D6E76", fontSize: 11 }}>
            {monthLabel} · Generated {new Date().toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0E0F19", lineHeight: 1 }}>
            {fmtMoney(d.settings.currentBalance)}
          </div>
          <div style={{ fontSize: 9, color: "#6D6E76" }}>cash on hand</div>
        </div>
      </div>

      {/* Summary stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <PrintStat label="MRR (net)" value={fmtMoney(summary.mrrNet)} note={summary.oneOffNetThisMonth > 0 ? `+ ${fmtMoney(summary.oneOffNetThisMonth)} one-off` : ""} />
        <PrintStat label="Operating expenses" value={fmtMoney(summary.monthlyOperating)} />
        <PrintStat label="Payroll" value={fmtMoney(summary.monthlyPayroll)} />
        <PrintStat label="Projected end balance" value={fmtMoney(endBalance)} note={`low: ${fmtMoney(lowestPoint)}`} />
      </div>

      {/* Cashflow projection */}
      <PrintSection title={`Cashflow projection — ${monthLabel}`} subtitle={`Starting balance: ${fmtMoney(startBalance)}`}>
        <PrintTable
          headers={["Day", "Date", "Income", "Expense", "Balance"]}
          rows={projection.map((p) => [
            String(p.day),
            p.date.slice(5),
            p.income > 0 ? fmtMoney(p.income) : "",
            p.expense > 0 ? `−${fmtMoney(p.expense)}` : "",
            fmtMoney(p.balance),
          ])}
          align={["left", "left", "right", "right", "right"]}
          striped
        />
      </PrintSection>

      {/* Recurring revenue */}
      <PrintSection title="Recurring revenue">
        <PrintTable
          headers={["Client", "Gross", "Method", "Net", "Day"]}
          rows={d.recurringClients.map((c) => {
            const pm = c.paymentMethodId != null ? pmById.get(c.paymentMethodId) ?? null : null;
            return [
              c.name + (c.isActive ? "" : " (inactive)"),
              fmtMoney(c.monthlyAmount),
              pm?.name ?? "—",
              fmtMoney(netAfterFees(c.monthlyAmount, pm)),
              c.invoiceDay != null ? String(c.invoiceDay) : "—",
            ];
          })}
          align={["left", "right", "left", "right", "right"]}
          totalRow={[
            "Total MRR",
            fmtMoney(d.recurringClients.filter((c) => c.isActive).reduce((s, c) => s + c.monthlyAmount, 0)),
            "",
            fmtMoney(summary.mrrNet),
            "",
          ]}
        />
      </PrintSection>

      {/* One-off invoices */}
      {d.oneOffInvoices.length > 0 && (
        <PrintSection title="One-off invoices">
          {invoicesThisMonth.length > 0 && (
            <>
              <PrintSubheading>This month</PrintSubheading>
              <PrintTable
                headers={["Client", "Gross", "Method", "Invoiced", "Payout", "Net"]}
                rows={invoicesThisMonth.map((i) => {
                  const pm = i.paymentMethodId != null ? pmById.get(i.paymentMethodId) ?? null : null;
                  return [
                    i.clientName + (i.instantPayout ? " (instant)" : ""),
                    fmtMoney(i.grossAmount),
                    pm?.name ?? "—",
                    i.invoiceDate ?? "—",
                    i.payoutDate,
                    fmtMoney(invoiceNetAmount(i.grossAmount, pm, i.instantPayout)),
                  ];
                })}
                align={["left", "right", "left", "left", "left", "right"]}
              />
            </>
          )}
          {otherInvoices.length > 0 && (
            <>
              <PrintSubheading>Other months</PrintSubheading>
              <PrintTable
                headers={["Client", "Gross", "Method", "Invoiced", "Payout", "Net"]}
                rows={otherInvoices.map((i) => {
                  const pm = i.paymentMethodId != null ? pmById.get(i.paymentMethodId) ?? null : null;
                  return [
                    i.clientName + (i.instantPayout ? " (instant)" : ""),
                    fmtMoney(i.grossAmount),
                    pm?.name ?? "—",
                    i.invoiceDate ?? "—",
                    i.payoutDate,
                    fmtMoney(invoiceNetAmount(i.grossAmount, pm, i.instantPayout)),
                  ];
                })}
                align={["left", "right", "left", "left", "left", "right"]}
              />
            </>
          )}
        </PrintSection>
      )}

      {/* Operating expenses */}
      <PrintSection title="Operating expenses">
        <PrintTable
          headers={["Name", "Category", "Monthly", "Pay day"]}
          rows={operating.map((e) => [
            e.name + (e.isActive ? "" : " (inactive)"),
            (e.categoryId != null ? catById.get(e.categoryId)?.name : null) ?? "—",
            fmtMoney(e.monthlyAmount),
            e.paymentDay != null ? String(e.paymentDay) : "—",
          ])}
          align={["left", "left", "right", "right"]}
          totalRow={[
            "Total operating",
            "",
            fmtMoney(summary.monthlyOperating),
            "",
          ]}
        />
      </PrintSection>

      {/* Payroll */}
      <PrintSection title="Payroll">
        <PrintTable
          headers={["Name", "Monthly", "Pay day"]}
          rows={payroll.map((e) => [
            e.name + (e.isActive ? "" : " (inactive)"),
            fmtMoney(e.monthlyAmount),
            e.paymentDay != null ? String(e.paymentDay) : "—",
          ])}
          align={["left", "right", "right"]}
          totalRow={["Total payroll", fmtMoney(summary.monthlyPayroll), ""]}
        />
      </PrintSection>

      {/* Planning & gear */}
      {d.oneTimeExpenses.length > 0 && (
        <PrintSection title="Planning & gear">
          <PrintTable
            headers={["What", "Category", "Amount", "Status", "Date"]}
            rows={d.oneTimeExpenses.map((e) => [
              e.name,
              (e.categoryId != null ? catById.get(e.categoryId)?.name : null) ?? "—",
              fmtMoney(e.amount),
              e.status,
              e.status === "paid" ? e.paidDate ?? "—" : e.plannedDate ?? "—",
            ])}
            align={["left", "left", "right", "left", "left"]}
          />
        </PrintSection>
      )}

      {/* Budgets */}
      <PrintSection title="Categories & budgets">
        <PrintTable
          headers={["Category", "Spent this month", "Budget", "Used %"]}
          rows={budgetStatus.map((s) => [
            s.category.name,
            fmtMoney(s.spent),
            s.budget != null ? fmtMoney(s.budget) : "—",
            s.percentUsed != null ? `${s.percentUsed}%` : "—",
          ])}
          align={["left", "right", "right", "right"]}
        />
      </PrintSection>

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 9, color: "#6D6E76" }}>
        TMC Marketing · Internal · Generated by the Tech Hub finance dashboard
      </div>
    </div>
  );
}

function PrintStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div
      style={{
        border: "1px solid #d1cfc9",
        borderRadius: 4,
        padding: 6,
        background: "#fafaf6",
      }}
    >
      <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#6D6E76" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 8, color: "#6D6E76", marginTop: 1 }}>{note}</div>}
    </div>
  );
}

function PrintSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14, breakInside: "avoid" }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#404E5C",
          borderBottom: "1px solid #CFB583",
          paddingBottom: 2,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
        {subtitle && (
          <span style={{ fontSize: 9, fontWeight: 400, color: "#6D6E76", marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
            {subtitle}
          </span>
        )}
      </h2>
      {children}
    </div>
  );
}

function PrintSubheading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 600, color: "#6D6E76", marginTop: 6, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>
      {children}
    </div>
  );
}

function PrintTable({
  headers,
  rows,
  align = [],
  striped,
  totalRow,
}: {
  headers: string[];
  rows: string[][];
  align?: ("left" | "right" | "center")[];
  striped?: boolean;
  totalRow?: string[];
}) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 9, fontStyle: "italic", color: "#6D6E76", padding: 4 }}>— none —</div>;
  }
  const cellAlign = (i: number) => align[i] ?? "left";
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 9.5,
      }}
    >
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                textAlign: cellAlign(i),
                padding: "3px 6px",
                borderBottom: "1px solid #404E5C",
                background: "#f1f1f0",
                fontWeight: 700,
                fontSize: 8.5,
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rIdx) => (
          <tr key={rIdx} style={{ background: striped && rIdx % 2 === 1 ? "#fafaf6" : "white" }}>
            {row.map((cell, i) => (
              <td
                key={i}
                style={{
                  textAlign: cellAlign(i),
                  padding: "2.5px 6px",
                  borderBottom: "0.5px solid #e2e0da",
                  fontVariantNumeric: cellAlign(i) === "right" ? "tabular-nums" : "normal",
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {totalRow && (
          <tr style={{ fontWeight: 700, borderTop: "1px solid #404E5C" }}>
            {totalRow.map((cell, i) => (
              <td
                key={i}
                style={{
                  textAlign: cellAlign(i),
                  padding: "4px 6px",
                  borderTop: "1px solid #404E5C",
                  fontVariantNumeric: cellAlign(i) === "right" ? "tabular-nums" : "normal",
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
