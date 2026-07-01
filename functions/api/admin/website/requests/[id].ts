// Team: mark a client change-request handled.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb, getUserByEmail } from "../../../../db";
import { handleRequest } from "../../../../db/website";

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  await handleRequest(db, id, me?.id ?? 0);
  return Response.json({ ok: true });
};
