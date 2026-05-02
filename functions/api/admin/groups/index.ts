import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { createGroup, listAllGroups } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const rows = await listAllGroups(db);
  return Response.json({ groups: rows });
};

interface CreateBody {
  name?: string;
  sortOrder?: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const created = await createGroup(db, {
    name: body.name.trim(),
    sortOrder: body.sortOrder ?? 0,
  });
  return Response.json({ group: created }, { status: 201 });
};
