// POST /api/cron/renewal-reminders: sends any renewal reminders due today.
// Called once a day by the tmc-renewal-reminders Worker, which holds the
// same CRON_SECRET; nothing else can trigger it. ?dryRun=1 reports what
// would go out without sending or logging anything.

import type { Env } from "../../lib/auth";
import { getDb } from "../../db";
import { runRenewalReminders, utcToday } from "../../lib/renewalReminders";

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

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await runRenewalReminders(env, getDb(env.DB), utcToday(), { dryRun });
  console.log(JSON.stringify({ level: "info", msg: "renewal_reminders.run", ...result }));
  return Response.json(result);
};

/** Compares without bailing at the first differing character. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
