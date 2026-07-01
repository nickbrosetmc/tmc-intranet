// Team: list all website projects (with client name), and create a new one
// for a client. Creating a project is the first setup step before pasting in
// the header/footer and pages.

import type { Env } from "../../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../../lib/admin";
import { getDb, getClientById } from "../../../../db";
import { listProjects, createProject } from "../../../../db/website";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  return Response.json({ projects: await listProjects(db) });
};

interface CreateBody {
  clientId?: unknown;
  name?: unknown;
  domain?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const clientId = typeof body.clientId === "number" ? body.clientId : 0;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!clientId || !name) {
    return Response.json({ error: "clientId and name are required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const client = await getClientById(db, clientId);
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const domain = typeof body.domain === "string" && body.domain.trim() ? body.domain.trim() : null;
  const project = await createProject(db, { clientId, name, domain });
  return Response.json({ project }, { status: 201 });
};
