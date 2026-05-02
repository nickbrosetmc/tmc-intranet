export interface AppGroup {
  id: number;
  name: string;
  sortOrder: number;
}

export interface App {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconEmoji: string | null;
  iconBgColor: string | null;
  desktopProtocol: string | null;
  webUrl: string | null;
  groupId: number | null;
  sortOrder: number;
  isComingSoon: boolean;
  isActive: boolean;
}

export interface GroupWithApps {
  group: AppGroup;
  apps: App[];
}

export interface AppsResponse {
  groups: GroupWithApps[];
}

export async function fetchApps(): Promise<AppsResponse> {
  const res = await fetch("/api/apps", { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`/api/apps returned ${res.status}`);
  }
  return (await res.json()) as AppsResponse;
}

export function recordLaunch(appId: number, type: "desktop" | "web"): void {
  // Best-effort, fire-and-forget. Failure shouldn't block the launch.
  fetch(`/api/apps/${appId}/launch`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  }).catch(() => {});
}

/**
 * Smart launcher: try desktop protocol via hidden iframe, fall back to opening
 * the web URL in a new tab if user is still on the page after a short delay.
 */
export function launchApp(app: App): void {
  if (app.isComingSoon) return;

  const usedDesktop = Boolean(app.desktopProtocol);
  recordLaunch(app.id, usedDesktop ? "desktop" : "web");

  if (!app.desktopProtocol) {
    if (app.webUrl) window.open(app.webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // Trigger desktop protocol via hidden iframe (least-invasive method —
  // doesn't navigate the parent if the OS doesn't have a handler)
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = app.desktopProtocol;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 200);

  // If user is still here in 1.2s, open the web URL as fallback
  if (app.webUrl) {
    let opened = false;
    const onVisChange = () => {
      if (document.hidden) opened = true;
    };
    document.addEventListener("visibilitychange", onVisChange);
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisChange);
      if (!opened) {
        window.open(app.webUrl!, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  }
}
