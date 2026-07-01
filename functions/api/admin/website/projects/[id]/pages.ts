// Team: add a page (its own GHL body block) to a project.

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../../lib/admin";
import { getDb } from "../../../../../db";
import { getProjectById, createPage } from "../../../../../db/website";

interface Body {
  title?: unknown;
  slug?: unknown;
  bodyHtml?: unknown;
  navOrder?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  let slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
  if (!slug) slug = "/" + title.toLowerCase().replace(/\s+/g, "-");
  if (!slug.startsWith("/")) slug = "/" + slug;

  const db = getDb(env.DB);
  const project = await getProjectById(db, id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const page = await createPage(db, {
    projectId: id,
    title,
    slug,
    bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : "",
    navOrder: typeof body.navOrder === "number" ? body.navOrder : 0,
  });
  return Response.json({ page }, { status: 201 });
};
