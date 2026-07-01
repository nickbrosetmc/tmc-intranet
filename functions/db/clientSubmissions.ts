import { desc, eq, sql } from "drizzle-orm";
import {
  clients,
  clientSubmissions,
  clientUsers,
  type ClientSubmissionRow,
  type NewClientSubmissionRow,
} from "./schema";
import type { DB } from "./index";

export type SubmissionWithRefs = ClientSubmissionRow & {
  clientName: string;
  submitterName: string;
};

const withRefs = (db: DB) =>
  db
    .select({
      id: clientSubmissions.id,
      clientId: clientSubmissions.clientId,
      clientUserId: clientSubmissions.clientUserId,
      type: clientSubmissions.type,
      subject: clientSubmissions.subject,
      details: clientSubmissions.details,
      eventDate: clientSubmissions.eventDate,
      location: clientSubmissions.location,
      status: clientSubmissions.status,
      adminNotes: clientSubmissions.adminNotes,
      createdAt: clientSubmissions.createdAt,
      updatedAt: clientSubmissions.updatedAt,
      clientName: clients.name,
      submitterName: clientUsers.name,
    })
    .from(clientSubmissions)
    .innerJoin(clients, eq(clients.id, clientSubmissions.clientId))
    .innerJoin(clientUsers, eq(clientUsers.id, clientSubmissions.clientUserId));

export async function createSubmission(
  db: DB,
  data: NewClientSubmissionRow,
): Promise<ClientSubmissionRow> {
  return db.insert(clientSubmissions).values(data).returning().get();
}

export async function getSubmissionById(
  db: DB,
  id: number,
): Promise<ClientSubmissionRow | null> {
  const row = await db
    .select()
    .from(clientSubmissions)
    .where(eq(clientSubmissions.id, id))
    .get();
  return row ?? null;
}

/** A single client's submissions (both types), newest first. */
export async function listSubmissionsForClient(
  db: DB,
  clientId: number,
): Promise<ClientSubmissionRow[]> {
  return db
    .select()
    .from(clientSubmissions)
    .where(eq(clientSubmissions.clientId, clientId))
    .orderBy(desc(clientSubmissions.createdAt))
    .all();
}

/** Admin: all submissions joined with client + submitter name. */
export async function listAllSubmissions(
  db: DB,
  opts: { status?: "new" | "in_progress" | "done" } = {},
): Promise<SubmissionWithRefs[]> {
  const base = withRefs(db);
  const q = opts.status
    ? base.where(eq(clientSubmissions.status, opts.status))
    : base;
  return q.orderBy(desc(clientSubmissions.createdAt)).limit(500).all();
}

export async function updateSubmission(
  db: DB,
  id: number,
  data: Partial<NewClientSubmissionRow>,
): Promise<void> {
  await db
    .update(clientSubmissions)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(clientSubmissions.id, id))
    .run();
}

export async function countNewSubmissions(db: DB): Promise<number> {
  const row = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(clientSubmissions)
    .where(eq(clientSubmissions.status, "new"))
    .get();
  return row?.c ?? 0;
}
