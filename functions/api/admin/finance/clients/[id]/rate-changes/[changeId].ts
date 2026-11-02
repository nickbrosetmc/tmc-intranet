// DELETE /api/admin/finance/clients/:id/rate-changes/:changeId. Corrects
// history (how past months are valued); the current rate stays as it is.

import { isResponse, requireAdmin } from "../../../../../../lib/admin";
import type { Env } from "../../../../../../lib/auth";
import { getDb } from "../../../../../../db";
import { deleteRateChange } from "../../../../../../db/rateChanges";

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = Number(params.id);
  const changeId = Number(params.changeId);
  if (!Number.isInteger(clientId) || !Number.isInteger(changeId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const ok = await deleteRateChange(getDb(env.DB), clientId, changeId);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
};
