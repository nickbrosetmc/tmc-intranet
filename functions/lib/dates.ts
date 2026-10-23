/**
 * Today's UTC calendar date. The daily job runs at 13:00 UTC, when it's the
 * same date across the US, so this is "today" for anything it does.
 */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
