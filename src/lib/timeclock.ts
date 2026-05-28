// Types, API wrappers, and helpers for the time clock feature.

export type PayRateType = "hourly" | "salaried" | "day_rate";
export type ShiftStatus = "active" | "completed" | "pending" | "denied";

export interface Job {
  id: number;
  name: string;
  description: string | null;
  payRateType: PayRateType;
  payRate: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobEligibilityEntry {
  id: number;
  jobId: number;
  userId: number;
  createdAt: string;
  userName: string | null;
  userEmail: string;
}

export interface Shift {
  id: number;
  userId: number;
  jobId: number;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  status: ShiftStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  denialReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShift extends Shift {
  userName: string | null;
  userEmail: string;
  jobName: string;
}

export interface UserOption {
  id: number;
  name: string | null;
  email: string;
}

export interface MeDashboard {
  user: { id: number; name: string | null; email: string };
  eligibleJobs: Job[];
  activeShift: Shift | null;
  recentShifts: Shift[];
}

export interface AdminDashboard {
  jobs: Job[];
  eligibilityByJob: Record<number, JobEligibilityEntry[]>;
  activeShifts: AdminShift[];
  recentShifts: AdminShift[];
  pendingCount: number;
  userOptions: UserOption[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export const PAY_RATE_TYPE_LABELS: Record<PayRateType, string> = {
  hourly: "Hourly",
  salaried: "Salaried",
  day_rate: "Day Rate",
};

export function formatRate(job: Pick<Job, "payRateType" | "payRate">): string {
  const dollars = `$${job.payRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  switch (job.payRateType) {
    case "hourly": return `${dollars}/hr`;
    case "day_rate": return `${dollars}/day`;
    case "salaried": return `${dollars}/yr`;
  }
}

/** Hours (decimal) between two ISO datetime strings. */
export function shiftHours(startIso: string, endIso: string | null): number {
  const end = endIso ? new Date(endIso) : new Date();
  const ms = end.getTime() - new Date(startIso).getTime();
  return Math.max(0, ms / 3_600_000);
}

/** "2h 34m" given decimal hours. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "8:14 AM, May 20" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Sum hours for a list of shifts in a given range (counts completed only). */
export function totalHoursInRange(
  shifts: Shift[],
  startIso: string,
  endIso: string,
): number {
  return shifts
    .filter(
      (s) =>
        (s.status === "completed" || s.status === "active") &&
        s.startedAt >= startIso &&
        s.startedAt <= endIso,
    )
    .reduce((sum, s) => sum + shiftHours(s.startedAt, s.endedAt), 0);
}

/** Estimate cost for a shift based on job pay rate. Day rate = 1× per shift. */
export function shiftCost(shift: Shift, job: Job | undefined): number {
  if (!job) return 0;
  const hours = shiftHours(shift.startedAt, shift.endedAt);
  switch (job.payRateType) {
    case "hourly": return hours * job.payRate;
    case "day_rate": return job.payRate; // 1 shift = 1 day at minimum
    case "salaried": return 0;
  }
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
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const timeclock = {
  // Team
  myDashboard: () => jsonReq<MeDashboard>("/api/timeclock/me/dashboard"),
  clockIn: (jobId: number, notes?: string) =>
    jsonReq<{ shift: Shift }>("/api/timeclock/me/clock-in", {
      method: "POST",
      body: JSON.stringify({ jobId, notes }),
    }),
  clockOut: (notes?: string) =>
    jsonReq<{ ok: true }>("/api/timeclock/me/clock-out", {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  backdate: (data: {
    jobId: number;
    startedAt: string;
    endedAt: string;
    notes?: string;
  }) =>
    jsonReq<{ shift: Shift }>("/api/timeclock/me/backdate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Admin
  adminDashboard: () => jsonReq<AdminDashboard>("/api/admin/timeclock/dashboard"),

  // Jobs
  createJob: (data: Partial<Job>) =>
    jsonReq<{ job: Job }>("/api/admin/timeclock/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateJob: (id: number, data: Partial<Job>) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteJob: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/jobs/${id}`, { method: "DELETE" }),

  // Eligibility
  addEligibility: (jobId: number, userId: number) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/jobs/${jobId}/eligibility`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  removeEligibility: (jobId: number, userId: number) =>
    jsonReq<{ ok: true }>(
      `/api/admin/timeclock/jobs/${jobId}/eligibility?userId=${userId}`,
      { method: "DELETE" },
    ),

  // Shifts (admin)
  updateShift: (id: number, data: Partial<Shift>) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/shifts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteShift: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/shifts/${id}`, { method: "DELETE" }),
  approveShift: (id: number) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/shifts/${id}/approve`, {
      method: "POST",
    }),
  denyShift: (id: number, reason?: string) =>
    jsonReq<{ ok: true }>(`/api/admin/timeclock/shifts/${id}/deny`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
