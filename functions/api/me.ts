import {
  clearSessionCookie,
  createSessionCookie,
  getSession,
  type Env,
} from "../lib/auth";
import { getClientById, getDb, getUserByEmail } from "../db";
import { getClientUserById, listMembershipsForUser } from "../db/admin";

// This endpoint is the app's "who am I" call on every page load. We use it
// to slide the session forward: each load re-issues the cookie with a fresh
// 30-day expiry, so an actively-used session never lapses out from under
// the user (and any browser 7-day cookie cap gets reset on every visit).

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.type === "client") {
    const db = getDb(env.DB);
    const [memberships, clientUser] = await Promise.all([
      listMembershipsForUser(db, session.clientUserId),
      getClientUserById(db, session.clientUserId),
    ]);
    if (!clientUser || !clientUser.isActive) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie(),
        },
      });
    }
    // Heal a stale active client (membership revoked / client deactivated)
    // by falling back to the first remaining membership.
    let activeId = session.clientId;
    if (!memberships.some((m) => m.clientId === activeId)) {
      if (memberships.length === 0) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearSessionCookie(),
          },
        });
      }
      activeId = memberships[0].clientId;
    }
    const client = await getClientById(db, activeId);
    const fresh = { ...session, clientId: activeId };
    const cookie = await createSessionCookie(fresh, env); // slide
    return new Response(
      JSON.stringify({
        type: "client",
        name: session.name,
        username: session.username,
        clientUserId: session.clientUserId,
        clientId: activeId,
        memberships,
        mustChangePassword: clientUser.mustChangePassword,
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
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      },
    );
  }

  // Team: confirm the account still exists and pick up any role change so
  // the UI matches the server-side gates. A removed/deactivated account
  // (e.g. email rewritten in a merge) gets logged out cleanly here.
  const db = getDb(env.DB);
  const row = await getUserByEmail(db, session.email);
  if (!row) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  }

  const fresh = { ...session, role: row.role };
  const cookie = await createSessionCookie(fresh, env); // slide + refresh role
  return new Response(
    JSON.stringify({
      type: "team",
      email: session.email,
      name: session.name,
      picture: session.picture,
      role: row.role,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    },
  );
};
