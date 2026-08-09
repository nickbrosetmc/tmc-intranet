// Engagement terms for a proposal, and the dates the Terms and Conditions
// derive from them. Pure functions; no React.
//
// Every date rule here traces to a numbered section of the Terms so the
// generated Schedule A cannot quietly drift from the contract:
//
//   §3.1  Initial Term is 6 or 12 months, or month-to-month
//   §3.2  Month-to-month requires a non-refundable Setup Fee of one month
//   §3.3  Automatic renewal for a successive term of the same length
//   §3.4  All cancellation requires 30 days written notice
//   §3.5  Penalty-free window: 30 days after each Renewal Date. Renewal can
//         also be prevented by notice at least 30 days BEFORE that date
//   §3.6  Early Termination Fee: greater of 50% of the remaining monthly
//         fees after the notice period, or 2 months of retainer
//   §4.4  Rate changes need 30 days notice before a Renewal Date
//   §1.4  The then-current Terms version is provided no later than 30 days
//         before the Renewal Date
//   §7.2  Content is deemed approved after 3 business days by default
//   §8    Six-Month Performance Review is 12-month terms only, requested
//         within 5 business days of the six-month mark

export const TC_VERSION = "2026.1";
export const TC_EFFECTIVE = "August 3, 2026";
export const NOTICE_DAYS = 30;
export const DEFAULT_APPROVAL_DAYS = 3;

export type TermLength = "6" | "12" | "mtm";

export const TERM_OPTIONS: { id: TermLength; label: string; months: number }[] = [
  { id: "6", label: "6 months", months: 6 },
  { id: "12", label: "12 months", months: 12 },
  { id: "mtm", label: "Month-to-month", months: 0 },
];

export interface EngagementTerms {
  clientLegalName: string;
  locationEntity: string;
  signerName: string;
  signerTitle: string;
  billingContact: string;
  billingEmail: string;
  noticeEmail: string;
  /** YYYY-MM-DD. Empty means "date of first payment" under §2. */
  startDate: string;
  termLength: TermLength;
  rawFileAccess: boolean;
  approvalWindowDays: number;
  personalGuarantee: boolean;
  guarantorName: string;
}

export const DEFAULT_TERMS: EngagementTerms = {
  clientLegalName: "",
  locationEntity: "",
  signerName: "",
  signerTitle: "",
  billingContact: "",
  billingEmail: "",
  noticeEmail: "",
  startDate: "",
  termLength: "12",
  rawFileAccess: true,
  approvalWindowDays: DEFAULT_APPROVAL_DAYS,
  personalGuarantee: false,
  guarantorName: "",
};

export function termMonths(t: TermLength): number {
  return TERM_OPTIONS.find((o) => o.id === t)?.months ?? 0;
}

export function termLabel(t: TermLength): string {
  return TERM_OPTIONS.find((o) => o.id === t)?.label ?? String(t);
}

// ─── Date helpers ─────────────────────────────────────────────────────────
// All parsing is local-time from YYYY-MM-DD. Using `new Date(str)` would
// parse as UTC and shift the date backwards for anyone west of Greenwich,
// which on a contract date is not a rounding error.

export function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Add whole months, clamping to the end of the target month. A term starting
 * Jan 31 renews Jul 31, and a 1-month step from Jan 31 lands on Feb 28, not
 * Mar 3 the way naive setMonth() would.
 */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Skips weekends. Holidays are not modelled; §7.4 excludes them separately. */
