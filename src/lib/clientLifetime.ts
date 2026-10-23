// How long each retainer client has been with us, what they've been worth,
// and the averages across clients. Pure functions; no React.
//
// Lifetime value is an estimate: every billing cycle started between the
// signed date and the last day of service (today, for current clients), each
// at the rate in effect that month (rates.ts), plus the client's projects at
// their price (or, without one, what their linked invoices add up to), plus
// one-off invoices under the client's name that aren't for a project, plus a
// hand-entered adjustment for anything the estimate can't see (a comped
// month, a setup fee). Gross, before payment fees, since it's what the
// client paid.

import { addMonths, parseYmd, toYmd } from "./agreement";
import { nextRenewal, noticeDeadline } from "./renewal";
import { rateOn, termStart, type RateChange } from "./rates";
import type { OneOffInvoice, RecurringClient } from "./finance";
import type { ClientProject } from "./projects";

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
  /** The client's projects: each at its price, or its linked invoices. */
  projectRevenue: number;
  /** One-off invoices under the client's name not paying for a project. */
  invoiceRevenue: number;
  /** projectRevenue + invoiceRevenue. */
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
  /** Every client's projects, or just this one's; others are ignored. */
  projects: ClientProject[] = [],
): ClientLifetime {
  const changes = rateChanges.filter((r) => r.clientId === client.id);
  const key = normalizeName(client.name);
  // A project counts once at its price; invoices paying for it don't add to
  // that. Without a price, it's worth what its invoices add up to.
  const projectRevenue = projects
    .filter((p) => p.clientId === client.id)
    .reduce(
      (s, p) =>
        s +
        (p.price ??
          invoices.filter((i) => i.projectId === p.id).reduce((t, i) => t + i.grossAmount, 0)),
      0,
    );
  const invoiceRevenue = invoices
    .filter((i) => i.projectId == null && normalizeName(i.clientName) === key)
    .reduce((s, i) => s + i.grossAmount, 0);
  const oneOffRevenue = projectRevenue + invoiceRevenue;
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
    projectRevenue,
    invoiceRevenue,
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
  /** In the segment but missing a date the averages need. */
  missing: number;
  /** Who those are, for saying so. */
  missingNames: string[];
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
  // averages are about, and one signed to start later has its dates but no
  // history yet: neither is missing anything.
  const relevant = seg.filter((r) => r.gap !== "no_retainer" && r.gap !== "not_started");
  const counted = relevant.filter((r) => r.gap === null);
  const missingRows = relevant.filter((r) => r.gap !== null);
  const ltvs = counted.map((r) => r.ltv);
  const tenures = counted.map((r) => r.tenureMonths ?? 0);
  return {
    counted: counted.length,
    missing: missingRows.length,
    missingNames: missingRows.map((r) => r.client.name),
    avgLtv: mean(ltvs),
    medianLtv: median(ltvs),
    totalLtv: ltvs.reduce((s, v) => s + v, 0),
    avgTenure: mean(tenures),
    medianTenure: median(tenures),
  };
}

export type ProjectionBasis =
  /** Has left: the projection is what they were actually worth. */
  | "final"
  /** A 6- or 12-month term: the rest of it, then renewals of the same length. */
  | "term"
  /** Month-to-month: nothing contracted; each renewal assumed is a year. */
  | "month_to_month"
  /** Current, but no term recorded, so nothing to project from. */
  | "no_term";

export interface LifetimeProjection {
  basis: ProjectionBasis;
  /** Value to date plus the rest of the current term. */
  contracted: number;
  /** Last day the current term covers; null when nothing is contracted. */
  contractedThrough: string | null;
  /** Contracted plus the renewals assumed. */
  projected: number;
  /** Last day the projection covers. */
  projectedThrough: string | null;
}

/** Months each assumed renewal adds for a month-to-month client. */
export const MONTH_TO_MONTH_RENEWAL_MONTHS = 12;

/**
 * Where a client's lifetime value is headed if they stay: the rest of the
 * current term is contracted (Terms §3.3 renews it for the same length), and
 * `renewals` more terms are assumed on top. Future months are valued at the
 * rate in effect then, so a scheduled change counts from its date. Null for
 * clients the averages leave out (no retainer, or missing dates).
 */
export function projectLifetime(
  l: ClientLifetime,
  today: string,
  renewals: number,
  rateChanges: RateChange[] = [],
): LifetimeProjection | null {
  const c = l.client;
  if (l.gap === "no_retainer" || l.gap === "no_signed_date" || l.gap === "no_end_date") return null;
  if (!c.isActive) {
    return { basis: "final", contracted: l.ltv, contractedThrough: c.endedDate, projected: l.ltv, projectedThrough: c.endedDate };
  }
  const changes = rateChanges.filter((r) => r.clientId === c.id);
  // Billing cycles still to come, valued at the rate in effect on each.
  const future = (end: string, inclusive: boolean) => {
    const start = parseYmd(c.signedDate!)!;
    let total = 0;
    for (let k = 0; k < 1200; k++) {
      const date = toYmd(addMonths(start, k));
      if (inclusive ? date > end : date >= end) break;
      if (date > today) total += rateOn(date, changes, c.monthlyAmount);
    }
    return total;
  };
  const dayBefore = (ymd: string) => {
    const d = parseYmd(ymd)!;
    d.setDate(d.getDate() - 1);
    return toYmd(d);
  };

  if (c.termMonths === 0) {
    const end = toYmd(addMonths(parseYmd(today)!, renewals * MONTH_TO_MONTH_RENEWAL_MONTHS));
    return {
      basis: "month_to_month",
      contracted: l.ltv,
      contractedThrough: null,
      projected: l.ltv + (renewals > 0 ? future(end, true) : 0),
      projectedThrough: renewals > 0 ? end : null,
    };
  }
  if (!l.nextRenewal || c.termMonths == null) {
    return { basis: "no_term", contracted: l.ltv, contractedThrough: null, projected: l.ltv, projectedThrough: null };
  }
  const projectedEnd = toYmd(addMonths(parseYmd(l.nextRenewal)!, renewals * c.termMonths));
  const contracted = l.ltv + future(l.nextRenewal, false);
  return {
    basis: "term",
    contracted,
    contractedThrough: dayBefore(l.nextRenewal),
    projected: l.ltv + future(projectedEnd, false),
    projectedThrough: dayBefore(projectedEnd),
  };
}

/** Average projected value across the clients that have a projection. */
export function averageProjected(
  rows: ClientLifetime[],
  segment: Segment,
  today: string,
  renewals: number,
  rateChanges: RateChange[] = [],
): { average: number | null; counted: number; noTerm: number } {
  const projections = rows
    .filter((r) => inSegment(r, segment))
    .map((r) => projectLifetime(r, today, renewals, rateChanges))
    .filter((p): p is LifetimeProjection => p != null);
  const usable = projections.filter((p) => p.basis !== "no_term");
  return {
    average: mean(usable.map((p) => p.projected)),
    counted: usable.length,
    noTerm: projections.length - usable.length,
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
