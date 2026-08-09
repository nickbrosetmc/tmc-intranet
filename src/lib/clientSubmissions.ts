// Types + API wrappers for client requests, event briefs, and support tickets.

export type SubmissionType = "request" | "event" | "support";
export type SubmissionStatus = "new" | "in_progress" | "done";
export type Severity = "low" | "normal" | "high" | "urgent";

export const TYPE_LABELS: Record<SubmissionType, string> = {
  request: "Request",
  event: "Event",
  support: "Support",
};

/** Client-facing wording; deliberately about impact, not jargon. */
export const SEVERITIES: { id: Severity; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Minor annoyance, no rush" },
  { id: "normal", label: "Normal", hint: "Something's wrong but we can work around it" },
  { id: "high", label: "High", hint: "A key feature is broken" },
  { id: "urgent", label: "Urgent", hint: "Site down or losing business right now" },
];

export const SEVERITY_TONE: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

export interface ClientSubmission {
  id: number;
  clientId: number;
  clientUserId: number;
  type: SubmissionType;
  subject: string;
  details: string;
  eventDate: string | null;
  location: string | null;
  severity: Severity | null;
  affectedUrl: string | null;
  status: SubmissionStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubmission extends ClientSubmission {
  clientName: string;
  submitterName: string;
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
};

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

export const submissions = {
  // Client
  mine: () =>
    jsonReq<{ submissions: ClientSubmission[] }>("/api/client/submissions"),
  submit: (data: {
    type: SubmissionType;
    subject: string;
    details: string;
    eventDate?: string | null;
    location?: string | null;
    severity?: Severity | null;
    affectedUrl?: string | null;
  }) =>
    jsonReq<{ submission: ClientSubmission }>("/api/client/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Team (any team member can view + manage; recipient editing stays admin)
  teamList: () =>
    jsonReq<{ submissions: AdminSubmission[]; notifyEmails: string }>(
      "/api/submissions",
    ),
  update: (
    id: number,
    data: { status?: SubmissionStatus; adminNotes?: string | null },
  ) =>
    jsonReq<{ ok: true }>(`/api/submissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
