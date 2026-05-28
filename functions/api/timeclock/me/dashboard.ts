// One-shot payload for the team-facing /time-clock page.

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  getActiveShiftForUser,
  listEligibleJobsForUser,
  listShiftsForUser,
} from "../../../db/timeclock";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) {
    return Response.json({ error: "User not in DB" }, { status: 404 });
  }

  const [eligibleJobs, activeShift, recentShifts] = await Promise.all([
    listEligibleJobsForUser(db, me.id),
    getActiveShiftForUser(db, me.id),
    listShiftsForUser(db, me.id, 20),
  ]);

  return Response.json({
    user: { id: me.id, name: me.name, email: me.email },
    eligibleJobs,
    activeShift,
    recentShifts,
  });
};
