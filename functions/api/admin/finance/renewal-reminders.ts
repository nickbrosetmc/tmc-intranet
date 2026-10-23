// Admin: who renewal reminders go to, what's been sent, and a test send.
//   GET   → { recipients, recent }
//   PUT   { recipients: "a@x.com, b@y.com" }
//   POST  sends a test reminder to the recipients (nothing is logged)

import { desc, eq } from "drizzle-orm";
import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getCalculatorSettings, getDb } from "../../../db";
import { setContentSetting } from "../../../db/content";
import { recurringClients, renewalReminders } from "../../../db/schema";
import { sendEmail } from "../../../lib/email";
import {
  RECIPIENTS_KEY,
  parseEmails,
  reminderRecipients,
  renewalEmail,
} from "../../../lib/renewalReminders";
import { utcToday } from "../../../lib/dates";
import { daysBetween, nextRenewal } from "../../../../src/lib/renewal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const [recipients, recent] = await Promise.all([
    reminderRecipients(db),
    db
      .select({
        clientName: recurringClients.name,
        renewalDate: renewalReminders.renewalDate,
        daysBefore: renewalReminders.daysBefore,
        sentAt: renewalReminders.sentAt,
      })
      .from(renewalReminders)
      .innerJoin(recurringClients, eq(recurringClients.id, renewalReminders.clientId))
      .orderBy(desc(renewalReminders.sentAt))
      .limit(5)
      .all(),
  ]);
  return Response.json({ recipients: recipients.join(", "), recent });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as { recipients?: unknown } | null;
  if (!body || typeof body.recipients !== "string") {
    return Response.json({ error: "recipients must be a string" }, { status: 400 });
  }
  const emails = parseEmails(body.recipients);
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) return Response.json({ error: `Not an email address: ${bad}` }, { status: 400 });
  await setContentSetting(getDb(env.DB), RECIPIENTS_KEY, emails.length ? emails.join(", ") : null);
  return Response.json({ ok: true, recipients: emails.join(", ") });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const [recipients, calc, clients] = await Promise.all([
    reminderRecipients(db),
    getCalculatorSettings(db),
    db.select().from(recurringClients).where(eq(recurringClients.isActive, true)).all(),
  ]);
  if (recipients.length === 0) {
    return Response.json({ error: "Add an email address to send reminders to first" }, { status: 400 });
  }
  if (!env.RESEND_API_KEY) {
    return Response.json({ error: "Email isn't configured (RESEND_API_KEY)" }, { status: 503 });
  }

  // Preview with the next client to renew, so the test shows real figures.
  const today = utcToday();
  const soonest = clients
    .map((client) => ({ client, renewal: nextRenewal(client.signedDate, client.termMonths, today) }))
    .filter((x): x is { client: typeof x.client; renewal: string } => x.renewal != null)
    .sort((a, b) => a.renewal.localeCompare(b.renewal))[0];
  if (!soonest) {
    return Response.json(
      { error: "Add a signed date and a 6- or 12-month term to a client first" },
      { status: 400 },
    );
  }
  const msg = renewalEmail(
    { ...soonest, daysOut: daysBetween(today, soonest.renewal), kind: 45 },
    calc.tcVersion,
    { test: true },
  );
  const ok = await sendEmail(env, { to: recipients, ...msg });
  if (!ok) return Response.json({ error: "The email didn't send. Check the Resend logs." }, { status: 502 });
  return Response.json({ ok: true, sentTo: recipients });
};
