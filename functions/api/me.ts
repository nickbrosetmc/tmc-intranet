import { getSession, type Env } from "../lib/auth";
import { getClientById, getDb } from "../db";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.type === "client") {
    // Enrich with the current client's data so the frontend can render
    // their tile links without a second roundtrip.
    const db = getDb(env.DB);
    const client = await getClientById(db, session.clientId);
    return Response.json({
      type: "client",
      name: session.name,
      username: session.username,
      clientUserId: session.clientUserId,
      clientId: session.clientId,
      client: client
        ? {
            id: client.id,
            name: client.name,
            filesUrl: client.filesUrl,
            ghlUrl: client.ghlUrl,
            passwordVaultUrl: client.passwordVaultUrl,
            isActive: client.isActive,
          }
        : null,
    });
  }

  return Response.json({
    type: "team",
    email: session.email,
    name: session.name,
    picture: session.picture,
    role: session.role,
  });
};
