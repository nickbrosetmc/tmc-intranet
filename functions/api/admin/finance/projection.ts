// PATCH /api/admin/finance/projection { projectedRenewals: 0-5 }: how many
// renewals projected lifetime value assumes. Separate from the balance
// endpoint, which stamps a new "as of" date on every save.

import { eq } from "drizzle-orm";
import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { financeSettings } from "../../../db/schema";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as { projectedRenewals?: unknown } | null;
  const n = body?.projectedRenewals;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 5) {
    return Response.json({ error: "Renewals must be a whole number from 0 to 5" }, { status: 400 });
  }
  await getDb(env.DB)
    .update(financeSettings)
    .set({ projectedRenewals: n })
    .where(eq(financeSettings.id, 1))
    .run();
  return Response.json({ ok: true, projectedRenewals: n });
};
