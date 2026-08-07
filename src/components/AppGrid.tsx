import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { fetchApps, launchApp, recordLaunch, type App, type GroupWithApps } from "@/lib/apps";

/** Internal SPA paths look like "/foo" — anything else is treated as external. */
function isInternalPath(url: string | null): boolean {
  return !!url && url.startsWith("/") && !url.startsWith("//");
}

/**
 * "tiles" is the original roomy springboard. "compact" is the same springboard
 * at 52px with the section spacing pulled in, for the dashboard homepage where
 * the launcher has to share the screen with the week's work.
 */
export function AppGrid({ variant = "tiles" }: { variant?: "tiles" | "compact" }) {
  const [groups, setGroups] = useState<GroupWithApps[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApps()
      .then((res) => setGroups(res.groups))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Couldn't load your apps: {error}
      </div>
    );
  }

  if (!groups) {
    return <AppGridSkeleton compact={variant === "compact"} />;
  }

  if (groups.every((g) => g.apps.length === 0)) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        No apps configured yet. Ask an admin to add some.
      </div>
    );
  }

  const compact = variant === "compact";
  // Compact lays the groups out side by side. Stacked, three groups of three
  // apps used a third of the width and 300px of height; in columns they fill
  // the row and cost about 100px.
  return (
    <div className={compact ? GROUPS_ROW : "w-full max-w-5xl space-y-10"}>
      {groups
        .filter((g) => g.apps.length > 0)
        .map(({ group, apps }) => (
          <section key={group.id}>
            <h2
              className={`text-xs font-semibold uppercase tracking-widest text-tmc-slate ${
                compact ? "mb-2" : "mb-4"
              }`}
            >
              {group.name}
            </h2>
            <div className={compact ? COMPACT_TILES : ROOMY_GRID}>
              {apps.map((app) => (
                <AppTile key={app.id} app={app} compact={compact} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

const ROOMY_GRID =
  "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-6";
/** Groups across the row, so the launcher is as wide as the dashboard below. */
const GROUPS_ROW =
  "w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4";
/** Tiles pack and wrap inside their group column, whatever the app count. */
const COMPACT_TILES = "flex flex-wrap gap-x-4 gap-y-3";

function AppTile({ app, compact = false }: { app: App; compact?: boolean }) {
  const [, navigate] = useLocation();
  const internal = isInternalPath(app.webUrl);

  const handleClick = () => {
    if (app.isComingSoon) return;
    if (internal && app.webUrl) {
      // Log launch best-effort, then SPA-navigate
      recordLaunch(app.id, "web");
      navigate(app.webUrl);
      return;
    }
    launchApp(app);
  };

  const tileBg = app.iconBgColor ? `#${app.iconBgColor}` : "#404E5C";

  return (
    <button
      type="button"
      className={`app-icon group${compact ? " app-icon--sm" : ""}`}
      onClick={handleClick}
      disabled={app.isComingSoon}
      aria-label={app.name}
    >
      <div
        className="app-icon-tile"
        style={
          {
            "--tile-bg": tileBg,
            opacity: app.isComingSoon ? 0.45 : 1,
          } as React.CSSProperties
        }
      >
        <AppIcon app={app} small={compact} />
      </div>
      <div className="app-icon-label">
        {app.name}
        {app.isComingSoon && (
          <span className="block text-[10px] font-normal text-muted-foreground">
            soon
          </span>
        )}
      </div>
    </button>
  );
}

function AppIcon({ app, small = false }: { app: App; small?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (app.iconUrl && !imgFailed) {
    return (
      <img
        src={app.iconUrl}
        alt=""
        className={small ? "h-4 w-4 select-none" : "h-9 w-9 select-none"}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }
  if (app.iconEmoji) {
    return <span aria-hidden="true">{app.iconEmoji}</span>;
  }
  return (
    <span
      aria-hidden="true"
      className={`text-white/90 font-semibold uppercase ${small ? "text-[10px]" : "text-base"}`}
    >
      {app.name.slice(0, 1)}
    </span>
  );
}

function AppGridSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? GROUPS_ROW : "w-full max-w-5xl space-y-10"}>
      {[0, 1, 2].map((s) => (
        <section key={s}>
          <div
            className={`h-3 w-32 bg-tmc-silver/40 rounded animate-pulse ${
              compact ? "mb-2" : "mb-4"
            }`}
          />
          <div className={compact ? COMPACT_TILES : ROOMY_GRID}>
            {Array.from({ length: compact ? 3 : 6 }).map((_, i) => (
              <div key={i} className={`app-icon${compact ? " app-icon--sm" : ""}`}>
                <div className="app-icon-tile bg-tmc-silver/40 animate-pulse" />
                <div className="h-3 w-12 bg-tmc-silver/40 rounded mt-1 animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
