// Admin endpoint for content tracker settings (key/value).
// PATCH /api/admin/content/settings with {key, value} — value=null deletes.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import { setContentSetting } from "../../../db/content";

const ALLOWED_KEYS = new Set([
  "default_post_assignee_id",
  "default_post_estimated_minutes",
]);

interface PatchBody {
  key?: unknown;
  value?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  if (typeof body.key !== "string" || !ALLOWED_KEYS.has(body.key)) {
    return Response.json({ error: "Unknown setting key" }, { status: 400 });
  }

  let value: string | null;
  if (body.value === null || body.value === "") {
    value = null;
  } else if (typeof body.value === "string") {
    value = body.value;
  } else if (typeof body.value === "number") {
    value = String(body.value);
  } else {
    return Response.json({ error: "Bad value" }, { status: 400 });
  }

  const db = getDb(env.DB);
  await setContentSetting(db, body.key, value);
  return Response.json({ ok: true });
};
