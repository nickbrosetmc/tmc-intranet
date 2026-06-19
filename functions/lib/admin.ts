import {
  getSession,
  type ClientSessionUser,
  type Env,
  type TeamSessionUser,
} from "./auth";
import { getDb, getUserByEmail } from "../db";

/**
 * Team-only gate (any team member, user or admin).
 *
 * The session JWT lives 7 days, so we re-check the user against the DB on
 * every request rather than trusting the token's `role`/existence claims.
 * This makes role changes and deactivations (a user removed from the
 * invite list, or whose email was rewritten during a merge) take effect
 * immediately instead of lingering until the cookie expires. One indexed
 * lookup per request — negligible at our scale.
 */
export async function requireTeamSession(
  request: Request,
  env: Env,
): Promise<TeamSessionUser | Response> {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.type !== "team") {
    return Response.json({ error: "Team access required" }, { status: 403 });
  }

  const db = getDb(env.DB);
  const row = await getUserByEmail(db, session.email);
  if (!row) {
    // Deactivated / removed since the token was minted.
    return Response.json(
      { error: "Account not found or deactivated" },
      { status: 401 },
    );
  }

  // Trust the live DB role, not the (possibly stale) token claim.
  return { ...session, role: row.role };
}

/**
 * Admin gate (team admin only).
 */
export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<TeamSessionUser | Response> {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  if (session.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  return session;
}

/**
 * Client-only gate. Use for endpoints that should only be hit by clients
 * (e.g. their own ticket submission, viewing their files).
 */
export async function requireClientSession(
  request: Request,
  env: Env,
): Promise<ClientSessionUser | Response> {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.type !== "client") {
    return Response.json({ error: "Client access required" }, { status: 403 });
  }
  return session;
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}
