// POST /api/cron/daily: the portal's once-a-day work, run by the
// tmc-renewal-reminders Worker, which holds the same CRON_SECRET; nothing
// else can trigger it.
//   1. Rate changes dated today take effect (so MRR and cash flow move).
//   2. Renewal reminders due today go out.
// ?dryRun=1 reports what the reminders would send without sending or
// logging; rate changes due are still applied, since that's not an email.

import type { Env } from "../../lib/auth";
import { getDb } from "../../db";
import { applyDueRateChanges } from "../../db/rateChanges";
import { utcToday } from "../../lib/dates";
import { runRenewalReminders } from "../../lib/renewalReminders";

interface CronEnv extends Env {
  CRON_SECRET?: string;
}

export const onRequestPost: PagesFunction<CronEnv> = async ({ request, env }) => {
  if (!env.CRON_SECRET) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  const auth = request.headers.get("Authorization") ?? "";
  if (!sameString(auth, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb(env.DB);
  const today = utcToday();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const rateChanges = await applyDueRateChanges(db, today);
  const reminders = await runRenewalReminders(env, db, today, { dryRun });
  const result = { today, rateChanges, reminders };
  console.log(JSON.stringify({ level: "info", msg: "cron.daily", ...result }));
  return Response.json(result);
};

/** Compares without bailing at the first differing character. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
