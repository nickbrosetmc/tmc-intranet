// Team-gated: the active client list with portal links, so any team member
// (not just admins) can preview what a client's portal looks like.

import type { Env } from "../lib/auth";
import { isResponse, requireTeamSession } from "../lib/admin";
import { getDb } from "../db";
import { clients } from "../db/schema";
import { asc, eq } from "drizzle-orm";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      filesUrl: clients.filesUrl,
      ghlUrl: clients.ghlUrl,
      passwordVaultUrl: clients.passwordVaultUrl,
    })
    .from(clients)
    .where(eq(clients.isActive, true))
    .orderBy(asc(clients.name))
    .all();

  return Response.json({ clients: rows });
};
