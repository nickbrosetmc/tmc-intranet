// Types, API wrappers, and helpers for the time-off feature.

export type TimeOffStatus = "pending" | "approved" | "denied" | "cancelled";

export interface TimeOffRequest {
  id: number;
  userId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string | null;
  coveragePlan: string;
  status: TimeOffStatus;
  decidedBy: number | null;
  decidedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTimeOffRequest extends TimeOffRequest {
  userName: string | null;
  userEmail: string;
  decidedByName: string | null;
}

export interface UserOption {
  id: number;
  name: string | null;
  email: string;
}

export interface MeTimeOffDashboard {
  user: { id: number; name: string | null; email: string };
  myRequests: TimeOffRequest[];
  upcomingTeam: AdminTimeOffRequest[];
}

export interface AdminTimeOffDashboard {
  requests: AdminTimeOffRequest[];
  pendingCount: number;
  userOptions: UserOption[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<TimeOffStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
};

/** "May 28" or "May 28 – Jun 2" or "May 28 – Jun 2, 2026" if needed. */
export function formatDateRange(startDate: string, endDate: string): string {
  const s = parseLocalDate(startDate);
  const e = parseLocalDate(endDate);
  const sameDay = startDate === endDate;
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameYearAsNow = s.getFullYear() === new Date().getFullYear();

  const sFmt = s.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYearAsNow ? {} : { year: "numeric" }),
  });
  if (sameDay) return sFmt;
  const eFmt = e.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear && sameYearAsNow ? {} : { year: "numeric" }),
  });
  return `${sFmt} – ${eFmt}`;
}

/** Inclusive number of days in [startDate, endDate]. */
export function dayCount(startDate: string, endDate: string): number {
  const s = parseLocalDate(startDate).getTime();
  const e = parseLocalDate(endDate).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

/** Today as YYYY-MM-DD in local time (for <input type="date"> min). */
export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a *local* date (avoids the UTC-midnight off-by-one). */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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

export const timeoff = {
  // Team
  myDashboard: () => jsonReq<MeTimeOffDashboard>("/api/timeoff/me/dashboard"),
  submit: (data: {
    startDate: string;
    endDate: string;
    coveragePlan: string;
    reason?: string;
  }) =>
    jsonReq<{ request: TimeOffRequest }>("/api/timeoff/me", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMine: (
    id: number,
    data: Partial<{
      startDate: string;
      endDate: string;
      coveragePlan: string;
      reason: string;
    }>,
  ) =>
    jsonReq<{ ok: true }>(`/api/timeoff/me/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  cancelMine: (id: number) =>
    jsonReq<{ ok: true }>(`/api/timeoff/me/${id}`, { method: "DELETE" }),

  // Admin
  adminDashboard: () =>
    jsonReq<AdminTimeOffDashboard>("/api/admin/timeoff/dashboard"),
  update: (id: number, data: Partial<AdminTimeOffRequest>) =>
    jsonReq<{ ok: true }>(`/api/admin/timeoff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/timeoff/${id}`, { method: "DELETE" }),
  approve: (id: number, adminNote?: string) =>
    jsonReq<{ ok: true }>(`/api/admin/timeoff/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ adminNote }),
    }),
  deny: (id: number, adminNote?: string) =>
    jsonReq<{ ok: true }>(`/api/admin/timeoff/${id}/deny`, {
      method: "POST",
      body: JSON.stringify({ adminNote }),
    }),
};
