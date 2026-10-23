// The admin landing page: the numbers that matter this month, what's coming
// up, and what's waiting on an admin, each linking to the page that handles
// it. Reads the same data the Finance pages and the team dashboard use, so
// it can't disagree with either.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  categoryBudgetStatus,
  computeSummary,
  finance,
  fmtMoney,
  projectMonth,
  thisMonthIso,
  type FinanceDashboard,
} from "@/lib/finance";
import { clientLifetime, formatTenure, lifetimeAverages } from "@/lib/clientLifetime";
import { daysBetween } from "@/lib/renewal";
import { todayYmd } from "@/lib/tasks";
import { usePollingRefresh } from "@/lib/usePollingRefresh";
import { projects as projectsApi, type ClientProject } from "@/lib/projects";
import { LaunchLabel } from "@/pages/admin/ProjectParts";
import { AdminPageHeader } from "@/pages/admin/AdminPageHeader";
import { StatCard } from "@/pages/admin/AdminFinance";

interface TeamToday {
  clockedIn: { userId: number; userName: string | null; jobName: string; startedAt: string }[];
  offToday: { userId: number; userName: string | null; startDate: string; endDate: string }[];
  pendingTimeOff: number;
  pendingShifts: number;
}

/** Renewals this close show on the overview. */
const RENEWAL_WINDOW_DAYS = 60;
/** Launches this many days either side of today show on the overview. */
const LAUNCH_WINDOW_DAYS = 30;

