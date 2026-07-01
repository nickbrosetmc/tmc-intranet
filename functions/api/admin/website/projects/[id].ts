// Team: read a project (with its pages) and update its name/domain/theme and
// the universal header/footer HTML. This is the agency setup surface.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb } from "../../../../db";
import { getProjectWithPages, updateProjectChrome } from "../../../../db/website";

function projectId(params: Record<string, string | string[]>): number {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  return Number(raw);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const data = await getProjectWithPages(db, projectId(params));
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
};

interface PatchBody {
  name?: unknown;
  domain?: unknown;
  headerHtml?: unknown;
  footerHtml?: unknown;
  themeJson?: unknown;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.domain === "string") updates.domain = body.domain.trim();
  if (typeof body.headerHtml === "string") updates.headerHtml = body.headerHtml;
  if (typeof body.footerHtml === "string") updates.footerHtml = body.footerHtml;
  if (typeof body.themeJson === "string") updates.themeJson = body.themeJson;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = getDb(env.DB);
  await updateProjectChrome(db, projectId(params), updates);
  const data = await getProjectWithPages(db, projectId(params));
  return Response.json(data);
};
