// Team: update or delete a page (edit its body HTML, rename, reorder).

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { getPageById, updatePage, deletePage } from "../../../../db/website";

function pageId(params: Record<string, string | string[]>): number {
  return Number(Array.isArray(params.id) ? params.id[0] : params.id);
}

interface PatchBody {
  title?: unknown;
  slug?: unknown;
  bodyHtml?: unknown;
  navOrder?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, string | number> = {};
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.slug === "string" && body.slug.trim()) {
    updates.slug = body.slug.trim().startsWith("/") ? body.slug.trim() : "/" + body.slug.trim();
  }
  if (typeof body.bodyHtml === "string") updates.bodyHtml = body.bodyHtml;
  if (typeof body.navOrder === "number") updates.navOrder = body.navOrder;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const existing = await getPageById(db, pageId(params));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await updatePage(db, pageId(params), updates);
  return Response.json({ page: await getPageById(db, pageId(params)) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  await deletePage(db, pageId(params));
  return Response.json({ ok: true });
};
