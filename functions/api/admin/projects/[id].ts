import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { getRecurringClient } from "../../../db/finance";
import { deleteProject, getProject, updateProject } from "../../../db/projects";
import { parseProjectFields } from "../../../lib/projectFields";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseProjectFields(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const db = getDb(env.DB);
  if (!(await getProject(db, id))) return Response.json({ error: "Not found" }, { status: 404 });
  if (parsed.fields.clientId !== undefined && !(await getRecurringClient(db, parsed.fields.clientId))) {
    return Response.json({ error: "No such client" }, { status: 400 });
  }
  await updateProject(db, id, parsed.fields);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteProject(getDb(env.DB), id);
  return Response.json({ ok: true });
};
