import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { deleteAnnouncement, updateAnnouncement } from "../../../db/admin";

function parseId(params: Record<string, string | string[]>): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface PatchBody {
  title?: string;
  body?: string;
  isPinned?: boolean;
  isActive?: boolean;
}

export const onRequestPatch: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: PatchBody = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.body !== undefined) updates.body = body.body.trim();
  if (body.isPinned !== undefined) updates.isPinned = body.isPinned;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  const db = getDb(env.DB);
  await updateAnnouncement(db, id, updates);
  return Response.json({ ok: true });
};

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
  await deleteAnnouncement(db, id);
  return Response.json({ ok: true });
};
