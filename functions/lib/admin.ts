import {
  getSession,
  type ClientSessionUser,
  type Env,
  type TeamSessionUser,
} from "./auth";

/**
 * Team-only gate (any team member, user or admin).
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
  return session;
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
