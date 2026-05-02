import { isResponse, requireAdmin } from "../../lib/admin";
import type { Env } from "../../lib/auth";
import { getDb } from "../../db";
import { getAnalyticsSummary } from "../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const summary = await getAnalyticsSummary(db);
  return Response.json(summary);
};
