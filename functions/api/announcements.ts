import { getDb, listActiveAnnouncements } from "../db";
import { getSession, type Env } from "../lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb(env.DB);
  const rows = await listActiveAnnouncements(db);
  return Response.json({ announcements: rows });
};
