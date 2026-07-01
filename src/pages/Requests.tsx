import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, MessageSquare } from "lucide-react";
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
import { Toaster } from "@/components/ui/sonner";
import { useUser } from "@/lib/useUser";
import { content } from "@/lib/content";
import { usePollingRefresh } from "@/lib/usePollingRefresh";
import {
  STATUS_LABELS,
  submissions,
  type AdminSubmission,
  type SubmissionStatus,
} from "@/lib/clientSubmissions";

type Filter = "all" | "new" | "in_progress" | "done";

export function RequestsPage() {
  const userState = useUser();
  const isTeam =
    userState.status === "authenticated" && userState.user.type === "team";
  const isAdmin =
    userState.status === "authenticated" &&
    userState.user.type === "team" &&
    userState.user.role === "admin";

  const [rows, setRows] = useState<AdminSubmission[] | null>(null);
  const [notifyEmails, setNotifyEmails] = useState("");
  const [filter, setFilter] = useState<Filter>("new");
  const [clientFilter, setClientFilter] = useState<number | "all">("all");

  async function refresh() {
    try {
      const d = await submissions.teamList();
      setRows(d.submissions);
      setNotifyEmails(d.notifyEmails);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    if (isTeam) void refresh();
  }, [isTeam]);
  usePollingRefresh(refresh, { intervalMs: 45_000, enabled: isTeam });

  const clientOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows ?? []) m.set(r.clientId, r.clientName);
    return [...m.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (clientFilter === "all" || r.clientId === clientFilter),
    );
  }, [rows, filter, clientFilter]);

  const newCount = rows?.filter((r) => r.status === "new").length ?? 0;

  if (!isTeam) {
    return (
      <div className="w-full max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Sign in as a team member to view client requests.
        </p>
      </div>
    );
  }
  if (!rows) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <header className="border-b border-tmc-gold/40 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Client Requests & Events
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Requests and event briefs clients submit from their portal.
        </p>
      </header>

      {isAdmin && <NotifyEmailsCard value={notifyEmails} onSaved={refresh} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {(["new", "in_progress", "done", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-tmc-gold/30 text-tmc-dark"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
              {f === "new" && newCount > 0 ? ` (${newCount})` : ""}
            </button>
          ))}
        </div>
        <div className="ml-auto min-w-[200px]">
          <Select
            value={clientFilter === "all" ? "all" : String(clientFilter)}
            onValueChange={(v) => setClientFilter(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SubmissionCard key={s.id} sub={s} onChanged={refresh} />
          ))}
        </div>
      )}

      <Toaster />
    </div>
  );
}

function NotifyEmailsCard({
  value,
  onSaved,
}: {
  value: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);

  async function save() {
    setSaving(true);
    try {
      await content.updateSetting("client_notify_emails", draft.trim());
      toast.success("Notification recipients updated.");
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-widest text-tmc-slate">
        Notification recipients (admin)
      </Label>
      <p className="text-xs text-muted-foreground">
        Comma-separated emails that get pinged when a client submits.
      </p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="nick@…, kit@…"
          className="text-sm"
        />
        <Button onClick={save} disabled={saving || draft.trim() === value.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function SubmissionCard({
  sub,
  onChanged,
}: {
  sub: AdminSubmission;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(sub.adminNotes ?? "");
  const isEvent = sub.type === "event";

  async function setStatus(status: SubmissionStatus) {
    try {
      await submissions.update(sub.id, { status });
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
      onChanged();
    } catch (e) {
      toast.error(`Update failed: ${(e as Error).message}`);
    }
  }
  async function saveNotes() {
    try {
      await submissions.update(sub.id, { adminNotes: notes.trim() || null });
      toast.success("Notes saved.");
      onChanged();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  }

  return (
    <article className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
              {isEvent ? <CalendarClock size={11} /> : <MessageSquare size={11} />}
              {isEvent ? "Event" : "Request"}
            </span>
            <h3 className="text-base font-semibold text-tmc-dark">{sub.subject}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sub.clientName} · {sub.submitterName} ·{" "}
            {new Date(sub.createdAt).toLocaleString()}
          </p>
        </div>
        <Select value={sub.status} onValueChange={(v) => setStatus(v as SubmissionStatus)}>
          <SelectTrigger className="h-8 w-36 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["new", "in_progress", "done"] as SubmissionStatus[]).map((st) => (
              <SelectItem key={st} value={st}>
                {STATUS_LABELS[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(sub.eventDate || sub.location) && (
        <div className="text-sm text-tmc-dark flex gap-4 flex-wrap">
          {sub.eventDate && (
            <span>
              <span className="text-muted-foreground">Date:</span> {sub.eventDate}
            </span>
          )}
          {sub.location && (
            <span>
              <span className="text-muted-foreground">Location:</span> {sub.location}
            </span>
          )}
        </div>
      )}

      <div className="bg-muted/60 rounded-md p-3 text-sm text-tmc-dark whitespace-pre-wrap">
        {sub.details}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Internal notes</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for the team…"
            className="text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={saveNotes}
          disabled={notes.trim() === (sub.adminNotes ?? "")}
        >
          Save note
        </Button>
      </div>
    </article>
  );
}
