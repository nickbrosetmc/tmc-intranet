// Request a password-reset link. Always answers generically so usernames
// can't be enumerated. Only sends when the account exists, is active, and
// has an email on file. Token: 256-bit CSPRNG, stored as SHA-256 hash,
// 30-minute TTL, single-use. Re-requests are throttled to one per 5 min.

import type { Env } from "../lib/auth";
import { getClientUserByUsername, getDb } from "../db";
import { setClientUserResetToken } from "../db/admin";
import { esc, sendEmail } from "../lib/email";

const TOKEN_TTL_MIN = 30;
const THROTTLE_MIN = 5;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
  } | null;
  const username =
    typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";

  // One generic response for every path — no user enumeration.
  const generic = Response.json({
    ok: true,
    message:
      "If that account exists and has an email on file, a reset link is on its way.",
  });

  if (!username) return generic;

  const db = getDb(env.DB);
  const user = await getClientUserByUsername(db, username);
  if (!user || !user.isActive || !user.email) return generic;

  // Throttle: one link per 5 minutes.
  if (user.resetRequestedAt) {
    const last = new Date(user.resetRequestedAt).getTime();
    if (Number.isFinite(last) && Date.now() - last < THROTTLE_MIN * 60_000) {
      return generic;
    }
  }

  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + TOKEN_TTL_MIN * 60_000);
  await setClientUserResetToken(
    db,
    user.id,
    tokenHash,
    expires.toISOString(),
    now.toISOString(),
  );

  const link = `https://portal.tmctechhub.com/reset-password?token=${token}`;
  ctx.waitUntil(
    sendEmail(env, {
      to: [user.email],
      subject: "Reset your TMC portal password",
      html: `
        <div style="font-family:system-ui,sans-serif;color:#0E0F19;max-width:560px">
          <h2 style="margin:0 0 4px">Reset your password</h2>
          <p style="color:#404E5C;margin:0 0 16px">
            Hi ${esc(user.name)}, someone requested a password reset for your
            TMC portal account (<span style="font-family:monospace">${esc(user.username)}</span>).
            If that wasn't you, you can ignore this email.
          </p>
          <p style="margin:0 0 16px">
            <a href="${link}"
               style="background:#CFB583;color:#0E0F19;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">
              Choose a new password
            </a>
          </p>
          <p style="color:#404E5C;font-size:12px">
            This link works once and expires in ${TOKEN_TTL_MIN} minutes.
          </p>
        </div>`,
    }).then(() => undefined),
  );

  return generic;
};
