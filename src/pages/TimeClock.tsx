import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
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
import { Toaster } from "@/components/ui/sonner";
import {
  formatDateTime,
  formatHours,
  shiftHours,
  timeclock,
  totalHoursInRange,
  type Job,
  type MeDashboard,
  type Shift,
} from "@/lib/timeclock";

export function TimeClockPage() {
  const userState = useUser();
  const [data, setData] = useState<MeDashboard | null>(null);
  const [tick, setTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function refresh() {
    try {
      setData(await timeclock.myDashboard());
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    if (userState.status !== "authenticated" || userState.user.type !== "team") return;
    void refresh();
  }, [userState.status]);

  // Tick every second so the live elapsed timer keeps updating
  useEffect(() => {
    if (!data?.activeShift) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [data?.activeShift]);
  void tick;

  if (userState.status !== "authenticated" || userState.user.type !== "team") {
    return (
      <div className="w-full max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Sign in as a team member to use the time clock.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  const activeJob = data.activeShift
    ? data.eligibleJobs.find((j) => j.id === data.activeShift!.jobId) ?? null
    : null;

  return (
    <div className="w-full max-w-4xl space-y-4">
      <header className="border-b border-tmc-gold/40 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Time Clock
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track time for your eligible jobs.
        </p>
      </header>

      {data.eligibleJobs.length === 0 ? (
        <NoJobs />
      ) : data.activeShift ? (
        <ActiveShiftCard shift={data.activeShift} job={activeJob} onChanged={refresh} />
      ) : (
        <ClockInCard
          jobs={data.eligibleJobs}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          onClockedIn={refresh}
        />
      )}

      <WeekSummary shifts={data.recentShifts} />

      <BackdateCard jobs={data.eligibleJobs} onSubmitted={refresh} />

      <RecentShiftsList shifts={data.recentShifts} jobs={data.eligibleJobs} />

      <Toaster />
    </div>
  );
}

function NoJobs() {
  return (
    <div className="rounded-lg border bg-card p-12 text-center space-y-3">
      <div className="inline-flex w-14 h-14 rounded-2xl bg-tmc-gold/20 items-center justify-center">
        <Clock size={28} className="text-tmc-gold-dark" />
      </div>
      <h2 className="text-lg font-semibold text-tmc-dark">No jobs assigned</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Ask an admin to add you to a job in Admin → Time Clock → Jobs.
      </p>
    </div>
  );
}

function ClockInCard({
  jobs,
  pickerOpen,
  setPickerOpen,
  onClockedIn,
}: {
  jobs: Job[];
  pickerOpen: boolean;
  setPickerOpen: (b: boolean) => void;
  onClockedIn: () => void;
}) {
  const [jobId, setJobId] = useState<number | null>(
    jobs.length === 1 ? jobs[0].id : null,
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function go() {
    if (!jobId) return;
    setSaving(true);
    try {
      await timeclock.clockIn(jobId, notes || undefined);
      toast.success("Clocked in");
      setPickerOpen(false);
      setNotes("");
      onClockedIn();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // 1 job → single big button, no picker.
  if (jobs.length === 1) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <div className="text-sm text-muted-foreground">
          You're not clocked in.
        </div>
        <Button
          size="lg"
          className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark text-base px-8 py-6 h-auto"
          onClick={() => {
            setJobId(jobs[0].id);
            void go();
          }}
          disabled={saving}
        >
          {saving ? "Clocking in…" : `Clock In — ${jobs[0].name}`}
        </Button>
      </div>
    );
  }

  // Multiple jobs → button opens picker dialog.
  return (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <div className="text-sm text-muted-foreground">You're not clocked in.</div>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark text-base px-8 py-6 h-auto"
          >
            Clock In
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clock In</DialogTitle>
          <DialogDescription>
            Pick the job you're clocking in for.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Job</Label>
            <Select
              value={jobId != null ? String(jobId) : ""}
              onValueChange={(v) => setJobId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPickerOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={go}
            disabled={!jobId || saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Clocking in…" : "Clock In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveShiftCard({
  shift,
  job,
  onChanged,
}: {
  shift: Shift;
  job: Job | null;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [saving, setSaving] = useState(false);
  const elapsed = shiftHours(shift.startedAt, null);

  async function clockOut() {
    setSaving(true);
    try {
      await timeclock.clockOut(notes || undefined);
      toast.success("Clocked out");
      onChanged();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-tmc-gold bg-tmc-gold/10 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
        <div className="font-semibold text-tmc-dark">
          On the clock — {job?.name ?? "(unknown job)"}
        </div>
      </div>
      <div className="text-3xl font-bold tabular-nums text-tmc-dark">
        {formatHours(elapsed)}
      </div>
      <div className="text-xs text-muted-foreground">
        Started {formatDateTime(shift.startedAt)}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes (optional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you work on?"
        />
      </div>
      <Button
        size="lg"
        onClick={clockOut}
        disabled={saving}
        className="bg-tmc-slate text-white hover:bg-tmc-dark w-full"
      >
        {saving ? "Clocking out…" : "Clock Out"}
      </Button>
    </div>
  );
}

function WeekSummary({ shifts }: { shifts: Shift[] }) {
  const { startIso, endIso, label } = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 Sun..6 Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      startIso: monday.toISOString(),
      endIso: sunday.toISOString(),
      label: `${monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    };
  }, []);

  const hours = totalHoursInRange(shifts, startIso, endIso);

  return (
    <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          This Week
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="text-2xl font-bold tabular-nums text-tmc-dark">
        {formatHours(hours)}
      </div>
    </div>
  );
}

function BackdateCard({
  jobs,
  onSubmitted,
}: {
  jobs: Job[];
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    jobId: jobs[0]?.id ?? null,
    date: today,
    startTime: "09:00",
    endTime: "17:00",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.jobId) {
      toast.error("Pick a job");
      return;
    }
    const startedAt = new Date(`${form.date}T${form.startTime}`).toISOString();
    const endedAt = new Date(`${form.date}T${form.endTime}`).toISOString();
    setSaving(true);
    try {
      await timeclock.backdate({
        jobId: form.jobId,
        startedAt,
        endedAt,
        notes: form.notes || undefined,
      });
      toast.success("Submitted for admin approval");
      setOpen(false);
      setForm({ ...form, notes: "" });
      onSubmitted();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          + Log a past shift (requires admin approval)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a past shift</DialogTitle>
          <DialogDescription>
            Use this if you forgot to clock in for work you already did. It'll
            sit in a pending state until an admin approves it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Job</Label>
            <Select
              value={form.jobId != null ? String(form.jobId) : ""}
              onValueChange={(v) => setForm({ ...form, jobId: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Date</Label>
            <Input
              type="date"
              max={today}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End time</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What did you work on?"
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
            {saving ? "Submitting…" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecentShiftsList({
  shifts,
  jobs,
}: {
  shifts: Shift[];
  jobs: Job[];
}) {
  if (shifts.length === 0) return null;
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        Recent shifts
      </div>
      <div className="divide-y">
        {shifts.map((s) => {
          const job = jobById.get(s.jobId);
          const hours = shiftHours(s.startedAt, s.endedAt);
          return (
            <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm">{job?.name ?? "(unknown job)"}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(s.startedAt)}
                  {s.endedAt ? ` → ${formatDateTime(s.endedAt)}` : " (active)"}
                </div>
                {s.notes && (
                  <div className="text-xs text-muted-foreground italic mt-0.5">
                    {s.notes}
                  </div>
                )}
                {s.status === "denied" && s.denialReason && (
                  <div className="text-xs text-red-700 mt-0.5">
                    Denied: {s.denialReason}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                <div className="text-sm tabular-nums font-semibold">
                  {s.endedAt ? formatHours(hours) : "…"}
                </div>
                <StatusPill status={s.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Shift["status"] }) {
  const cls = {
    active: "bg-tmc-gold/30 text-tmc-dark",
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    denied: "bg-red-100 text-red-800",
  }[status];
  const label = {
    active: "Active",
    completed: "Completed",
    pending: "Pending approval",
    denied: "Denied",
  }[status];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}
