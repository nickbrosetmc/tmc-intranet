// Data access for the website editor. Projects belong to a client; pages,
// submissions, requests and assets all hang off a project. Client-facing
// reads are always scoped by client_id at the call site (see the API layer)
// so one client can never reach another's site.

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import {
  clients,
  siteProjects,
  sitePages,
  siteSubmissions,
  siteRequests,
  siteAssets,
  type SiteProjectRow,
  type SitePageRow,
  type SiteSubmissionRow,
  type SiteRequestRow,
} from "./schema";

// ─── Projects & pages ──────────────────────────────────────────────────────

export interface ProjectWithPages {
  project: SiteProjectRow;
  pages: SitePageRow[];
}

async function pagesFor(db: DB, projectId: number): Promise<SitePageRow[]> {
  return db
    .select()
    .from(sitePages)
    .where(eq(sitePages.projectId, projectId))
    .orderBy(asc(sitePages.navOrder), asc(sitePages.id))
    .all();
}

/** The client's active site (today 1:1; returns the first active project). */
export async function getActiveProjectForClient(
  db: DB,
  clientId: number,
): Promise<ProjectWithPages | null> {
  const project = await db
    .select()
    .from(siteProjects)
    .where(and(eq(siteProjects.clientId, clientId), eq(siteProjects.isActive, true)))
    .orderBy(asc(siteProjects.id))
    .get();
  if (!project) return null;
  return { project, pages: await pagesFor(db, project.id) };
}

export async function getProjectById(
  db: DB,
  id: number,
): Promise<SiteProjectRow | null> {
  const row = await db
    .select()
    .from(siteProjects)
    .where(eq(siteProjects.id, id))
    .get();
  return row ?? null;
}

export async function getProjectWithPages(
  db: DB,
  id: number,
): Promise<ProjectWithPages | null> {
  const project = await getProjectById(db, id);
  if (!project) return null;
  return { project, pages: await pagesFor(db, id) };
}

export interface ProjectSummary {
  project: SiteProjectRow;
  clientName: string;
  pageCount: number;
}

/** All projects with their client name — for the admin setup list. */
export async function listProjects(db: DB): Promise<ProjectSummary[]> {
  const rows = await db
    .select({ project: siteProjects, clientName: clients.name })
    .from(siteProjects)
    .innerJoin(clients, eq(siteProjects.clientId, clients.id))
    .orderBy(asc(clients.name))
    .all();
  const out: ProjectSummary[] = [];
  for (const r of rows) {
    const pages = await pagesFor(db, r.project.id);
    out.push({ project: r.project, clientName: r.clientName, pageCount: pages.length });
  }
  return out;
}

export async function createProject(
  db: DB,
  input: { clientId: number; name: string; domain?: string | null },
): Promise<SiteProjectRow> {
  const row = await db
    .insert(siteProjects)
    .values({ clientId: input.clientId, name: input.name, domain: input.domain ?? null })
    .returning()
    .get();
  return row;
}

export async function updateProjectChrome(
  db: DB,
  id: number,
  updates: Partial<Pick<SiteProjectRow, "name" | "domain" | "headerHtml" | "footerHtml" | "themeJson">>,
): Promise<void> {
  await db
    .update(siteProjects)
    .set({ ...updates, updatedAt: nowSql() })
    .where(eq(siteProjects.id, id))
    .run();
}

export async function createPage(
  db: DB,
  input: { projectId: number; title: string; slug: string; bodyHtml?: string; navOrder?: number },
): Promise<SitePageRow> {
  return db
    .insert(sitePages)
    .values({
      projectId: input.projectId,
      title: input.title,
      slug: input.slug,
      bodyHtml: input.bodyHtml ?? "",
      navOrder: input.navOrder ?? 0,
    })
    .returning()
    .get();
}

export async function updatePage(
  db: DB,
  id: number,
  updates: Partial<Pick<SitePageRow, "title" | "slug" | "bodyHtml" | "navOrder">>,
): Promise<void> {
  await db
    .update(sitePages)
    .set({ ...updates, updatedAt: nowSql() })
    .where(eq(sitePages.id, id))
    .run();
}

export async function getPageById(db: DB, id: number): Promise<SitePageRow | null> {
  const row = await db.select().from(sitePages).where(eq(sitePages.id, id)).get();
  return row ?? null;
}

