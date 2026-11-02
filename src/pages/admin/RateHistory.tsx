// A client's rate history on their profile: what they've paid over time,
// and recording a change (including one that happened before it was
// entered, like a client who already moved to a lower plan).

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { finance, fmtMoney, type RecurringClient } from "@/lib/finance";
import { rateOn, sortChanges, type RateChange } from "@/lib/rates";
import { todayYmd } from "@/lib/tasks";
import { DeleteAlert, TermSelect } from "@/pages/admin/AdminFinance";
import { fmtLongDay } from "@/pages/admin/ProjectParts";

export function RateHistoryList({
  client,
  changes,
  onChanged,
}: {
  client: RecurringClient;
  changes: RateChange[];
  onChanged: () => void;
}) {
  const today = todayYmd();
  const oldestFirst = sortChanges(changes);
  // "From" is what they were paying just before: the change before this one,
  // which stays right even when a change is recorded out of order. Only the
  // first change's own from_amount says what they started on.
  const shown = oldestFirst.map((c, i) => ({
    ...c,
    previous: i === 0 ? c.fromAmount : oldestFirst[i - 1].toAmount,
  }));
  const newestFirst = shown.reverse();

  if (newestFirst.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-1">
        No changes recorded, so lifetime value counts every month at{" "}
        {fmtMoney(client.monthlyAmount)}. If what they pay changed, record it here so each month
        counts at the rate they actually paid.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {newestFirst.map((c) => (
        <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {c.previous !== c.toAmount ? (
                <>
                  <span className="tabular-nums text-muted-foreground line-through decoration-muted-foreground/50">
                    {fmtMoney(c.previous)}
                  </span>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <span className="tabular-nums font-medium text-tmc-dark">{fmtMoney(c.toAmount)}/mo</span>
                </>
              ) : (
                <span className="font-medium text-tmc-dark">Same rate</span>
              )}
              {c.termMonths != null && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-tmc-slate px-1.5 py-0.5 rounded">
                  {TERM_WORDS[c.termMonths]}
                </span>
              )}
              <span className="text-muted-foreground">
                {c.effectiveDate > today ? "from" : "since"} {fmtLongDay(c.effectiveDate)}
              </span>
              {c.effectiveDate > today && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-tmc-gold/30 text-tmc-dark px-1.5 py-0.5 rounded">
                  scheduled
                </span>
              )}
            </div>
            {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
          </div>
          <DeleteAlert
            title="Delete this change?"
            description="Corrects the history lifetime value is counted from. The client's current rate stays as it is."
            trigger={
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-700 shrink-0" aria-label="Delete change">
                <Trash2 size={13} />
              </Button>
            }
            onConfirm={async () => {
              await finance.deleteRateChange(client.id, c.id);
              toast.success("Change deleted");
              onChanged();
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function RecordRateChangeDialog({
  client,
  changes,
  onSaved,
}: {
  client: RecurringClient;
  changes: RateChange[];
  onSaved: () => void;
}) {
  const wasOn = (date: string) => rateOn(dayBefore(date), changes, client.monthlyAmount);
  const blank = () => {
    const today = todayYmd();
    return {
      effectiveDate: today,
      fromAmount: wasOn(today),
      toAmount: client.monthlyAmount,
      termMonths: null as number | null,
      note: "",
      fromTouched: false,
    };
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.effectiveDate) {
      toast.error("Pick the date the change took effect");
      return;
    }
    if (form.fromAmount === form.toAmount && form.termMonths == null) {
      toast.error("Nothing changes: same amount, and no new term");
      return;
    }
    setSaving(true);
    try {
      await finance.recordRateChange(client.id, {
        effectiveDate: form.effectiveDate,
        fromAmount: form.fromAmount,
        toAmount: form.toAmount,
        termMonths: form.termMonths,
        note: form.note || null,
      });
      toast.success("Change recorded");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Couldn't record it: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank());
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus size={14} /> Record a change
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a rate change</DialogTitle>
          <DialogDescription>
            For when what {client.name} pays changes, or already changed. Months before the date
            count at the old amount in lifetime value; from then on, the new one.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Takes effect</Label>
            <Input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => {
                const effectiveDate = e.target.value;
                setForm({
                  ...form,
                  effectiveDate,
                  // Follow the date until the amount is typed over.
                  fromAmount: form.fromTouched || !effectiveDate ? form.fromAmount : wasOn(effectiveDate),
                });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Was paying ($/mo)</Label>
            <Input
              type="number"
              min={0}
              value={form.fromAmount}
              onChange={(e) =>
                setForm({ ...form, fromAmount: Number(e.target.value) || 0, fromTouched: true })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Now pays ($/mo)</Label>
            <Input
              type="number"
              min={0}
              value={form.toAmount}
              onChange={(e) => setForm({ ...form, toAmount: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>New term</Label>
            <TermSelect
              value={form.termMonths}
              onChange={(termMonths) => setForm({ ...form, termMonths })}
              emptyLabel="No change"
            />
            <p className="text-xs text-muted-foreground">
              Setting one starts a new term on this date, so renewals count from it.
              {client.termMonths != null && ` Now: ${TERM_WORDS[client.termMonths]}.`}
            </p>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>What changed</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="e.g. Cancelled social and SEO, hosting only"
            />
          </div>
          {form.effectiveDate <= todayYmd() && form.toAmount !== client.monthlyAmount && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Their current rate will change to {fmtMoney(form.toAmount)} a month, unless a later
              change is already recorded.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Record change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TERM_WORDS: Record<number, string> = {
  0: "month-to-month",
  6: "6-month term",
  12: "12-month term",
};

function dayBefore(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
