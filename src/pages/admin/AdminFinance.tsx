import { useEffect, useMemo, useState } from "react";
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
  netAfterFees,
  payrollCategoryId,
  projectMonth,
  thisMonthIso,
  type ExpenseCategory,
  type FinanceDashboard,
  type OneTimeExpense,
  type RecurringClient,
  type RecurringExpense,
} from "@/lib/finance";

const TABS = [
  { id: "revenue", label: "Revenue" },
  { id: "operating", label: "Operating" },
  { id: "payroll", label: "Payroll" },
  { id: "planning", label: "Planning & Gear" },
  { id: "budgets", label: "Budgets" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminFinance() {
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [tab, setTab] = useState<Tab>("revenue");
  const [monthIso, setMonthIso] = useState(thisMonthIso());
  const [startBalanceOverride, setStartBalanceOverride] = useState<number | null>(null);

  async function refresh() {
    try {
      const data = await finance.dashboard();
      setD(data);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  const startBalance = startBalanceOverride ?? d?.settings.currentBalance ?? 0;

  const summary = useMemo(
    () => (d ? computeSummary(d, monthIso) : null),
    [d, monthIso],
  );
  const projection = useMemo(
    () =>
      d
        ? projectMonth({
            monthIso,
            startBalance,
            clients: d.recurringClients,
            recurringExpenses: d.recurringExpenses,
            oneTimeExpenses: d.oneTimeExpenses,
            paymentMethods: d.paymentMethods,
          })
        : [],
    [d, monthIso, startBalance],
  );
  const budgetStatus = useMemo(
    () => (d ? categoryBudgetStatus(d, monthIso) : []),
    [d, monthIso],
  );

  if (!d) {
    return <div className="text-muted-foreground text-sm">Loading finance…</div>;
  }

  const endBalance = projection.length > 0 ? projection[projection.length - 1].balance : startBalance;
  const lowestPoint = projection.length > 0 ? Math.min(...projection.map((p) => p.balance)) : startBalance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            Recurring revenue, expenses, gear, and cashflow projection.
          </p>
        </div>
        <MonthPicker value={monthIso} onChange={setMonthIso} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BalanceCard
          settings={d.settings}
          onUpdate={async (newBal) => {
            const fresh = await finance.setBalance(newBal);
            setD({ ...d, settings: fresh });
            setStartBalanceOverride(null);
            toast.success("Balance updated");
          }}
        />
        <StatCard
          label="MRR (net)"
          value={fmtMoney(summary!.mrrNet)}
          subtitle={summary!.mrrGross !== summary!.mrrNet
            ? `gross ${fmtMoney(summary!.mrrGross)}`
            : "after fees"}
        />
        <StatCard
          label="Monthly expenses"
          value={fmtMoney(summary!.monthlyExpenses)}
          subtitle={`${fmtMoney(summary!.monthlyOperating)} operating + ${fmtMoney(summary!.monthlyPayroll)} payroll`}
        />
        <StatCard
          label="Projected end balance"
          value={fmtMoney(endBalance)}
          subtitle={`low: ${fmtMoney(lowestPoint)}`}
          tone={endBalance >= startBalance ? "good" : "warn"}
        />
      </div>

      {/* Cashflow chart */}
      <CashflowCard
        projection={projection}
        startBalance={startBalance}
        currentBalance={d.settings.currentBalance}
        onChangeStart={setStartBalanceOverride}
        monthIso={monthIso}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "border-tmc-gold-dark text-tmc-dark"
                : "border-transparent text-muted-foreground hover:text-tmc-dark"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "revenue" && (
        <RecurringClientsTable d={d} onChanged={refresh} />
      )}
      {tab === "operating" && (
        <RecurringExpensesTable
          d={d}
          onChanged={refresh}
          variant="operating"
        />
      )}
      {tab === "payroll" && (
        <RecurringExpensesTable d={d} onChanged={refresh} variant="payroll" />
      )}
      {tab === "planning" && <PlanningSection d={d} onChanged={refresh} />}
      {tab === "budgets" && (
        <CategoriesTable status={budgetStatus} onChanged={refresh} />
      )}
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

function StatCard({
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
      <CardHeader className="flex-row items-center justify-between">
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
              d.recurringClients.map((c) => {
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
                      {c.isActive ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <ClientDialog mode="edit" client={c} d={d} onSaved={onChanged} />
                      <DeleteAlert
                        title={`Remove ${c.name}?`}
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
      <CardHeader className="flex-row items-center justify-between">
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
        <CardHeader className="flex-row items-center justify-between">
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
      <CardHeader className="flex-row items-center justify-between">
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

function DeleteAlert({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description?: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
