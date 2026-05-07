import { getDb, listAppsByGroup } from "../../db";
import type { Env } from "../../lib/auth";
import { isResponse, requireTeamSession } from "../../lib/admin";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const groups = await listAppsByGroup(db);

  return Response.json({ groups });
};
