import { isResponse, requireAdmin } from "../../../../lib/admin";
import type { Env } from "../../../../lib/auth";
import { getClientUserByUsername, getDb } from "../../../../db";
import { createClientUser, listClientUsers } from "../../../../db/admin";
import { hashPassword } from "../../../../lib/passwords";

function parseClientId(
  params: Record<string, string | string[]>,
): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestGet: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = parseClientId(params);
  if (!clientId) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const rows = await listClientUsers(db, clientId);
  // Strip password hash before returning
  const safe = rows.map(({ passwordHash: _ph, ...rest }) => rest);
  return Response.json({ users: safe });
};

interface CreateBody {
  username?: string;
  password?: string;
  name?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const clientId = parseClientId(params);
  if (!clientId) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password ?? "";
  if (!username || !name) {
    return Response.json(
      { error: "Username and name are required" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);

  const existing = await getClientUserByUsername(db, username);
  if (existing) {
    return Response.json(
      { error: "Username already taken" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const created = await createClientUser(db, {
    clientId,
    username,
    passwordHash,
    name,
  });

  // Strip the hash before returning
  const { passwordHash: _ph, ...safe } = created;
  return Response.json({ user: safe }, { status: 201 });
};
