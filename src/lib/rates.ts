// A client's monthly rate on any date, from their recorded rate changes.
// Shared by the Finance pages (lifetime value) and functions/ (keeping the
// current rate in step with changes as they take effect), so both read the
// history the same way. Relative imports only, for that reason.

export interface RateChange {
  id: number;
  clientId: number;
  /** YYYY-MM-DD the new rate starts. */
  effectiveDate: string;
  fromAmount: number;
  toAmount: number;
  /** A new term (0, 6 or 12) starting on effectiveDate; null leaves it alone. */
  termMonths: number | null;
  note: string | null;
  createdAt: string;
}

type Change = Pick<RateChange, "id" | "effectiveDate" | "fromAmount" | "toAmount">;

/** Oldest first; two changes on one day apply in the order they were made. */
export function sortChanges<T extends Change>(changes: T[]): T[] {
  return [...changes].sort((a, b) =>
    a.effectiveDate === b.effectiveDate ? a.id - b.id : a.effectiveDate < b.effectiveDate ? -1 : 1,
  );
}

/**
 * The rate on `date`. With no history, the current amount. Before the first
 * change, what it changed from; from then on, the latest change in effect.
 */
export function rateOn(date: string, changes: Change[], currentAmount: number): number {
  if (changes.length === 0) return currentAmount;
  const sorted = sortChanges(changes);
  if (date < sorted[0].effectiveDate) return sorted[0].fromAmount;
  let rate = sorted[0].toAmount;
  for (const c of sorted) {
    if (c.effectiveDate > date) break;
    rate = c.toAmount;
  }
  return rate;
}

/**
 * Where renewals count from: the start of the latest term set by a change in
 * effect on `today`, or the signed date when no change set one. A rate change
 * that leaves the term alone doesn't restart it.
 */
export function termStart<T extends Change & { termMonths: number | null }>(
  signedDate: string | null,
  changes: T[],
  today: string,
): string | null {
  let start = signedDate;
  for (const c of sortChanges(changes)) {
    if (c.effectiveDate > today) break;
    if (c.termMonths != null) start = c.effectiveDate;
  }
  return start;
}

/** The term set by the latest change in effect on `today`, or null if none set one. */
export function termInEffect<T extends Change & { termMonths: number | null }>(
  changes: T[],
  today: string,
): number | null {
  let term: number | null = null;
  for (const c of sortChanges(changes)) {
    if (c.effectiveDate > today) break;
    if (c.termMonths != null) term = c.termMonths;
  }
  return term;
}

/** The latest change in effect on `today`, if any: what the current rate should be. */
export function changeInEffect<T extends Change>(changes: T[], today: string): T | null {
  let found: T | null = null;
  for (const c of sortChanges(changes)) {
    if (c.effectiveDate > today) break;
    found = c;
  }
  return found;
}
