import { useEffect, useState } from "react";
import { fetchApps, launchApp, type App, type GroupWithApps } from "@/lib/apps";

export function AppGrid() {
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
    return <AppGridSkeleton />;
  }

  if (groups.every((g) => g.apps.length === 0)) {
    return (
      <div className="text-center text-muted-foreground text-sm">
        No apps configured yet. Ask an admin to add some.
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
  const handleClick = () => launchApp(app);

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

function AppIcon({ app }: { app: App }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (app.iconUrl && !imgFailed) {
    return (
      <img
        src={app.iconUrl}
        alt=""
        className="h-9 w-9 select-none"
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
      className="text-white/90 font-semibold uppercase text-base"
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
