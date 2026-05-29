// Submit a new time-off request. Lands as 'pending' for admin review.
// Coverage plan is required because our policy is unlimited PTO *as long
// as work is completed or coverage is arranged*.

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import { createTimeOff } from "../../../db/timeoff";

interface CreateBody {
  startDate?: unknown;
  endDate?: unknown;
  coveragePlan?: unknown;
  reason?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  const coveragePlan =
    typeof body.coveragePlan === "string" ? body.coveragePlan.trim() : "";
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : null;

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return Response.json(
      { error: "startDate and endDate must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (endDate < startDate) {
    return Response.json(
      { error: "endDate must be on or after startDate" },
      { status: 400 },
    );
  }
  if (!coveragePlan) {
    return Response.json(
      { error: "coveragePlan is required" },
      { status: 400 },
    );
  }

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) {
    return Response.json({ error: "User not in DB" }, { status: 404 });
  }

  const created = await createTimeOff(db, {
    userId: me.id,
    startDate,
    endDate,
    coveragePlan,
    reason,
    status: "pending",
  });

  return Response.json({ request: created }, { status: 201 });
};
