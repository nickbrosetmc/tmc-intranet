import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  users,
  appGroups,
  apps,
  appLaunches,
  announcements,
  calculatorSettings,
  clients,
  clientUsers,
  type UserRow,
  type AppRow,
  type AppGroupRow,
  type AnnouncementRow,
  type CalculatorSettingsRow,
  type ClientRow,
  type ClientUserRow,
} from "./schema";

export type DB = ReturnType<typeof drizzle>;

export function getDb(d1: D1Database): DB {
  return drizzle(d1);
}

export async function getUserByEmail(
  db: DB,
  email: string,
): Promise<UserRow | null> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .get();
  return row ?? null;
}

export async function recordSignIn(
  db: DB,
  email: string,
  profile: { name: string; picture?: string },
): Promise<void> {
  await db
    .update(users)
    .set({
      name: profile.name,
      picture: profile.picture,
      lastSignedIn: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(users.email, email.toLowerCase()))
    .run();
}

export interface GroupWithApps {
  group: AppGroupRow;
  apps: AppRow[];
}

/** Returns all active apps grouped by their group, in display order. */
export async function listAppsByGroup(db: DB): Promise<GroupWithApps[]> {
  const groups = await db
    .select()
    .from(appGroups)
    .orderBy(asc(appGroups.sortOrder))
    .all();

  const allApps = await db
    .select()
    .from(apps)
    .where(eq(apps.isActive, true))
    .orderBy(asc(apps.sortOrder))
    .all();

  return groups.map((group) => ({
    group,
    apps: allApps.filter((a) => a.groupId === group.id),
  }));
}

export async function getAppById(db: DB, id: number): Promise<AppRow | null> {
  const row = await db
    .select()
    .from(apps)
    .where(and(eq(apps.id, id), eq(apps.isActive, true)))
    .get();
  return row ?? null;
}

export async function recordLaunch(
  db: DB,
  userId: number,
  appId: number,
  launchType: "desktop" | "web",
): Promise<void> {
  await db
    .insert(appLaunches)
    .values({ userId, appId, launchType })
    .run();
}

/** Active announcements for the home page, pinned first then newest. */
export async function listActiveAnnouncements(
  db: DB,
): Promise<AnnouncementRow[]> {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.isActive, true))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .all();
}

/** Singleton calculator settings row. Always id=1. */
export async function getCalculatorSettings(
  db: DB,
): Promise<CalculatorSettingsRow> {
  const row = await db
    .select()
    .from(calculatorSettings)
    .where(eq(calculatorSettings.id, 1))
    .get();
  if (!row) {
    throw new Error("Calculator settings row missing — migration 0006 not applied?");
  }
  return row;
}

export async function updateCalculatorSettings(
  db: DB,
  updates: Partial<Omit<CalculatorSettingsRow, "id" | "updatedAt">>,
): Promise<void> {
  await db
    .update(calculatorSettings)
    .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(calculatorSettings.id, 1))
    .run();
}

// ─── Clients ─────────────────────────────────────────────────────────────

export async function getClientById(
  db: DB,
  id: number,
): Promise<ClientRow | null> {
  const row = await db.select().from(clients).where(eq(clients.id, id)).get();
  return row ?? null;
}

export async function getClientUserByUsername(
  db: DB,
  username: string,
): Promise<ClientUserRow | null> {
  const row = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.username, username.toLowerCase()))
    .get();
  return row ?? null;
}

export async function recordClientUserSignIn(
  db: DB,
  id: number,
): Promise<void> {
  await db
    .update(clientUsers)
    .set({ lastSignedIn: sql`CURRENT_TIMESTAMP` })
    .where(eq(clientUsers.id, id))
    .run();
}
