import { getDb, listAppsByGroup } from "../../db";
import { getSession, type Env } from "../../lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb(env.DB);
  const groups = await listAppsByGroup(db);

  return Response.json({ groups });
};
