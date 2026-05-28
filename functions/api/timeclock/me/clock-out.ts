import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  getActiveShiftForUser,
  updateShift,
} from "../../../db/timeclock";

interface Body {
  notes?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // empty body is fine
  }

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const active = await getActiveShiftForUser(db, me.id);
  if (!active) {
    return Response.json({ error: "You're not clocked in" }, { status: 409 });
  }

  const notes =
    body.notes !== undefined
      ? body.notes || null
      : active.notes;
  await updateShift(db, active.id, {
    endedAt: new Date().toISOString(),
    status: "completed",
    notes,
  });

  return Response.json({ ok: true });
};
