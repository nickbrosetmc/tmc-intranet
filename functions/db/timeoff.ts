import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import {
  timeOffRequests,
  users,
  type NewTimeOffRequestRow,
  type TimeOffRequestRow,
} from "./schema";
import type { DB } from "./index";

export type TimeOffWithUser = TimeOffRequestRow & {
  userName: string | null;
  userEmail: string;
  decidedByName: string | null;
};

const selectWithUser = (db: DB) =>
  db
    .select({
      id: timeOffRequests.id,
      userId: timeOffRequests.userId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      reason: timeOffRequests.reason,
      coveragePlan: timeOffRequests.coveragePlan,
      status: timeOffRequests.status,
      decidedBy: timeOffRequests.decidedBy,
      decidedAt: timeOffRequests.decidedAt,
      adminNote: timeOffRequests.adminNote,
      createdAt: timeOffRequests.createdAt,
      updatedAt: timeOffRequests.updatedAt,
      userName: users.name,
      userEmail: users.email,
      // We can't easily join on decided_by here without a second alias —
      // the admin name is only needed in dialogs, so the client resolves
      // it from the user list. Leaving null avoids the alias gymnastics.
      decidedByName: sql<string | null>`NULL`.as("decided_by_name"),
    })
    .from(timeOffRequests)
    .innerJoin(users, eq(users.id, timeOffRequests.userId));

export async function createTimeOff(
  db: DB,
  data: NewTimeOffRequestRow,
): Promise<TimeOffRequestRow> {
  return db.insert(timeOffRequests).values(data).returning().get();
}

export async function getTimeOffById(
  db: DB,
  id: number,
): Promise<TimeOffRequestRow | null> {
  const row = await db
    .select()
    .from(timeOffRequests)
    .where(eq(timeOffRequests.id, id))
    .get();
  return row ?? null;
}

export async function updateTimeOff(
  db: DB,
  id: number,
  data: Partial<NewTimeOffRequestRow>,
): Promise<void> {
  await db
    .update(timeOffRequests)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(timeOffRequests.id, id))
    .run();
}

export async function deleteTimeOff(db: DB, id: number): Promise<void> {
  await db.delete(timeOffRequests).where(eq(timeOffRequests.id, id)).run();
}

/** All requests for one user, newest first. */
export async function listTimeOffForUser(
  db: DB,
  userId: number,
  limit = 50,
): Promise<TimeOffRequestRow[]> {
  return db
    .select()
    .from(timeOffRequests)
    .where(eq(timeOffRequests.userId, userId))
    .orderBy(desc(timeOffRequests.startDate))
    .limit(limit)
    .all();
}

/** Admin: every request, joined with user info, newest first. */
export async function listAllTimeOff(
  db: DB,
  opts: {
    limit?: number;
    status?: "pending" | "approved" | "denied" | "cancelled";
  } = {},
): Promise<TimeOffWithUser[]> {
  const base = selectWithUser(db);
  const filtered = opts.status
    ? base.where(eq(timeOffRequests.status, opts.status))
    : base;
  return filtered
    .orderBy(desc(timeOffRequests.startDate))
    .limit(opts.limit ?? 200)
    .all();
}

/**
 * Approved requests whose range overlaps [start, end]. Used by the team
 * calendar so everyone can see who's out.
 */
export async function listApprovedInRange(
  db: DB,
  startDate: string,
  endDate: string,
): Promise<TimeOffWithUser[]> {
  // Overlap test: NOT (req.end < start OR req.start > end)
  //              == req.end >= start AND req.start <= end
  return selectWithUser(db)
    .where(
      and(
        eq(timeOffRequests.status, "approved"),
        gte(timeOffRequests.endDate, startDate),
        lte(timeOffRequests.startDate, endDate),
      ),
    )
    .orderBy(timeOffRequests.startDate)
    .all();
}

export async function countPendingTimeOff(db: DB): Promise<number> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(timeOffRequests)
    .where(eq(timeOffRequests.status, "pending"))
    .get();
  return row?.c ?? 0;
}

/**
 * Anything happening "now or upcoming" for the team calendar. Returns
 * approved-and-not-yet-over requests so people glance the page and see
 * who's out today + who's out next week.
 */
export async function listUpcomingApproved(
  db: DB,
  today: string,
  limit = 50,
): Promise<TimeOffWithUser[]> {
  return selectWithUser(db)
    .where(
      and(
        eq(timeOffRequests.status, "approved"),
        // Either it hasn't started yet OR it's currently in progress.
        or(
          gte(timeOffRequests.startDate, today),
          gte(timeOffRequests.endDate, today),
        ),
      ),
    )
    .orderBy(timeOffRequests.startDate)
    .limit(limit)
    .all();
}
