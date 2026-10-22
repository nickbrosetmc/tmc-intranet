// Renewal dates and the reminders ahead of them. Shared by the Finance page
// and the daily reminder job in functions/, so the date the team sees and the
// date the email names can't disagree. Relative imports only, for that reason.
//
//   §3.3  A 6- or 12-month term renews automatically for the same length,
//         counted from the start of the agreement. Month-to-month has no
//         renewal date.
//   §3.5  The client can prevent a renewal with notice at least 30 days
//         before it.
//   §4.4  A rate change needs 30 days notice before a Renewal Date.
//   §1.4  The then-current Terms go to the client no later than 30 days
//         before the Renewal Date.
//
// So 30 days out is the last day to act, and the 45-day reminder leaves two
// weeks to prepare.

import { NOTICE_DAYS, addDays, addMonths, parseYmd, toYmd } from "./agreement";

/** Terms that renew automatically. 0 (month-to-month) never does. */
export const RENEWING_TERMS = [6, 12];

/** Days before a renewal that a reminder goes out, earliest first. */
export const REMINDER_DAYS = [45, 30] as const;
export type ReminderKind = (typeof REMINDER_DAYS)[number];

/** The first renewal on or after `today`, or null if the term doesn't renew. */
export function nextRenewal(
  signedDate: string | null,
  termMonths: number | null,
  today: string,
): string | null {
  if (!signedDate || termMonths == null || !RENEWING_TERMS.includes(termMonths)) return null;
  const start = parseYmd(signedDate);
  const now = parseYmd(today);
  if (!start || !now) return null;
  for (let k = 1; k <= 200; k++) {
    // Always from the original date, so a 31st doesn't drift to the 28th.
    const r = addMonths(start, k * termMonths);
    if (r >= now) return toYmd(r);
  }
  return null;
}

/** Last day to give 30 days notice before `renewal` (§3.5, §4.4, §1.4). */
export function noticeDeadline(renewal: string): string {
  return toYmd(addDays(parseYmd(renewal)!, -NOTICE_DAYS));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseYmd(from)!;
  const b = parseYmd(to)!;
  // Rounded, so a daylight-saving hour either way doesn't shift the count.
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Which reminder, if any, is due for a renewal `daysOut` days away. The
 * 45-day one covers 45 down to 31 days, so a day the job doesn't run is
 * caught the next day; inside 30 days it's the 30-day one. A renewal first
 * recorded inside 30 days gets only the 30-day reminder.
 */
export function reminderDue(daysOut: number): ReminderKind | null {
  if (daysOut < 0) return null;
  if (daysOut <= 30) return 30;
  if (daysOut <= 45) return 45;
  return null;
}
