import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  dayCount,
  formatDateRange,
  STATUS_LABELS,
  timeoff,
  type AdminTimeOffDashboard,
  type AdminTimeOffRequest,
  type TimeOffStatus,
} from "@/lib/timeoff";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "all", label: "All requests" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminTimeOff() {
  const [tab, setTab] = useState<Tab>("pending");
  const [data, setData] = useState<AdminTimeOffDashboard | null>(null);

  async function refresh() {
    try {
      setData(await timeoff.adminDashboard());
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  if (!data) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-tmc-gold/40 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Time Off
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending requests, see the team's full history.
        </p>
      </header>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = tab === t.id;
          const showBadge = t.id === "pending" && data.pendingCount > 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                active
                  ? "border-tmc-gold text-tmc-dark"
                  : "border-transparent text-muted-foreground hover:text-tmc-dark"
              }`}
            >
              {t.label}
              {showBadge && (
                <span className="bg-tmc-gold text-tmc-dark text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {data.pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "pending" ? (
        <PendingTab data={data} onChanged={refresh} />
      ) : (
        <AllTab data={data} onChanged={refresh} />
      )}
    </div>
  );
}

// ─── Pending tab — the inbox ─────────────────────────────────────────────

function PendingTab({
  data,
  onChanged,
}: {
  data: AdminTimeOffDashboard;
  onChanged: () => void;
}) {
  const pending = useMemo(
    () => data.requests.filter((r) => r.status === "pending"),
    [data.requests],
  );

  if (pending.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Inbox zero — nothing pending.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((r) => (
        <PendingCard key={r.id} req={r} onChanged={onChanged} />
      ))}
    </div>
  );
}

function PendingCard({
  req,
  onChanged,
}: {
  req: AdminTimeOffRequest;
  onChanged: () => void;
}) {
  return (
    <article className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-tmc-dark">
            {req.userName ?? req.userEmail}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(req.startDate, req.endDate)} ·{" "}
            {dayCount(req.startDate, req.endDate)}d
          </p>
        </div>
        <div className="flex gap-2">
          <ApproveButton id={req.id} onChanged={onChanged} />
          <DenyButton id={req.id} onChanged={onChanged} />
        </div>
      </div>
      {req.reason && (
        <div className="text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Reason
          </span>
          <p className="text-sm text-tmc-dark mt-0.5">{req.reason}</p>
        </div>
      )}
      <div className="text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Coverage plan
        </span>
        <p className="text-sm text-tmc-dark mt-0.5">{req.coveragePlan}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Submitted {new Date(req.createdAt).toLocaleString()}
      </p>
    </article>
  );
}

// ─── All requests tab — table view ───────────────────────────────────────

function AllTab({
  data,
  onChanged,
}: {
  data: AdminTimeOffDashboard;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<TimeOffStatus | "all">(
    "all",
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return data.requests;
    return data.requests.filter((r) => r.status === statusFilter);
  }, [data.requests, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <FilterPill
          label="All"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {(["pending", "approved", "denied", "cancelled"] as const).map((s) => (
          <FilterPill
            key={s}
            label={STATUS_LABELS[s]}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching requests.</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-tmc-dark">
                    {r.userName ?? r.userEmail}
                  </TableCell>
                  <TableCell>
                    {formatDateRange(r.startDate, r.endDate)}
                  </TableCell>
                  <TableCell>{dayCount(r.startDate, r.endDate)}</TableCell>
                  <TableCell
                    className="max-w-[180px] truncate"
                    title={r.reason ?? ""}
                  >
                    {r.reason ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[220px] truncate"
                    title={r.coveragePlan}
                  >
                    {r.coveragePlan}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === "pending" && (
                        <>
                          <ApproveButton
                            id={r.id}
                            onChanged={onChanged}
                            compact
                          />
                          <DenyButton
                            id={r.id}
                            onChanged={onChanged}
                            compact
                          />
                        </>
                      )}
                      <DeleteButton id={r.id} onChanged={onChanged} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-tmc-gold/30 text-tmc-dark"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Action buttons ──────────────────────────────────────────────────────

function ApproveButton({
  id,
  onChanged,
  compact = false,
}: {
  id: number;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      await timeoff.approve(id, note.trim() || undefined);
      toast.success("Approved.");
      setOpen(false);
      setNote("");
      onChanged();
    } catch (e) {
      toast.error(`Approve failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={compact ? "sm" : "default"}
          variant={compact ? "ghost" : "default"}
          className={compact ? "h-8 px-2 text-green-700 hover:bg-green-100" : "gap-2"}
        >
          <Check size={14} />
          {!compact && "Approve"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve time off</DialogTitle>
          <DialogDescription>
            Optional note will show on the requester's page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="approve-note">Note (optional)</Label>
          <textarea
            id="approve-note"
            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="LGTM — enjoy!"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={approve} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DenyButton({
  id,
  onChanged,
  compact = false,
}: {
  id: number;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function deny() {
    setBusy(true);
    try {
      await timeoff.deny(id, note.trim() || undefined);
      toast.success("Denied.");
      setOpen(false);
      setNote("");
      onChanged();
    } catch (e) {
      toast.error(`Deny failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={compact ? "sm" : "default"}
          variant={compact ? "ghost" : "destructive"}
          className={compact ? "h-8 px-2 text-red-700 hover:bg-red-100" : "gap-2"}
        >
          <X size={14} />
          {!compact && "Deny"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deny time off</DialogTitle>
          <DialogDescription>
            Add a reason so the requester knows what to change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="deny-note">Reason</Label>
          <textarea
            id="deny-note"
            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Coverage conflict — please re-arrange and resubmit."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={deny} disabled={busy}>
            {busy ? "Denying…" : "Deny request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({
  id,
  onChanged,
}: {
  id: number;
  onChanged: () => void;
}) {
  async function del() {
    try {
      await timeoff.delete(id);
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
          title="Delete request"
        >
          <Trash2 size={14} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this request?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the request. Prefer "Deny" if it was a
            real submission you're rejecting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={del}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatusPill({ status }: { status: TimeOffStatus }) {
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
