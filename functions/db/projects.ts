import { asc, desc, eq, sql } from "drizzle-orm";
import {
  clientProjects,
  recurringClients,
  type ClientProjectRow,
  type NewClientProjectRow,
} from "./schema";
import type { DB } from "./index";

export type ProjectWithClient = ClientProjectRow & { clientName: string };

/** Every project, or one client's, newest launch first; undated ones lead. */
export async function listProjects(db: DB, clientId?: number): Promise<ProjectWithClient[]> {
  const q = db
    .select({
      id: clientProjects.id,
      clientId: clientProjects.clientId,
      name: clientProjects.name,
      kind: clientProjects.kind,
      launchDate: clientProjects.launchDate,
      url: clientProjects.url,
      notes: clientProjects.notes,
      createdAt: clientProjects.createdAt,
      updatedAt: clientProjects.updatedAt,
      clientName: recurringClients.name,
    })
    .from(clientProjects)
    .innerJoin(recurringClients, eq(recurringClients.id, clientProjects.clientId));
  const filtered = clientId != null ? q.where(eq(clientProjects.clientId, clientId)) : q;
  return filtered
    .orderBy(
      sql`${clientProjects.launchDate} IS NOT NULL`,
      desc(clientProjects.launchDate),
      asc(clientProjects.name),
    )
    .all();
}

export async function getProject(db: DB, id: number): Promise<ClientProjectRow | undefined> {
  return db.select().from(clientProjects).where(eq(clientProjects.id, id)).get();
}

export async function createProject(
  db: DB,
  data: NewClientProjectRow,
): Promise<ClientProjectRow> {
  return db.insert(clientProjects).values(data).returning().get();
}

export async function updateProject(
  db: DB,
  id: number,
  data: Partial<NewClientProjectRow>,
): Promise<void> {
  await db
    .update(clientProjects)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(clientProjects.id, id))
    .run();
}

export async function deleteProject(db: DB, id: number): Promise<void> {
  await db.delete(clientProjects).where(eq(clientProjects.id, id)).run();
}

export async function countProjects(db: DB, clientId: number): Promise<number> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(clientProjects)
    .where(eq(clientProjects.clientId, clientId))
    .get();
  return row?.c ?? 0;
}
