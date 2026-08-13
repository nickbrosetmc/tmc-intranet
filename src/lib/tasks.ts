// Types, API wrappers, and helpers for the tasks system.
import { effectiveAssigneeId, workDueDate } from "./content";
import type { ContentPost, FunnelStage, Pillar } from "./content";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  assigneeId: number;
  createdBy: number;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  contentPostId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithRefs extends Task {
  assigneeName: string | null;
  assigneeEmail: string;
  createdByName: string | null;
  contentPostTitle: string | null;
}

export interface UserOption {
  id: number;
  name: string | null;
  email: string;
}

export interface PostOption {
  id: number;
  title: string;
  scheduledDate: string;
  clientId: number;
}

export interface ClientOption {
  id: number;
  name: string;
  isActive: boolean;
  weeklyPostTarget: number | null;
}

export interface TasksDashboard {
  user: { id: number; name: string | null; email: string };
  tasks: TaskWithRefs[];
  openPosts: ContentPost[];
  userOptions: UserOption[];
  postOptions: PostOption[];
  clientOptions: ClientOption[];
  weeklyPostsByClient: Record<number, number>;
  weekStart: string;        // YYYY-MM-DD, Monday
  weekEnd: string;          // YYYY-MM-DD, Sunday
  weekDueDate: string;      // YYYY-MM-DD, Friday — placeholder due date
  defaultPostAssigneeId: number | null;
  defaultPostEstimatedMinutes: number | null;
  pillars: Pillar[];
  funnelStages: FunnelStage[];
}

