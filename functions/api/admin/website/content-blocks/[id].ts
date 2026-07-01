// Team: update or delete a content block.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { getContentBlockById, updateContentBlock, deleteContentBlock } from "../../../../db/website";

function blockId(params: Record<string, string | string[]>): number {
  return Number(Array.isArray(params.id) ? params.id[0] : params.id);
}

interface PatchBody {
  name?: unknown;
  html?: unknown;
  sortOrder?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, string | number> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.html === "string") updates.html = body.html;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const existing = await getContentBlockById(db, blockId(params));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await updateContentBlock(db, blockId(params), updates);
  return Response.json({ block: await getContentBlockById(db, blockId(params)) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  await deleteContentBlock(db, blockId(params));
  return Response.json({ ok: true });
};
