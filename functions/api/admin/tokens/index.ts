// Admin: list + mint personal API tokens. The raw token is returned ONCE
// at mint; only its hash is stored.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import { apiTokens, users } from "../../../db/schema";
import { desc, eq } from "drizzle-orm";
import { generateApiToken, sha256Hex } from "../../../lib/apiTokens";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await db
    .select({
      id: apiTokens.id,
      label: apiTokens.label,
      scope: apiTokens.scope,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      ownerEmail: users.email,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .orderBy(desc(apiTokens.createdAt))
    .all();

  return Response.json({ tokens: rows });
};

interface CreateBody {
  label?: unknown;
  scope?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const scope = body?.scope === "write" ? "write" : "read";
  if (!label) {
    return Response.json({ error: "Label is required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not found" }, { status: 404 });

  const token = generateApiToken();
  const tokenHash = await sha256Hex(token);
  const created = await db
    .insert(apiTokens)
    .values({ userId: me.id, label, tokenHash, scope })
    .returning({ id: apiTokens.id })
    .get();

  // The ONLY time the raw token leaves the server.
  return Response.json(
    { id: created.id, token, label, scope },
    { status: 201 },
  );
};
