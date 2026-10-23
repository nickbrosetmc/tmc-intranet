// How long each retainer client has been with us, what they've been worth,
// and the averages across clients. Pure functions; no React.
//
// Lifetime value is an estimate: every billing cycle started between the
// signed date and the last day of service (today, for current clients), each
// at the rate in effect that month (rates.ts), plus one-off invoices logged
// under the same client name, plus a hand-entered adjustment for anything
// the estimate can't see (a comped month, a setup fee). Gross, before
// payment fees, since it's what the client paid.

import { addMonths, parseYmd, toYmd } from "./agreement";
import { nextRenewal, noticeDeadline } from "./renewal";
import { rateOn, termStart, type RateChange } from "./rates";
import type { OneOffInvoice, RecurringClient } from "./finance";

export type LifetimeGap = "no_retainer" | "no_signed_date" | "no_end_date" | "not_started";

export interface ClientLifetime {
  client: RecurringClient;
  /** Why the client is left out of the averages; null when it counts. */
  gap: LifetimeGap | null;
  /** Fractional months from signing through the last day of service. */
  tenureMonths: number | null;
  /** Billing cycles started, the first on the signed date. */
  cyclesBilled: number;
  /** Whether the rate changed over the client's lifetime. */
  rateVaried: boolean;
  /** The rate every cycle was billed at, when it never changed. */
  uniformRate: number | null;
  retainerRevenue: number;
  oneOffRevenue: number;
  adjustment: number;
  ltv: number;
  /** Where renewals count from: the signed date, or a later new term. */
  termStart: string | null;
  nextRenewal: string | null;
  noticeBy: string | null;
}

export function clientLifetime(
  client: RecurringClient,
  invoices: OneOffInvoice[],
  today: string,
  /** Every client's changes, or just this one's; others are ignored. */
  rateChanges: RateChange[] = [],
): ClientLifetime {
  const changes = rateChanges.filter((r) => r.clientId === client.id);
  const key = normalizeName(client.name);
  const oneOffRevenue = invoices
    .filter((i) => normalizeName(i.clientName) === key)
    .reduce((s, i) => s + i.grossAmount, 0);
  const adjustment = client.ltvAdjustment ?? 0;

  const through = client.isActive ? today : client.endedDate;
  let gap: LifetimeGap | null = null;
  // A retainer client is one who has paid monthly at some point, so a
  // client who dropped to $0 still has a lifetime worth counting.
  const everPaid =
    client.monthlyAmount > 0 || changes.some((r) => r.fromAmount > 0 || r.toAmount > 0);
  if (!everPaid) gap = "no_retainer";
  else if (!client.signedDate) gap = "no_signed_date";
  else if (!through) gap = "no_end_date";
  else if (client.signedDate > through) gap = "not_started";

  const dated = !!client.signedDate && !!through && client.signedDate <= through;
  const cycles = dated ? cycleDates(client.signedDate!, through!) : [];
  const rates = cycles.map((date) => rateOn(date, changes, client.monthlyAmount));
  const tenureMonths = dated ? monthsBetween(client.signedDate!, dayAfter(through!)) : null;
  const retainerRevenue = rates.reduce((s, r) => s + r, 0);

  const start = termStart(client.signedDate, changes, today);
  const renewal = client.isActive ? nextRenewal(start, client.termMonths, today) : null;

  return {
    client,
    gap,
    tenureMonths,
    cyclesBilled: cycles.length,
    rateVaried: new Set(rates).size > 1,
    uniformRate: new Set(rates).size === 1 ? rates[0] : null,
    retainerRevenue,
    oneOffRevenue,
    adjustment,
    ltv: Math.max(0, retainerRevenue + oneOffRevenue + adjustment),
    termStart: start,
    nextRenewal: renewal,
    noticeBy: renewal ? noticeDeadline(renewal) : null,
  };
}

export type Segment = "all" | "current" | "past";

export interface LifetimeAverages {
  counted: number;
  /** In the segment but missing something the averages need. */
  missing: number;
  avgLtv: number | null;
  medianLtv: number | null;
  totalLtv: number;
  avgTenure: number | null;
  medianTenure: number | null;
}

export function inSegment(l: ClientLifetime, segment: Segment): boolean {
  if (segment === "current") return l.client.isActive;
  if (segment === "past") return !l.client.isActive;
  return true;
}

export function lifetimeAverages(rows: ClientLifetime[], segment: Segment): LifetimeAverages {
  const seg = rows.filter((r) => inSegment(r, segment));
  // Clients with no retainer (TMC's own account, say) aren't clients the
  // averages are about, so they don't count as missing either.
  const relevant = seg.filter((r) => r.gap !== "no_retainer");
  const counted = relevant.filter((r) => r.gap === null);
  const ltvs = counted.map((r) => r.ltv);
  const tenures = counted.map((r) => r.tenureMonths ?? 0);
  return {
    counted: counted.length,
    missing: relevant.length - counted.length,
    avgLtv: mean(ltvs),
    medianLtv: median(ltvs),
    totalLtv: ltvs.reduce((s, v) => s + v, 0),
    avgTenure: mean(tenures),
    medianTenure: median(tenures),
  };
}

/** "1 yr 3 mo", "8 mo", "2 yrs", "< 1 mo". */
export function formatTenure(months: number | null): string {
  if (months == null) return "—";
  if (months < 1) return "< 1 mo";
  const whole = Math.floor(months);
  const y = Math.floor(whole / 12);
  const m = whole % 12;
  const yrs = y === 0 ? "" : y === 1 ? "1 yr" : `${y} yrs`;
  const mos = m === 0 ? "" : `${m} mo`;
  return [yrs, mos].filter(Boolean).join(" ");
}

/** The start date of each billing cycle on or before `through`. */
function cycleDates(start: string, through: string): string[] {
  const s = parseYmd(start)!;
  const t = parseYmd(through)!;
  const dates: string[] = [];
  for (let n = 0; addMonths(s, n) <= t; n++) dates.push(toYmd(addMonths(s, n)));
  return dates;
}

/** Fractional months from `from` to `to` (exclusive), calendar-aware. */
export function monthsBetween(from: string, to: string): number {
  const a = parseYmd(from)!;
  const b = parseYmd(to)!;
  let whole = 0;
  while (addMonths(a, whole + 1) <= b) whole++;
  const lo = addMonths(a, whole);
  const hi = addMonths(a, whole + 1);
  return whole + (b.getTime() - lo.getTime()) / (hi.getTime() - lo.getTime());
}

function dayAfter(ymd: string): string {
  const d = parseYmd(ymd)!;
  d.setDate(d.getDate() + 1);
  return toYmd(d);
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
