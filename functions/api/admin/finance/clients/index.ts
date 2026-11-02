import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { listRecurringClients } from "../../../../db/finance";
import { editedInFinance } from "../../../../lib/financeApp";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json({ clients: await listRecurringClients(db) });
};

// Clients are added in TMC Finance, which writes them here
// (/api/finance-feed/clients). The content planner and the clients roster
// link there instead.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  return editedInFinance("Clients are added");
};
