import { useEffect, useState } from "react";

// Detects when a newer build has been deployed and the running tab is
// stale. Polls /version.json (stamped by the build with the same id that's
// inlined into this bundle as __BUILD_ID__). Returns `updateReady` so the
// app can show a reload banner. Also auto-reloads the next time the tab is
// backgrounded then refocused — a safe moment that won't interrupt typing.

const POLL_MS = 60_000;

async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { buildId?: string };
    return typeof body.buildId === "string" ? body.buildId : null;
  } catch {
    return null;
  }
}

export function useAppVersion(): boolean {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let ready = false;

    async function check() {
      if (cancelled || ready) return;
      const deployed = await fetchDeployedBuildId();
      if (cancelled || !deployed) return;
      if (deployed !== __BUILD_ID__) {
        ready = true;
        setUpdateReady(true);
      }
    }

    const interval = setInterval(check, POLL_MS);

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      // Returning to a backgrounded tab is a safe time to auto-reload
      // once an update is known to be pending.
      if (ready) {
        window.location.reload();
        return;
      }
      void check();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const initial = setTimeout(check, 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return updateReady;
}
