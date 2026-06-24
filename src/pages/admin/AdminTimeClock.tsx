import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePollingRefresh } from "@/lib/usePollingRefresh";
import { Check, Trash2, X } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatHours,
  formatRate,
  PAY_RATE_TYPE_LABELS,
  shiftHours,
  shiftCost,
  timeclock,
  type AdminDashboard,
  type AdminShift,
  type Job,
  type PayRateType,
  type UserOption,
} from "@/lib/timeclock";

const TABS = [
  { id: "live", label: "Live" },
  { id: "shifts", label: "Shifts" },
  { id: "jobs", label: "Jobs" },
  { id: "eligibility", label: "Eligibility" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminTimeClock() {
  const [tab, setTab] = useState<Tab>("live");
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [tick, setTick] = useState(0);

  async function refresh() {
    try {
      setData(await timeclock.adminDashboard());
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  // Live-refresh who's on the clock / pending shifts without a reload.
  usePollingRefresh(refresh, { intervalMs: 45_000 });

  // Keep live elapsed times updating
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  if (!data) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Time Clock
          </h1>
          <p className="text-sm text-muted-foreground">
            Jobs, eligibility, shift approvals, and live team status.
          </p>
        </div>
        {data.pendingCount > 0 && (
          <div className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md font-semibold">
            {data.pendingCount} pending approval{data.pendingCount === 1 ? "" : "s"}
          </div>
        )}
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
            {t.id === "shifts" && data.pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-yellow-200 text-yellow-900 rounded-full px-1.5 py-0.5">
                {data.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "live" && <LiveTab data={data} />}
      {tab === "shifts" && <ShiftsTab data={data} onChanged={refresh} />}
      {tab === "jobs" && <JobsTab data={data} onChanged={refresh} />}
      {tab === "eligibility" && <EligibilityTab data={data} onChanged={refresh} />}
    </div>
  );
}

// ─── Live tab ────────────────────────────────────────────────────────────

function LiveTab({ data }: { data: AdminDashboard }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b font-semibold">
        Currently on the clock
      </div>
      {data.activeShifts.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
          No one is clocked in right now.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Elapsed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.activeShifts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.userName ?? s.userEmail}</TableCell>
                <TableCell>{s.jobName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(s.startedAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatHours(shiftHours(s.startedAt, null))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Shifts tab ──────────────────────────────────────────────────────────

function ShiftsTab({
  data,
  onChanged,
}: {
  data: AdminDashboard;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "active" | "denied">(
    data.pendingCount > 0 ? "pending" : "all",
  );
  const jobById = useMemo(
    () => new Map(data.jobs.map((j) => [j.id, j])),
    [data.jobs],
  );

  const filtered = data.recentShifts.filter((s) =>
    filter === "all" ? true : s.status === filter,
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {(["all", "pending", "completed", "active", "denied"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2 py-1 rounded ${
              filter === f
                ? "bg-tmc-gold text-tmc-dark font-semibold"
                : "bg-muted text-muted-foreground hover:text-tmc-dark"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Ended</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Est. cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No shifts in this filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => {
                const job = jobById.get(s.jobId);
                const hours = shiftHours(s.startedAt, s.endedAt);
                const cost = job ? shiftCost(s, job) : 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.userName ?? s.userEmail}</TableCell>
                    <TableCell>{s.jobName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(s.startedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.endedAt ? formatDateTime(s.endedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.endedAt ? formatHours(hours) : "active"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {job?.payRateType === "salaried"
                        ? "—"
                        : `$${cost.toFixed(2)}`}
                    </TableCell>
                    <TableCell><ShiftStatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      {s.status === "pending" && (
                        <>
                          <ApproveButton id={s.id} onChanged={onChanged} />
                          <DenyButton id={s.id} onChanged={onChanged} />
                        </>
                      )}
                      <EditShiftDialog shift={s} jobs={data.jobs} onChanged={onChanged} />
                      <DeleteShiftButton id={s.id} onChanged={onChanged} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ShiftStatusBadge({ status }: { status: AdminShift["status"] }) {
  const cls = {
    active: "bg-tmc-gold/30 text-tmc-dark",
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    denied: "bg-red-100 text-red-800",
  }[status];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function ApproveButton({ id, onChanged }: { id: number; onChanged: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-green-700 hover:bg-green-50"
      onClick={async () => {
        try {
          await timeclock.approveShift(id);
          toast.success("Approved");
          onChanged();
        } catch (e) {
          toast.error(`Failed: ${(e as Error).message}`);
        }
      }}
      title="Approve"
    >
      <Check size={14} />
    </Button>
  );
}

function DenyButton({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" title="Deny">
          <X size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deny this backdated shift?</DialogTitle>
          <DialogDescription>
            Optionally explain why — the submitter will see this in their recent shifts.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              try {
                await timeclock.denyShift(id, reason || undefined);
                toast.success("Denied");
                setOpen(false);
                onChanged();
              } catch (e) {
                toast.error(`Failed: ${(e as Error).message}`);
              }
            }}
          >
            Deny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteShiftButton({ id, onChanged }: { id: number; onChanged: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive" title="Delete">
          <Trash2 size={14} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
          <AlertDialogDescription>
            Permanent. Use with care.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await timeclock.deleteShift(id);
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
  );
}

function EditShiftDialog({
  shift,
  jobs,
  onChanged,
}: {
  shift: AdminShift;
  jobs: Job[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const startISO = shift.startedAt.slice(0, 16);
  const endISO = shift.endedAt ? shift.endedAt.slice(0, 16) : "";
  const [form, setForm] = useState({
    jobId: shift.jobId,
    startedAt: startISO,
    endedAt: endISO,
    notes: shift.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await timeclock.updateShift(shift.id, {
        jobId: form.jobId,
        startedAt: new Date(form.startedAt).toISOString(),
        endedAt: form.endedAt ? new Date(form.endedAt).toISOString() : null,
        notes: form.notes || null,
      });
      toast.success("Updated");
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit shift</DialogTitle>
          <DialogDescription>
            For cleanup — fix start/end times if someone forgot to clock out, etc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Job</Label>
            <Select
              value={String(form.jobId)}
              onValueChange={(v) => setForm({ ...form, jobId: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>{j.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input
              type="datetime-local"
              value={form.startedAt}
              onChange={(e) => setForm({ ...form, startedAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input
              type="datetime-local"
              value={form.endedAt}
              onChange={(e) => setForm({ ...form, endedAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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

// ─── Jobs tab ────────────────────────────────────────────────────────────

function JobsTab({
  data,
  onChanged,
}: {
  data: AdminDashboard;
  onChanged: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="font-semibold">Jobs</div>
        <JobDialog mode="create" onSaved={onChanged} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                No jobs yet. Add one to start tracking time.
              </TableCell>
            </TableRow>
          ) : (
            data.jobs.map((j) => (
              <TableRow key={j.id} className={!j.isActive ? "opacity-50" : undefined}>
                <TableCell className="font-medium">
                  {j.name}
                  {j.description && (
                    <span className="block text-xs text-muted-foreground italic">
                      {j.description}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{PAY_RATE_TYPE_LABELS[j.payRateType]}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(j)}</TableCell>
                <TableCell className="text-sm">{j.isActive ? "Active" : "Archived"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <JobDialog mode="edit" job={j} onSaved={onChanged} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        Archive
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive {j.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          People can no longer clock in for this job. Existing shifts are preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          await timeclock.deleteJob(j.id);
                          toast.success("Archived");
                          onChanged();
                        }}>Archive</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function JobDialog({
  mode,
  job,
  onSaved,
}: {
  mode: "create" | "edit";
  job?: Job;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: job?.name ?? "",
    description: job?.description ?? "",
    payRateType: job?.payRateType ?? ("hourly" as PayRateType),
    payRate: job?.payRate ?? 0,
    isActive: job?.isActive ?? true,
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
        name: form.name,
        description: form.description || null,
        payRateType: form.payRateType,
        payRate: form.payRate,
        isActive: form.isActive,
      };
      if (mode === "create") {
        await timeclock.createJob(payload);
        toast.success("Added");
      } else {
        await timeclock.updateJob(job!.id, payload);
        toast.success("Saved");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const ratePer = {
    hourly: "per hour",
    salaried: "per year",
    day_rate: "per day",
  }[form.payRateType];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
            Add job
          </Button>
        ) : (
          <Button size="sm" variant="ghost">Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add job" : `Edit ${job?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Video Editing"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pay rate type</Label>
              <Select
                value={form.payRateType}
                onValueChange={(v) => setForm({ ...form, payRateType: v as PayRateType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="day_rate">Day rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.payRate}
                onChange={(e) =>
                  setForm({ ...form, payRate: Number(e.target.value) || 0 })
                }
              />
              <p className="text-[11px] text-muted-foreground">{ratePer}</p>
            </div>
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          )}
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

// ─── Eligibility tab ─────────────────────────────────────────────────────

function EligibilityTab({
  data,
  onChanged,
}: {
  data: AdminDashboard;
  onChanged: () => void;
}) {
  if (data.jobs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Add a job first, then assign people here.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {data.jobs.filter((j) => j.isActive).map((j) => (
        <EligibilityCard
          key={j.id}
          job={j}
          users={data.userOptions}
          eligible={data.eligibilityByJob[j.id] ?? []}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function EligibilityCard({
  job,
  users,
  eligible,
  onChanged,
}: {
  job: Job;
  users: UserOption[];
  eligible: { userId: number; userName: string | null; userEmail: string }[];
  onChanged: () => void;
}) {
  const eligibleIds = new Set(eligible.map((e) => e.userId));
  const candidates = users.filter((u) => !eligibleIds.has(u.id));
  const [adding, setAdding] = useState<number | null>(null);

  async function add() {
    if (!adding) return;
    try {
      await timeclock.addEligibility(job.id, adding);
      setAdding(null);
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <div className="font-semibold">{job.name}</div>
          <div className="text-xs text-muted-foreground">
            {PAY_RATE_TYPE_LABELS[job.payRateType]} · {formatRate(job)}
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {eligible.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No one's eligible yet. Add someone below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {eligible.map((e) => (
              <span
                key={e.userId}
                className="inline-flex items-center gap-1 text-xs bg-tmc-gold/20 text-tmc-dark px-2 py-1 rounded"
              >
                {e.userName ?? e.userEmail}
                <button
                  onClick={async () => {
                    try {
                      await timeclock.removeEligibility(job.id, e.userId);
                      onChanged();
                    } catch (err) {
                      toast.error(`Failed: ${(err as Error).message}`);
                    }
                  }}
                  className="hover:text-red-700"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {candidates.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Select
              value={adding != null ? String(adding) : ""}
              onValueChange={(v) => setAdding(Number(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Add someone…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={add} disabled={!adding}>
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
