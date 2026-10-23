// Renewal reminder emails: 45 and 30 days before each retainer client's
// renewal, so there's time to send a rate change, an updated agreement or
// the current Terms before the 30-day notice date. Run once a day by the
// tmc-renewal-reminders Worker (workers/renewal-reminders) through
// /api/cron/daily.
//
// Each sent reminder is logged; a reminder already in the log is never sent
// again, and a send that fails isn't logged, so the next day retries it.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { DB } from "../db";
import { getCalculatorSettings } from "../db";
import { listContentSettings } from "../db/content";
import { recurringClients, renewalReminders, type RecurringClientRow } from "../db/schema";
import { esc, sendEmail, type EmailEnv } from "./email";
import { formatLongDate } from "../../src/lib/agreement";
import {
  RENEWING_TERMS,
  daysBetween,
  nextRenewal,
  noticeDeadline,
  reminderDue,
  type ReminderKind,
} from "../../src/lib/renewal";

export const RECIPIENTS_KEY = "renewal_notify_emails";
const PORTAL_URL = "https://portal.tmctechhub.com/admin/finance/clients";

export interface DueReminder {
  client: RecurringClientRow;
  renewal: string;
  daysOut: number;
  kind: ReminderKind;
}

export async function reminderRecipients(db: DB): Promise<string[]> {
  const settings = await listContentSettings(db);
  return parseEmails(settings[RECIPIENTS_KEY] ?? "");
}

export function parseEmails(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Active, dated, auto-renewing clients with a reminder due today and not yet sent. */
export async function findDueReminders(db: DB, today: string): Promise<DueReminder[]> {
  const clients = await db
    .select()
    .from(recurringClients)
    .where(
      and(
        eq(recurringClients.isActive, true),
        isNotNull(recurringClients.signedDate),
        inArray(recurringClients.termMonths, RENEWING_TERMS),
      ),
    )
    .all();

  const candidates: DueReminder[] = [];
  for (const client of clients) {
    const renewal = nextRenewal(client.signedDate, client.termMonths, today);
    if (!renewal) continue;
    const daysOut = daysBetween(today, renewal);
    const kind = reminderDue(daysOut);
    if (kind) candidates.push({ client, renewal, daysOut, kind });
  }
  if (candidates.length === 0) return [];

  const sent = await db
    .select()
    .from(renewalReminders)
    .where(inArray(renewalReminders.clientId, candidates.map((c) => c.client.id)))
    .all();
  const done = new Set(sent.map((s) => `${s.clientId}|${s.renewalDate}|${s.daysBefore}`));
  return candidates.filter((c) => !done.has(`${c.client.id}|${c.renewal}|${c.kind}`));
}

export interface RunResult {
  today: string;
  dryRun: boolean;
  recipients: string[];
  sent: { client: string; renewal: string; daysBefore: ReminderKind }[];
  failed: { client: string; renewal: string; daysBefore: ReminderKind }[];
}

export async function runRenewalReminders(
  env: EmailEnv,
  db: DB,
  today: string,
  opts: { dryRun?: boolean } = {},
): Promise<RunResult> {
  const dryRun = !!opts.dryRun;
  const [due, recipients, calc] = await Promise.all([
    findDueReminders(db, today),
    reminderRecipients(db),
    getCalculatorSettings(db),
  ]);
  const result: RunResult = { today, dryRun, recipients, sent: [], failed: [] };

  for (const r of due) {
    const item = { client: r.client.name, renewal: r.renewal, daysBefore: r.kind };
    if (dryRun) {
      result.sent.push(item);
      continue;
    }
    const msg = renewalEmail(r, calc.tcVersion);
    const ok = recipients.length > 0 && (await sendEmail(env, { to: recipients, ...msg }));
    if (!ok) {
      result.failed.push(item);
      continue;
    }
    await db
      .insert(renewalReminders)
      .values({
        clientId: r.client.id,
        renewalDate: r.renewal,
        daysBefore: r.kind,
        sentTo: recipients.join(", "),
      })
      .onConflictDoNothing()
      .run();
    result.sent.push(item);
  }
  return result;
}

const TERM_WORDS: Record<number, string> = { 6: "6-month", 12: "12-month" };

export function renewalEmail(
  r: DueReminder,
  tcVersion: string,
  opts: { test?: boolean } = {},
): { subject: string; html: string } {
  const c = r.client;
  const renews = formatLongDate(r.renewal);
  const noticeYmd = noticeDeadline(r.renewal);
  const noticeBy = formatLongDate(noticeYmd);
  const term = TERM_WORDS[c.termMonths ?? 0] ?? "";

  let subject: string;
  let heading: string;
  let lead: string;
  if (r.kind === 45) {
    subject = `${c.name} renews ${renews} (${r.daysOut} days)`;
    heading = `${c.name} renews in ${r.daysOut} days`;
    lead =
      `Their ${term} agreement renews on ${renews}. If anything should change at renewal ` +
      `(rate, scope, or term), the client needs written notice by ${noticeBy}, ` +
      `30 days before the renewal date (Terms §4.4).`;
  } else if (r.daysOut === 30) {
    subject = `Notice due today: ${c.name} renews ${renews}`;
    heading = `Last day to give ${c.name} notice`;
    lead =
      `Their ${term} agreement renews on ${renews}, 30 days from today. Today is the ` +
      `last day to give written notice of any change for this renewal (Terms §4.4).`;
  } else {
    subject = `${c.name} renews ${renews} (${r.daysOut} days)`;
    heading = `${c.name} renews in ${r.daysOut} days`;
    lead =
      `Their ${term} agreement renews on ${renews}. The 30-day notice date ` +
      `(Terms §4.4) was ${noticeBy}.`;
  }
  if (opts.test) subject = `[Test] ${subject}`;

  // §1.4 shares the 30-day date; only point at it while it's still ahead.
  const termsLine =
    r.daysOut > 30
      ? `The current Terms are version ${tcVersion}. Section 1.4 requires sending them to the client by ${noticeBy} as well.`
      : r.daysOut === 30
        ? `The current Terms are version ${tcVersion}. Section 1.4 requires sending them to the client by today as well.`
        : `The current Terms are version ${tcVersion}.`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#404E5C;font-weight:600">${esc(label)}</td><td>${esc(value)}</td></tr>`;
  const rows = [
    row("Client", c.name),
    row("Monthly", `$${c.monthlyAmount.toLocaleString("en-US")}`),
    row("Term", term ? `${term}, renews automatically` : "Not recorded"),
    row("Signed", formatLongDate(c.signedDate)),
    row("Renews", renews),
    row("Notice by", noticeBy),
  ].join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0E0F19;max-width:560px">
      ${
        opts.test
          ? `<p style="background:#F1F1F0;border-radius:8px;padding:8px 12px;font-size:13px;color:#404E5C;margin:0 0 16px">This is a test of the renewal reminder. Nothing was logged, and the real reminders still go out on schedule.</p>`
          : ""
      }
      <h2 style="margin:0 0 8px">${esc(heading)}</h2>
      <p style="color:#404E5C;margin:0 0 12px;line-height:1.5">${esc(lead)}</p>
      <p style="color:#404E5C;margin:0 0 16px;line-height:1.5">${esc(termsLine)}</p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">${rows}</table>
      <p style="margin-top:16px"><a href="${PORTAL_URL}" style="color:#A8884E;font-weight:600">Open Client lifetime in the portal →</a></p>
    </div>`;

  return { subject, html };
}
