import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  Link2,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Toaster } from "@/components/ui/sonner";
import {
  daysUntilDue,
  elapsedMinutes,
  formatDueDate,
  formatMinutes,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  tasksApi,
  todayYmd,
  type PostOption,
  type Task,
  type TasksDashboard,
  type TaskPriority,
  type TaskStatus,
  type TaskWithRefs,
  type UserOption,
} from "@/lib/tasks";
import {
  content,
  effectiveAssigneeId,
  statusMeta,
  workDueDate,
  type ContentPost,
} from "@/lib/content";

const VIEWS = [
  { id: "my-week", label: "My Week", adminOnly: false },
  { id: "mine", label: "My Tasks", adminOnly: false },
  { id: "all", label: "All Tasks", adminOnly: false },
  { id: "by-person", label: "By Person", adminOnly: true },
] as const;
type View = (typeof VIEWS)[number]["id"];

// A unified inbox item — either a manual task, an open content post
// surfaced as work-to-do, or a placeholder slot for an unscheduled
// weekly post. Bucketing logic treats all three the same.
type WeekItem =
  | { kind: "task"; task: TaskWithRefs; dueDate: string | null; done: boolean }
  | { kind: "post"; post: ContentPost; dueDate: string }
  | {
      kind: "placeholder";
      clientId: number;
      clientName: string;
      slotIndex: number;     // 1-based, used in title & key
      slotsTotal: number;    // total needed for this client this week
      dueDate: string;       // friday of current week
    };

/**
 * For each tracked client with a weekly target, return one placeholder
 * per missing post. They only show up if a default assignee is set and
 * we're inside the current week's display window.
 */
function buildPlaceholders(data: TasksDashboard): WeekItem[] {
  const out: WeekItem[] = [];
  for (const c of data.clientOptions) {
    if (!c.isActive) continue;
    const target = c.weeklyPostTarget ?? 0;
    if (target <= 0) continue;
    const scheduled = data.weeklyPostsByClient[c.id] ?? 0;
    const missing = Math.max(0, target - scheduled);
    for (let i = 0; i < missing; i++) {
      out.push({
        kind: "placeholder",
        clientId: c.id,
        clientName: c.name,
        slotIndex: i + 1,
        slotsTotal: target,
        dueDate: data.weekDueDate,
      });
    }
  }
  return out;
}

function buildItemsForUser(
  data: TasksDashboard,
  userId: number,
): WeekItem[] {
  const items: WeekItem[] = data.tasks
    .filter((t) => t.assigneeId === userId)
    .map((t) => ({
      kind: "task" as const,
      task: t,
      dueDate: t.dueDate,
      done: t.status === "completed",
    }));
  for (const p of data.openPosts) {
    if (effectiveAssigneeId(p) !== userId) continue;
    items.push({ kind: "post", post: p, dueDate: workDueDate(p.scheduledDate) });
  }
  // Placeholders only land on the default assignee's list.
  if (data.defaultPostAssigneeId === userId) {
    items.push(...buildPlaceholders(data));
  }
  return items;
}

function buildAllItems(data: TasksDashboard): WeekItem[] {
  const items: WeekItem[] = data.tasks.map((t) => ({
    kind: "task" as const,
    task: t,
    dueDate: t.dueDate,
    done: t.status === "completed",
  }));
  for (const p of data.openPosts) {
    items.push({ kind: "post", post: p, dueDate: workDueDate(p.scheduledDate) });
  }
  items.push(...buildPlaceholders(data));
  return items;
}

function itemKey(it: WeekItem): string {
  if (it.kind === "task") return `t-${it.task.id}`;
  if (it.kind === "post") return `p-${it.post.id}`;
  return `ph-${it.clientId}-${it.slotIndex}`;
}

/** Stable sort within a bucket. */
function sortItems(items: WeekItem[]): WeekItem[] {
  const kindRank = (k: WeekItem["kind"]) =>
    k === "post" ? 0 : k === "placeholder" ? 1 : 2;
  return [...items].sort((a, b) => {
    const aDue = a.dueDate ?? "9999-12-31";
    const bDue = b.dueDate ?? "9999-12-31";
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    const kr = kindRank(a.kind) - kindRank(b.kind);
    if (kr !== 0) return kr;
    return 0;
  });
}

