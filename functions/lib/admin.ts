import { getSession, type Env, type SessionUser } from "./auth";

/**
 * Admin gate. Returns the session user if they're an admin, or a 401/403
 * Response that the caller should return immediately.
 */
export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<SessionUser | Response> {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  return session;
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}
