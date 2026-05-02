import { getSession, type Env } from "../lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getSession(request, env);
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  return Response.json(user);
};