export function TasksPage() {
  const userState = useUser();
  const isAdmin =
    userState.status === "authenticated" &&
    userState.user.type === "team" &&
    userState.user.role === "admin";
  const [data, setData] = useState<TasksDashboard | null>(null);
  const [view, setView] = useState<View>("my-week");
  const [focusedUserId, setFocusedUserId] = useState<number | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [tick, setTick] = useState(0);

  async function refresh() {
    try {
      setData(await tasksApi.dashboard(includeCompleted));
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    if (userState.status !== "authenticated" || userState.user.type !== "team")
      return;
    void refresh();
  }, [userState.status, includeCompleted]);

  // Tick once a minute so the "running for 12m" displays stay fresh.
  useEffect(() => {
    if (!data?.tasks.some((t) => t.status === "in_progress" && t.startedAt))
      return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [data?.tasks]);
  void tick;

  if (userState.status !== "authenticated" || userState.user.type !== "team") {
    return (
      <div className="w-full max-w-5xl">
        <p className="text-sm text-muted-foreground">
          Sign in as a team member to use the task tracker.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="w-full max-w-5xl space-y-5">
      <header className="border-b border-tmc-gold/40 pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What's on your plate. Assign work, track time, link to content.
          </p>
        </div>
        <CreateTaskDialog
          data={data}
          defaultAssigneeId={data.user.id}
          onCreated={refresh}
        />
      </header>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 border-b w-full sm:w-auto">
          {VIEWS.filter((v) => isAdmin || !v.adminOnly).map((v) => {
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-tmc-gold text-tmc-dark"
                    : "border-transparent text-muted-foreground hover:text-tmc-dark"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
          />
          Show completed
        </label>
      </div>

      {view === "my-week" && (
        <MyWeekView data={data} myUserId={data.user.id} onChanged={refresh} />
      )}
      {view === "mine" && (
        <TaskList
          items={buildItemsForUser(data, data.user.id)}
          data={data}
          onChanged={refresh}
        />
      )}
      {view === "all" && (
        <TaskList
          items={buildAllItems(data)}
          data={data}
          onChanged={refresh}
        />
      )}
      {view === "by-person" && isAdmin && (
        <ByPersonView
          data={data}
          focusedUserId={focusedUserId ?? data.user.id}
          onPickUser={setFocusedUserId}
          onChanged={refresh}
        />
      )}

      <Toaster />
    </div>
  );
}

// ─── By Person view (admin) ──────────────────────────────────────────────

function ByPersonView({
  data,
  focusedUserId,
  onPickUser,
  onChanged,
}: {
  data: TasksDashboard;
  focusedUserId: number;
  onPickUser: (id: number) => void;
  onChanged: () => void;
}) {
  const focused =
    data.userOptions.find((u) => u.id === focusedUserId) ?? data.userOptions[0];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-3 flex items-center gap-3 flex-wrap">
        <Label htmlFor="by-person-picker" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
          Viewing
        </Label>
        <div className="min-w-[220px]">
          <Select
            value={String(focusedUserId)}
            onValueChange={(v) => onPickUser(Number(v))}
          >
            <SelectTrigger id="by-person-picker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.userOptions.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {focused && (
          <span className="text-xs text-muted-foreground">
            Tasks assigned to {focused.name ?? focused.email}
          </span>
        )}
      </div>

      <MyWeekView
        data={data}
        myUserId={focusedUserId}
        onChanged={onChanged}
      />
    </div>
  );
}

// ─── My Week view ────────────────────────────────────────────────────────

function MyWeekView({
  data,
  myUserId,
  onChanged,
}: {
  data: TasksDashboard;
  myUserId: number;
  onChanged: () => void;
}) {
  const mine = useMemo(
    () => buildItemsForUser(data, myUserId),
    [data, myUserId],
  );

  // Bucket: overdue, today, this week (next 7d), later, no date, completed.
  const buckets = useMemo(() => {
    const overdue: WeekItem[] = [];
    const today: WeekItem[] = [];
    const thisWeek: WeekItem[] = [];
    const later: WeekItem[] = [];
    const noDate: WeekItem[] = [];
    const done: WeekItem[] = [];
    for (const it of mine) {
      if (it.kind === "task" && it.done) {
        done.push(it);
        continue;
      }
      const diff = daysUntilDue(it.dueDate);
      if (diff == null) noDate.push(it);
      else if (diff < 0) overdue.push(it);
      else if (diff === 0) today.push(it);
      else if (diff <= 7) thisWeek.push(it);
      else later.push(it);
    }
    return { overdue, today, thisWeek, later, noDate, done };
  }, [mine]);

  const empty =
    buckets.overdue.length === 0 &&
    buckets.today.length === 0 &&
    buckets.thisWeek.length === 0 &&
    buckets.later.length === 0 &&
    buckets.noDate.length === 0 &&
    buckets.done.length === 0;

  if (empty) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing on your list. Hit "New task" to start.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SummaryStrip items={mine} />
      {buckets.overdue.length > 0 && (
        <WeekBucket
          title="Overdue"
          tone="bg-red-50 border-red-200"
          items={buckets.overdue}
          data={data}
          onChanged={onChanged}
        />
      )}
      {buckets.today.length > 0 && (
        <WeekBucket
          title="Today"
          tone="bg-tmc-gold/10 border-tmc-gold/40"
          items={buckets.today}
          data={data}
          onChanged={onChanged}
        />
      )}
      {buckets.thisWeek.length > 0 && (
        <WeekBucket
          title="This week"
          items={buckets.thisWeek}
          data={data}
          onChanged={onChanged}
        />
      )}
      {buckets.later.length > 0 && (
        <WeekBucket
          title="Later"
          items={buckets.later}
          data={data}
          onChanged={onChanged}
        />
      )}
      {buckets.noDate.length > 0 && (
        <WeekBucket
          title="No due date"
          items={buckets.noDate}
          data={data}
          onChanged={onChanged}
        />
      )}
      {buckets.done.length > 0 && (
        <WeekBucket
          title="Done"
          tone="bg-muted border-transparent"
          items={buckets.done}
          data={data}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function SummaryStrip({ items }: { items: WeekItem[] }) {
  const tasksOnly = items.filter((it) => it.kind === "task").map((it) => it.task);
  const postsOnly = items.filter((it) => it.kind === "post").map((it) => it.post);
  const placeholders = items.filter((it) => it.kind === "placeholder");
  const openTasks = tasksOnly.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  const totalEstimated =
    openTasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0) +
    postsOnly.reduce((sum, p) => sum + (p.estimatedMinutes ?? 0), 0);
  const urgent = openTasks.filter((t) => t.priority === "urgent").length;
  const inProgress = openTasks.filter((t) => t.status === "in_progress").length;
  const openCount = openTasks.length + postsOnly.length + placeholders.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Open" value={openCount} />
      <Stat
        label="In progress"
        value={inProgress}
        tone={inProgress > 0 ? "text-blue-700" : undefined}
      />
      <Stat label="Urgent" value={urgent} tone={urgent > 0 ? "text-red-700" : undefined} />
      <Stat label="Est. time" value={formatMinutes(totalEstimated)} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${tone ?? "text-tmc-dark"}`}>
        {value}
      </div>
    </div>
  );
}

function WeekBucket({
  title,
  tone,
  items,
  data,
  onChanged,
}: {
  title: string;
  tone?: string;
  items: WeekItem[];
  data: TasksDashboard;
  onChanged: () => void;
}) {
  return (
    <section className={`rounded-lg border ${tone ?? "bg-card"}`}>
      <div className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-widest text-tmc-slate flex items-center justify-between">
        <span>{title}</span>
        <span className="text-muted-foreground">{items.length}</span>
      </div>
      <ul className="divide-y">
        {sortItems(items).map((it) => (
          <ItemRow key={itemKey(it)} it={it} data={data} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({
  it,
  data,
  onChanged,
}: {
  it: WeekItem;
  data: TasksDashboard;
  onChanged: () => void;
}) {
  if (it.kind === "task") {
    return <TaskRow task={it.task} data={data} onChanged={onChanged} />;
  }
  if (it.kind === "post") {
    return <PostRow post={it.post} data={data} />;
  }
  return <PlaceholderRow item={it} data={data} onChanged={onChanged} />;
}

// ─── Generic list (Mine / All views) ─────────────────────────────────────

function TaskList({
  items,
  data,
  onChanged,
}: {
  items: WeekItem[];
  data: TasksDashboard;
  onChanged: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <section className="rounded-lg border bg-card">
      <ul className="divide-y">
        {sortItems(items).map((it) => (
          <ItemRow key={itemKey(it)} it={it} data={data} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

// ─── Task row ────────────────────────────────────────────────────────────

function TaskRow({
  task,
  data,
  onChanged,
}: {
  task: TaskWithRefs;
  data: TasksDashboard;
  onChanged: () => void;
}) {
  const isOpen = task.status === "pending" || task.status === "in_progress";
  const isRunning = task.status === "in_progress" && !!task.startedAt;
  const overdue =
    isOpen &&
    task.dueDate &&
    (daysUntilDue(task.dueDate) ?? 0) < 0;

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <StatusToggle task={task} onChanged={onChanged} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <span
            className={`text-sm font-medium ${
              task.status === "completed"
                ? "text-muted-foreground line-through"
                : "text-tmc-dark"
            }`}
          >
            {task.title}
          </span>
          <PriorityPill priority={task.priority} />
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Running · {formatMinutes(elapsedMinutes(task.startedAt!))}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
            {task.description}
          </p>
        )}
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span
            className={overdue ? "text-red-700 font-medium" : undefined}
            title={task.dueDate ?? ""}
          >
            {formatDueDate(task.dueDate)}
          </span>
          <span>· {task.assigneeName ?? task.assigneeEmail}</span>
          {task.estimatedMinutes != null && (
            <span>· est {formatMinutes(task.estimatedMinutes)}</span>
          )}
          {task.actualMinutes != null && task.status === "completed" && (
            <span>· logged {formatMinutes(task.actualMinutes)}</span>
          )}
          {task.contentPostTitle && (
            <span className="inline-flex items-center gap-1">
              <Link2 size={11} /> {task.contentPostTitle}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isOpen && !isRunning && <StartButton id={task.id} onChanged={onChanged} />}
        <EditTaskDialog task={task} data={data} onChanged={onChanged} />
        <DeleteTaskButton id={task.id} title={task.title} onChanged={onChanged} />
      </div>
    </li>
  );
}

function StatusToggle({
  task,
  onChanged,
}: {
  task: TaskWithRefs;
  onChanged: () => void;
}) {
  const [completeOpen, setCompleteOpen] = useState(false);

  if (task.status === "completed") {
    async function reopen() {
      try {
        await tasksApi.reopen(task.id);
        toast.success("Reopened.");
        onChanged();
      } catch (e) {
        toast.error(`Reopen failed: ${(e as Error).message}`);
      }
    }
    return (
      <button
        onClick={reopen}
        className="mt-0.5 text-green-600 hover:text-tmc-dark transition-colors"
        title="Reopen"
      >
        <CheckCircle2 size={18} />
      </button>
    );
  }

  // Open task — click to complete (with potential time confirmation).
  return (
    <>
      <button
        onClick={() => setCompleteOpen(true)}
        className="mt-0.5 text-muted-foreground hover:text-green-600 transition-colors"
        title="Mark complete"
      >
        <Circle size={18} />
      </button>
      {completeOpen && (
        <CompleteTaskDialog
          task={task}
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function PriorityPill({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${PRIORITY_TONE[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

// ─── Post row (open content posts surfaced as tasks) ─────────────────────

function PostRow({
  post,
  data,
}: {
  post: ContentPost;
  data: TasksDashboard;
}) {
  const client = data.clientOptions.find((c) => c.id === post.clientId);
  const status = statusMeta(post.status);
  const assignee = data.userOptions.find((u) => u.id === post.assignedTo);
  const reviewer = data.userOptions.find((u) => u.id === post.reviewerId);
  const workDue = workDueDate(post.scheduledDate);
  const overdue = (daysUntilDue(workDue) ?? 0) < 0;

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <Link2
        size={18}
        className="mt-0.5 shrink-0 text-tmc-gold-dark"
        aria-label="Content post"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm font-medium text-tmc-dark">{post.title}</span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            style={{
              backgroundColor: `${status.color}22`,
              color: status.color,
              borderColor: `${status.color}44`,
            }}
          >
            {status.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span
            className={overdue ? "text-red-700 font-medium" : undefined}
            title={`Work due ${workDue}; publishes ${post.scheduledDate}`}
          >
            Due {formatDueDate(workDue)}
          </span>
          <span title={`Publishes ${post.scheduledDate}`}>
            · publishes {formatDueDate(post.scheduledDate)}
          </span>
          {client && <span>· {client.name}</span>}
          {post.platform && <span>· {post.platform}</span>}
          {post.estimatedMinutes != null && (
            <span>· est {formatMinutes(post.estimatedMinutes)}</span>
          )}
          {post.status === "review" && reviewer ? (
            <span>
              · reviewer{" "}
              <span className="font-medium">
                {reviewer.name ?? reviewer.email}
              </span>
            </span>
          ) : assignee ? (
            <span>· {assignee.name ?? assignee.email}</span>
          ) : null}
        </div>
      </div>
      <a
        href={`/content?focusPost=${post.id}`}
        className="text-xs text-tmc-gold-dark hover:underline shrink-0 self-center"
      >
        Open
      </a>
    </li>
  );
}

// ─── Placeholder row (virtual weekly post slots) ─────────────────────────

function PlaceholderRow({
  item,
  data,
  onChanged,
}: {
  item: Extract<WeekItem, { kind: "placeholder" }>;
  data: TasksDashboard;
  onChanged: () => void;
}) {
  const overdue = (daysUntilDue(item.dueDate) ?? 0) < 0;
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <CalendarPlus
        size={18}
        className="mt-0.5 shrink-0 text-tmc-slate"
        aria-label="Weekly post placeholder"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm font-medium text-tmc-dark">
            {item.clientName} post
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-dashed border-tmc-slate/40 text-tmc-slate">
            Slot {item.slotIndex}/{item.slotsTotal}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span className={overdue ? "text-red-700 font-medium" : undefined}>
            Due {formatDueDate(item.dueDate)}
          </span>
          <span>· Not yet scheduled</span>
        </div>
      </div>
      <NewPostFromPlaceholderDialog
        item={item}
        data={data}
        onCreated={onChanged}
      />
    </li>
  );
}

function NewPostFromPlaceholderDialog({
  item,
  data,
  onCreated,
}: {
  item: Extract<WeekItem, { kind: "placeholder" }>;
  data: TasksDashboard;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(item.dueDate);
  const [platform, setPlatform] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle("");
    setScheduledDate(item.dueDate);
    setPlatform("");
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Title required.");
      return;
    }
    setBusy(true);
    try {
      await content.createPost({
        clientId: item.clientId,
        title: title.trim(),
        scheduledDate,
        platform: platform.trim() || null,
        status: "idea",
        assignedTo: data.defaultPostAssigneeId ?? null,
        estimatedMinutes: data.defaultPostEstimatedMinutes ?? null,
      });
      toast.success("Post added to the planner.");
      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1 bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
        >
          <Plus size={14} /> Add post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New post for {item.clientName}</DialogTitle>
          <DialogDescription>
            Lands on the content planner as an Idea — refine pillar /
            funnel / status there.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ph-title">Title *</Label>
            <Input
              id="ph-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="What's the post about?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ph-date">Scheduled date</Label>
              <Input
                id="ph-date"
                type="date"
                min={data.weekStart}
                max={data.weekEnd}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ph-platform">Platform</Label>
              <Input
                id="ph-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Instagram, LinkedIn…"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Adding…" : "Add to planner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────

function StartButton({
  id,
  onChanged,
}: {
  id: number;
  onChanged: () => void;
}) {
  async function start() {
    try {
      await tasksApi.start(id);
      toast.success("Timer started.");
      onChanged();
    } catch (e) {
      toast.error(`Start failed: ${(e as Error).message}`);
    }
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={start}
      className="h-8 px-2 text-blue-700 hover:bg-blue-100"
      title="Start timer"
    >
      <Play size={14} />
    </Button>
  );
}

function DeleteTaskButton({
  id,
  title,
  onChanged,
}: {
  id: number;
  title: string;
  onChanged: () => void;
}) {
  async function remove() {
    try {
      await tasksApi.remove(id);
      toast.success("Deleted.");
      onChanged();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
          title="Delete task"
        >
          <Trash2 size={14} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Complete dialog (editable elapsed) ──────────────────────────────────

function CompleteTaskDialog({
  task,
  open,
  onOpenChange,
  onChanged,
}: {
  task: TaskWithRefs;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const auto = task.startedAt ? elapsedMinutes(task.startedAt) : null;
  const [minutes, setMinutes] = useState<string>(
    auto != null ? String(auto) : task.actualMinutes != null ? String(task.actualMinutes) : "",
  );
  const [busy, setBusy] = useState(false);

  async function complete() {
    setBusy(true);
    try {
      const n = minutes.trim() === "" ? null : Number(minutes);
      if (n != null && (!Number.isFinite(n) || n < 0)) {
        toast.error("Minutes must be a non-negative number.");
        setBusy(false);
        return;
      }
      await tasksApi.complete(task.id, n);
      toast.success("Marked complete.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      toast.error(`Complete failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark complete</DialogTitle>
          <DialogDescription>
            {auto != null
              ? `Timer ran for ${formatMinutes(auto)}. Adjust if needed.`
              : "Optionally log how long this took."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="complete-minutes">Minutes worked</Label>
          <Input
            id="complete-minutes"
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Leave blank to skip"
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={complete} disabled={busy}>
            {busy ? "Saving…" : "Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create dialog ───────────────────────────────────────────────────────

function CreateTaskDialog({
  data,
  defaultAssigneeId,
  onCreated,
}: {
  data: TasksDashboard;
  defaultAssigneeId: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} /> New task
        </Button>
      </DialogTrigger>
      {open && (
        <TaskForm
          mode="create"
          data={data}
          defaultAssigneeId={defaultAssigneeId}
          onSaved={() => {
            setOpen(false);
            onCreated();
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

function EditTaskDialog({
  task,
  data,
  onChanged,
}: {
  task: TaskWithRefs;
  data: TasksDashboard;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-tmc-dark"
          title="Edit task"
        >
          <Pencil size={14} />
        </Button>
      </DialogTrigger>
      {open && (
        <TaskForm
          mode="edit"
          task={task}
          data={data}
          defaultAssigneeId={task.assigneeId}
          onSaved={() => {
            setOpen(false);
            onChanged();
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}

function TaskForm({
  mode,
  task,
  data,
  defaultAssigneeId,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  task?: TaskWithRefs;
  data: TasksDashboard;
  defaultAssigneeId: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<number>(
    task?.assigneeId ?? defaultAssigneeId,
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [estMinutes, setEstMinutes] = useState(
    task?.estimatedMinutes != null ? String(task.estimatedMinutes) : "",
  );
  const [contentPostId, setContentPostId] = useState<number | null>(
    task?.contentPostId ?? null,
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const est = estMinutes.trim() === "" ? null : Number(estMinutes);
      if (est != null && (!Number.isFinite(est) || est < 0)) {
        toast.error("Estimated minutes must be non-negative.");
        setBusy(false);
        return;
      }
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId,
        priority,
        dueDate: dueDate || null,
        estimatedMinutes: est,
        contentPostId: contentPostId ?? null,
      };
      if (mode === "create") {
        await tasksApi.create(payload);
        toast.success("Task created.");
      } else if (task) {
        await tasksApi.update(task.id, payload);
        toast.success("Task updated.");
      }
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "New task" : "Edit task"}
        </DialogTitle>
        <DialogDescription>
          Assign it, set a priority, give it a deadline if you've got one.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="task-title">Title *</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="task-desc">Description</Label>
          <textarea
            id="task-desc"
            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Assignee</Label>
            <AssigneeSelect
              users={data.userOptions}
              value={assigneeId}
              onChange={setAssigneeId}
            />
          </div>
          <div className="space-y-1">
            <Label>Priority</Label>
            <PrioritySelect value={priority} onChange={setPriority} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              min={todayYmd()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-est">Estimated minutes</Label>
            <Input
              id="task-est"
              type="number"
              min={0}
              value={estMinutes}
              onChange={(e) => setEstMinutes(e.target.value)}
              placeholder="30"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Linked content post</Label>
          <ContentPostSelect
            posts={data.postOptions}
            value={contentPostId}
            onChange={setContentPostId}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create task" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AssigneeSelect({
  users,
  value,
  onChange,
}: {
  users: UserOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.name ?? u.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as TaskPriority)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((p) => (
          <SelectItem key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContentPostSelect({
  posts,
  value,
  onChange,
}: {
  posts: PostOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <Select
      value={value == null ? "__none__" : String(value)}
      onValueChange={(v) => onChange(v === "__none__" ? null : Number(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {posts.map((p) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.scheduledDate} · {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type { TaskStatus, Task };