export async function deletePage(db: DB, id: number): Promise<void> {
  await db.delete(sitePages).where(eq(sitePages.id, id)).run();
}

// ─── Submissions ───────────────────────────────────────────────────────────

export async function createSubmission(
  db: DB,
  input: {
    projectId: number;
    clientUserId: number | null;
    submittedByName: string;
    changesJson: string;
    blocksJson: string;
  },
): Promise<SiteSubmissionRow> {
  return db
    .insert(siteSubmissions)
    .values({
      projectId: input.projectId,
      clientUserId: input.clientUserId,
      submittedByName: input.submittedByName,
      changesJson: input.changesJson,
      blocksJson: input.blocksJson,
    })
    .returning()
    .get();
}

export interface SubmissionWithContext {
  submission: SiteSubmissionRow;
  projectName: string;
  clientName: string;
}

export async function listPendingSubmissions(
  db: DB,
): Promise<SubmissionWithContext[]> {
  const rows = await db
    .select({ submission: siteSubmissions, projectName: siteProjects.name, clientName: clients.name })
    .from(siteSubmissions)
    .innerJoin(siteProjects, eq(siteSubmissions.projectId, siteProjects.id))
    .innerJoin(clients, eq(siteProjects.clientId, clients.id))
    .where(eq(siteSubmissions.status, "pending"))
    .orderBy(desc(siteSubmissions.createdAt))
    .all();
  return rows;
}

export async function getSubmissionById(
  db: DB,
  id: number,
): Promise<SiteSubmissionRow | null> {
  const row = await db
    .select()
    .from(siteSubmissions)
    .where(eq(siteSubmissions.id, id))
    .get();
  return row ?? null;
}

export async function setSubmissionDone(db: DB, id: number, doneJson: string): Promise<void> {
  await db.update(siteSubmissions).set({ doneJson }).where(eq(siteSubmissions.id, id)).run();
}

export async function publishSubmission(db: DB, id: number, userId: number): Promise<void> {
  await db
    .update(siteSubmissions)
    .set({ status: "published", publishedBy: userId, publishedAt: nowSql() })
    .where(eq(siteSubmissions.id, id))
    .run();
}

export async function dismissSubmission(db: DB, id: number): Promise<void> {
  await db.update(siteSubmissions).set({ status: "dismissed" }).where(eq(siteSubmissions.id, id)).run();
}

// ─── Requests ──────────────────────────────────────────────────────────────

export async function createRequest(
  db: DB,
  input: {
    projectId: number;
    clientUserId: number | null;
    submittedByName: string;
    body: string;
    assetKey?: string | null;
    assetName?: string | null;
  },
): Promise<SiteRequestRow> {
  return db
    .insert(siteRequests)
    .values({
      projectId: input.projectId,
      clientUserId: input.clientUserId,
      submittedByName: input.submittedByName,
      body: input.body,
      assetKey: input.assetKey ?? null,
      assetName: input.assetName ?? null,
    })
    .returning()
    .get();
}

export interface RequestWithContext {
  request: SiteRequestRow;
  projectName: string;
  clientName: string;
}

export async function listPendingRequests(db: DB): Promise<RequestWithContext[]> {
  return db
    .select({ request: siteRequests, projectName: siteProjects.name, clientName: clients.name })
    .from(siteRequests)
    .innerJoin(siteProjects, eq(siteRequests.projectId, siteProjects.id))
    .innerJoin(clients, eq(siteProjects.clientId, clients.id))
    .where(eq(siteRequests.status, "pending"))
    .orderBy(desc(siteRequests.createdAt))
    .all();
}

export async function handleRequest(db: DB, id: number, userId: number): Promise<void> {
  await db
    .update(siteRequests)
    .set({ status: "handled", handledBy: userId, handledAt: nowSql() })
    .where(eq(siteRequests.id, id))
    .run();
}

// ─── Assets ────────────────────────────────────────────────────────────────

export async function recordAsset(
  db: DB,
  input: {
    projectId: number;
    r2Key: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    uploadedByClientUserId: number | null;
  },
): Promise<void> {
  await db.insert(siteAssets).values(input).run();
}

function nowSql() {
  return sql`CURRENT_TIMESTAMP`;
}
