import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  contentPosts,
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
