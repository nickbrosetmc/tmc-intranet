import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { fetchApps, launchApp, recordLaunch, type App, type GroupWithApps } from "@/lib/apps";

/** Internal SPA paths look like "/foo" — anything else is treated as external. */
function isInternalPath(url: string | null): boolean {
  return !!url && url.startsWith("/") && !url.startsWith("//");
}

/**
 * "tiles" is the original springboard: big icons, one section per group.
 * "compact" is a dense chip row for the dashboard homepage, where the
 * launcher has to stay reachable without pushing everything else below the
 * fold. Same links, a fifth of the height.
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
    return variant === "compact" ? <CompactSkeleton /> : <AppGridSkeleton />;
  }

  if (groups.every((g) => g.apps.length === 0)) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        No apps configured yet. Ask an admin to add some.
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="w-full flex flex-wrap gap-1.5">
        {groups
          .filter((g) => g.apps.length > 0)
          .flatMap(({ apps }) => apps)
          .map((app) => (
            <AppChip key={app.id} app={app} />
          ))}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-10">
      {groups
        .filter((g) => g.apps.length > 0)
        .map(({ group, apps }) => (
          <section key={group.id}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-4">
              {group.name}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-6">
              {apps.map((app) => (
                <AppTile key={app.id} app={app} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function AppTile({ app }: { app: App }) {
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
      className="app-icon group"
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
        <AppIcon app={app} />
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

/** Dense launcher chip: small icon + name, sized for a wrapping row. */
function AppChip({ app }: { app: App }) {
  const [, navigate] = useLocation();
  const internal = isInternalPath(app.webUrl);

  const handleClick = () => {
    if (app.isComingSoon) return;
    if (internal && app.webUrl) {
      recordLaunch(app.id, "web");
      navigate(app.webUrl);
      return;
    }
    launchApp(app);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={app.isComingSoon}
      aria-label={app.name}
      title={app.isComingSoon ? `${app.name} (coming soon)` : app.name}
      className="inline-flex items-center gap-1.5 rounded-md border bg-card pl-1 pr-2.5 py-1 text-xs font-medium text-tmc-dark transition hover:border-tmc-gold hover:bg-tmc-gold/5 disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-card"
    >
      <span
        className="w-5 h-5 rounded flex items-center justify-center text-[11px] shrink-0 overflow-hidden"
        style={{ background: app.iconBgColor ? `#${app.iconBgColor}` : "#404E5C" }}
      >
        <AppIcon app={app} small />
      </span>
      <span className="truncate max-w-32">{app.name}</span>
    </button>
  );
}

function CompactSkeleton() {
  return (
    <div className="w-full flex flex-wrap gap-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-7 w-24 rounded-md bg-tmc-silver/40 animate-pulse" />
      ))}
    </div>
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

function AppGridSkeleton() {
  return (
    <div className="w-full max-w-5xl space-y-10">
      {[0, 1, 2].map((s) => (
        <section key={s}>
          <div className="h-3 w-32 bg-tmc-silver/40 rounded mb-4 animate-pulse" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-4 gap-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="app-icon">
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
