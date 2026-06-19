import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  contentPosts,
  contentSeedLog,
  contentSettings,
  funnelStages,
  pillars,
  type ContentPostRow,
  type FunnelStageRow,
  type NewContentPostRow,
  type NewFunnelStageRow,
  type NewPillarRow,
  type PillarRow,
} from "./schema";
import type { DB } from "./index";

// ─── Pillars ─────────────────────────────────────────────────────────────

export async function listPillars(db: DB): Promise<PillarRow[]> {
  return db.select().from(pillars).orderBy(asc(pillars.sortOrder)).all();
}

export async function createPillar(
  db: DB,
  data: NewPillarRow,
): Promise<PillarRow> {
  return db.insert(pillars).values(data).returning().get();
}

export async function updatePillar(
  db: DB,
  id: number,
  data: Partial<NewPillarRow>,
): Promise<void> {
  await db.update(pillars).set(data).where(eq(pillars.id, id)).run();
}

export async function deletePillar(db: DB, id: number): Promise<void> {
  // Orphan posts in this pillar rather than cascade
  await db
    .update(contentPosts)
    .set({ pillarId: null })
    .where(eq(contentPosts.pillarId, id))
    .run();
  await db.delete(pillars).where(eq(pillars.id, id)).run();
}

// ─── Funnel stages ───────────────────────────────────────────────────────

export async function listFunnelStages(db: DB): Promise<FunnelStageRow[]> {
  return db.select().from(funnelStages).orderBy(asc(funnelStages.sortOrder)).all();
}

export async function createFunnelStage(
  db: DB,
  data: NewFunnelStageRow,
): Promise<FunnelStageRow> {
  return db.insert(funnelStages).values(data).returning().get();
}

export async function updateFunnelStage(
  db: DB,
  id: number,
  data: Partial<NewFunnelStageRow>,
): Promise<void> {
  await db.update(funnelStages).set(data).where(eq(funnelStages.id, id)).run();
}

export async function deleteFunnelStage(db: DB, id: number): Promise<void> {
  await db
    .update(contentPosts)
    .set({ funnelStageId: null })
    .where(eq(contentPosts.funnelStageId, id))
    .run();
  await db.delete(funnelStages).where(eq(funnelStages.id, id)).run();
}

// ─── Content posts ───────────────────────────────────────────────────────

/** All posts in a date range [startDateIso, endDateIso). */
export async function listPostsInRange(
  db: DB,
  startDateIso: string,
  endDateIso: string,
): Promise<ContentPostRow[]> {
  return db
    .select()
    .from(contentPosts)
    .where(
      and(
        gte(contentPosts.scheduledDate, startDateIso),
        lt(contentPosts.scheduledDate, endDateIso),
      ),
    )
    .orderBy(asc(contentPosts.scheduledDate), asc(contentPosts.id))
    .all();
}

export async function getContentPostById(
  db: DB,
  id: number,
): Promise<ContentPostRow | null> {
  const row = await db
    .select()
    .from(contentPosts)
    .where(eq(contentPosts.id, id))
    .get();
  return row ?? null;
}

export async function createContentPost(
  db: DB,
  data: NewContentPostRow,
): Promise<ContentPostRow> {
  return db.insert(contentPosts).values(data).returning().get();
}

export async function updateContentPost(
  db: DB,
  id: number,
  data: Partial<NewContentPostRow>,
): Promise<void> {
  await db
    .update(contentPosts)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(contentPosts.id, id))
    .run();
}

export async function deleteContentPost(db: DB, id: number): Promise<void> {
  await db.delete(contentPosts).where(eq(contentPosts.id, id)).run();
}

/**
 * Open posts (status != completed) for the tasks dashboard. Returns the
 * raw rows — assignee/reviewer/client lookups happen client-side from
 * the userOptions / clients lists that already ship with the payload.
 */
export async function listOpenPosts(
  db: DB,
): Promise<ContentPostRow[]> {
  return db
    .select()
    .from(contentPosts)
    .where(sql`${contentPosts.status} != 'completed'`)
    .orderBy(asc(contentPosts.scheduledDate))
    .all();
}

