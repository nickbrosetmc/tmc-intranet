// Tiny typed wrapper around the /api/admin/* endpoints.

import type { App, AppGroup } from "./apps";
import type { Announcement } from "./announcements";

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: "user" | "admin";
  invitedBy: number | null;
  createdAt: string;
  lastSignedIn: string | null;
}

export interface AnalyticsSummary {
  totalsAllTime: number;
  totalsLast7Days: number;
  totalsToday: number;
  topApps: { appId: number; name: string; iconEmoji: string | null; count: number }[];
  topUsers: { userId: number; email: string; name: string | null; count: number }[];
  recentLaunches: {
    launchedAt: string;
    userEmail: string;
    appName: string;
    launchType: string;
  }[];
}

async function jsonRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// Users
export const adminUsers = {
  list: () => jsonRequest<{ users: AdminUser[] }>("/api/admin/users"),
  invite: (email: string, role: "user" | "admin") =>
    jsonRequest<{ user: AdminUser }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  setRole: (id: number, role: "user" | "admin") =>
    jsonRequest<{ ok: true }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  remove: (id: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/users/${id}`, {
      method: "DELETE",
    }),
};

// Apps
export const adminApps = {
  list: () => jsonRequest<{ apps: App[] }>("/api/admin/apps"),
  create: (data: Partial<App>) =>
    jsonRequest<{ app: App }>("/api/admin/apps", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<App>) =>
    jsonRequest<{ ok: true }>(`/api/admin/apps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/apps/${id}`, {
      method: "DELETE",
    }),
};

// Groups
export const adminGroups = {
  list: () => jsonRequest<{ groups: AppGroup[] }>("/api/admin/groups"),
  create: (name: string, sortOrder = 0) =>
    jsonRequest<{ group: AppGroup }>("/api/admin/groups", {
      method: "POST",
      body: JSON.stringify({ name, sortOrder }),
    }),
  update: (id: number, data: { name?: string; sortOrder?: number }) =>
    jsonRequest<{ ok: true }>(`/api/admin/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/groups/${id}`, {
      method: "DELETE",
    }),
};

// Analytics
export const adminAnalytics = {
  summary: () => jsonRequest<AnalyticsSummary>("/api/admin/analytics"),
};

// Clients
export interface AdminClient {
  id: number;
  name: string;
  filesUrl: string | null;
  ghlUrl: string | null;
  passwordVaultUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClientUser {
  id: number;
  clientId: number;
  username: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastSignedIn: string | null;
}

export const adminClients = {
  list: () => jsonRequest<{ clients: AdminClient[] }>("/api/admin/clients"),
  create: (data: {
    name: string;
    filesUrl?: string | null;
    ghlUrl?: string | null;
    passwordVaultUrl?: string | null;
  }) =>
    jsonRequest<{ client: AdminClient }>("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: number,
    data: Partial<Pick<AdminClient, "name" | "filesUrl" | "ghlUrl" | "passwordVaultUrl" | "isActive">>,
  ) =>
    jsonRequest<{ ok: true }>(`/api/admin/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/clients/${id}`, {
      method: "DELETE",
    }),
  listUsers: (clientId: number) =>
    jsonRequest<{ users: AdminClientUser[] }>(
      `/api/admin/clients/${clientId}/users`,
    ),
  createUser: (
    clientId: number,
    data: { username: string; password: string; name: string },
  ) =>
    jsonRequest<{ user: AdminClientUser }>(`/api/admin/clients/${clientId}/users`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (userId: number, data: { name?: string; password?: string }) =>
    jsonRequest<{ ok: true }>(`/api/admin/client-users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeUser: (userId: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/client-users/${userId}`, {
      method: "DELETE",
    }),
};

// Announcements
export const adminAnnouncements = {
  list: () =>
    jsonRequest<{ announcements: Announcement[] }>("/api/admin/announcements"),
  create: (data: { title: string; body: string; isPinned?: boolean }) =>
    jsonRequest<{ announcement: Announcement }>("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (
    id: number,
    data: { title?: string; body?: string; isPinned?: boolean; isActive?: boolean },
  ) =>
    jsonRequest<{ ok: true }>(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    jsonRequest<{ ok: true }>(`/api/admin/announcements/${id}`, {
      method: "DELETE",
    }),
};
