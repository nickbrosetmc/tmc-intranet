// Admin: revoke an API token (soft — sets revoked_at so the audit trail
// of when it existed and was last used survives).

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import { apiTokens } from "../../../db/schema";
import { eq, sql } from "drizzle-orm";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestDelete: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  await db
    .update(apiTokens)
    .set({ revokedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(apiTokens.id, id))
    .run();

  return Response.json({ ok: true });
};
