import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb, getUserByEmail } from "../../../db";
import { inviteUser, listAllUsers } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await listAllUsers(db);
  return Response.json({ users: rows });
};

interface InviteBody {
  email?: string;
  role?: "user" | "admin";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "user";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const existing = await getUserByEmail(db, email);
  if (existing) {
    return Response.json(
      { error: "User with that email already exists" },
      { status: 409 },
    );
  }

  const inviter = await getUserByEmail(db, session.email);
  const created = await inviteUser(db, {
    email,
    role,
    invitedBy: inviter?.id,
  });
  return Response.json({ user: created }, { status: 201 });
};
