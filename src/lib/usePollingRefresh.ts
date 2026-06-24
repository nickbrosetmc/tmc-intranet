import { useEffect, useRef } from "react";

// Keeps a page's data fresh without a manual reload: re-runs `refresh` on a
// fixed interval and whenever the tab regains focus / becomes visible. The
// interval pauses while the tab is hidden to avoid pointless background
// fetches. `refresh` is kept in a ref so callers can pass an inline closure
// without resubscribing every render.

export function usePollingRefresh(
  refresh: () => void,
  opts: { intervalMs?: number; enabled?: boolean } = {},
): void {
  const { intervalMs = 60_000, enabled = true } = opts;
  const fn = useRef(refresh);
  fn.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.visibilityState === "visible") fn.current();
    };
    const start = () => {
      if (timer == null) timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    function onVisible() {
      if (document.visibilityState === "visible") {
        fn.current(); // refetch immediately on return
        start();
      } else {
        stop();
      }
    }
    function onFocus() {
      fn.current();
    }

    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, enabled]);
}
