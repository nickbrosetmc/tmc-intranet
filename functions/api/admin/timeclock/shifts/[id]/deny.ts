// Deny a pending backdated shift with a reason.

import type { Env } from "../../../../../lib/auth";
import { isResponse, requireAdmin } from "../../../../../lib/admin";
import { getDb, getUserByEmail } from "../../../../../db";
import { getShiftById, updateShift } from "../../../../../db/timeclock";

function parseId(p: Record<string, string | string[]>): number | null {
  const raw = p.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

interface Body {
  reason?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;
  const id = parseId(params);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* empty is ok */
  }

  const db = getDb(env.DB);
  const shift = await getShiftById(db, id);
  if (!shift) return Response.json({ error: "Shift not found" }, { status: 404 });
  if (shift.status !== "pending") {
    return Response.json(
      { error: `Shift is not pending (status=${shift.status})` },
      { status: 409 },
    );
  }

  const me = await getUserByEmail(db, session.email);
  await updateShift(db, id, {
    status: "denied",
    approvedBy: me?.id ?? null,
    approvedAt: new Date().toISOString(),
    denialReason: body.reason?.trim() || null,
  });
  return Response.json({ ok: true });
};
