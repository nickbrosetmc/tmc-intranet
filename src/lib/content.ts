// Content pipeline — types, API wrapper, week math, status logic.

import type { RecurringClient } from "./finance";

export interface Pillar {
  id: number;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  /** Target % of monthly content; null = no target. */
  targetPct: number | null;
  createdAt: string;
}

export interface FunnelStage {
  id: number;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export type PostStatus = "idea" | "drafting" | "review" | "completed";

export interface ContentPost {
  id: number;
  clientId: number;
  title: string;
  pillarId: number | null;
  funnelStageId: number | null;
  scheduledDate: string;          // YYYY-MM-DD
  platform: string | null;
  status: PostStatus;
  assignedTo: number | null;
  reviewerId: number | null;
  estimatedMinutes: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Whose task list this post lives on. Reviewer takes over once status hits review. */
export function effectiveAssigneeId(p: Pick<ContentPost, "status" | "assignedTo" | "reviewerId">): number | null {
  if (p.status === "review" && p.reviewerId != null) return p.reviewerId;
  return p.assignedTo;
}

/**
 * The work to produce a post is due on the Friday BEFORE its publish week —
 * TMC produces a week ahead. So a post scheduled Mon Jun 22 (publish week
 * Jun 22-28) has its work due Fri Jun 19.
 */
export function workDueDate(scheduledDate: string): string {
  const [y, m, d] = scheduledDate.split("-").map(Number);
  const publish = new Date(y, m - 1, d);
  const day = publish.getDay(); // 0=Sun..6=Sat
  // Mon of publish week
  const diff = day === 0 ? -6 : 1 - day;
  const publishMon = new Date(publish);
  publishMon.setDate(publishMon.getDate() + diff);
  // Fri before that = Mon − 3 days
  const fri = new Date(publishMon);
  fri.setDate(fri.getDate() - 3);
  const yy = fri.getFullYear();
  const mm = String(fri.getMonth() + 1).padStart(2, "0");
  const dd = String(fri.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export interface ContentUserOption {
  id: number;
  name: string | null;
  email: string;
}

export interface ContentSettings {
  default_post_assignee_id?: string | null;
  default_post_estimated_minutes?: string | null;
  [key: string]: string | null | undefined;
}

export interface ContentDashboard {
  pillars: Pillar[];
  funnelStages: FunnelStage[];
  clients: RecurringClient[];
  posts: ContentPost[];
  settings: ContentSettings;
  userOptions: ContentUserOption[];
  range: { start: string; end: string };
}

// ─── Status metadata ─────────────────────────────────────────────────────

export const STATUSES: { id: PostStatus; label: string; color: string }[] = [
  { id: "idea",      label: "Idea",       color: "#94a3b8" },
  { id: "drafting",  label: "Drafting",   color: "#3b82f6" },
  { id: "review",    label: "Review",     color: "#f59e0b" },
  { id: "completed", label: "Completed",  color: "#16a34a" },
];

export function statusMeta(s: PostStatus) {
  return STATUSES.find((x) => x.id === s) ?? STATUSES[0];
}

/** Completed = the work is done. Only mark when Nick has approved. */
export function isCompleted(status: PostStatus): boolean {
  return status === "completed";
}

// ─── Week math ───────────────────────────────────────────────────────────

/** Return ISO date "YYYY-MM-DD" of the Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Mon–Sun ISO dates for the week containing the given date. */
export function weekDates(anchorIso: string): string[] {
  const start = startOfWeek(parseIsoDate(anchorIso));
  return Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(start, i)));
}

/** End-of-week (exclusive) for range queries. */
export function nextWeekStart(anchorIso: string): string {
  const start = startOfWeek(parseIsoDate(anchorIso));
  return toIsoDate(addDays(start, 7));
}

export function weekLabel(anchorIso: string): string {
  const start = startOfWeek(parseIsoDate(anchorIso));
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (d: Date, withYear: boolean) =>
    `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ""}`;
  return `${fmt(start, false)}${sameMonth ? "" : "–" + fmt(end, false)}${sameMonth ? `–${end.getDate()}` : ""}, ${end.getFullYear()}`;
}

// ─── Progress tracking ───────────────────────────────────────────────────

export interface WeekProgress {
  total: number;
  completed: number;
  pctCompleted: number;            // 0–100
  targetPctToday: number;          // expected based on day of week + 85% Thursday target
  onTrack: boolean;
  fridayDeadline: string;          // ISO date of Friday EOD before the week
  daysUntilDeadline: number;       // can be negative if past
}

/**
 * Targets: 0% Mon, 25% Tue, 50% Wed, 85% Thu, 100% Fri+ (clamped).
 * Posts for week W must be completed by Friday of week W-1.
 */
export function computeProgress(
  postsForWeek: ContentPost[],
  weekStartIso: string,
  today: Date,
): WeekProgress {
  const total = postsForWeek.length;
  const completed = postsForWeek.filter((p) => isCompleted(p.status)).length;
  const pctCompleted = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Deadline = Friday of the week BEFORE the target week
  const targetWeekStart = parseIsoDate(weekStartIso);
  const deadline = addDays(targetWeekStart, -3); // Mon - 3 days = Fri prior
  const deadlineIso = toIsoDate(deadline);

  const today0 = new Date(today);
  today0.setHours(0, 0, 0, 0);
  const dayMs = 1000 * 60 * 60 * 24;
  const daysUntilDeadline = Math.round(
    (deadline.getTime() - today0.getTime()) / dayMs,
  );

  // What % should we be at TODAY?
  const cur = new Date(today0);
  const dow = cur.getDay(); // 0=Sun..6=Sat
  // Anchor: deadline is Friday. Target curve for the week leading up to deadline:
  // Mon=0%, Tue=25%, Wed=50%, Thu=85%, Fri=100%, weekend/past=100%
  const daysFromDeadline = daysUntilDeadline; // positive = future, negative = past
  let targetPctToday: number;
  if (daysFromDeadline <= 0) targetPctToday = 100;
  else if (daysFromDeadline === 1) targetPctToday = 85;       // Thursday
  else if (daysFromDeadline === 2) targetPctToday = 50;       // Wednesday
  else if (daysFromDeadline === 3) targetPctToday = 25;       // Tuesday
  else if (daysFromDeadline === 4) targetPctToday = 0;        // Monday
  else targetPctToday = 0;                                    // earlier — no expectation
  void dow;

  return {
    total,
    completed,
    pctCompleted,
    targetPctToday,
    onTrack: pctCompleted >= targetPctToday,
    fridayDeadline: deadlineIso,
    daysUntilDeadline,
  };
}

// ─── Coverage ────────────────────────────────────────────────────────────

export interface CoverageBucket {
  id: number;
  name: string;
  color: string;
  count: number;
  pct: number;
  /** Target % from pillar.targetPct, if set. */
  targetPct: number | null;
  /** pct - targetPct. Null if no target set. */
  delta: number | null;
}

/** Group posts by a categorical field (pillar or funnel stage). */
export function coverage(
  posts: ContentPost[],
  buckets: { id: number; name: string; color: string; targetPct?: number | null }[],
  fieldKey: "pillarId" | "funnelStageId",
): CoverageBucket[] {
  const total = posts.length;
  return buckets.map((b) => {
    const count = posts.filter((p) => p[fieldKey] === b.id).length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const targetPct = b.targetPct ?? null;
    return {
      id: b.id,
      name: b.name,
      color: b.color,
      count,
      pct,
      targetPct,
      delta: targetPct != null ? pct - targetPct : null,
    };
  });
}

// ─── API wrapper ─────────────────────────────────────────────────────────

async function jsonReq<T>(path: string, init?: RequestInit): Promise<T> {
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

export const content = {
  // Dashboard + post CRUD are TEAM-accessible (anyone signed in can use
  // the content tracker). Settings mutations below stay admin-only.
  dashboard: (startIso: string, endIso: string) =>
    jsonReq<ContentDashboard>(
      `/api/content/dashboard?start=${startIso}&end=${endIso}`,
    ),

  // Posts (team)
  createPost: (data: Partial<ContentPost>) =>
    jsonReq<{ post: ContentPost }>("/api/content/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePost: (id: number, data: Partial<ContentPost>) =>
    jsonReq<{ ok: true }>(`/api/content/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePost: (id: number) =>
    jsonReq<{ ok: true }>(`/api/content/posts/${id}`, { method: "DELETE" }),

  // Settings (admin)
  updateSetting: (key: string, value: string | number | null) =>
    jsonReq<{ ok: true }>("/api/admin/content/settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    }),

  // Pillars
  createPillar: (data: Partial<Pillar>) =>
    jsonReq<{ pillar: Pillar }>("/api/admin/content/pillars", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePillar: (id: number, data: Partial<Pillar>) =>
    jsonReq<{ ok: true }>(`/api/admin/content/pillars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deletePillar: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/content/pillars/${id}`, { method: "DELETE" }),

  // Funnel stages
  createFunnelStage: (data: Partial<FunnelStage>) =>
    jsonReq<{ funnelStage: FunnelStage }>("/api/admin/content/funnel-stages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFunnelStage: (id: number, data: Partial<FunnelStage>) =>
    jsonReq<{ ok: true }>(`/api/admin/content/funnel-stages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteFunnelStage: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/content/funnel-stages/${id}`, { method: "DELETE" }),
};
