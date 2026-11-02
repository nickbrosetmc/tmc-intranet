// Once a day, asks the portal to do its daily work: apply rate changes that
// take effect today and send any renewal reminders that are due.
//
// Pages Functions can't run on a schedule, so this Worker supplies the clock
// and the portal does the work (functions/api/cron/daily.ts), with its own
// database and email setup. CRON_SECRET is shared with the portal.

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
  const res = await fetch(`${env.PORTAL_URL}/api/cron/daily`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(JSON.stringify({ msg: "cron.daily", status: res.status, body }));
  // Throwing marks the run failed in the Worker's cron history.
  if (!res.ok) throw new Error(`Portal returned ${res.status}`);
}
