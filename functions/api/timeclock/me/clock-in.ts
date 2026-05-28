import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  createShift,
  getActiveShiftForUser,
  getJobById,
  isEligible,
} from "../../../db/timeclock";

interface Body {
  jobId?: number;
  notes?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireTeamSession(request, env);
  if (isResponse(session)) return session;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.jobId || !Number.isFinite(body.jobId)) {
    return Response.json({ error: "jobId required" }, { status: 400 });
  }

  const db = getDb(env.DB);
  const me = await getUserByEmail(db, session.email);
  if (!me) return Response.json({ error: "User not in DB" }, { status: 404 });

  const job = await getJobById(db, body.jobId);
  if (!job || !job.isActive) {
    return Response.json({ error: "Job not available" }, { status: 404 });
  }

  const eligible = await isEligible(db, body.jobId, me.id);
  if (!eligible) {
    return Response.json(
      { error: "You're not eligible to clock in for this job" },
      { status: 403 },
    );
  }

  const existing = await getActiveShiftForUser(db, me.id);
  if (existing) {
    return Response.json(
      { error: "You're already clocked in. Clock out first." },
      { status: 409 },
    );
  }

  const shift = await createShift(db, {
    userId: me.id,
    jobId: body.jobId,
    startedAt: new Date().toISOString(),
    notes: body.notes ?? null,
    status: "active",
  });
  return Response.json({ shift }, { status: 201 });
};
