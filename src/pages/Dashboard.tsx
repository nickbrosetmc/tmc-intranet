// The team homepage. Answers the questions people used to open three pages
// for: what do I owe by Friday, what is waiting on me, is any client behind,
// and (for admins) where is everyone.
//
// The task blocks run the same buildItemsForUser()/bucketByUrgency() helpers
// the Tasks page uses, from a payload shaped like /api/tasks/dashboard. If
// this page and the Tasks page ever disagreed about someone's workload the
// dashboard would stop being trusted, so there is one implementation.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Inbox,
  Users,
} from "lucide-react";
import { usePollingRefresh } from "@/lib/usePollingRefresh";
import {
  bucketByUrgency,
  buildItemsForUser,
  estimatedMinutesFor,
  formatDueDate,
  formatMinutes,
  itemKey,
  type TasksDashboard,
  type UserOption,
  type WeekItem,
} from "@/lib/tasks";
import {
  statusMeta,
  STATUSES,
  type ContentPost,
  type PostStatus,
} from "@/lib/content";
import type { TeamUser } from "@/lib/useUser";

interface DashboardData extends TasksDashboard {
  isAdmin: boolean;
  weekPosts: ContentPost[];
  newSubmissions: {
    id: number;
    type: "request" | "event";
    subject: string;
    clientName: string | null;
    createdAt: string;
  }[];
  newSubmissionCount: number;
  team: {
    clockedIn: {
      userId: number;
      userName: string | null;
      jobName: string;
      startedAt: string;
    }[];
    offToday: {
      userId: number;
      userName: string | null;
      startDate: string;
      endDate: string;
    }[];
    pendingTimeOff: number;
    pendingShifts: number;
  } | null;
}

