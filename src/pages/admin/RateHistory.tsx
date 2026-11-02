// A client's rate history on their profile: what they've paid over time.
// Changes are recorded in TMC Finance now and show here.

import { ArrowRight } from "lucide-react";
import { fmtMoney, type RecurringClient } from "@/lib/finance";
import { sortChanges, type RateChange } from "@/lib/rates";
import { todayYmd } from "@/lib/tasks";
import { fmtLongDay } from "@/pages/admin/ProjectParts";

export function RateHistoryList({ client, changes }: { client: RecurringClient; changes: RateChange[] }) {
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
        </li>
      ))}
    </ul>
  );
}

const TERM_WORDS: Record<number, string> = {
  0: "month-to-month",
  6: "6-month term",
  12: "12-month term",
};

