// Admin time-clock payload — jobs, eligibility per job, active shifts,
// recent shifts (all statuses), pending count, and the user list for the
// eligibility dropdowns.

import type { Env } from "../../../lib/auth";
import { isResponse, requireAdmin } from "../../../lib/admin";
import { getDb } from "../../../db";
import {
  countPendingShifts,
  listActiveShifts,
  listAllShifts,
  listEligibilityForJob,
  listJobs,
} from "../../../db/timeclock";
import { listAllUsers } from "../../../db/admin";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAdmin(request, env);
  if (isResponse(session)) return session;

  const db = getDb(env.DB);
  const [jobsList, activeShifts, recentShifts, pendingCount, allUsers] =
    await Promise.all([
      listJobs(db),
      listActiveShifts(db),
      listAllShifts(db, { limit: 200 }),
      countPendingShifts(db),
      listAllUsers(db),
    ]);

  // Eligibility per job — N+1 but jobs count is small (handful).
  const eligibilityByJob: Record<number, Awaited<ReturnType<typeof listEligibilityForJob>>> = {};
  for (const j of jobsList) {
    eligibilityByJob[j.id] = await listEligibilityForJob(db, j.id);
  }

  // Strip sensitive user fields (no password-related concerns here, but
  // we don't need invitedBy etc for the dropdown).
  const userOptions = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));

  return Response.json({
    jobs: jobsList,
    eligibilityByJob,
    activeShifts,
    recentShifts,
    pendingCount,
    userOptions,
  });
};
