// DELETE /api/finance-feed/clients/:id/rate-changes/:changeId: a rate change
// removed in TMC Finance, correcting history (how past months are valued).
// Takes FINANCE_WRITE_TOKEN (see lib/financeApp.ts).

import type { Env } from "../../../../../lib/auth";
import { getDb } from "../../../../../db";
import { deleteRateChange } from "../../../../../db/rateChanges";
import { financeAppDenied, onBehalfOf } from "../../../../../lib/financeApp";

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const denied = await financeAppDenied(request, env, "write");
  if (denied) return denied;
  const clientId = Number(params.id);
  const changeId = Number(params.changeId);
  if (!Number.isInteger(clientId) || !Number.isInteger(changeId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const ok = await deleteRateChange(getDb(env.DB), clientId, changeId);
  if (!ok) return Response.json({ error: "That rate change isn't in the Tech Hub" }, { status: 404 });
  console.log(JSON.stringify({ msg: "finance app deleted rate change", clientId, changeId, by: onBehalfOf(request) }));
  return Response.json({ ok: true });
};
