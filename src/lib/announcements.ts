export interface Announcement {
  id: number;
  title: string;
  body: string;
  createdBy: number | null;
  isPinned: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementsResponse {
  announcements: Announcement[];
}

export async function fetchAnnouncements(): Promise<AnnouncementsResponse> {
  const res = await fetch("/api/announcements", {
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error(`/api/announcements returned ${res.status}`);
  }
  return (await res.json()) as AnnouncementsResponse;
}