// ─── Constants ───────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-muted text-muted-foreground border-transparent",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Minutes between two ISO datetimes (or now if endIso is null). */
export function elapsedMinutes(startIso: string, endIso?: string | null): number {
  const end = endIso ? new Date(endIso) : new Date();
  const ms = end.getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/** "1h 24m" / "45m" / "—" */
export function formatMinutes(mins: number | null | undefined): string {
  if (mins == null || mins < 0) return "—";
  if (mins === 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "Mon Jun 16" (or "Today" / "Tomorrow" if close). */
export function formatDueDate(ymd: string | null): string {
  if (!ymd) return "No due date";
  const [y, mo, d] = ymd.split("-").map(Number);
  const date = new Date(y, (mo ?? 1) - 1, d ?? 1);
  const today = startOfToday();
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns days difference; negative if overdue. null if no dueDate. */
export function daysUntilDue(ymd: string | null): number | null {
  if (!ymd) return null;
  const [y, mo, d] = ymd.split("-").map(Number);
  const date = new Date(y, (mo ?? 1) - 1, d ?? 1);
  const today = startOfToday();
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

/** Sort: status (open first), priority (urgent first), then due date. */
export function sortTasks(list: TaskWithRefs[]): TaskWithRefs[] {
  const statusRank = (s: TaskStatus) =>
    s === "in_progress" ? 0 : s === "pending" ? 1 : s === "completed" ? 2 : 3;
  return [...list].sort((a, b) => {
    const sd = statusRank(a.status) - statusRank(b.status);
    if (sd !== 0) return sd;
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    const aDue = a.dueDate ?? "9999-12-31";
    const bDue = b.dueDate ?? "9999-12-31";
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

// ─── API wrappers ────────────────────────────────────────────────────────

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

export const tasksApi = {
  dashboard: (includeCompleted = false) =>
    jsonReq<TasksDashboard>(
      `/api/tasks/dashboard${includeCompleted ? "?includeCompleted=1" : ""}`,
    ),
  create: (data: {
    title: string;
    description?: string;
    assigneeId?: number;
    priority?: TaskPriority;
    dueDate?: string | null;
    estimatedMinutes?: number | null;
    contentPostId?: number | null;
  }) =>
    jsonReq<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Task>) =>
    jsonReq<{ ok: true }>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    jsonReq<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
  start: (id: number) =>
    jsonReq<{ ok: true }>(`/api/tasks/${id}/start`, { method: "POST" }),
  complete: (id: number, actualMinutes?: number | null) =>
    jsonReq<{ ok: true }>(`/api/tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ actualMinutes }),
    }),
  reopen: (id: number) =>
    jsonReq<{ ok: true }>(`/api/tasks/${id}/reopen`, { method: "POST" }),
  forPosts: (postIds: number[]) =>
    jsonReq<{ tasks: TaskWithRefs[] }>(
      `/api/tasks/for-posts?postIds=${postIds.join(",")}`,
    ),
};

// ─── Week items ───────────────────────────────────────────────────────────
// A person's workload is three things at once: manually-created tasks, open
// content posts routed by status, and placeholder slots for posts a client
// is owed but nobody has created yet. The Tasks page and the dashboard both
// read from here so they can never disagree about what someone owes.

export type WeekItem =
  | { kind: "task"; task: TaskWithRefs; dueDate: string | null; done: boolean }
  | { kind: "post"; post: ContentPost; dueDate: string }
  | {
      kind: "placeholder";
      clientId: number;
      clientName: string;
      slotIndex: number; // 1-based, used in title & key
      slotsTotal: number; // total needed for this client this week
      dueDate: string; // friday of current week
    };

/**
 * For each tracked client with a weekly target, return one placeholder per
 * missing post. They only show up if a default assignee is set and we're
 * inside the current week's display window.
 */
export function buildPlaceholders(data: TasksDashboard): WeekItem[] {
  const out: WeekItem[] = [];
  for (const c of data.clientOptions) {
    if (!c.isActive) continue;
    const target = c.weeklyPostTarget ?? 0;
    if (target <= 0) continue;
    const scheduled = data.weeklyPostsByClient[c.id] ?? 0;
    const missing = Math.max(0, target - scheduled);
    for (let i = 0; i < missing; i++) {
      out.push({
        kind: "placeholder",
        clientId: c.id,
        clientName: c.name,
        slotIndex: i + 1,
        slotsTotal: target,
        dueDate: data.weekDueDate,
      });
    }
  }
  return out;
}

export function buildItemsForUser(
  data: TasksDashboard,
  userId: number,
): WeekItem[] {
  const items: WeekItem[] = data.tasks
    .filter((t) => t.assigneeId === userId)
    .map((t) => ({
      kind: "task" as const,
      task: t,
      dueDate: t.dueDate,
      done: t.status === "completed",
    }));
  for (const p of data.openPosts) {
    if (effectiveAssigneeId(p, data.defaultPostAssigneeId) !== userId) continue;
    items.push({ kind: "post", post: p, dueDate: workDueDate(p.scheduledDate) });
  }
  // Placeholders only land on the default assignee's list.
  if (data.defaultPostAssigneeId === userId) {
    items.push(...buildPlaceholders(data));
  }
  return items;
}

export function buildAllItems(data: TasksDashboard): WeekItem[] {
  const items: WeekItem[] = data.tasks.map((t) => ({
    kind: "task" as const,
    task: t,
    dueDate: t.dueDate,
    done: t.status === "completed",
  }));
  for (const p of data.openPosts) {
    items.push({ kind: "post", post: p, dueDate: workDueDate(p.scheduledDate) });
  }
  items.push(...buildPlaceholders(data));
  return items;
}

export function itemKey(it: WeekItem): string {
  if (it.kind === "task") return `t-${it.task.id}`;
  if (it.kind === "post") return `p-${it.post.id}`;
  return `ph-${it.clientId}-${it.slotIndex}`;
}

/** Stable sort within a bucket. */
export function sortItems(items: WeekItem[]): WeekItem[] {
  const kindRank = (k: WeekItem["kind"]) =>
    k === "post" ? 0 : k === "placeholder" ? 1 : 2;
  return [...items].sort((a, b) => {
    const aDue = a.dueDate ?? "9999-12-31";
    const bDue = b.dueDate ?? "9999-12-31";
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return kindRank(a.kind) - kindRank(b.kind);
  });
}

/** Open (not completed) items, split into overdue / due today / rest. */
export function bucketByUrgency(items: WeekItem[]): {
  overdue: WeekItem[];
  today: WeekItem[];
  upcoming: WeekItem[];
} {
  const overdue: WeekItem[] = [];
  const today: WeekItem[] = [];
  const upcoming: WeekItem[] = [];
  for (const it of items) {
    if (it.kind === "task" && it.done) continue;
    const diff = daysUntilDue(it.dueDate);
    if (diff == null) upcoming.push(it);
    else if (diff < 0) overdue.push(it);
    else if (diff === 0) today.push(it);
    else upcoming.push(it);
  }
  return {
    overdue: sortItems(overdue),
    today: sortItems(today),
    upcoming: sortItems(upcoming),
  };
}

/** Total estimated minutes across open items, with the post fallback. */
export function estimatedMinutesFor(
  items: WeekItem[],
  postFallback: number | null,
): number {
  let total = 0;
  for (const it of items) {
    if (it.kind === "task") {
      if (!it.done) total += it.task.estimatedMinutes ?? 0;
    } else if (it.kind === "post") {
      total += it.post.estimatedMinutes ?? postFallback ?? 0;
    } else {
      total += postFallback ?? 0;
    }
  }
  return total;
}

// ─── Grouping by client ───────────────────────────────────────────────────

/** Sentinel key for work that belongs to no client (internal tasks). */
export const NO_CLIENT = -1;

/**
 * Which client a week item belongs to.
 *
 * Posts and placeholders carry a client directly. A manual task does not: it
 * only reaches a client through a linked content post, so an unlinked task is
 * genuinely internal rather than unassigned, and lands under NO_CLIENT.
 */
export function clientIdOf(it: WeekItem, data: TasksDashboard): number {
  if (it.kind === "post") return it.post.clientId;
  if (it.kind === "placeholder") return it.clientId;
  const postId = it.task.contentPostId;
  if (postId == null) return NO_CLIENT;
  return data.postOptions.find((p) => p.id === postId)?.clientId ?? NO_CLIENT;
}

export function clientNameOf(clientId: number, data: TasksDashboard): string {
  if (clientId === NO_CLIENT) return "Internal / no client";
  return (
    data.clientOptions.find((c) => c.id === clientId)?.name ?? "Unknown client"
  );
}

export interface ClientGroup {
  clientId: number;
  clientName: string;
  items: WeekItem[];
  open: number;
  overdue: number;
  estimatedMinutes: number;
}

/**
 * Split items into per-client groups. Ordered by what needs attention first:
 * clients with overdue work, then by how much is open, then alphabetically so
 * the list is stable when everything is healthy. Internal work sorts last
 * regardless, since it is not a client commitment.
 */
export function groupByClient(
  items: WeekItem[],
  data: TasksDashboard,
): ClientGroup[] {
  const byClient = new Map<number, WeekItem[]>();
  for (const it of items) {
    const id = clientIdOf(it, data);
    const list = byClient.get(id) ?? [];
    list.push(it);
    byClient.set(id, list);
  }

  const groups: ClientGroup[] = [];
  for (const [clientId, list] of byClient) {
    const b = bucketByUrgency(list);
    groups.push({
      clientId,
      clientName: clientNameOf(clientId, data),
      items: sortItems(list),
      open: b.overdue.length + b.today.length + b.upcoming.length,
      overdue: b.overdue.length,
      estimatedMinutes: estimatedMinutesFor(list, data.defaultPostEstimatedMinutes),
    });
  }

  return groups.sort((a, b) => {
    if (a.clientId === NO_CLIENT) return 1;
    if (b.clientId === NO_CLIENT) return -1;
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    if (a.open !== b.open) return b.open - a.open;
    return a.clientName.localeCompare(b.clientName);
  });
}
