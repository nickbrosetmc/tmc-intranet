// Team: create a standalone content block on a project.

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../../lib/admin";
import { getDb } from "../../../../../db";
import { getProjectById, createContentBlock } from "../../../../../db/website";

interface Body {
  name?: unknown;
  html?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const db = getDb(env.DB);
  const project = await getProjectById(db, id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const block = await createContentBlock(db, {
    projectId: id,
    name,
    html: typeof body.html === "string" ? body.html : "",
  });
  return Response.json({ block }, { status: 201 });
};