export function Dashboard({ user }: { user: TeamUser }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  usePollingRefresh(load);

  const firstName = user.name?.split(" ")[0] ?? "there";

  if (error && !data) {
    return (
      <div className="w-full max-w-5xl space-y-4">
        <Greeting firstName={firstName} />
        <Card>
          <p className="text-sm text-muted-foreground">
            Couldn't load your dashboard ({error}).{" "}
            <button onClick={() => void load()} className="text-tmc-gold-dark hover:underline">
              Try again
            </button>
          </p>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="w-full max-w-5xl space-y-4">
        <Greeting firstName={firstName} />
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl space-y-5">
      <Greeting firstName={firstName} weekDueDate={data.weekDueDate} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <MyWeek data={data} />
          <ContentPipeline data={data} />
        </div>
        <div className="space-y-5">
          <NeedsYou data={data} />
          {data.team && <TeamBlock team={data.team} data={data} />}
        </div>
      </div>
    </div>
  );
}

function Greeting({
  firstName,
  weekDueDate,
}: {
  firstName: string;
  weekDueDate?: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
        Hey, {firstName}
      </h1>
      {weekDueDate && (
        <p className="text-sm text-muted-foreground">
          This week's content is due {formatDueDate(weekDueDate)}.
        </p>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  action,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-tmc-slate flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {action && (
            <Link
              href={action.href}
              className="text-[11px] text-tmc-gold-dark hover:underline inline-flex items-center gap-0.5"
            >
              {action.label} <ArrowRight size={11} />
            </Link>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Block 1: my week ────────────────────────────────────────────────────

function MyWeek({ data }: { data: DashboardData }) {
  const { buckets, estimate } = useMemo(() => {
    const items = buildItemsForUser(data, data.user.id);
    return {
      buckets: bucketByUrgency(items),
      estimate: estimatedMinutesFor(items, data.defaultPostEstimatedMinutes),
    };
  }, [data]);

  const openCount =
    buckets.overdue.length + buckets.today.length + buckets.upcoming.length;

  return (
    <Card
      title="My week"
      icon={<CalendarClock size={13} />}
      action={{ label: "All tasks", href: "/tasks" }}
    >
      {openCount === 0 ? (
        <Empty icon={<CheckCircle2 size={15} />}>
          Nothing open. You're clear for the week.
        </Empty>
      ) : (
        <>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="text-2xl font-bold text-tmc-dark tabular-nums">
              {openCount}
            </span>
            <span className="text-muted-foreground">
              open · about {formatMinutes(estimate)} of work
            </span>
          </div>
          <div className="space-y-3">
            {buckets.overdue.length > 0 && (
              <ItemGroup label="Overdue" tone="danger" items={buckets.overdue} data={data} />
            )}
            {buckets.today.length > 0 && (
              <ItemGroup label="Due today" tone="warn" items={buckets.today} data={data} />
            )}
            {buckets.upcoming.length > 0 && (
              <ItemGroup
                label="Coming up"
                tone="normal"
                items={buckets.upcoming.slice(0, 6)}
                more={buckets.upcoming.length - 6}
                data={data}
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function ItemGroup({
  label,
  tone,
  items,
  more = 0,
  data,
}: {
  label: string;
  tone: "danger" | "warn" | "normal";
  items: WeekItem[];
  more?: number;
  data: DashboardData;
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${toneClass}`}>
        {label} ({items.length + more})
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={itemKey(it)} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{itemTitle(it, data)}</span>
            <span className={`text-xs shrink-0 tabular-nums ${toneClass}`}>
              {formatDueDate(it.dueDate)}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li className="text-xs text-muted-foreground">and {more} more</li>
        )}
      </ul>
    </div>
  );
}

function itemTitle(it: WeekItem, data: DashboardData): string {
  if (it.kind === "task") return it.task.title;
  if (it.kind === "placeholder") {
    return `${it.clientName} post ${it.slotIndex} of ${it.slotsTotal}`;
  }
  const client = data.clientOptions.find((c) => c.id === it.post.clientId);
  const title = it.post.title?.trim() || "Untitled post";
  return client ? `${client.name}: ${title}` : title;
}

// ─── Block 2: needs you ──────────────────────────────────────────────────

function NeedsYou({ data }: { data: DashboardData }) {
  // Posts kicked back to this person with edit notes, and posts waiting on
  // them as reviewer. Both already route through openPosts.
  const kickedBack = data.openPosts.filter(
    (p) => p.editNotes && p.assignedTo === data.user.id,
  );
  const toReview = data.openPosts.filter(
    (p) => p.status === "review" && p.reviewerId === data.user.id,
  );
  const nothing =
    data.newSubmissionCount === 0 &&
    kickedBack.length === 0 &&
    toReview.length === 0;

  return (
    <Card title="Needs you" icon={<Inbox size={13} />}>
      {nothing ? (
        <Empty icon={<CheckCircle2 size={15} />}>Nothing waiting on you.</Empty>
      ) : (
        <div className="space-y-3">
          {kickedBack.length > 0 && (
            <Row
              href="/tasks"
              tone="warn"
              count={kickedBack.length}
              label={kickedBack.length === 1 ? "post needs edits" : "posts need edits"}
            />
          )}
          {toReview.length > 0 && (
            <Row
              href="/tasks"
              tone="warn"
              count={toReview.length}
              label={toReview.length === 1 ? "post to review" : "posts to review"}
            />
          )}
          {data.newSubmissionCount > 0 && (
            <div className="space-y-1">
              <Row
                href="/requests"
                tone="normal"
                count={data.newSubmissionCount}
                label={
                  data.newSubmissionCount === 1
                    ? "new client request"
                    : "new client requests"
                }
              />
              <ul className="space-y-0.5 pl-1">
                {data.newSubmissions.slice(0, 3).map((s) => (
                  <li key={s.id} className="text-xs text-muted-foreground truncate">
                    {s.clientName ? `${s.clientName}: ` : ""}
                    {s.subject}
                    {s.type === "event" && (
                      <span className="ml-1 text-[10px] uppercase tracking-wider text-tmc-gold-dark">
                        event
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({
  href,
  tone,
  count,
  label,
}: {
  href: string;
  tone: "warn" | "normal";
  count: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm hover:underline decoration-tmc-gold"
    >
      <span
        className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded text-xs font-bold tabular-nums ${
          tone === "warn"
            ? "bg-amber-100 text-amber-800"
            : "bg-tmc-gold/20 text-tmc-gold-dark"
        }`}
      >
        {count}
      </span>
      <span className="text-tmc-dark">{label}</span>
    </Link>
  );
}

// ─── Block 3: content pipeline ───────────────────────────────────────────

function ContentPipeline({ data }: { data: DashboardData }) {
  const rows = useMemo(() => {
    const byClient = new Map<number, ContentPost[]>();
    for (const p of data.weekPosts) {
      const list = byClient.get(p.clientId) ?? [];
      list.push(p);
      byClient.set(p.clientId, list);
    }
    return data.clientOptions
      .filter((c) => c.isActive && (c.weeklyPostTarget ?? 0) > 0)
      .map((c) => {
        const posts = byClient.get(c.id) ?? [];
        const target = c.weeklyPostTarget ?? 0;
        const counts: Record<PostStatus, number> = {
          idea: 0,
          drafting: 0,
          review: 0,
          completed: 0,
        };
        for (const p of posts) counts[p.status] += 1;
        // Slots the client is owed that nobody has created yet.
        const missing = Math.max(0, target - posts.length);
        return { client: c, target, counts, missing, done: counts.completed };
      })
      .sort((a, b) => a.done / (a.target || 1) - b.done / (b.target || 1));
  }, [data]);

  if (rows.length === 0) {
    return (
      <Card title="Content pipeline" icon={<Clock size={13} />}>
        <Empty>No clients have a weekly post target set.</Empty>
      </Card>
    );
  }

  return (
    <Card
      title="Content pipeline"
      icon={<Clock size={13} />}
      action={{ label: "Planner", href: "/content" }}
    >
      <p className="text-[11px] text-muted-foreground -mt-1">
        Production week of {data.weekStart}
      </p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.client.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-tmc-dark">{r.client.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {r.done}/{r.target} done
              </span>
            </div>
            <div className="flex h-2 rounded overflow-hidden bg-muted">
              {STATUSES.map((s) =>
                r.counts[s.id] > 0 ? (
                  <div
                    key={s.id}
                    style={{
                      backgroundColor: s.color,
                      width: `${(r.counts[s.id] / r.target) * 100}%`,
                    }}
                    title={`${r.counts[s.id]} ${s.label}`}
                  />
                ) : null,
              )}
            </div>
            {r.missing > 0 && (
              <p className="text-[11px] text-amber-700">
                {r.missing} not created yet
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {STATUSES.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: statusMeta(s.id).color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─── Block 4: team (admin) ───────────────────────────────────────────────

function TeamBlock({
  team,
  data,
}: {
  team: NonNullable<DashboardData["team"]>;
  data: DashboardData;
}) {
  // Open workload per person, from the same builders as My Week.
  const perPerson = useMemo(() => {
    const offIds = new Set(team.offToday.map((o) => o.userId));
    return data.userOptions
      .map((u: UserOption) => {
        const items = buildItemsForUser(data, u.id);
        const b = bucketByUrgency(items);
        return {
          user: u,
          open: b.overdue.length + b.today.length + b.upcoming.length,
          overdue: b.overdue.length,
          clockedIn: team.clockedIn.some((c) => c.userId === u.id),
          off: offIds.has(u.id),
        };
      })
      .filter((p) => p.open > 0 || p.clockedIn || p.off)
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [data, team]);

  return (
    <Card title="Team" icon={<Users size={13} />} action={{ label: "By person", href: "/tasks" }}>
      {(team.pendingTimeOff > 0 || team.pendingShifts > 0) && (
        <div className="space-y-1.5">
          {team.pendingTimeOff > 0 && (
            <Row
              href="/admin/time-off"
              tone="warn"
              count={team.pendingTimeOff}
              label={
                team.pendingTimeOff === 1
                  ? "time off request to review"
                  : "time off requests to review"
              }
            />
          )}
          {team.pendingShifts > 0 && (
            <Row
              href="/admin/time-clock"
              tone="warn"
              count={team.pendingShifts}
              label={
                team.pendingShifts === 1
                  ? "shift to approve"
                  : "shifts to approve"
              }
            />
          )}
        </div>
      )}
      {perPerson.length === 0 ? (
        <Empty>Nobody has open work.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {perPerson.map((p) => (
            <li key={p.user.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-tmc-dark inline-flex items-center gap-1.5">
                {p.clockedIn && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"
                    title="Clocked in"
                  />
                )}
                {p.user.name ?? p.user.email}
                {p.off && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    off
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums shrink-0 text-muted-foreground">
                {p.overdue > 0 && (
                  <span className="text-red-700 font-medium">{p.overdue} late · </span>
                )}
                {p.open} open
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Empty({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
      {icon ?? <AlertCircle size={15} />}
      {children}
    </p>
  );
}
