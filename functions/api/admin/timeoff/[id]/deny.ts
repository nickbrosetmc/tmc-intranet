// Deny a pending time-off request with an admin note (recommended but
// not required).

import type { Env } from "../../../../lib/auth";
import { isResponse, requireAdmin } from "../../../../lib/admin";
import { getDb, getUserByEmail } from "../../../../db";
import { getTimeOffById, updateTimeOff } from "../../../../db/timeoff";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const db = getDb(env.DB);
  const row = await getTimeOffById(db, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "pending") {
    return Response.json(
      { error: `Cannot deny a ${row.status} request` },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    adminNote?: unknown;
  };
  const adminNote =
    typeof body.adminNote === "string" && body.adminNote.trim()
      ? body.adminNote.trim()
      : null;

  const admin = await getUserByEmail(db, session.email);

  await updateTimeOff(db, id, {
    status: "denied",
    decidedBy: admin?.id ?? null,
    decidedAt: new Date().toISOString(),
    adminNote,
  });

  return Response.json({ ok: true });
};