export function addBusinessDays(d: Date, days: number): Date {
  const x = new Date(d);
  let left = days;
  while (left > 0) {
    x.setDate(x.getDate() + 1);
    const day = x.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return x;
}

export function formatLongDate(ymd: string | null): string {
  const d = ymd ? parseYmd(ymd) : null;
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Derived dates and amounts ────────────────────────────────────────────

export interface DerivedAgreement {
  /** §3.3 End of the Initial Term. Null on month-to-month. */
  renewalDate: string | null;
  /** §3.5 Last day to give notice that prevents the renewal entirely. */
  nonRenewalNoticeBy: string | null;
  /** §3.5 End of the penalty-free window after the Renewal Date. */
  penaltyFreeWindowEnds: string | null;
  /** §1.4 / §4.4 Date TMC must have sent version and rate notices by. */
  renewalNoticeDueBy: string | null;
  /** §8 Six-month mark; null unless this is a 12-month term. */
  sixMonthMark: string | null;
  /** §8 Deadline to request the review: 5 business days after the mark. */
  sixMonthRequestBy: string | null;
  /** §3.2 Non-refundable, month-to-month only, equal to one month. */
  setupFee: number;
  /** §3.6 (b) The floor on the Early Termination Fee. */
  earlyTerminationFloor: number;
  /** True where §8 applies at all. */
  sixMonthReviewEligible: boolean;
}

export function deriveAgreement(
  terms: EngagementTerms,
  monthlyRetainer: number,
): DerivedAgreement {
  const months = termMonths(terms.termLength);
  const isMtm = terms.termLength === "mtm";
  const start = parseYmd(terms.startDate);
  const retainer = Math.max(0, Math.round(monthlyRetainer));

  const renewal = start && !isMtm ? addMonths(start, months) : null;
  const sixMonthEligible = terms.termLength === "12";
  const sixMark = start && sixMonthEligible ? addMonths(start, 6) : null;

  return {
    renewalDate: renewal ? toYmd(renewal) : null,
    nonRenewalNoticeBy: renewal ? toYmd(addDays(renewal, -NOTICE_DAYS)) : null,
    penaltyFreeWindowEnds: renewal ? toYmd(addDays(renewal, NOTICE_DAYS)) : null,
    renewalNoticeDueBy: renewal ? toYmd(addDays(renewal, -NOTICE_DAYS)) : null,
    sixMonthMark: sixMark ? toYmd(sixMark) : null,
    sixMonthRequestBy: sixMark ? toYmd(addBusinessDays(sixMark, 5)) : null,
    setupFee: isMtm ? retainer : 0,
    earlyTerminationFloor: retainer * 2,
    sixMonthReviewEligible: sixMonthEligible,
  };
}

/**
 * §3.6 Early Termination Fee if notice were given today: the greater of half
 * the monthly fees left in the term after the notice period, or two months.
 * Returns null where it cannot be computed (no start date, or month-to-month,
 * which has no term to break).
 */
export function earlyTerminationFee(
  terms: EngagementTerms,
  monthlyRetainer: number,
  asOf: Date = new Date(),
): { fee: number; monthsRemaining: number } | null {
  const start = parseYmd(terms.startDate);
  const months = termMonths(terms.termLength);
  if (!start || months === 0) return null;

  const end = addMonths(start, months);
  const noticeEnds = addDays(asOf, NOTICE_DAYS);
  if (noticeEnds >= end) return { fee: 0, monthsRemaining: 0 };

  // Whole months left between the end of the notice period and term end.
  let monthsRemaining = 0;
  let cursor = addMonths(noticeEnds, 1);
  while (cursor <= end) {
    monthsRemaining += 1;
    cursor = addMonths(cursor, 1);
  }
  const retainer = Math.max(0, Math.round(monthlyRetainer));
  const half = Math.round(retainer * monthsRemaining * 0.5);
  return { fee: Math.max(half, retainer * 2), monthsRemaining };
}

/** Schedule A rows, in the order the signed document lists them. */
export function scheduleARows(
  terms: EngagementTerms,
  monthlyRetainer: number,
  derived: DerivedAgreement,
  services: string[],
): { field: string; entry: string }[] {
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return [
    { field: "Client legal name", entry: terms.clientLegalName || "—" },
    { field: "Location or entity (if multi-location)", entry: terms.locationEntity || "—" },
    {
      field: "Authorized signer and title",
      entry: [terms.signerName, terms.signerTitle].filter(Boolean).join(", ") || "—",
    },
    {
      field: "Billing contact and email",
      entry: [terms.billingContact, terms.billingEmail].filter(Boolean).join(" · ") || "—",
    },
    { field: "Notice email on file", entry: terms.noticeEmail || "—" },
    {
      field: "Start Date",
      entry: terms.startDate
        ? formatLongDate(terms.startDate)
        : "Date of first payment (Section 2)",
    },
    { field: "Initial Term", entry: termLabel(terms.termLength) },
    {
      field: "Renewal Date",
      entry: derived.renewalDate
        ? formatLongDate(derived.renewalDate)
        : "Not applicable (month-to-month)",
    },
    { field: "Monthly retainer", entry: money(monthlyRetainer) },
    {
      field: "Setup Fee (month-to-month only, non-refundable)",
      entry: derived.setupFee > 0 ? money(derived.setupFee) : "Not applicable",
    },
    { field: "Services included", entry: services.length ? services.join("; ") : "—" },
    {
      field: "Six-Month Performance Review eligible",
      entry: derived.sixMonthReviewEligible ? "Yes (12-month term)" : "No",
    },
    {
      field: "Raw and Source File access during term",
      entry: terms.rawFileAccess ? "Yes" : "No",
    },
    {
      field: "Content approval window (Section 7.2)",
      entry: `${terms.approvalWindowDays} business days${
        terms.approvalWindowDays === DEFAULT_APPROVAL_DAYS ? " (default)" : ""
      }`,
    },
    {
      field: "Personal Guarantee required (Section 15)",
      entry: terms.personalGuarantee ? "Yes" : "No",
    },
    {
      field: "Guarantor name (if yes)",
      entry: terms.personalGuarantee ? terms.guarantorName || "—" : "Not applicable",
    },
    { field: "Terms and Conditions version governing", entry: `Version ${TC_VERSION}` },
  ];
}
