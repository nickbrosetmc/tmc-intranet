import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, FolderOpen, KeyRound, Zap } from "lucide-react";
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
import { usePollingRefresh } from "@/lib/usePollingRefresh";
import {
  STATUS_LABELS,
  submissions,
  type AdminSubmission,
} from "@/lib/clientSubmissions";

interface OverviewClient {
  id: number;
  name: string;
  filesUrl: string | null;
  ghlUrl: string | null;
  passwordVaultUrl: string | null;
}

const FALLBACK_GHL_URL = "https://app.tmctechhub.com";

// Team-side preview of a client's portal: their tool links plus everything
// they've submitted, without needing that client's login.
export function ClientViewPage() {
  const userState = useUser();
  const isTeam =
    userState.status === "authenticated" && userState.user.type === "team";

  const [clients, setClients] = useState<OverviewClient[] | null>(null);
  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  async function refresh() {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/clients-overview", { credentials: "same-origin" }),
        submissions.teamList(),
      ]);
      if (!cRes.ok) throw new Error(`${cRes.status}`);
      const cBody = (await cRes.json()) as { clients: OverviewClient[] };
      setClients(cBody.clients);
      setSubs(sRes.submissions);
      setSelectedId((prev) => prev ?? cBody.clients[0]?.id ?? null);
    } catch (e) {
      toast.error(`Failed to load: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    if (isTeam) void refresh();
  }, [isTeam]);
  usePollingRefresh(refresh, { intervalMs: 60_000, enabled: isTeam });

  const selected = useMemo(
    () => clients?.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );
  const clientSubs = useMemo(
    () => subs.filter((s) => s.clientId === selectedId),
    [subs, selectedId],
  );

  if (!isTeam) {
    return (
      <div className="w-full max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Sign in as a team member to preview client portals.
        </p>
      </div>
    );
  }
  if (!clients) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <header className="border-b border-tmc-gold/40 pb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tmc-dark flex items-center gap-2">
            <Eye size={22} className="text-tmc-gold-dark" /> Client View
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            See a client's portal the way they see it.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Viewing as</Label>
          <Select
            value={selectedId != null ? String(selectedId) : undefined}
            onValueChange={(v) => setSelectedId(Number(v))}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Pick a client…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {selected ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LinkTile
              label="Files"
              description="Their shared drive with TMC"
              url={selected.filesUrl}
              icon={<FolderOpen size={28} strokeWidth={1.75} />}
              bg="bg-tmc-slate"
            />
            <LinkTile
              label="GoHighLevel"
              description="Their CRM dashboard"
              url={selected.ghlUrl ?? FALLBACK_GHL_URL}
              icon={<Zap size={28} strokeWidth={1.75} />}
              bg="bg-[#FF7F32]"
            />
            <LinkTile
              label="Password Vault"
              description="Shared credentials in 1Password"
              url={selected.passwordVaultUrl}
              icon={<KeyRound size={28} strokeWidth={1.75} />}
              bg="bg-[#0572EC]"
            />
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
              Their submissions
            </h2>
            {clientSubs.length === 0 ? (
              <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                {selected.name} hasn't submitted anything yet.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {clientSubs.map((s) => (
                  <li key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                          {s.type === "event" ? "Event" : "Request"}
                        </span>
                        <span className="text-sm font-medium text-tmc-dark">
                          {s.subject}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.submitterName} · {new Date(s.createdAt).toLocaleDateString()}
                        {s.eventDate ? ` · event ${s.eventDate}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                      {STATUS_LABELS[s.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No active clients yet.</p>
      )}

      <Toaster />
    </div>
  );
}

function LinkTile({
  label,
  description,
  url,
  icon,
  bg,
}: {
  label: string;
  description: string;
  url: string | null;
  icon: React.ReactNode;
  bg: string;
}) {
  const base = "flex items-center gap-4 rounded-lg border bg-card p-4 transition-shadow";
  const inner = (
    <>
      <div
        className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${bg} ${url ? "" : "opacity-50"}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-tmc-dark">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {url ? description : "Not set up yet"}
        </p>
      </div>
    </>
  );
  if (!url) return <div className={`${base} opacity-70`}>{inner}</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`${base} hover:shadow-md`}>
      {inner}
    </a>
  );
}
