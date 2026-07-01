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
  siteContentBlocks,
  type SiteProjectRow,
  type SitePageRow,
  type SiteSubmissionRow,
  type SiteRequestRow,
  type SiteContentBlockRow,
} from "./schema";

// ─── Projects, pages & content blocks ───────────────────────────────────────

export interface ProjectWithPages {
  project: SiteProjectRow;
  pages: SitePageRow[];
  contentBlocks: SiteContentBlockRow[];
}

async function pagesFor(db: DB, projectId: number): Promise<SitePageRow[]> {
  return db
    .select()
    .from(sitePages)
    .where(eq(sitePages.projectId, projectId))
    .orderBy(asc(sitePages.navOrder), asc(sitePages.id))
    .all();
}

async function blocksFor(db: DB, projectId: number): Promise<SiteContentBlockRow[]> {
  return db
    .select()
    .from(siteContentBlocks)
    .where(eq(siteContentBlocks.projectId, projectId))
    .orderBy(asc(siteContentBlocks.sortOrder), asc(siteContentBlocks.id))
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
  return {
    project,
    pages: await pagesFor(db, project.id),
    contentBlocks: await blocksFor(db, project.id),
  };
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
  return {
    project,
    pages: await pagesFor(db, id),
    contentBlocks: await blocksFor(db, id),
  };
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

// ─── Content blocks ──────────────────────────────────────────────────────────

export async function createContentBlock(
  db: DB,
  input: { projectId: number; name: string; html?: string; sortOrder?: number },
): Promise<SiteContentBlockRow> {
  return db
    .insert(siteContentBlocks)
    .values({
      projectId: input.projectId,
      name: input.name,
      html: input.html ?? "",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .get();
}

export async function getContentBlockById(
  db: DB,
  id: number,
): Promise<SiteContentBlockRow | null> {
  const row = await db
    .select()
    .from(siteContentBlocks)
    .where(eq(siteContentBlocks.id, id))
    .get();
  return row ?? null;
}

export async function updateContentBlock(
  db: DB,
  id: number,
  updates: Partial<Pick<SiteContentBlockRow, "name" | "html" | "sortOrder">>,
): Promise<void> {
  await db
    .update(siteContentBlocks)
    .set({ ...updates, updatedAt: nowSql() })
    .where(eq(siteContentBlocks.id, id))
    .run();
}

export async function deleteContentBlock(db: DB, id: number): Promise<void> {
  await db.delete(siteContentBlocks).where(eq(siteContentBlocks.id, id)).run();
}

// ─── Bulk import ─────────────────────────────────────────────────────────────

export type ImportItem =
  | { kind: "header"; html: string }
  | { kind: "footer"; html: string }
  | { kind: "page"; title: string; slug: string; html: string }
  | { kind: "block"; name: string; html: string };

export interface ImportResult {
  header: boolean;
  footer: boolean;
  pages: number;
  blocks: number;
}

/**
 * Apply a batch of uploaded files to a project in one call. Header/footer
 * overwrite the project's universal blocks; pages and content blocks are
 * appended (ordered after existing ones).
 */
export async function importItems(
  db: DB,
  projectId: number,
  items: ImportItem[],
): Promise<ImportResult> {
  const result: ImportResult = { header: false, footer: false, pages: 0, blocks: 0 };
  const existingPages = await pagesFor(db, projectId);
  const existingBlocks = await blocksFor(db, projectId);
  let pageOrder = existingPages.length;
  let blockOrder = existingBlocks.length;
  const chrome: Partial<Pick<SiteProjectRow, "headerHtml" | "footerHtml">> = {};

  for (const item of items) {
    if (item.kind === "header") {
      chrome.headerHtml = item.html;
      result.header = true;
    } else if (item.kind === "footer") {
      chrome.footerHtml = item.html;
      result.footer = true;
    } else if (item.kind === "page") {
      await createPage(db, {
        projectId,
        title: item.title,
        slug: item.slug,
        bodyHtml: item.html,
        navOrder: pageOrder++,
      });
      result.pages++;
    } else {
      await createContentBlock(db, {
        projectId,
        name: item.name,
        html: item.html,
        sortOrder: blockOrder++,
      });
      result.blocks++;
    }
  }
  if (Object.keys(chrome).length) await updateProjectChrome(db, projectId, chrome);
  return result;
}

function nowSql() {
  return sql`CURRENT_TIMESTAMP`;
}
