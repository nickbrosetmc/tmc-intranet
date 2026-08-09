import { forwardRef, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  FolderOpen,
  KeyRound,
  LifeBuoy,
  MessageSquarePlus,
  Pencil,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientUser } from "@/lib/useUser";
import {
  SEVERITIES,
  STATUS_LABELS,
  submissions,
  type ClientSubmission,
  type Severity,
  type SubmissionStatus,
  type SubmissionType,
} from "@/lib/clientSubmissions";

const FALLBACK_GHL_URL = "https://app.tmctechhub.com";

export function ClientHome({ user }: { user: ClientUser }) {
  // Block portal use until the admin-set password is replaced.
  if (user.mustChangePassword) {
    return <ForcePasswordChange firstName={user.name.split(" ")[0]} />;
  }
  return <ClientHomeInner user={user} />;
}

function ClientHomeInner({ user }: { user: ClientUser }) {
  const client = user.client;
  const [mine, setMine] = useState<ClientSubmission[]>([]);

  async function refresh() {
    try {
      const { submissions: rows } = await submissions.mine();
      setMine(rows);
    } catch {
      /* silent — the tiles still work */
    }
  }
  useEffect(() => {
    if (client) void refresh();
  }, [client?.id]);

  if (!client) {
    return (
      <div className="text-center max-w-md space-y-3 mx-auto">
        <h1 className="text-xl font-semibold text-tmc-dark">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your client account isn't fully set up yet. Reach out to TMC and we'll get
          your tools wired up.
        </p>
      </div>
    );
  }

  const tiles: Tile[] = [
    {
      label: "Update My Website",
      description: "Edit your site's text & images",
      url: "/website",
      internal: true,
      icon: <Pencil size={32} strokeWidth={1.75} />,
      bg: "bg-tmc-gold-dark",
      placeholder: null,
    },
    {
      label: "Files",
      description: "Your shared drive with TMC",
      url: client.filesUrl,
      icon: <FolderOpen size={32} strokeWidth={1.75} />,
      bg: "bg-tmc-slate",
      placeholder: "TMC will share your folder link here once it's set up.",
    },
    {
      label: "GoHighLevel",
      description: "Your CRM dashboard",
      url: client.ghlUrl ?? FALLBACK_GHL_URL,
      icon: <Zap size={32} strokeWidth={1.75} />,
      bg: "bg-[#FF7F32]",
      placeholder: null,
    },
    {
      label: "Password Vault",
      description: "Shared credentials in 1Password",
      url: client.passwordVaultUrl,
      icon: <KeyRound size={32} strokeWidth={1.75} />,
      bg: "bg-[#0572EC]",
      placeholder: "TMC will share a 1Password vault link here once it's set up.",
    },
  ];

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-tmc-dark">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {client.name}'s client portal — everything TMC has set up for you.
        </p>
        {user.memberships.length > 1 && (
          <div className="flex justify-center pt-1">
            <AccountSwitcher
              memberships={user.memberships}
              activeClientId={user.clientId}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {tiles.map((t) => (
          <TileCard key={t.label} tile={t} />
        ))}
        <SubmissionDialog
          type="request"
          onSubmitted={refresh}
          trigger={
            <ActionTile
              label="Submit a Request"
              description="Ask us for something new"
              icon={<MessageSquarePlus size={32} strokeWidth={1.75} />}
              bg="bg-tmc-gold-dark"
            />
          }
        />
        <SubmissionDialog
          type="event"
          onSubmitted={refresh}
          trigger={
            <ActionTile
              label="Submit an Event"
              description="Tell us about an event to market"
              icon={<CalendarPlus size={32} strokeWidth={1.75} />}
              bg="bg-tmc-dark"
            />
          }
        />
        <SubmissionDialog
          type="support"
          onSubmitted={refresh}
          trigger={
            <ActionTile
              label="Report an Issue"
              description="Something broken? Get us on it"
              icon={<LifeBuoy size={32} strokeWidth={1.75} />}
              bg="bg-tmc-slate"
            />
          }
        />
      </div>

      {mine.length > 0 && (
        <section className="w-full space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
            Your submissions
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {mine.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                      {s.type === "event" ? "Event" : "Request"}
                    </span>
                    <span className="text-sm font-medium text-tmc-dark">{s.subject}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString()}
                    {s.eventDate ? ` · event ${s.eventDate}` : ""}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AccountSwitcher({
  memberships,
  activeClientId,
}: {
  memberships: { clientId: number; name: string }[];
  activeClientId: number;
}) {
  const [busy, setBusy] = useState(false);

  async function switchTo(clientId: number) {
    if (clientId === activeClientId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/auth/switch-client", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `${res.status}`);
      }
      window.location.reload();
    } catch (e) {
      toast.error(`Couldn't switch accounts: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <Select
      value={String(activeClientId)}
      onValueChange={(v) => void switchTo(Number(v))}
    >
      <SelectTrigger className="h-8 w-56 text-sm" disabled={busy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.clientId} value={String(m.clientId)}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, string> = {
    new: "bg-blue-100 text-blue-800",
    in_progress: "bg-yellow-100 text-yellow-800",
    done: "bg-green-100 text-green-800",
  };
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${map[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Submission dialog (request or event) ────────────────────────────────

function SubmissionDialog({
  type,
  trigger,
  onSubmitted,
}: {
  type: SubmissionType;
  trigger: React.ReactNode;
  onSubmitted: () => void;
}) {
  const isEvent = type === "event";
  const isSupport = type === "support";
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [affectedUrl, setAffectedUrl] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setSubject("");
    setDetails("");
    setEventDate("");
    setLocation("");
    setSeverity("normal");
    setAffectedUrl("");
  }

  async function submit() {
    if (!subject.trim()) {
      toast.error(
        isEvent
          ? "Event name is required."
          : isSupport
            ? "Please summarize the issue."
            : "Subject is required.",
      );
      return;
    }
    if (!details.trim()) {
      toast.error("Please add some details.");
      return;
    }
    setBusy(true);
    try {
      await submissions.submit({
        type,
        subject: subject.trim(),
        details: details.trim(),
        eventDate: isEvent && eventDate ? eventDate : null,
        location: isEvent && location.trim() ? location.trim() : null,
        severity: isSupport ? severity : null,
        affectedUrl: isSupport && affectedUrl.trim() ? affectedUrl.trim() : null,
      });
      toast.success("Sent to the TMC team.");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEvent
              ? "Submit an event"
              : isSupport
                ? "Report a technical issue"
                : "Submit a request"}
          </DialogTitle>
          <DialogDescription>
            {isEvent
              ? "Tell us about an event you'd like marketed. The team gets notified right away."
              : isSupport
                ? "Something broken? Tell us what's happening and we'll get an email straight away."
                : "Send the TMC team a request. We'll get an email and follow up."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>
              {isEvent ? "Event name *" : isSupport ? "What's wrong? *" : "Subject *"}
            </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                isEvent
                  ? "Summer Kickoff Party"
                  : isSupport
                    ? "Contact form isn't sending"
                    : "What do you need?"
              }
            />
          </div>
          {isEvent && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Venue / city"
                />
              </div>
            </div>
          )}
          {isSupport && (
            <>
              <div className="space-y-1">
                <Label>How urgent is it?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SEVERITIES.map((sv) => (
                    <button
                      key={sv.id}
                      type="button"
                      onClick={() => setSeverity(sv.id)}
                      className={`text-left rounded-md border px-2.5 py-2 transition ${
                        severity === sv.id
                          ? "border-tmc-gold bg-tmc-gold/10"
                          : "hover:border-tmc-gold/50"
                      }`}
                    >
                      <div className="text-sm font-medium text-tmc-dark">{sv.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {sv.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Where is it happening?</Label>
                <Input
                  value={affectedUrl}
                  onChange={(e) => setAffectedUrl(e.target.value)}
                  placeholder="Page URL, or the tool that's broken"
                />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>
              {isEvent
                ? "Details & what you'd like us to do *"
                : isSupport
                  ? "What happens, and what did you expect? *"
                  : "Details *"}
            </Label>
            <textarea
              className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isEvent
                  ? "What's the event, who's it for, and how can we help promote it?"
                  : isSupport
                    ? "What you did, what happened, and anything you've already tried. Screenshots can follow by email."
                    : "Give us the details so we can help."
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {busy ? "Sending…" : "Send to TMC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Tile {
  label: string;
  description: string;
  url: string | null;
  internal?: boolean;
  icon: React.ReactNode;
  bg: string;
  placeholder: string | null;
}

// A tile that acts as a button (opens a dialog) instead of a link.
// forwardRef so it works as a Radix DialogTrigger `asChild`.
const ActionTile = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    description: string;
    icon: React.ReactNode;
    bg: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function ActionTile({ label, description, icon, bg, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className="flex items-center gap-4 rounded-lg border bg-card p-5 text-left transition-shadow hover:shadow-md w-full"
    >
      <div className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${bg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-tmc-dark">{label}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
});

function TileCard({ tile }: { tile: Tile }) {
  const content = (
    <>
      <div
        className={`w-16 h-16 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${tile.bg} ${tile.url ? "" : "opacity-50"}`}
      >
        {tile.icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-tmc-dark">{tile.label}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {tile.url ? tile.description : (tile.placeholder ?? tile.description)}
        </p>
      </div>
    </>
  );

  const baseClass =
    "flex items-center gap-4 rounded-lg border bg-card p-5 transition-shadow";

  if (!tile.url) {
    return (
      <div className={`${baseClass} opacity-70 cursor-not-allowed`}>{content}</div>
    );
  }
  if (tile.internal) {
    return (
      <Link href={tile.url} className={`${baseClass} hover:shadow-md`}>
        {content}
      </Link>
    );
  }
  return (
    <a
      href={tile.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} hover:shadow-md`}
    >
      {content}
    </a>
  );
}

// ─── Forced password change (first login / after admin reset) ────────────

function ForcePasswordChange({ firstName }: { firstName: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `${res.status}`);
      }
      toast.success("Password updated. Welcome in!");
      setTimeout(() => window.location.reload(), 600);
    } catch (e2) {
      toast.error(`${(e2 as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark">
          Welcome, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Before you get started, set your own password. The one you signed
          in with was chosen by TMC — pick something only you know.
        </p>
      </div>
      <form onSubmit={submit} className="rounded-lg border bg-card p-6 space-y-4">
        <div className="space-y-2">
          <Label>Current password</Label>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <Label>New password</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="min 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label>Confirm new password</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
        >
          {busy ? "Saving…" : "Set password & continue"}
        </Button>
      </form>
    </div>
  );
}
