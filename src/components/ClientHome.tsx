import { forwardRef, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  FolderOpen,
  KeyRound,
  MessageSquarePlus,
  Zap,
} from "lucide-react";
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
import type { ClientUser } from "@/lib/useUser";
import {
  STATUS_LABELS,
  submissions,
  type ClientSubmission,
  type SubmissionStatus,
  type SubmissionType,
} from "@/lib/clientSubmissions";

const FALLBACK_GHL_URL = "https://app.tmctechhub.com";

export function ClientHome({ user }: { user: ClientUser }) {
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
              description="Ask us for something or flag an issue"
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
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setSubject("");
    setDetails("");
    setEventDate("");
    setLocation("");
  }

  async function submit() {
    if (!subject.trim()) {
      toast.error(isEvent ? "Event name is required." : "Subject is required.");
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
            {isEvent ? "Submit an event" : "Submit a request"}
          </DialogTitle>
          <DialogDescription>
            {isEvent
              ? "Tell us about an event you'd like marketed. The team gets notified right away."
              : "Send the TMC team a request. We'll get an email and follow up."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{isEvent ? "Event name *" : "Subject *"}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={isEvent ? "Summer Kickoff Party" : "What do you need?"}
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
          <div className="space-y-1">
            <Label>
              {isEvent ? "Details & what you'd like us to do *" : "Details *"}
            </Label>
            <textarea
              className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={
                isEvent
                  ? "What's the event, who's it for, and how can we help promote it?"
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
