// Small pieces shared by the client profile and the Projects page.

import { launchState } from "@/lib/projects";

/** "Mar 3, 2026" from a calendar date, read as a local day. */
export function fmtLongDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** When a project launched (and how much data there is since), or launches. */
export function LaunchLabel({ launchDate, today }: { launchDate: string | null; today: string }) {
  const s = launchState(launchDate, today);
  if (s.state === "unscheduled") {
    return <span className="text-xs text-muted-foreground">No launch date yet</span>;
  }
  if (s.state === "upcoming") {
    return (
      <div className="leading-tight">
        <div className="text-sm">Launches {fmtLongDay(launchDate!)}</div>
        <div className="text-[11px] text-tmc-gold-dark">
          in {s.daysUntil} {s.daysUntil === 1 ? "day" : "days"}
        </div>
      </div>
    );
  }
  return (
    <div className="leading-tight">
      <div className="text-sm">Launched {fmtLongDay(launchDate!)}</div>
      <div className="text-[11px] text-muted-foreground">
        {s.daysSince === 0
          ? "today"
          : `${s.daysSince} ${s.daysSince === 1 ? "day" : "days"} of data since launch`}
      </div>
    </div>
  );
}
