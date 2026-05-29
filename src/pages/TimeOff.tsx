import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, Plus, X } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  dayCount,
  formatDateRange,
  STATUS_LABELS,
  timeoff,
  todayYmd,
  type AdminTimeOffRequest,
  type MeTimeOffDashboard,
  type TimeOffRequest,
  type TimeOffStatus,
} from "@/lib/timeoff";

export function TimeOffPage() {
  const userState = useUser();
  const [data, setData] = useState<MeTimeOffDashboard | null>(null);

  async function refresh() {
    try {
      setData(await timeoff.myDashboard());
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    if (userState.status !== "authenticated" || userState.user.type !== "team")
      return;
    void refresh();
  }, [userState.status]);

  if (userState.status !== "authenticated" || userState.user.type !== "team") {
    return (
      <div className="w-full max-w-4xl space-y-4">
        <header className="border-b border-tmc-gold/40 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Time Off
          </h1>
        </header>
        <p className="text-sm text-muted-foreground">
          Sign in as a team member to submit and view time-off requests.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  const myUserId = data.user.id;

  return (
    <div className="w-full max-w-4xl space-y-6">
      <header className="border-b border-tmc-gold/40 pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
            Time Off
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unlimited PTO — submit a request, arrange coverage, get it
            approved.
          </p>
        </div>
        <RequestDialog onSubmitted={refresh} />
      </header>

      <UpcomingTeamCard
        requests={data.upcomingTeam}
        myUserId={myUserId}
      />

      <MyRequestsCard requests={data.myRequests} onChanged={refresh} />

      <Toaster />
    </div>
  );
}

// ─── Dialog: submit a new request ────────────────────────────────────────

function RequestDialog({ onSubmitted }: { onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const today = todayYmd();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [coverage, setCoverage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setStart(today);
    setEnd(today);
    setCoverage("");
    setReason("");
  }

  async function submit() {
    if (!start || !end) {
      toast.error("Pick a start and end date.");
      return;
    }
    if (end < start) {
      toast.error("End date can't be before the start date.");
      return;
    }
    if (!coverage.trim()) {
      toast.error("Coverage plan is required.");
      return;
    }
    setBusy(true);
    try {
      await timeoff.submit({
        startDate: start,
        endDate: end,
        coveragePlan: coverage.trim(),
        reason: reason.trim() || undefined,
      });
      toast.success("Request submitted — Nick will review it.");
      setOpen(false);
      reset();
      onSubmitted();
    } catch (e) {
      toast.error(`Submit failed: ${(e as Error).message}`);
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
        <Button className="gap-2">
          <Plus size={16} /> Request time off
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            Coverage plan is required — say who's covering or how the work
            will get done.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="to-start">From</Label>
              <Input
                id="to-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to-end">Through</Label>
              <Input
                id="to-end"
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          {start && end && end >= start ? (
            <p className="text-xs text-muted-foreground">
              {dayCount(start, end)} day{dayCount(start, end) === 1 ? "" : "s"}{" "}
              off
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="to-coverage">Coverage plan *</Label>
            <textarea
              id="to-coverage"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. Sarah is covering check-ins; client posts scheduled ahead through Wed."
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to-reason">Reason (optional)</Label>
            <Input
              id="to-reason"
              placeholder="Vacation, family, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Upcoming team time off ──────────────────────────────────────────────

function UpcomingTeamCard({
  requests,
  myUserId,
}: {
  requests: AdminTimeOffRequest[];
  myUserId: number;
}) {
  const today = todayYmd();
  const grouped = useMemo(() => {
    const now: AdminTimeOffRequest[] = [];
    const upcoming: AdminTimeOffRequest[] = [];
    for (const r of requests) {
      if (r.startDate <= today && r.endDate >= today) now.push(r);
      else upcoming.push(r);
    }
    return { now, upcoming };
  }, [requests, today]);

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Team time off
      </h2>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No approved time off coming up.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.now.length > 0 && (
            <RangeGroup
              label="Out today"
              items={grouped.now}
              myUserId={myUserId}
            />
          )}
          {grouped.upcoming.length > 0 && (
            <RangeGroup
              label="Upcoming"
              items={grouped.upcoming}
              myUserId={myUserId}
            />
          )}
        </div>
      )}
    </section>
  );
}

function RangeGroup({
  label,
  items,
  myUserId,
}: {
  label: string;
  items: AdminTimeOffRequest[];
  myUserId: number;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {label}
      </div>
      <ul className="divide-y border rounded-md">
        {items.map((r) => (
          <li
            key={r.id}
            className="px-3 py-2 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-tmc-dark truncate">
                {r.userId === myUserId ? "You" : r.userName ?? r.userEmail}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateRange(r.startDate, r.endDate)}
              </div>
            </div>
            {r.reason && (
              <div className="text-xs text-muted-foreground italic max-w-[40%] truncate">
                {r.reason}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── My requests ─────────────────────────────────────────────────────────

function MyRequestsCard({
  requests,
  onChanged,
}: {
  requests: TimeOffRequest[];
  onChanged: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        My requests
      </h2>
      {requests.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <CalendarOff size={28} className="text-tmc-gold-dark" />
          <p className="text-sm text-muted-foreground">
            You haven't submitted any time-off requests yet.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {requests.map((r) => (
            <MyRequestRow key={r.id} req={r} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MyRequestRow({
  req,
  onChanged,
}: {
  req: TimeOffRequest;
  onChanged: () => void;
}) {
  const canCancel = req.status === "pending" || req.status === "approved";
  async function cancel() {
    if (!confirm("Cancel this time-off request?")) return;
    try {
      await timeoff.cancelMine(req.id);
      toast.success("Request cancelled.");
      onChanged();
    } catch (e) {
      toast.error(`Cancel failed: ${(e as Error).message}`);
    }
  }

  return (
    <li className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-tmc-dark">
            {formatDateRange(req.startDate, req.endDate)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({dayCount(req.startDate, req.endDate)}d)
          </span>
          <StatusPill status={req.status} />
        </div>
        {req.reason && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Reason:</span> {req.reason}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Coverage:</span> {req.coveragePlan}
        </div>
        {req.adminNote && (
          <div className="text-xs text-muted-foreground italic">
            <span className="font-medium not-italic">Admin note:</span>{" "}
            {req.adminNote}
          </div>
        )}
      </div>
      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={cancel}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          title="Cancel request"
        >
          <X size={14} />
        </Button>
      )}
    </li>
  );
}

export function StatusPill({ status }: { status: TimeOffStatus }) {
  const map: Record<TimeOffStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${map[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