// ─── Auto-seed blank posts from posting_days ─────────────────────────────

const DAY_CODE_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseDayCodes(csv: string | null): Set<string> {
  if (!csv) return new Set();
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Given a Monday date, return the dates in that Mon-Sun week. */
function weekDays(monday: Date): { code: string; iso: string }[] {
  const out: { code: string; iso: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const idx = d.getDay();
    out.push({ code: DAY_CODE_BY_INDEX[idx], iso: d.toISOString().slice(0, 10) });
  }
  return out;
}

/**
 * For each active client with posting_days, ensure a blank post exists
 * on each of their posting days in the current week. Only creates posts
 * for dates >= today (no backfilling — if you deleted Monday's slot we
 * don't keep recreating it).
 *
 * Returns the number of posts created. Cheap when there's nothing to do
 * since it short-circuits on the first scheduled check.
 */
export async function seedBlankPostsForCurrentWeek(
  db: DB,
  opts: {
    monday: Date;
    today: Date;
    defaultAssigneeId: number | null;
    defaultEstimatedMinutes: number | null;
  },
): Promise<number> {
  const { monday, today, defaultAssigneeId, defaultEstimatedMinutes } = opts;
  const todayIso = today.toISOString().slice(0, 10);

  // Find every active client that has a posting_days set.
  const clients = await db
    .select({
      id: sql<number>`id`.as("id"),
      name: sql<string>`name`.as("name"),
      postingDays: sql<string | null>`posting_days`.as("posting_days"),
    })
    .from(sql`recurring_clients`)
    .where(sql`is_active = 1 AND posting_days IS NOT NULL AND posting_days != ''`)
    .all();
  if (clients.length === 0) return 0;

  const week = weekDays(monday);
  const weekStartIso = week[0].iso;
  let created = 0;

  for (const c of clients) {
    const days = parseDayCodes(c.postingDays);
    if (days.size === 0) continue;

    // Atomic claim: try to insert the (client, week) marker. The composite
    // primary key means only ONE concurrent caller succeeds; the rest hit
    // the conflict, get back an empty array, and skip. This is the lock
    // that prevents two simultaneous dashboard loads from both seeding a
    // fresh week into duplicate posts. It also enforces seed-once-per-week:
    // once the marker exists we never re-seed, so moved/deleted slots stay
    // as the user left them.
    const claimed = await db
      .insert(contentSeedLog)
      .values({ clientId: c.id, weekStart: weekStartIso })
      .onConflictDoNothing()
      .returning({ clientId: contentSeedLog.clientId })
      .all();
    if (claimed.length === 0) continue;

    // We own the seed for this client-week. Still respect any posts that
    // already exist (e.g. posting_days enabled mid-week after manual posts)
    // so we never double up on real content.
    const existing = await db
      .select({ id: contentPosts.id })
      .from(contentPosts)
      .where(
        and(
          eq(contentPosts.clientId, c.id),
          gte(contentPosts.scheduledDate, week[0].iso),
          lt(contentPosts.scheduledDate, addDayIso(week[6].iso, 1)),
        ),
      )
      .all();
    if (existing.length > 0) continue;

    // Posting days in this week, today onward.
    const targetIsos = week
      .filter((d) => days.has(d.code) && d.iso >= todayIso)
      .map((d) => d.iso);
    for (const iso of targetIsos) {
      await db
        .insert(contentPosts)
        .values({
          clientId: c.id,
          title: "Untitled",
          scheduledDate: iso,
          status: "idea",
          assignedTo: defaultAssigneeId,
          estimatedMinutes: defaultEstimatedMinutes,
        })
        .run();
      created++;
    }
  }
  return created;
}

function addDayIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ─── Settings (key/value) ────────────────────────────────────────────────

export async function listContentSettings(
  db: DB,
): Promise<Record<string, string | null>> {
  const rows = await db.select().from(contentSettings).all();
  const out: Record<string, string | null> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setContentSetting(
  db: DB,
  key: string,
  value: string | null,
): Promise<void> {
  await db
    .insert(contentSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: contentSettings.key,
      set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .run();
}

// Re-export drizzle helpers other files in this folder might want
export { desc };
