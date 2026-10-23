// Admin: client projects and their launch dates.
//   GET  ?clientId=N  → { projects } for one client, or every project
//   POST              → create

import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { getRecurringClient } from "../../../db/finance";
import { createProject, listProjects } from "../../../db/projects";
import { parseProjectFields } from "../../../lib/projectFields";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const raw = new URL(request.url).searchParams.get("clientId");
  const clientId = raw ? Number(raw) : undefined;
  if (clientId !== undefined && !Number.isInteger(clientId)) {
    return Response.json({ error: "Invalid clientId" }, { status: 400 });
  }
  return Response.json({ projects: await listProjects(getDb(env.DB), clientId) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseProjectFields(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  if (f.clientId === undefined || !f.name) {
    return Response.json({ error: "A client and a name are required" }, { status: 400 });
  }
  const db = getDb(env.DB);
  if (!(await getRecurringClient(db, f.clientId))) {
    return Response.json({ error: "No such client" }, { status: 400 });
  }
  const created = await createProject(db, {
    clientId: f.clientId,
    name: f.name,
    kind: f.kind ?? "website",
    launchDate: f.launchDate ?? null,
    url: f.url ?? null,
    notes: f.notes ?? null,
  });
  return Response.json({ project: created }, { status: 201 });
};
