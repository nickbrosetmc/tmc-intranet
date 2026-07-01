// Typed wrapper around the website-editor endpoints (client + team/admin).

export interface SitePage {
  id: number;
  projectId: number;
  title: string;
  slug: string;
  bodyHtml: string;
  navOrder: number;
}

export interface SiteProject {
  id: number;
  clientId: number;
  name: string;
  domain: string | null;
  headerHtml: string;
  footerHtml: string;
  themeJson: string | null;
  isActive: boolean;
}

export interface SiteContentBlock {
  id: number;
  projectId: number;
  name: string;
  html: string;
  sortOrder: number;
}

export interface ProjectWithPages {
  project: SiteProject;
  pages: SitePage[];
  contentBlocks: SiteContentBlock[];
}

// A normalized file from the bulk importer, ready to send to the server.
export type ImportItem =
  | { kind: "header"; html: string }
  | { kind: "footer"; html: string }
  | { kind: "page"; title: string; slug: string; html: string }
  | { kind: "block"; name: string; html: string };

export interface SubmissionBlock {
  title: string;
  note: string;
  code: string;
}

export interface SubmissionChange {
  label: string;
  group: string;
}

// Raw submission row (JSON columns unparsed) as returned by the list endpoint.
export interface SubmissionRow {
  id: number;
  projectId: number;
  submittedByName: string;
  status: "pending" | "published" | "dismissed";
  changesJson: string;
  blocksJson: string;
  doneJson: string;
  createdAt: string;
}

export interface PendingSubmission {
  submission: SubmissionRow;
  projectName: string;
  clientName: string;
}

// Parsed submission as returned by the detail endpoint.
export interface Submission extends SubmissionRow {
  changes: SubmissionChange[];
  blocks: SubmissionBlock[];
  done: string[];
}

export interface RequestRow {
  id: number;
  projectId: number;
  submittedByName: string;
  body: string;
  assetKey: string | null;
  assetName: string | null;
  status: "pending" | "handled";
  createdAt: string;
}

export interface PendingRequest {
  request: RequestRow;
  projectName: string;
  clientName: string;
}

export interface ProjectSummary {
  project: SiteProject;
  clientName: string;
  pageCount: number;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ─── Client-facing ─────────────────────────────────────────────────────────

export const clientSite = {
  getProject: () => json<ProjectWithPages | { project: null; pages: [] }>("/api/website/project"),

  submit: (input: {
    changes: SubmissionChange[];
    blocks: SubmissionBlock[];
    submittedByName?: string;
  }) =>
    json<{ submission: SubmissionRow }>("/api/website/submissions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  request: (input: { body: string; assetKey?: string | null; assetName?: string | null }) =>
    json<{ request: RequestRow }>("/api/website/requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  async uploadAsset(file: File): Promise<{ key: string; url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/website/assets", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Upload failed (${res.status})`);
    }
    return (await res.json()) as { key: string; url: string };
  },
};

// ─── Team / admin ──────────────────────────────────────────────────────────

export const adminSite = {
  listProjects: () => json<{ projects: ProjectSummary[] }>("/api/admin/website/projects"),
  createProject: (data: { clientId: number; name: string; domain?: string | null }) =>
    json<{ project: SiteProject }>("/api/admin/website/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getProject: (id: number) => json<ProjectWithPages>(`/api/admin/website/projects/${id}`),
  updateProject: (
    id: number,
    data: Partial<Pick<SiteProject, "name" | "domain" | "headerHtml" | "footerHtml" | "themeJson">>,
  ) =>
    json<ProjectWithPages>(`/api/admin/website/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  addPage: (
    projectId: number,
    data: { title: string; slug?: string; bodyHtml?: string; navOrder?: number },
  ) =>
    json<{ page: SitePage }>(`/api/admin/website/projects/${projectId}/pages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePage: (
    id: number,
    data: Partial<Pick<SitePage, "title" | "slug" | "bodyHtml" | "navOrder">>,
  ) =>
    json<{ page: SitePage }>(`/api/admin/website/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePage: (id: number) =>
    json<{ ok: true }>(`/api/admin/website/pages/${id}`, { method: "DELETE" }),

  createContentBlock: (projectId: number, data: { name: string; html?: string }) =>
    json<{ block: SiteContentBlock }>(`/api/admin/website/projects/${projectId}/content-blocks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateContentBlock: (id: number, data: Partial<Pick<SiteContentBlock, "name" | "html" | "sortOrder">>) =>
    json<{ block: SiteContentBlock }>(`/api/admin/website/content-blocks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteContentBlock: (id: number) =>
    json<{ ok: true }>(`/api/admin/website/content-blocks/${id}`, { method: "DELETE" }),

  importItems: (projectId: number, items: ImportItem[]) =>
    json<{ result: { header: boolean; footer: boolean; pages: number; blocks: number } }>(
      `/api/admin/website/projects/${projectId}/import`,
      { method: "POST", body: JSON.stringify({ items }) },
    ),

  listSubmissions: () => json<{ submissions: PendingSubmission[] }>("/api/admin/website/submissions"),
  getSubmission: (id: number) =>
    json<{ submission: Submission }>(`/api/admin/website/submissions/${id}`),
  patchSubmission: (id: number, data: { done?: string[]; action?: "publish" | "dismiss" }) =>
    json<{ submission: Submission | null }>(`/api/admin/website/submissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listRequests: () => json<{ requests: PendingRequest[] }>("/api/admin/website/requests"),
  handleRequest: (id: number) =>
    json<{ ok: true }>(`/api/admin/website/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "handle" }),
    }),
};

export function parseChanges(row: SubmissionRow): SubmissionChange[] {
  try {
    return JSON.parse(row.changesJson) as SubmissionChange[];
  } catch {
    return [];
  }
}
