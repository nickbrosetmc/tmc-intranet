import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  announcements,
  appGroups,
  apps,
  appLaunches,
  clients,
  clientUserClients,
  clientUsers,
  users,
  type AnnouncementRow,
  type AppGroupRow,
  type AppRow,
  type ClientRow,
  type ClientUserRow,
  type NewAnnouncementRow,
  type NewAppRow,
  type NewClientRow,
  type NewClientUserRow,
  type NewUserRow,
  type UserRow,
} from "./schema";
import type { DB } from "./index";

// ─── Users ───────────────────────────────────────────────────────────────

export async function listAllUsers(db: DB): Promise<UserRow[]> {
  // Deactivated rows get their email rewritten to *@deactivated.local
  // during merges; filter them out of pickers / admin views.
  return db
    .select()
    .from(users)
    .where(sql`${users.email} NOT LIKE '%@deactivated.local'`)
    .orderBy(users.id)
    .all();
}

export async function inviteUser(
  db: DB,
  data: { email: string; role: "user" | "admin"; invitedBy?: number },
): Promise<UserRow> {
  const inserted = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase().trim(),
      role: data.role,
      invitedBy: data.invitedBy,
    } satisfies NewUserRow)
    .returning()
    .get();
  return inserted;
}

export async function updateUserRole(
  db: DB,
  id: number,
  role: "user" | "admin",
): Promise<void> {
  await db.update(users).set({ role }).where(eq(users.id, id)).run();
}

export async function deleteUser(db: DB, id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id)).run();
}

// ─── Apps ────────────────────────────────────────────────────────────────

export async function listAllApps(db: DB): Promise<AppRow[]> {
  return db.select().from(apps).orderBy(apps.groupId, apps.sortOrder).all();
}

export async function createApp(db: DB, data: NewAppRow): Promise<AppRow> {
  return db.insert(apps).values(data).returning().get();
}

export async function updateApp(
  db: DB,
  id: number,
  data: Partial<NewAppRow>,
): Promise<void> {
  await db
    .update(apps)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(apps.id, id))
    .run();
}

export async function deleteApp(db: DB, id: number): Promise<void> {
  // Soft delete via is_active=false to preserve app_launches FK integrity.
  await db
    .update(apps)
    .set({ isActive: false, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(apps.id, id))
    .run();
}

// ─── Groups ──────────────────────────────────────────────────────────────

export async function listAllGroups(db: DB): Promise<AppGroupRow[]> {
  return db.select().from(appGroups).orderBy(appGroups.sortOrder).all();
}

export async function createGroup(
  db: DB,
  data: { name: string; sortOrder: number },
): Promise<AppGroupRow> {
  return db.insert(appGroups).values(data).returning().get();
}

export async function updateGroup(
  db: DB,
  id: number,
  data: { name?: string; sortOrder?: number },
): Promise<void> {
  await db.update(appGroups).set(data).where(eq(appGroups.id, id)).run();
}

export async function deleteGroup(db: DB, id: number): Promise<void> {
  // Apps in this group get their group_id set to null
  await db.update(apps).set({ groupId: null }).where(eq(apps.groupId, id)).run();
  await db.delete(appGroups).where(eq(appGroups.id, id)).run();
}

// ─── Analytics ───────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalsAllTime: number;
  totalsLast7Days: number;
  totalsToday: number;
  topApps: { appId: number; name: string; iconEmoji: string | null; count: number }[];
  topUsers: { userId: number; email: string; name: string | null; count: number }[];
  recentLaunches: {
    launchedAt: string;
    userEmail: string;
    appName: string;
    launchType: string;
  }[];
}

