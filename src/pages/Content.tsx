import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { finance } from "@/lib/finance";
import {
  addDays,
  computeProgress,
  content,
  coverage,
  parseIsoDate,
  startOfWeek,
  statusMeta,
  STATUSES,
  toIsoDate,
  weekDates,
  weekLabel,
  type ContentDashboard,
  type ContentPost,
  type FunnelStage,
  type Pillar,
  type PostStatus,
} from "@/lib/content";
import type { RecurringClient } from "@/lib/finance";
import { tasksApi, type TaskWithRefs } from "@/lib/tasks";

const ALL_TABS = [
  { id: "week", label: "This Week", adminOnly: false },
  { id: "coverage", label: "Coverage", adminOnly: false },
  { id: "settings", label: "Settings", adminOnly: true },
] as const;
type Tab = (typeof ALL_TABS)[number]["id"];

export function ContentPage() {
  const userState = useUser();
  const isAdmin =
    userState.status === "authenticated" &&
    userState.user.type === "team" &&
    userState.user.role === "admin";
  const TABS = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  const [tab, setTab] = useState<Tab>("week");
  // Anchor date — we work in week chunks. Default shows the production week
  // (the week whose completion deadline is THIS Friday).
  const [anchorIso, setAnchorIso] = useState<string>(() => {
    const today = new Date();
    // Show next week by default (the one we're approving FOR)
    return toIsoDate(addDays(startOfWeek(today), 7));
  });

  // Fetch a wide range — 90 days back (for rolling Coverage windows) +
  // 5 weeks around the anchor so This Week is covered even if user is
  // browsing a future week.
  const range = useMemo(() => {
    const today = new Date();
    const anchor = parseIsoDate(anchorIso);
    const earliest = new Date(
      Math.min(
        today.getTime() - 90 * 24 * 60 * 60 * 1000,
        anchor.getTime() - 14 * 24 * 60 * 60 * 1000,
      ),
    );
    const latest = new Date(
      Math.max(
        today.getTime() + 35 * 24 * 60 * 60 * 1000,
        anchor.getTime() + 21 * 24 * 60 * 60 * 1000,
      ),
    );
    return { start: toIsoDate(earliest), end: toIsoDate(latest) };
  }, [anchorIso]);

  const [d, setD] = useState<ContentDashboard | null>(null);
  const [tasksByPost, setTasksByPost] = useState<Map<number, TaskWithRefs[]>>(
    new Map(),
  );

  async function refresh() {
    try {
      const data = await content.dashboard(range.start, range.end);
      setD(data);
      const postIds = data.posts.map((p) => p.id);
      if (postIds.length > 0) {
        const { tasks } = await tasksApi.forPosts(postIds);
        const map = new Map<number, TaskWithRefs[]>();
        for (const t of tasks) {
          if (t.contentPostId == null) continue;
          const list = map.get(t.contentPostId) ?? [];
          list.push(t);
          map.set(t.contentPostId, list);
        }
        setTasksByPost(map);
      } else {
        setTasksByPost(new Map());
      }
    } catch (e) {
      toast.error(`Failed to load content: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  if (!d) {
    return <div className="text-muted-foreground text-sm">Loading content pipeline…</div>;
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Content Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Weekly content production with pillar & funnel coverage tracking.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? "border-tmc-gold-dark text-tmc-dark"
                : "border-transparent text-muted-foreground hover:text-tmc-dark"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "week" && (
        <WeekView
          d={d}
          anchorIso={anchorIso}
          setAnchorIso={setAnchorIso}
          onChanged={refresh}
          tasksByPost={tasksByPost}
        />
      )}
      {tab === "coverage" && <CoverageView d={d} />}
      {tab === "settings" && isAdmin && <SettingsView d={d} onChanged={refresh} />}
    </div>
  );
}

// ─── Week view ───────────────────────────────────────────────────────────

function WeekView({
  d,
  anchorIso,
  setAnchorIso,
  onChanged,
  tasksByPost,
}: {
  d: ContentDashboard;
  anchorIso: string;
  setAnchorIso: (v: string) => void;
  onChanged: () => void;
  tasksByPost: Map<number, TaskWithRefs[]>;
}) {
  const dates = weekDates(anchorIso);
  const weekStart = dates[0];
  const weekEnd = dates[6];
  const today = new Date();

  const tracked = d.clients.filter(
    (c) => c.isActive && c.weeklyPostTarget && c.weeklyPostTarget > 0,
  );

  const postsInWeek = d.posts.filter(
    (p) => p.scheduledDate >= weekStart && p.scheduledDate <= weekEnd,
  );

  const progress = computeProgress(postsInWeek, weekStart, today);

  // Pillar + funnel weekly mix
  const pillarMix = coverage(postsInWeek, d.pillars, "pillarId");
  const funnelMix = coverage(postsInWeek, d.funnelStages, "funnelStageId");

  function shiftWeek(weeks: number) {
    setAnchorIso(toIsoDate(addDays(parseIsoDate(anchorIso), 7 * weeks)));
  }
  // The "current production week" is whatever week we're approving FOR
  // this Friday — i.e. the week starting next Monday.
  const productionWeekIso = toIsoDate(addDays(startOfWeek(new Date()), 7));
  const isProductionWeek = weekStart === productionWeekIso;
  function jumpToProductionWeek() {
    setAnchorIso(productionWeekIso);
  }

  return (
    <div className="space-y-4">
      {/* Week picker — stacks on mobile, inline on sm+ */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:flex-wrap sm:gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
          >
            ←
          </Button>
          <div className="font-semibold text-tmc-dark text-center flex-1 sm:flex-none sm:min-w-44">
            Week of {weekLabel(anchorIso)}
            {isProductionWeek && (
              <span className="ml-2 inline-block text-[10px] font-semibold uppercase tracking-wider bg-tmc-gold/30 text-tmc-dark px-1.5 py-0.5 rounded">
                Current
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
          >
            →
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isProductionWeek && (
            <Button variant="ghost" size="sm" onClick={jumpToProductionWeek}>
              ← Current week
            </Button>
          )}
          <PostDialog
            mode="create"
            d={d}
            onSaved={onChanged}
            defaultDate={weekStart}
          />
        </div>
      </div>

      {/* Progress */}
      <ProgressCard progress={progress} />

      {/* Weekly mix (pillar + funnel) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MixCard title="Pillar mix this week" buckets={pillarMix} />
        <MixCard title="Funnel stage mix this week" buckets={funnelMix} />
      </div>

      {/* Grid: clients × days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By client</CardTitle>
        </CardHeader>
        <CardContent>
          {tracked.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No clients are in the content pipeline yet. Go to Settings → opt clients in
              by setting their weekly post target.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-tmc-slate border-b">
                    <th className="px-2 py-2 sticky left-0 bg-card min-w-32">Client</th>
                    {dates.map((iso, i) => (
                      <DayHeader key={iso} iso={iso} dayIndex={i} />
                    ))}
                    <th className="px-2 py-2 text-right">This wk</th>
                  </tr>
                </thead>
                <tbody>
                  {tracked.map((c) => {
                    const clientPosts = postsInWeek.filter((p) => p.clientId === c.id);
                    return (
                      <ClientRow
                        key={c.id}
                        client={c}
                        dates={dates}
                        posts={clientPosts}
                        d={d}
                        onChanged={onChanged}
                        tasksByPost={tasksByPost}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DayHeader({ iso, dayIndex }: { iso: string; dayIndex: number }) {
  const date = parseIsoDate(iso);
  const isToday = toIsoDate(new Date()) === iso;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <th
      className={`px-2 py-2 text-left font-medium ${isToday ? "text-tmc-gold-dark" : ""}`}
    >
      <div className="text-[10px]">{dayNames[dayIndex]}</div>
      <div className="text-sm">{date.getDate()}</div>
    </th>
  );
}

function ClientRow({
  client,
  dates,
  posts,
  d,
  onChanged,
  tasksByPost,
}: {
  client: RecurringClient;
  dates: string[];
  posts: ContentPost[];
  d: ContentDashboard;
  onChanged: () => void;
  tasksByPost: Map<number, TaskWithRefs[]>;
}) {
  const total = posts.length;
  const target = client.weeklyPostTarget ?? 0;
  const targetMet = total >= target;

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-2 py-2 sticky left-0 bg-card align-top">
        <div className="font-medium">{client.name}</div>
        <div className={`text-xs ${targetMet ? "text-green-700" : "text-yellow-700"}`}>
          {total}/{target} planned
        </div>
      </td>
      {dates.map((iso) => {
        const postsForDay = posts.filter((p) => p.scheduledDate === iso);
        return (
          <td key={iso} className="px-2 py-2 align-top min-w-32">
            <div className="space-y-1">
              {postsForDay.map((p) => (
                <PostChip
                  key={p.id}
                  post={p}
                  d={d}
                  onChanged={onChanged}
                  tasks={tasksByPost.get(p.id) ?? []}
                />
              ))}
              <PostDialog
                mode="create"
                d={d}
                onSaved={onChanged}
                defaultDate={iso}
                defaultClientId={client.id}
                compact
              />
            </div>
          </td>
        );
      })}
      <td className="px-2 py-2 text-right align-top">
        <div className="text-lg font-bold tabular-nums">{total}</div>
      </td>
    </tr>
  );
}

function PostChip({
  post,
  d,
  onChanged,
  tasks,
}: {
  post: ContentPost;
  d: ContentDashboard;
  onChanged: () => void;
  tasks: TaskWithRefs[];
}) {
  const status = statusMeta(post.status);
  const pillar = d.pillars.find((p) => p.id === post.pillarId);
  const stage = d.funnelStages.find((s) => s.id === post.funnelStageId);
  const openTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );

  return (
    <PostDialog
      mode="edit"
      post={post}
      d={d}
      onSaved={onChanged}
      trigger={
        <button
          type="button"
          className="block w-full text-left rounded-md border bg-card hover:shadow-sm transition-shadow px-2 py-1.5 text-xs"
          style={{ borderLeft: `3px solid ${status.color}` }}
        >
          <div className="font-medium truncate">{post.title}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {pillar && <Pill bg={pillar.color}>{pillar.name}</Pill>}
            {stage && <Pill bg={stage.color}>{stage.name}</Pill>}
          </div>
          <div
            className="text-[10px] uppercase tracking-wide mt-0.5 flex items-center justify-between gap-1"
            style={{ color: status.color }}
          >
            <span>{status.label}</span>
            {openTasks.length > 0 && (
              <span
                className="text-[10px] font-semibold bg-tmc-gold/30 text-tmc-dark px-1.5 py-0.5 rounded normal-case tracking-normal"
                title={`${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`}
              >
                {openTasks.length} task{openTasks.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </button>
      }
    />
  );
}

function Pill({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded text-white uppercase tracking-wide"
      style={{ backgroundColor: `#${bg}` }}
    >
      {children}
    </span>
  );
}

function ProgressCard({
  progress,
}: {
  progress: ReturnType<typeof computeProgress>;
}) {
  const tone =
    progress.daysUntilDeadline < 0
      ? "danger"
      : progress.onTrack
        ? "good"
        : "warn";
  const ringClass =
    tone === "good"
      ? "ring-1 ring-green-300 bg-green-50/40"
      : tone === "warn"
        ? "ring-1 ring-yellow-300 bg-yellow-50/40"
        : "ring-1 ring-red-300 bg-red-50/40";

  const deadlineDate = parseIsoDate(progress.fridayDeadline);
  const deadlineLabel = `Fri ${deadlineDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

  return (
    <Card className={ringClass}>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Completion progress for this week's content
            </div>
            <div className="text-3xl font-bold tabular-nums text-tmc-dark mt-1">
              {progress.completed}/{progress.total}{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({progress.pctCompleted}%)
              </span>
            </div>
            <div className="text-sm mt-1">
              {progress.daysUntilDeadline < 0 ? (
                <span className="text-red-700 font-medium">
                  {Math.abs(progress.daysUntilDeadline)} day{Math.abs(progress.daysUntilDeadline) === 1 ? "" : "s"} past deadline ({deadlineLabel})
                </span>
              ) : progress.daysUntilDeadline === 0 ? (
                <span className="text-yellow-700 font-medium">
                  Today is the deadline ({deadlineLabel}) — target: 100%
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Completion deadline: {deadlineLabel} ·{" "}
                  {progress.daysUntilDeadline} day{progress.daysUntilDeadline === 1 ? "" : "s"} out · target today:{" "}
                  <strong>{progress.targetPctToday}%</strong>
                </span>
              )}
            </div>
          </div>
          <div className="w-full sm:flex-1 sm:min-w-44 sm:max-w-md">
            <ProgressBar
              actual={progress.pctCompleted}
              target={progress.targetPctToday}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ actual, target }: { actual: number; target: number }) {
  const fillColor = actual >= target ? "bg-green-600" : actual >= target * 0.7 ? "bg-yellow-500" : "bg-red-600";
  return (
    <div className="relative h-4 bg-muted rounded-full overflow-hidden">
      <div className={`${fillColor} h-full transition-all`} style={{ width: `${Math.min(actual, 100)}%` }} />
      {target > 0 && target < 100 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-tmc-dark"
          style={{ left: `${target}%` }}
          title={`Target: ${target}%`}
        />
      )}
    </div>
  );
}

function MixCard({
  title,
  buckets,
}: {
  title: string;
  buckets: ReturnType<typeof coverage>;
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground italic">No posts yet</p>
        ) : (
          <div className="space-y-1.5">
            {buckets.map((b) => (
              <CoverageRow key={b.id} bucket={b} barWidth={24} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Single row in a mix / coverage card. Shows actual + target tick + delta. */
function CoverageRow({
  bucket: b,
  barWidth,
}: {
  bucket: ReturnType<typeof coverage>[number];
  barWidth: number;
}) {
  const widthClass = barWidth === 20 ? "w-20" : "w-24";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className="w-2 h-2 rounded-sm shrink-0"
        style={{ backgroundColor: `#${b.color}` }}
      />
      <span className="flex-1 truncate">{b.name}</span>
      <span className="font-semibold tabular-nums">
        {b.count} ({b.pct}%)
      </span>
      {b.targetPct != null && <DeltaPill delta={b.delta ?? 0} target={b.targetPct} />}
      <div className={`${widthClass} h-1.5 bg-muted rounded-full overflow-hidden relative shrink-0`}>
        <div
          className="h-full"
          style={{ backgroundColor: `#${b.color}`, width: `${Math.min(b.pct, 100)}%` }}
        />
        {b.targetPct != null && b.targetPct > 0 && b.targetPct < 100 && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-tmc-dark"
            style={{ left: `${b.targetPct}%` }}
            title={`Target ${b.targetPct}%`}
          />
        )}
      </div>
    </div>
  );
}

function DeltaPill({ delta, target }: { delta: number; target: number }) {
  const abs = Math.abs(delta);
  // ±5% = on track; ±10% = warning; beyond = bad
  const tone =
    abs <= 5 ? "good" : abs <= 10 ? "warn" : "bad";
  const cls = {
    good: "bg-green-100 text-green-800",
    warn: "bg-yellow-100 text-yellow-800",
    bad: "bg-red-100 text-red-800",
  }[tone];
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${cls}`}
      title={`Target ${target}%`}
    >
      {sign}
      {delta}%
    </span>
  );
}

// ─── Post dialog ─────────────────────────────────────────────────────────

function PostDialog({
  mode,
  post,
  d,
  onSaved,
  defaultDate,
  defaultClientId,
  compact,
  trigger,
}: {
  mode: "create" | "edit";
  post?: ContentPost;
  d: ContentDashboard;
  onSaved: () => void;
  defaultDate?: string;
  defaultClientId?: number;
  compact?: boolean;
  trigger?: React.ReactNode;
}) {
  const tracked = d.clients.filter(
    (c) => c.isActive && c.weeklyPostTarget && c.weeklyPostTarget > 0,
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    clientId: number;
    title: string;
    pillarId: number | null;
    funnelStageId: number | null;
    scheduledDate: string;
    platform: string;
    status: PostStatus;
    notes: string;
  }>({
    clientId: post?.clientId ?? defaultClientId ?? tracked[0]?.id ?? 0,
    title: post?.title ?? "",
    pillarId: post?.pillarId ?? d.pillars[0]?.id ?? null,
    funnelStageId: post?.funnelStageId ?? d.funnelStages[0]?.id ?? null,
    scheduledDate: post?.scheduledDate ?? defaultDate ?? toIsoDate(new Date()),
    platform: post?.platform ?? "",
    status: post?.status ?? "idea",
    notes: post?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const tagsRequired = form.status === "completed";
  const missingPillar = tagsRequired && form.pillarId == null;
  const missingFunnel = tagsRequired && form.funnelStageId == null;

  async function submit() {
    if (!form.clientId || !form.title.trim() || !form.scheduledDate) {
      toast.error("Client, title, and date required");
      return;
    }
    if (missingPillar || missingFunnel) {
      toast.error(
        "Pillar and funnel stage are required to mark a post completed.",
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId,
        title: form.title,
        pillarId: form.pillarId,
        funnelStageId: form.funnelStageId,
        scheduledDate: form.scheduledDate,
        platform: form.platform || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (mode === "create") {
        await content.createPost(payload);
        toast.success("Post added");
      } else {
        await content.updatePost(post!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!post) return;
    try {
      await content.deletePost(post.id);
      toast.success("Deleted");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }

  const defaultTrigger =
    mode === "create" ? (
      compact ? (
        <button
          type="button"
          className="w-full text-[10px] text-muted-foreground hover:text-tmc-gold-dark border border-dashed border-border hover:border-tmc-gold-dark rounded-md py-1 transition-colors"
        >
          + Add
        </button>
      ) : (
        <Button size="sm" className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
          Add post
        </Button>
      )
    ) : (
      <Button size="sm" variant="ghost">Edit</Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md sm:max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New content post" : "Edit post"}
          </DialogTitle>
          <DialogDescription>
            Idea → Drafting → Review → Completed. Mark Completed only when
            approved. Pillar + funnel are required at that point.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Spring promo announcement"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select
              value={String(form.clientId || "")}
              onValueChange={(v) => setForm({ ...form, clientId: Number(v) })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {tracked.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled date</Label>
            <Input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={missingPillar ? "text-red-700" : ""}>
              Pillar{tagsRequired && " *"}
            </Label>
            <Select
              value={form.pillarId != null ? String(form.pillarId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, pillarId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger className={`w-full ${missingPillar ? "ring-2 ring-red-300" : ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not set —</SelectItem>
                {d.pillars.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missingPillar && (
              <p className="text-[11px] text-red-700">Required to complete.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className={missingFunnel ? "text-red-700" : ""}>
              Funnel stage{tagsRequired && " *"}
            </Label>
            <Select
              value={form.funnelStageId != null ? String(form.funnelStageId) : "none"}
              onValueChange={(v) =>
                setForm({ ...form, funnelStageId: v === "none" ? null : Number(v) })
              }
            >
              <SelectTrigger className={`w-full ${missingFunnel ? "ring-2 ring-red-300" : ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— not set —</SelectItem>
                {d.funnelStages.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missingFunnel && (
              <p className="text-[11px] text-red-700">Required to complete.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as PostStatus })}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Platform (optional)</Label>
            <Input
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              placeholder="Instagram, LinkedIn, Blog…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          {mode === "edit" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive sm:mr-auto w-full sm:w-auto">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>Can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark w-full sm:w-auto"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coverage view ───────────────────────────────────────────────────────

const WINDOWS = [30, 60, 90] as const;
type Window = (typeof WINDOWS)[number];

function CoverageView({ d }: { d: ContentDashboard }) {
  const [windowDays, setWindowDays] = useState<Window>(30);

  // Rolling window ending today (inclusive). Past content only —
  // anything with a scheduled_date in the window counts toward coverage
  // regardless of status, since the work was planned for that date.
  const today = new Date();
  const todayIso = toIsoDate(today);
  const startDate = addDays(today, -windowDays + 1);
  const startIso = toIsoDate(startDate);

  const windowPosts = d.posts.filter(
    (p) => p.scheduledDate >= startIso && p.scheduledDate <= todayIso,
  );

  const tracked = d.clients.filter(
    (c) => c.isActive && c.weeklyPostTarget && c.weeklyPostTarget > 0,
  );

  const rangeLabel = `${startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  // Agency-wide
  const agencyPillar = coverage(windowPosts, d.pillars, "pillarId");
  const agencyFunnel = coverage(windowPosts, d.funnelStages, "funnelStageId");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          Rolling <strong>{windowDays}-day</strong> window · {rangeLabel} ·{" "}
          <strong>{windowPosts.length}</strong> posts
        </div>
        <div className="inline-flex rounded-md border bg-card p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                windowDays === w
                  ? "bg-tmc-gold text-tmc-dark"
                  : "text-muted-foreground hover:text-tmc-dark"
              }`}
            >
              {w} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MixCard
          title={`Pillar mix — agency-wide`}
          buckets={agencyPillar}
        />
        <MixCard
          title={`Funnel stage mix — agency-wide`}
          buckets={agencyFunnel}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per client</CardTitle>
        </CardHeader>
        <CardContent>
          {tracked.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No clients in the pipeline yet.
            </p>
          ) : (
            <div className="space-y-4">
              {tracked.map((c) => {
                const clientPosts = windowPosts.filter((p) => p.clientId === c.id);
                const pillarCov = coverage(clientPosts, d.pillars, "pillarId");
                const funnelCov = coverage(clientPosts, d.funnelStages, "funnelStageId");
                return (
                  <div key={c.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {clientPosts.length} posts in last {windowDays} days
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <CoverageBlock title="Pillars" buckets={pillarCov} />
                      <CoverageBlock title="Funnel stages" buckets={funnelCov} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CoverageBlock({
  title,
  buckets,
}: {
  title: string;
  buckets: ReturnType<typeof coverage>;
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {title}
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground italic">—</p>
      ) : (
        <div className="space-y-1">
          {buckets.map((b) => (
            <CoverageRow key={b.id} bucket={b} barWidth={20} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings view ───────────────────────────────────────────────────────

function SettingsView({ d, onChanged }: { d: ContentDashboard; onChanged: () => void }) {
  return (
    <div className="space-y-4">
      <PillarsCard pillars={d.pillars} onChanged={onChanged} />
      <FunnelStagesCard stages={d.funnelStages} onChanged={onChanged} />
      <ClientTargetsCard clients={d.clients} onChanged={onChanged} />
    </div>
  );
}

function PillarsCard({
  pillars,
  onChanged,
}: {
  pillars: Pillar[];
  onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Pillars</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            The recurring content themes. Rename the seeded ones to match TMC's actual four.
          </p>
        </div>
        <PillarDialog mode="create" onSaved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pillars.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span
                    className="inline-block text-[11px] font-medium px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: `#${p.color}` }}
                  >
                    {p.name}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.description ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {p.targetPct != null ? `${p.targetPct}%` : "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">#{p.color}</TableCell>
                <TableCell className="text-right space-x-1">
                  <PillarDialog mode="edit" pillar={p} onSaved={onChanged} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Posts in this pillar will keep their data but no longer
                          be tagged.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await content.deletePillar(p.id);
                              toast.success("Deleted");
                              onChanged();
                            } catch (e) {
                              toast.error(`Failed: ${(e as Error).message}`);
                            }
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PillarDialog({
  mode,
  pillar,
  onSaved,
}: {
  mode: "create" | "edit";
  pillar?: Pillar;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    color: string;
    sortOrder: number;
    targetPct: number | null;
  }>({
    name: pillar?.name ?? "",
    description: pillar?.description ?? "",
    color: pillar?.color ?? "404E5C",
    sortOrder: pillar?.sortOrder ?? 0,
    targetPct: pillar?.targetPct ?? null,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        color: form.color.replace(/^#/, ""),
        sortOrder: form.sortOrder,
        targetPct: form.targetPct,
      };
      if (mode === "create") {
        await content.createPillar(payload);
        toast.success("Added");
      } else {
        await content.updatePillar(pillar!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add pillar
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add pillar" : `Edit ${pillar?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color (hex, no #)</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly target % (optional)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.targetPct ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  targetPct: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="e.g. 30"
            />
            <p className="text-[11px] text-muted-foreground">
              Used in Coverage tab to flag over/under-indexing. Targets across pillars should add up to ~100%.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FunnelStagesCard({
  stages,
  onChanged,
}: {
  stages: FunnelStage[];
  onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Funnel stages</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Order matters — sort_order goes top of funnel to bottom.
          </p>
        </div>
        <FunnelStageDialog mode="create" onSaved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stages.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="tabular-nums text-muted-foreground">{s.sortOrder}</TableCell>
                <TableCell>
                  <span
                    className="inline-block text-[11px] font-medium px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: `#${s.color}` }}
                  >
                    {s.name}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.description ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <FunnelStageDialog mode="edit" stage={s} onSaved={onChanged} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await content.deleteFunnelStage(s.id);
                              toast.success("Deleted");
                              onChanged();
                            } catch (e) {
                              toast.error(`Failed: ${(e as Error).message}`);
                            }
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FunnelStageDialog({
  mode,
  stage,
  onSaved,
}: {
  mode: "create" | "edit";
  stage?: FunnelStage;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: stage?.name ?? "",
    description: stage?.description ?? "",
    color: stage?.color ?? "404E5C",
    sortOrder: stage?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        color: form.color.replace(/^#/, ""),
        sortOrder: form.sortOrder,
      };
      if (mode === "create") {
        await content.createFunnelStage(payload);
        toast.success("Added");
      } else {
        await content.updateFunnelStage(stage!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" size="sm">
            Add stage
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add funnel stage" : `Edit ${stage?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color (hex, no #)</Label>
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Sort order (top → bottom of funnel)</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientTargetsCard({
  clients,
  onChanged,
}: {
  clients: RecurringClient[];
  onChanged: () => void;
}) {
  const active = clients.filter((c) => c.isActive);
  async function setTarget(id: number, target: number | null) {
    try {
      await finance.updateClient(id, { weeklyPostTarget: target });
      toast.success("Updated");
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client weekly post targets</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Set 1–7 to opt a client into the content pipeline. Leave blank to exclude.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="w-44 text-right">Posts/week</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={c.weeklyPostTarget ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== null && (v < 0 || v > 7)) return;
                      void setTarget(c.id, v);
                    }}
                    placeholder="—"
                    className="w-20 ml-auto text-right tabular-nums"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
