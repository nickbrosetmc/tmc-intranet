// The signed-in client's own website (project + pages). Always scoped to the
// session's clientId, so a client can only ever load their own site.

import type { Env } from "../../lib/auth";
import { isResponse, requireClientSession } from "../../lib/admin";
import { getDb } from "../../db";
import { getActiveProjectForClient } from "../../db/website";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireClientSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const data = await getActiveProjectForClient(db, session.clientId);
  if (!data) return Response.json({ project: null, pages: [] });
  return Response.json(data);
};
