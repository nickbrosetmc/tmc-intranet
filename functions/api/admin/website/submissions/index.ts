// Team: pending client submissions across all projects, for the dashboard.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { listPendingSubmissions } from "../../../../db/website";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json({ submissions: await listPendingSubmissions(db) });
};
