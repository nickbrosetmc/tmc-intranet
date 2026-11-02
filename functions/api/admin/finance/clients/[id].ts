import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { getRecurringClient, updateRecurringClient } from "../../../../db/finance";
import { financeOwnedIn, parseClientFields } from "../../../../lib/clientFields";
import { editedInFinance } from "../../../../lib/financeApp";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Who the client is, what they pay and their contract are TMC Finance's;
  // here it's the planner's fields and the client portal link.
  if (financeOwnedIn(body).length) return editedInFinance("Client names, rates and contracts are edited");
  const parsed = parseClientFields(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const db = getDb(env.DB);
  const existing = await getRecurringClient(db, id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await updateRecurringClient(db, id, parsed.fields);
  return Response.json({ ok: true });
};

// Removing a client is done in TMC Finance (by marking them as left).
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return editedInFinance("Clients are removed");
};
