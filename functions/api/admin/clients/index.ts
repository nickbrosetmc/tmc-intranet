import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import { createClient, listAllClients } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const db = getDb(env.DB);
  const rows = await listAllClients(db);
  return Response.json({ clients: rows });
};

interface CreateBody {
  name?: string;
  filesUrl?: string | null;
  ghlUrl?: string | null;
  passwordVaultUrl?: string | null;
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
  const created = await createClient(db, {
    name: body.name,
    filesUrl: body.filesUrl ?? null,
    ghlUrl: body.ghlUrl ?? null,
    passwordVaultUrl: body.passwordVaultUrl ?? null,
  });
  return Response.json({ client: created }, { status: 201 });
};