export async function getAnalyticsSummary(db: DB): Promise<AnalyticsSummary> {
  const totalsAllTime = (
    await db.select({ c: sql<number>`COUNT(*)` }).from(appLaunches).get()
  )?.c ?? 0;

  const totalsLast7Days = (
    await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(appLaunches)
      .where(sql`${appLaunches.launchedAt} >= datetime('now', '-7 days')`)
      .get()
  )?.c ?? 0;

  const totalsToday = (
    await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(appLaunches)
      .where(sql`${appLaunches.launchedAt} >= date('now')`)
      .get()
  )?.c ?? 0;

  const topApps = await db
    .select({
      appId: appLaunches.appId,
      name: apps.name,
      iconEmoji: apps.iconEmoji,
      count: sql<number>`COUNT(*)`,
    })
    .from(appLaunches)
    .innerJoin(apps, eq(apps.id, appLaunches.appId))
    .groupBy(appLaunches.appId, apps.name, apps.iconEmoji)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5)
    .all();

  const topUsers = await db
    .select({
      userId: appLaunches.userId,
      email: users.email,
      name: users.name,
      count: sql<number>`COUNT(*)`,
    })
    .from(appLaunches)
    .innerJoin(users, eq(users.id, appLaunches.userId))
    .groupBy(appLaunches.userId, users.email, users.name)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5)
    .all();

  const recentLaunches = await db
    .select({
      launchedAt: appLaunches.launchedAt,
      userEmail: users.email,
      appName: apps.name,
      launchType: appLaunches.launchType,
    })
    .from(appLaunches)
    .innerJoin(users, eq(users.id, appLaunches.userId))
    .innerJoin(apps, eq(apps.id, appLaunches.appId))
    .orderBy(desc(appLaunches.launchedAt))
    .limit(15)
    .all();

  return {
    totalsAllTime,
    totalsLast7Days,
    totalsToday,
    topApps,
    topUsers,
    recentLaunches,
  };
}

// ─── Announcements ───────────────────────────────────────────────────────

export async function listAllAnnouncements(
  db: DB,
): Promise<AnnouncementRow[]> {
  return db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .all();
}

export async function createAnnouncement(
  db: DB,
  data: { title: string; body: string; createdBy?: number; isPinned?: boolean },
): Promise<AnnouncementRow> {
  return db
    .insert(announcements)
    .values({
      title: data.title.trim(),
      body: data.body.trim(),
      createdBy: data.createdBy,
      isPinned: data.isPinned ?? false,
    } satisfies NewAnnouncementRow)
    .returning()
    .get();
}

export async function updateAnnouncement(
  db: DB,
  id: number,
  data: Partial<Pick<NewAnnouncementRow, "title" | "body" | "isPinned" | "isActive">>,
): Promise<void> {
  await db
    .update(announcements)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(announcements.id, id))
    .run();
}

export async function deleteAnnouncement(db: DB, id: number): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id)).run();
}

// ─── Clients ─────────────────────────────────────────────────────────────

export async function listAllClients(db: DB): Promise<ClientRow[]> {
  return db.select().from(clients).orderBy(asc(clients.name)).all();
}

export async function createClient(
  db: DB,
  data: Pick<NewClientRow, "name" | "filesUrl" | "ghlUrl" | "passwordVaultUrl">,
): Promise<ClientRow> {
  return db
    .insert(clients)
    .values({
      name: data.name.trim(),
      filesUrl: data.filesUrl ?? null,
      ghlUrl: data.ghlUrl ?? null,
      passwordVaultUrl: data.passwordVaultUrl ?? null,
    })
    .returning()
    .get();
}

export async function updateClient(
  db: DB,
  id: number,
  data: Partial<NewClientRow>,
): Promise<void> {
  await db
    .update(clients)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(clients.id, id))
    .run();
}

export async function deleteClient(db: DB, id: number): Promise<void> {
  // Cascade delete via client_users.client_id ON DELETE CASCADE
  await db.delete(clients).where(eq(clients.id, id)).run();
}

// ─── Client users ────────────────────────────────────────────────────────

export async function listClientUsers(
  db: DB,
  clientId: number,
): Promise<ClientUserRow[]> {
  // Membership-based: shows everyone attached to this client, whether it's
  // their primary account or an additional one.
  return db
    .select({
      id: clientUsers.id,
      clientId: clientUsers.clientId,
      username: clientUsers.username,
      passwordHash: clientUsers.passwordHash,
      name: clientUsers.name,
      email: clientUsers.email,
      isActive: clientUsers.isActive,
      mustChangePassword: clientUsers.mustChangePassword,
      resetTokenHash: clientUsers.resetTokenHash,
      resetTokenExpires: clientUsers.resetTokenExpires,
      resetRequestedAt: clientUsers.resetRequestedAt,
      createdAt: clientUsers.createdAt,
      lastSignedIn: clientUsers.lastSignedIn,
    })
    .from(clientUserClients)
    .innerJoin(clientUsers, eq(clientUsers.id, clientUserClients.clientUserId))
    .where(eq(clientUserClients.clientId, clientId))
    .orderBy(asc(clientUsers.name))
    .all();
}

