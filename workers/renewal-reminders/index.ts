// Once a day, asks the portal to send any renewal reminders that are due.
//
// Pages Functions can't run on a schedule, so this Worker supplies the clock
// and the portal does the work (functions/lib/renewalReminders.ts), with its
// own database and email setup. CRON_SECRET is shared with the portal.

interface Env {
  PORTAL_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env));
  },
} satisfies ExportedHandler<Env>;

async function run(env: Env): Promise<void> {
  const res = await fetch(`${env.PORTAL_URL}/api/cron/renewal-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(JSON.stringify({ msg: "renewal_reminders", status: res.status, body }));
  // Throwing marks the run failed in the Worker's cron history.
  if (!res.ok) throw new Error(`Portal returned ${res.status}`);
}
