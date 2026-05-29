// Admin time-off payload — all requests, pending count, user lookup.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import {
  countPendingTimeOff,
  listAllTimeOff,
} from "../../../db/timeoff";
import { listAllUsers } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const [requests, pendingCount, allUsers] = await Promise.all([
    listAllTimeOff(db, { limit: 200 }),
    countPendingTimeOff(db),
    listAllUsers(db),
  ]);

  const userOptions = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  return Response.json({ requests, pendingCount, userOptions });
};