export function AdminOverview() {
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [team, setTeam] = useState<TeamToday | null>(null);
  const [newRequests, setNewRequests] = useState(0);
  const [projectList, setProjectList] = useState<ClientProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [fin, dash, proj] = await Promise.all([
        finance.dashboard(),
        fetch("/api/dashboard", { credentials: "same-origin" }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<{ team: TeamToday | null; newSubmissionCount: number }>;
        }),
        projectsApi.list(),
      ]);
      setProjectList(proj.projects);
      setD(fin);
      setTeam(dash.team);
      setNewRequests(dash.newSubmissionCount);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  usePollingRefresh(() => void load());

  const today = todayYmd();
  const monthIso = thisMonthIso();
  const view = useMemo(() => {
    if (!d) return null;
    const summary = computeSummary(d, monthIso);
    const projection = projectMonth({
      monthIso,
      startBalance: d.settings.currentBalance,
      clients: d.recurringClients,
      recurringExpenses: d.recurringExpenses,
      oneTimeExpenses: d.oneTimeExpenses,
      oneOffInvoices: d.oneOffInvoices,
      paymentMethods: d.paymentMethods,
    });
    const endBalance = projection.length
      ? projection[projection.length - 1].balance
      : d.settings.currentBalance;
    const lifetimes = d.recurringClients.map((c) => clientLifetime(c, d.oneOffInvoices, today, d.rateChanges));
    const renewals = lifetimes
      .filter((l) => l.nextRenewal && daysBetween(today, l.nextRenewal) <= RENEWAL_WINDOW_DAYS)
      .sort((a, b) => a.nextRenewal!.localeCompare(b.nextRenewal!));
    const overBudget = categoryBudgetStatus(d, monthIso).filter(
      (s) => s.percentUsed != null && s.percentUsed > 100,
    );
    const launches = projectList
      .filter(
        (p) => p.launchDate && Math.abs(daysBetween(today, p.launchDate)) <= LAUNCH_WINDOW_DAYS,
      )
      .sort((a, b) => b.launchDate!.localeCompare(a.launchDate!));
    return {
      summary,
      endBalance,
      launches,
      renewals,
      all: lifetimeAverages(lifetimes, "all"),
      current: lifetimeAverages(lifetimes, "current"),
      past: lifetimeAverages(lifetimes, "past"),
      overBudget,
    };
  }, [d, monthIso, today, projectList]);

  if (error && !d) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load the overview ({error}).{" "}
        <button onClick={() => void load()} className="text-tmc-gold-dark hover:underline">
          Try again
        </button>
      </p>
    );
  }
  if (!d || !view) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const attention = [
    { count: team?.pendingTimeOff ?? 0, one: "time-off request to review", many: "time-off requests to review", href: "/admin/time-off" },
    { count: team?.pendingShifts ?? 0, one: "shift edit to approve", many: "shift edits to approve", href: "/admin/time-clock" },
    { count: newRequests, one: "new client request", many: "new client requests", href: "/requests" },
    { count: view.renewals.filter((r) => daysBetween(today, r.nextRenewal!) <= 30).length, one: "renewal inside its 30-day notice window", many: "renewals inside their 30-day notice window", href: "/admin/finance/clients" },
    { count: view.overBudget.length, one: "budget over its limit this month", many: "budgets over their limit this month", href: "/admin/finance/budgets" },
    { count: view.all.missing, one: "client missing lifetime dates", many: "clients missing lifetime dates", href: "/admin/finance/clients" },
  ].filter((a) => a.count > 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TileLink href="/admin/finance">
          <StatCard
            label="Cash on hand"
            value={fmtMoney(d.settings.currentBalance)}
            subtitle="as last entered"
          />
        </TileLink>
        <TileLink href="/admin/finance/revenue">
          <StatCard
            label="MRR (net)"
            value={fmtMoney(view.summary.mrrNet)}
            subtitle={`gross ${fmtMoney(view.summary.mrrGross)}`}
          />
        </TileLink>
        <TileLink href="/admin/finance">
          <StatCard
            label="Month-end balance"
            value={fmtMoney(view.endBalance)}
            subtitle="projected"
            tone={view.endBalance >= d.settings.currentBalance ? "good" : "warn"}
          />
        </TileLink>
        <TileLink href="/admin/finance/expenses">
          <StatCard
            label="Monthly expenses"
            value={fmtMoney(view.summary.monthlyExpenses)}
            subtitle={`${fmtMoney(view.summary.monthlyPayroll)} of it payroll`}
          />
        </TileLink>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Upcoming renewals" href="/admin/finance/clients" linkLabel="Client lifetime">
            {view.renewals.length === 0 ? (
              <Empty>
                No renewals in the next {RENEWAL_WINDOW_DAYS} days.
                {view.all.missing > 0 && " Some clients don't have a signed date or term yet."}
              </Empty>
            ) : (
              <ul className="divide-y">
                {view.renewals.map((r) => {
                  const days = daysBetween(today, r.nextRenewal!);
                  return (
                    <li key={r.client.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-tmc-dark truncate">{r.client.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Renews {fmtDay(r.nextRenewal!)} · notice by {fmtDay(r.noticeBy!)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm tabular-nums text-tmc-slate">
                          {fmtMoney(r.client.monthlyAmount)}/mo
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            days <= 30
                              ? "bg-red-100 text-red-800"
                              : days <= 45
                                ? "bg-tmc-gold/30 text-tmc-dark"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {days === 0 ? "today" : `${days}d`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {view.launches.length > 0 && (
            <Panel title="Launches" href="/admin/projects" linkLabel="All projects">
              <ul className="divide-y">
                {view.launches.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-tmc-dark truncate">{p.name}</div>
                      <Link
                        href={`/admin/clients/${p.clientId}`}
                        className="text-xs text-muted-foreground hover:text-tmc-gold-dark"
                      >
                        {p.clientName}
                      </Link>
                    </div>
                    <div className="text-right shrink-0">
                      <LaunchLabel launchDate={p.launchDate} today={today} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Client lifetime" href="/admin/finance/clients" linkLabel="Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Figure
                label="Average LTV"
                value={view.all.avgLtv == null ? "—" : fmtMoney(view.all.avgLtv)}
                note={`${view.all.counted} ${view.all.counted === 1 ? "client" : "clients"}`}
              />
              <Figure
                label="Average lifetime"
                value={formatTenure(view.past.avgTenure)}
                note={view.past.counted ? `${view.past.counted} past ${view.past.counted === 1 ? "client" : "clients"}` : "no past clients dated"}
              />
              <Figure
                label="Current clients so far"
                value={formatTenure(view.current.avgTenure)}
                note={view.current.counted ? "average tenure" : "add signed dates"}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Needs your attention">
            {attention.length === 0 ? (
              <Empty>All caught up.</Empty>
            ) : (
              <ul className="-mx-2">
                {attention.map((a) => (
                  <li key={a.one}>
                    <Link
                      href={a.href}
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                    >
                      <span className="min-w-6 h-6 px-1.5 rounded-full bg-tmc-gold/25 text-tmc-dark text-xs font-semibold flex items-center justify-center tabular-nums">
                        {a.count}
                      </span>
                      <span className="flex-1 text-tmc-dark">{a.count === 1 ? a.one : a.many}</span>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {team && (
            <Panel title="Team today" href="/admin/time-clock" linkLabel="Time clock">
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-tmc-slate mb-1">
                    Clocked in
                  </div>
                  {team.clockedIn.length === 0 ? (
                    <p className="text-muted-foreground">Nobody right now.</p>
                  ) : (
                    team.clockedIn.map((s) => (
                      <p key={s.userId} className="text-tmc-dark">
                        {s.userName ?? "Someone"}{" "}
                        <span className="text-muted-foreground">on {s.jobName}</span>
                      </p>
                    ))
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-tmc-slate mb-1">
                    Off today
                  </div>
                  {team.offToday.length === 0 ? (
                    <p className="text-muted-foreground">Everyone's in.</p>
                  ) : (
                    team.offToday.map((o) => (
                      <p key={o.userId} className="text-tmc-dark">
                        {o.userName ?? "Someone"}
                        {o.endDate !== o.startDate && (
                          <span className="text-muted-foreground"> through {fmtDay(o.endDate)}</span>
                        )}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-tmc-slate">
          {title}
        </CardTitle>
        {href && (
          <Link href={href} className="text-xs text-tmc-gold-dark hover:underline">
            {linkLabel} →
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-bold tracking-tight tabular-nums text-tmc-dark mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{note}</div>
    </div>
  );
}

function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-xl transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-tmc-gold"
    >
      {children}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-2">{children}</p>;
}

/** "Dec 6" from a calendar date, read as a local day. */
function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
