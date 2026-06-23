// Types, API wrappers, and helpers for the tasks system.
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
