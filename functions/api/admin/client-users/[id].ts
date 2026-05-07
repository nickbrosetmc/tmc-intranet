// Update or delete a single client_user. Path is /api/admin/client-users/:id
// rather than nesting under the client to keep the URL simple — admin page
// already knows which client the user belongs to.

import { isResponse, requireAdmin } from "../../../lib/admin";
import type { Env } from "../../../lib/auth";
import { getDb } from "../../../db";
import {
  deleteClientUser,
  getClientUserById,
  updateClientUserName,
  updateClientUserPassword,
} from "../../../db/admin";
import { hashPassword } from "../../../lib/passwords";

function parseId(params: Record<string, string | string[]>): number | null {
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface PatchBody {
  name?: string;
  password?: string; // if set, resets password
}

export const onRequestPatch: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const user = await getClientUserById(db, id);
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    await updateClientUserName(db, id, body.name);
  }

  if (body.password !== undefined) {
    if (body.password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    const hash = await hashPassword(body.password);
    await updateClientUserPassword(db, id, hash);
  }

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  await deleteClientUser(db, id);
  return Response.json({ ok: true });
};