// ─── Client memberships (one user, many clients) ─────────────────────────

export async function addClientMembership(
  db: DB,
  clientUserId: number,
  clientId: number,
): Promise<void> {
  await db
    .insert(clientUserClients)
    .values({ clientUserId, clientId })
    .onConflictDoNothing()
    .run();
}

export async function removeClientMembership(
  db: DB,
  clientUserId: number,
  clientId: number,
): Promise<void> {
  await db
    .delete(clientUserClients)
    .where(
      and(
        eq(clientUserClients.clientUserId, clientUserId),
        eq(clientUserClients.clientId, clientId),
      ),
    )
    .run();
}

/** All clients this user can access (active clients only), primary first. */
export async function listMembershipsForUser(
  db: DB,
  clientUserId: number,
): Promise<{ clientId: number; name: string }[]> {
  const rows = await db
    .select({
      clientId: clientUserClients.clientId,
      name: clients.name,
      isActive: clients.isActive,
    })
    .from(clientUserClients)
    .innerJoin(clients, eq(clients.id, clientUserClients.clientId))
    .where(eq(clientUserClients.clientUserId, clientUserId))
    .orderBy(asc(clients.name))
    .all();
  return rows
    .filter((r) => r.isActive)
    .map((r) => ({ clientId: r.clientId, name: r.name }));
}

export async function countMembershipsForUser(
  db: DB,
  clientUserId: number,
): Promise<number> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(clientUserClients)
    .where(eq(clientUserClients.clientUserId, clientUserId))
    .get();
  return row?.c ?? 0;
}

export async function getClientUserById(
  db: DB,
  id: number,
): Promise<ClientUserRow | null> {
  const row = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.id, id))
    .get();
  return row ?? null;
}

export async function createClientUser(
  db: DB,
  data: {
    clientId: number;
    username: string;
    passwordHash: string;
    name: string;
    email?: string | null;
  },
): Promise<ClientUserRow> {
  const row = await db
    .insert(clientUsers)
    .values({
      clientId: data.clientId,
      username: data.username.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name.trim(),
      email: data.email?.trim().toLowerCase() || null,
      // The initial password is admin-chosen (and emailed), so require the
      // user to set their own on first sign-in.
      mustChangePassword: true,
    } satisfies NewClientUserRow)
    .returning()
    .get();
  await addClientMembership(db, row.id, data.clientId);
  return row;
}

export async function updateClientUserEmail(
  db: DB,
  id: number,
  email: string | null,
): Promise<void> {
  await db
    .update(clientUsers)
    .set({ email: email?.trim().toLowerCase() || null })
    .where(eq(clientUsers.id, id))
    .run();
}

export async function updateClientUserName(
  db: DB,
  id: number,
  name: string,
): Promise<void> {
  await db
    .update(clientUsers)
    .set({ name: name.trim() })
    .where(eq(clientUsers.id, id))
    .run();
}

export async function updateClientUserPassword(
  db: DB,
  id: number,
  passwordHash: string,
  opts: { mustChangePassword?: boolean } = {},
): Promise<void> {
  await db
    .update(clientUsers)
    .set({
      passwordHash,
      mustChangePassword: opts.mustChangePassword ?? false,
      // Any password change invalidates outstanding reset links.
      resetTokenHash: null,
      resetTokenExpires: null,
    })
    .where(eq(clientUsers.id, id))
    .run();
}

// ─── Password reset tokens ───────────────────────────────────────────────

export async function setClientUserResetToken(
  db: DB,
  id: number,
  tokenHash: string,
  expiresIso: string,
  requestedAtIso: string,
): Promise<void> {
  await db
    .update(clientUsers)
    .set({
      resetTokenHash: tokenHash,
      resetTokenExpires: expiresIso,
      resetRequestedAt: requestedAtIso,
    })
    .where(eq(clientUsers.id, id))
    .run();
}

export async function getClientUserByResetTokenHash(
  db: DB,
  tokenHash: string,
): Promise<ClientUserRow | null> {
  const row = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.resetTokenHash, tokenHash))
    .get();
  return row ?? null;
}

export async function deleteClientUser(db: DB, id: number): Promise<void> {
  await db.delete(clientUsers).where(eq(clientUsers.id, id)).run();
}

// Re-export helper so admin endpoints can use it
export { and, eq };
