// Switch the active client account for a multi-client user. Verifies the
// requested client is one of the user's memberships, then re-issues the
// session cookie with the new active clientId.

import { createSessionCookie, getSession, type Env } from "../lib/auth";
import { getClientById, getDb } from "../db";
import { listMembershipsForUser } from "../db/admin";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session || session.type !== "client") {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    clientId?: unknown;
  } | null;
  const clientId = typeof body?.clientId === "number" ? body.clientId : null;
  if (!clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const memberships = await listMembershipsForUser(db, session.clientUserId);
  if (!memberships.some((m) => m.clientId === clientId)) {
    return Response.json(
      { error: "You don't have access to that client" },
      { status: 403 },
    );
  }
  const client = await getClientById(db, clientId);
  if (!client || !client.isActive) {
    return Response.json({ error: "Client is inactive" }, { status: 403 });
  }

  const cookie = await createSessionCookie(
    { ...session, clientId },
    env,
  );
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
};
