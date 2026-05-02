import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { deleteApp, updateApp } from "../../../db/admin";
import type { NewAppRow } from "../../../db/schema";

function parseId(params: Record<string, string | string[]>): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
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

  let body: Partial<NewAppRow>;
  try {
    body = (await request.json()) as Partial<NewAppRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb(env.DB);
  await updateApp(db, id, body);
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
  await deleteApp(db, id);
  return Response.json({ ok: true });
};
