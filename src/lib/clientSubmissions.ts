// Types + API wrappers for client requests / event briefs.

export type SubmissionType = "request" | "event";
export type SubmissionStatus = "new" | "in_progress" | "done";

export interface ClientSubmission {
  id: number;
  clientId: number;
  clientUserId: number;
  type: SubmissionType;
  subject: string;
  details: string;
  eventDate: string | null;
  location: string | null;
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
