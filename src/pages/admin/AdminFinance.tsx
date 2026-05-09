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

  if (!d) {
    return <div className="text-muted-foreground text-sm">Loading finance…</div>;
  }

  const endBalance = projection.length > 0 ? projection[projection.length - 1].balance : startBalance;
  const lowestPoint = projection.length > 0 ? Math.min(...projection.map((p) => p.balance)) : startBalance;

  return (
    <>
      <div className="space-y-6 print:hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            Recurring revenue, expenses, gear, and cashflow projection.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker value={monthIso} onChange={setMonthIso} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Save the full report as PDF via your browser's print dialog"
          >
            Export PDF
          </Button>
        </div>
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
          subtitle={
            summary!.oneOffNetThisMonth > 0
              ? `+ ${fmtMoney(summary!.oneOffNetThisMonth)} one-off this month`
              : summary!.mrrGross !== summary!.mrrNet
                ? `gross ${fmtMoney(summary!.mrrGross)}`
                : "after fees"
          }
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
        <div className="space-y-4">
          <RecurringClientsTable d={d} onChanged={refresh} />
          <OneOffInvoicesTable d={d} onChanged={refresh} />
        </div>
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
    {summary && (
      <PrintableReport
        d={d}
        monthIso={monthIso}
        startBalance={startBalance}
        summary={summary}
        projection={projection}
        budgetStatus={budgetStatus}
      />
    )}
    </>
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
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">One-off invoices</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Project work, ad-hoc charges — anything outside a monthly retainer.
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
              <TableHead>Payout</TableHead>
              <TableHead className="text-right">Net received</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
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
                <TableCell colSpan={4}>Total received</TableCell>
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
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: invoice?.clientName ?? "",
    grossAmount: invoice?.grossAmount ?? 0,
    paymentMethodId: invoice?.paymentMethodId ?? null,
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
    if (!form.payoutDate && !form.instantPayout) {
      toast.error("Payout date required (or check Instant payout)");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientName: form.clientName,
        grossAmount: form.grossAmount,
        paymentMethodId: form.paymentMethodId,
        // When instant, payout date is "today" — money lands the same day
        payoutDate: form.instantPayout ? today : form.payoutDate,
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
              (subtracts {pm ? `${(pm.instantPayoutPct * 100).toFixed(1)}%` : "1%"} from net; payout dated today)
            </span>
          </label>

          {!form.instantPayout && (
            <div className="space-y-1.5 col-span-2">
              <Label>Payout date</Label>
              <Input
                type="date"
                value={form.payoutDate}
                onChange={(e) => setForm({ ...form, payoutDate: e.target.value })}
              />
            </div>
          )}

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
                headers={["Client", "Gross", "Method", "Payout", "Net"]}
                rows={invoicesThisMonth.map((i) => {
                  const pm = i.paymentMethodId != null ? pmById.get(i.paymentMethodId) ?? null : null;
                  return [
                    i.clientName + (i.instantPayout ? " (instant)" : ""),
                    fmtMoney(i.grossAmount),
                    pm?.name ?? "—",
                    i.payoutDate,
                    fmtMoney(invoiceNetAmount(i.grossAmount, pm, i.instantPayout)),
                  ];
                })}
                align={["left", "right", "left", "left", "right"]}
              />
            </>
          )}
          {otherInvoices.length > 0 && (
            <>
              <PrintSubheading>Other months</PrintSubheading>
              <PrintTable
                headers={["Client", "Gross", "Method", "Payout", "Net"]}
                rows={otherInvoices.map((i) => {
                  const pm = i.paymentMethodId != null ? pmById.get(i.paymentMethodId) ?? null : null;
                  return [
                    i.clientName + (i.instantPayout ? " (instant)" : ""),
                    fmtMoney(i.grossAmount),
                    pm?.name ?? "—",
                    i.payoutDate,
                    fmtMoney(invoiceNetAmount(i.grossAmount, pm, i.instantPayout)),
                  ];
                })}
                align={["left", "right", "left", "left", "right"]}
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
