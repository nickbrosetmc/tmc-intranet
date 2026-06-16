import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  contentPosts,
  tasks,
  users,
  type NewTaskRow,
  type TaskRow,
} from "./schema";
import type { DB } from "./index";

export type TaskWithRefs = TaskRow & {
  assigneeName: string | null;
  assigneeEmail: string;
  createdByName: string | null;
  contentPostTitle: string | null;
};

const selectWithRefs = (db: DB) =>
  db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      assigneeId: tasks.assigneeId,
      createdBy: tasks.createdBy,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      estimatedMinutes: tasks.estimatedMinutes,
      actualMinutes: tasks.actualMinutes,
      status: tasks.status,
      startedAt: tasks.startedAt,
      completedAt: tasks.completedAt,
      contentPostId: tasks.contentPostId,
      sortOrder: tasks.sortOrder,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      assigneeName: users.name,
      assigneeEmail: users.email,
      // createdBy name resolved client-side from user list to avoid a
      // second self-join (matches the time-off pattern).
      createdByName: sql<string | null>`NULL`.as("created_by_name"),
      contentPostTitle: contentPosts.title,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.assigneeId))
    .leftJoin(contentPosts, eq(contentPosts.id, tasks.contentPostId));

export async function createTask(
  db: DB,
  data: NewTaskRow,
): Promise<TaskRow> {
  return db.insert(tasks).values(data).returning().get();
}

export async function getTaskById(
  db: DB,
  id: number,
): Promise<TaskRow | null> {
  const row = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  return row ?? null;
}

export async function updateTask(
  db: DB,
  id: number,
  data: Partial<NewTaskRow>,
): Promise<void> {
  await db
    .update(tasks)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(tasks.id, id))
    .run();
}

export async function deleteTask(db: DB, id: number): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id)).run();
}

/** Every task, joined with assignee + linked content post title. */
export async function listAllTasks(
  db: DB,
  opts: { includeCompleted?: boolean; limit?: number } = {},
): Promise<TaskWithRefs[]> {
  const base = selectWithRefs(db);
  const filtered = opts.includeCompleted
    ? base
    : base.where(inArray(tasks.status, ["pending", "in_progress"]));
  return filtered
    .orderBy(
      asc(tasks.status), // pending / in_progress first alphabetically
      asc(tasks.dueDate),
      desc(tasks.priority),
    )
    .limit(opts.limit ?? 500)
    .all();
}

/** A specific user's open tasks, ordered by due date then priority. */
export async function listOpenTasksForUser(
  db: DB,
  userId: number,
): Promise<TaskWithRefs[]> {
  return selectWithRefs(db)
    .where(
      and(
        eq(tasks.assigneeId, userId),
        inArray(tasks.status, ["pending", "in_progress"]),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.sortOrder))
    .all();
}

/** Tasks linked to a given set of content posts — for badges on the grid. */
export async function listTasksForContentPosts(
  db: DB,
  postIds: number[],
): Promise<TaskWithRefs[]> {
  if (postIds.length === 0) return [];
  return selectWithRefs(db)
    .where(
      and(
        isNotNull(tasks.contentPostId),
        inArray(tasks.contentPostId, postIds),
      ),
    )
    .all();
}

/** Has the given user got an active timer running anywhere? */
export async function getRunningTaskForUser(
  db: DB,
  userId: number,
): Promise<TaskRow | null> {
  const row = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, userId),
        eq(tasks.status, "in_progress"),
        isNotNull(tasks.startedAt),
      ),
    )
    .get();
  return row ?? null;
}
