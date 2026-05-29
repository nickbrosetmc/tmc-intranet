// One-shot payload for the team-facing /time-off page:
//   - the signed-in user's own requests (any status)
//   - upcoming approved time-off across the team, so everyone can see
//     who's out

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  listTimeOffForUser,
  listUpcomingApproved,
} from "../../../db/timeoff";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) {
    return Response.json({ error: "User not in DB" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const [myRequests, upcomingTeam] = await Promise.all([
    listTimeOffForUser(db, me.id, 50),
    listUpcomingApproved(db, today, 50),
  ]);

  return Response.json({
    user: { id: me.id, name: me.name, email: me.email },
    myRequests,
    upcomingTeam,
  });
};
