import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { deleteCategory, updateCategory } from "../../../../db/finance";
import type { NewExpenseCategoryRow } from "../../../../db/schema";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  let body: Partial<NewExpenseCategoryRow>;
  try {
    body = (await request.json()) as Partial<NewExpenseCategoryRow>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await updateCategory(getDb(env.DB), id, body);
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteCategory(getDb(env.DB), id);
  return Response.json({ ok: true });
};
