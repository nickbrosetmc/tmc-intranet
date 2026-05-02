import { useEffect, useState, type ReactNode } from "react";
import { Pin } from "lucide-react";
import {
  fetchAnnouncements,
  type Announcement,
} from "@/lib/announcements";

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

export function AnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    fetchAnnouncements()
      .then((res) => setItems(res.announcements))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="w-full max-w-4xl space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-tmc-slate">
        Announcements
      </h2>
      <div className="space-y-3">
        {items.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} />
        ))}
      </div>
    </section>
  );
}

function AnnouncementCard({ announcement: a }: { announcement: Announcement }) {
  const date = new Date(a.createdAt.replace(" ", "T") + "Z");
  return (
    <article
      className={`rounded-lg border p-4 ${
        a.isPinned
          ? "bg-tmc-gold/10 border-tmc-gold/40"
          : "bg-card border-border"
      }`}
    >
      <header className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-tmc-dark flex items-center gap-2">
          {a.isPinned && (
            <Pin
              size={14}
              strokeWidth={2.5}
              className="text-tmc-gold-dark fill-tmc-gold-dark/30"
              aria-label="Pinned"
            />
          )}
          {a.title}
        </h3>
        <time
          className="text-xs text-muted-foreground shrink-0"
          dateTime={a.createdAt}
        >
          {date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </time>
      </header>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {linkify(a.body)}
      </div>
    </article>
  );
}

/** Render plain text with URLs auto-linked. */
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-tmc-gold-dark hover:underline"
      >
        {match[0]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
