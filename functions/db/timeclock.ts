import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  jobEligibility,
  jobs,
  timeClockShifts,
  users,
  type JobEligibilityRow,
  type JobRow,
  type NewJobEligibilityRow,
  type NewJobRow,
  type NewTimeClockShiftRow,
  type TimeClockShiftRow,
} from "./schema";
import type { DB } from "./index";

// ─── Jobs ────────────────────────────────────────────────────────────────

export async function listJobs(db: DB): Promise<JobRow[]> {
  return db.select().from(jobs).orderBy(asc(jobs.sortOrder), asc(jobs.name)).all();
}

export async function getJobById(db: DB, id: number): Promise<JobRow | null> {
  const row = await db.select().from(jobs).where(eq(jobs.id, id)).get();
  return row ?? null;
}

export async function createJob(db: DB, data: NewJobRow): Promise<JobRow> {
  return db.insert(jobs).values(data).returning().get();
}

export async function updateJob(
  db: DB,
  id: number,
  data: Partial<NewJobRow>,
): Promise<void> {
  await db
    .update(jobs)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(jobs.id, id))
    .run();
}

export async function deleteJob(db: DB, id: number): Promise<void> {
  // Soft delete via is_active=false so existing shifts keep their FK.
  await db
    .update(jobs)
    .set({ isActive: false, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(jobs.id, id))
    .run();
}

// ─── Eligibility ─────────────────────────────────────────────────────────

export async function listEligibilityForJob(
  db: DB,
  jobId: number,
): Promise<(JobEligibilityRow & { userName: string | null; userEmail: string })[]> {
  return db
    .select({
      id: jobEligibility.id,
      jobId: jobEligibility.jobId,
      userId: jobEligibility.userId,
      createdAt: jobEligibility.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(jobEligibility)
    .innerJoin(users, eq(users.id, jobEligibility.userId))
    .where(eq(jobEligibility.jobId, jobId))
    .all();
}

export async function listEligibleJobsForUser(
  db: DB,
  userId: number,
): Promise<JobRow[]> {
  return db
    .select({
      id: jobs.id,
      name: jobs.name,
      description: jobs.description,
      payRateType: jobs.payRateType,
      payRate: jobs.payRate,
      isActive: jobs.isActive,
      sortOrder: jobs.sortOrder,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .innerJoin(jobEligibility, eq(jobEligibility.jobId, jobs.id))
    .where(and(eq(jobEligibility.userId, userId), eq(jobs.isActive, true)))
    .orderBy(asc(jobs.sortOrder), asc(jobs.name))
    .all();
}

export async function addEligibility(
  db: DB,
  data: NewJobEligibilityRow,
): Promise<void> {
  await db.insert(jobEligibility).values(data).onConflictDoNothing().run();
}

export async function removeEligibility(
  db: DB,
  jobId: number,
  userId: number,
): Promise<void> {
  await db
    .delete(jobEligibility)
    .where(
      and(eq(jobEligibility.jobId, jobId), eq(jobEligibility.userId, userId)),
    )
    .run();
}

export async function isEligible(
  db: DB,
  jobId: number,
  userId: number,
): Promise<boolean> {
  const row = await db
    .select({ id: jobEligibility.id })
    .from(jobEligibility)
    .where(
      and(eq(jobEligibility.jobId, jobId), eq(jobEligibility.userId, userId)),
    )
    .get();
  return !!row;
}

// ─── Shifts ──────────────────────────────────────────────────────────────

export async function getActiveShiftForUser(
  db: DB,
  userId: number,
): Promise<TimeClockShiftRow | null> {
  const row = await db
    .select()
    .from(timeClockShifts)
    .where(
      and(
        eq(timeClockShifts.userId, userId),
        eq(timeClockShifts.status, "active"),
        isNull(timeClockShifts.endedAt),
      ),
    )
    .get();
  return row ?? null;
}

export async function createShift(
  db: DB,
  data: NewTimeClockShiftRow,
): Promise<TimeClockShiftRow> {
  return db.insert(timeClockShifts).values(data).returning().get();
}

export async function updateShift(
  db: DB,
  id: number,
  data: Partial<NewTimeClockShiftRow>,
): Promise<void> {
  await db
    .update(timeClockShifts)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(timeClockShifts.id, id))
    .run();
}

export async function getShiftById(
  db: DB,
  id: number,
): Promise<TimeClockShiftRow | null> {
  const row = await db
    .select()
    .from(timeClockShifts)
    .where(eq(timeClockShifts.id, id))
    .get();
  return row ?? null;
}

export async function deleteShift(db: DB, id: number): Promise<void> {
  await db.delete(timeClockShifts).where(eq(timeClockShifts.id, id)).run();
}

/** A user's shifts (any status) ordered most-recent first. */
export async function listShiftsForUser(
  db: DB,
  userId: number,
  limit = 50,
): Promise<TimeClockShiftRow[]> {
  return db
    .select()
    .from(timeClockShifts)
    .where(eq(timeClockShifts.userId, userId))
    .orderBy(desc(timeClockShifts.startedAt))
    .limit(limit)
    .all();
}

export async function listShiftsForUserInRange(
  db: DB,
  userId: number,
  startIso: string,
  endIso: string,
): Promise<TimeClockShiftRow[]> {
  return db
    .select()
    .from(timeClockShifts)
    .where(
      and(
        eq(timeClockShifts.userId, userId),
        gte(timeClockShifts.startedAt, startIso),
        lte(timeClockShifts.startedAt, endIso),
      ),
    )
    .orderBy(asc(timeClockShifts.startedAt))
    .all();
}

/** Admin: list all shifts with user/job joined. */
export async function listAllShifts(
  db: DB,
  opts: { limit?: number; status?: "active" | "completed" | "pending" | "denied" } = {},
): Promise<
  (TimeClockShiftRow & {
    userName: string | null;
    userEmail: string;
    jobName: string;
  })[]
> {
  const baseQuery = db
    .select({
      id: timeClockShifts.id,
      userId: timeClockShifts.userId,
      jobId: timeClockShifts.jobId,
      startedAt: timeClockShifts.startedAt,
      endedAt: timeClockShifts.endedAt,
      notes: timeClockShifts.notes,
      status: timeClockShifts.status,
      approvedBy: timeClockShifts.approvedBy,
      approvedAt: timeClockShifts.approvedAt,
      denialReason: timeClockShifts.denialReason,
      createdAt: timeClockShifts.createdAt,
      updatedAt: timeClockShifts.updatedAt,
      userName: users.name,
      userEmail: users.email,
      jobName: jobs.name,
    })
    .from(timeClockShifts)
    .innerJoin(users, eq(users.id, timeClockShifts.userId))
    .innerJoin(jobs, eq(jobs.id, timeClockShifts.jobId));
  const filtered = opts.status
    ? baseQuery.where(eq(timeClockShifts.status, opts.status))
    : baseQuery;
  return filtered
    .orderBy(desc(timeClockShifts.startedAt))
    .limit(opts.limit ?? 100)
    .all();
}

export async function listActiveShifts(
  db: DB,
): Promise<
  (TimeClockShiftRow & { userName: string | null; userEmail: string; jobName: string })[]
> {
  return listAllShifts(db, { status: "active", limit: 100 });
}

export async function countPendingShifts(db: DB): Promise<number> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(timeClockShifts)
    .where(eq(timeClockShifts.status, "pending"))
    .get();
  return row?.c ?? 0;
}
