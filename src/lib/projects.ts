// Client projects (websites, landing pages, campaigns...) and their launch
// dates: where analytics for the work should look back to.

import { daysBetween } from "./renewal";

export type ProjectKind =
  | "website"
  | "landing_page"
  | "ecommerce"
  | "branding"
  | "campaign"
  | "other";

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  website: "Website",
  landing_page: "Landing page",
  ecommerce: "Online store",
  branding: "Branding",
  campaign: "Campaign",
  other: "Other",
};

export interface ClientProject {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  kind: ProjectKind;
  /** YYYY-MM-DD it went (or goes) live. */
  launchDate: string | null;
  /** One-off price in whole dollars. */
  price: number | null;
  url: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Partial<
  Pick<ClientProject, "clientId" | "name" | "kind" | "launchDate" | "price" | "url" | "notes">
>;

export type LaunchState =
  | { state: "launched"; daysSince: number }
  | { state: "upcoming"; daysUntil: number }
  | { state: "unscheduled" };

export function launchState(launchDate: string | null, today: string): LaunchState {
  if (!launchDate) return { state: "unscheduled" };
  const days = daysBetween(launchDate, today);
  return days >= 0 ? { state: "launched", daysSince: days } : { state: "upcoming", daysUntil: -days };
}

/** A link that opens: bare domains like "example.com" get https:// added. */
export function projectHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status}`);
  }
  return (await res.json()) as T;
}

export const projects = {
  list: (clientId?: number) =>
    req<{ projects: ClientProject[] }>(
      clientId != null ? `/api/admin/projects?clientId=${clientId}` : "/api/admin/projects",
    ),
  create: (data: ProjectInput) =>
    req<{ project: ClientProject }>("/api/admin/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: ProjectInput) =>
    req<{ ok: true }>(`/api/admin/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => req<{ ok: true }>(`/api/admin/projects/${id}`, { method: "DELETE" }),
};
