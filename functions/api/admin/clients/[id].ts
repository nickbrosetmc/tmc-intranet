import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { deleteClient, updateClient } from "../../../db/admin";

function parseId(params: Record<string, string | string[]>): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface PatchBody {
  name?: string;
  filesUrl?: string | null;
  ghlUrl?: string | null;
  passwordVaultUrl?: string | null;
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
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.filesUrl !== undefined) updates.filesUrl = body.filesUrl || null;
  if (body.ghlUrl !== undefined) updates.ghlUrl = body.ghlUrl || null;
  if (body.passwordVaultUrl !== undefined)
    updates.passwordVaultUrl = body.passwordVaultUrl || null;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  const db = getDb(env.DB);
  await updateClient(db, id, updates);
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
  await deleteClient(db, id);
  return Response.json({ ok: true });
};
