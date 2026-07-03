// Redeem a password-reset token. Single-use: the token (stored as a
// SHA-256 hash) is burned by the password update itself, so a replay
// finds nothing. Expiry checked server-side.

import type { Env } from "../lib/auth";
import { getDb } from "../db";
import {
  getClientUserByResetTokenHash,
  updateClientUserPassword,
} from "../db/admin";
import { hashPassword } from "../lib/passwords";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    newPassword?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return Response.json(
      { error: "This reset link is invalid. Request a new one." },
      { status: 400 },
    );
  }
  if (newPassword.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const tokenHash = await sha256Hex(token);
  const user = await getClientUserByResetTokenHash(db, tokenHash);
  if (!user || !user.isActive) {
    return Response.json(
      { error: "This reset link is invalid or was already used. Request a new one." },
      { status: 400 },
    );
  }
  if (
    !user.resetTokenExpires ||
    new Date(user.resetTokenExpires).getTime() < Date.now()
  ) {
    return Response.json(
      { error: "This reset link has expired. Request a new one." },
      { status: 400 },
    );
  }

  const hash = await hashPassword(newPassword);
  // updateClientUserPassword clears the token fields — burns the link.
  await updateClientUserPassword(db, user.id, hash, {
    mustChangePassword: false,
  });

  return Response.json({ ok: true });
};
