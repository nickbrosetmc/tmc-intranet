// A client's requests, event briefs and support tickets, with where each one
// stands. Shown on the client's portal home, and on the team's Client View so
// the preview is exactly what the client sees.
//
// Open items lead; finished ones fold away under a toggle so the list stays
// about what's still moving. Each row opens the full submission and a
// Received / In progress / Done tracker.

import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
  SEVERITIES,
  SEVERITY_TONE,
  type MySubmission,
  type SubmissionStatus,
} from "@/lib/clientSubmissions";

const SECTION_ID = "your-requests";

/** For a link elsewhere on the page that jumps down to the list. */
export function scrollToClientSubmissions(): void {
  document.getElementById(SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ClientSubmissionsList({
  items,
  emptyText,
}: {
  items: MySubmission[];
  emptyText: string;
}) {
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const open = items.filter((s) => s.status !== "done");
  const done = items.filter((s) => s.status === "done");
  const selected = items.find((s) => s.id === openId) ?? null;

  return (
    <section id={SECTION_ID} className="w-full space-y-2 scroll-mt-24">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
        Your requests
      </h2>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="divide-y rounded-lg border bg-card">
              {open.map((s) => (
                <Row key={s.id} s={s} onOpen={() => setOpenId(s.id)} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
              Nothing open right now. Everything you've sent us is done.
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-tmc-slate hover:text-tmc-dark"
                aria-expanded={showDone}
              >
                {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Completed ({done.length})
              </button>
              {showDone && (
                <ul className="divide-y rounded-lg border bg-card">
                  {done.map((s) => (
                    <Row key={s.id} s={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <Dialog open={selected != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && <Detail s={selected} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Row({ s, onOpen }: { s: MySubmission; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        {/* Subject on its own line so a phone shows it whole rather than
            cutting it off beside the badge and status. */}
        <div className="min-w-0">
          <div className="text-sm font-medium text-tmc-dark line-clamp-2">{s.subject}</div>
          <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
            <TypeBadge s={s} />
            <span className="min-w-0 pt-px">{metaLine(s)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={s.status} />
          <ChevronRight size={14} className="text-muted-foreground" />
        </div>
      </button>
    </li>
  );
}

function Detail({ s }: { s: MySubmission }) {
  const severity = s.severity ? SEVERITIES.find((x) => x.id === s.severity) : null;
  return (
    <div className="space-y-5">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <TypeBadge s={s} />
          <StatusPill status={s.status} />
        </div>
        <DialogTitle className="text-left">{s.subject}</DialogTitle>
        <DialogDescription className="text-left">
          Sent by {s.submitterName} on {formatStamp(s.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <Tracker s={s} />

      <dl className="space-y-3 text-sm">
        {s.type === "event" && (s.eventDate || s.location) && (
          <Field label="Event">
            {[s.eventDate && formatYmd(s.eventDate), s.location].filter(Boolean).join(" · ")}
          </Field>
        )}
        {severity && (
          <Field label="How urgent">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${SEVERITY_TONE[severity.id]}`}
            >
              {severity.label}
            </span>
          </Field>
        )}
        {s.affectedUrl && (
          <Field label="Where">
            <span className="break-all">{s.affectedUrl}</span>
          </Field>
        )}
        <Field label="What you sent">
          <div className="rounded-md bg-muted/60 p-3 whitespace-pre-wrap text-tmc-dark">
            {s.details}
          </div>
        </Field>
      </dl>
    </div>
  );
}

const STEPS: SubmissionStatus[] = ["new", "in_progress", "done"];

/** Received, In progress, Done, with the date of each step we know. */
function Tracker({ s }: { s: MySubmission }) {
  const current = STEPS.indexOf(s.status);
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((step, i) => {
        const reached = i <= current;
        const date =
          i === 0 ? s.createdAt : i === current ? s.statusChangedAt : null;
        return (
          <li key={step} className="space-y-1.5">
            <div
              className={`h-1.5 rounded-full ${reached ? "bg-tmc-gold" : "bg-tmc-silver/60"}`}
            />
            <div className="flex items-center gap-1 text-xs">
              {reached && i < current && <Check size={12} className="text-tmc-gold-dark" />}
              <span
                className={
                  i === current
                    ? "font-semibold text-tmc-dark"
                    : reached
                      ? "text-tmc-slate"
                      : "text-muted-foreground"
                }
              >
                {CLIENT_STATUS_LABELS[step]}
              </span>
            </div>
            {date && <div className="text-[11px] text-muted-foreground">{formatStamp(date)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-tmc-slate">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function TypeBadge({ s }: { s: MySubmission }) {
  return (
    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider bg-muted text-tmc-slate px-1.5 py-0.5 rounded">
      {CLIENT_TYPE_LABELS[s.type]}
    </span>
  );
}

const STATUS_TONE: Record<SubmissionStatus, string> = {
  new: "bg-tmc-silver/50 text-tmc-slate",
  in_progress: "bg-tmc-gold/30 text-tmc-dark",
  done: "bg-green-100 text-green-800",
};

function StatusPill({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${STATUS_TONE[status]}`}
    >
      {CLIENT_STATUS_LABELS[status]}
    </span>
  );
}

function metaLine(s: MySubmission): string {
  const parts = [`Sent ${formatStamp(s.createdAt)} by ${s.submitterName}`];
  if (s.type === "event" && s.eventDate) parts.push(`event ${formatYmd(s.eventDate)}`);
  if (s.statusChangedAt && s.status === "in_progress") {
    parts.push(`started ${formatStamp(s.statusChangedAt)}`);
  }
  if (s.statusChangedAt && s.status === "done") {
    parts.push(`done ${formatStamp(s.statusChangedAt)}`);
  }
  return parts.join(" · ");
}

/**
 * Database timestamps are UTC "YYYY-MM-DD HH:MM:SS" with no zone. Read them
 * as UTC explicitly: parsed as-is they come out in the wrong zone, and
 * Safari (most clients, on their phones) rejects the format outright.
 */
function formatStamp(ts: string): string {
  const d = new Date(ts.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? ts.slice(0, 10) : formatDay(d);
}

/** Calendar dates ("YYYY-MM-DD") are local days, not instants. */
function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return formatDay(new Date(y, (m ?? 1) - 1, d ?? 1));
}

function formatDay(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
