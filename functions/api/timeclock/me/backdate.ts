// Submit a backdated shift — goes into 'pending' status until admin approves.

import type { Env } from "../../../lib/auth";
import { isResponse, requireTeamSession } from "../../../lib/admin";
import { getDb, getUserByEmail } from "../../../db";
import {
  createShift,
  getJobById,
  isEligible,
} from "../../../db/timeclock";

interface Body {
  jobId?: number;
  startedAt?: string;   // ISO datetime
  endedAt?: string;     // ISO datetime
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

  if (!body.jobId || !body.startedAt || !body.endedAt) {
    return Response.json(
      { error: "jobId, startedAt, and endedAt are required" },
      { status: 400 },
    );
  }
  const start = new Date(body.startedAt);
  const end = new Date(body.endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Response.json(
      { error: "startedAt and endedAt must be valid ISO datetimes" },
      { status: 400 },
    );
  }
  if (end <= start) {
    return Response.json(
      { error: "endedAt must be after startedAt" },
      { status: 400 },
    );
  }
  const now = new Date();
  if (start > now || end > now) {
    return Response.json(
      { error: "Backdated shifts can't be in the future" },
      { status: 400 },
    );
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

  const shift = await createShift(db, {
    userId: me.id,
    jobId: body.jobId,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    notes: body.notes ?? null,
    status: "pending",
  });

  return Response.json({ shift }, { status: 201 });
};
