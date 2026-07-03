// Logged-in client changes their own password (used by the forced
// first-login change and any voluntary change). Requires the current
// password even mid-session so a walk-up attacker can't rotate it.

import { getSession, type Env } from "../lib/auth";
import { getDb } from "../db";
import { getClientUserById, updateClientUserPassword } from "../db/admin";
import { hashPassword, verifyPassword } from "../lib/passwords";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session || session.type !== "client") {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 8) {
    return Response.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return Response.json(
      { error: "New password must be different from the current one" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const user = await getClientUserById(db, session.clientUserId);
  if (!user || !user.isActive) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return Response.json(
      { error: "Current password is incorrect" },
      { status: 401 },
    );
  }

  const hash = await hashPassword(newPassword);
  await updateClientUserPassword(db, user.id, hash, {
    mustChangePassword: false,
  });

  return Response.json({ ok: true });
};
