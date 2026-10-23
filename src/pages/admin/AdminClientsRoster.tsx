// Every client in one list (retainers, project-only clients and past
// clients), each opening their profile. Portal accounts that aren't tied to
// a client yet are listed underneath, ready to add.

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminClients, type AdminClient } from "@/lib/admin-api";
import { clientLifetime } from "@/lib/clientLifetime";
import { finance, fmtMoney, type FinanceDashboard } from "@/lib/finance";
import { projects as projectsApi, type ClientProject } from "@/lib/projects";
import { daysBetween } from "@/lib/renewal";
import { todayYmd } from "@/lib/tasks";
import { AdminPageHeader } from "@/pages/admin/AdminPageHeader";
import { ClientDialog } from "@/pages/admin/AdminFinance";
import { fmtLongDay } from "@/pages/admin/ProjectParts";

type Segment = "current" | "past" | "all";
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

export function AdminClientsRoster() {
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [projectList, setProjectList] = useState<ClientProject[]>([]);
  const [accounts, setAccounts] = useState<AdminClient[]>([]);
  const [segment, setSegment] = useState<Segment>("current");
  const [, navigate] = useLocation();

  async function load() {
    try {
      const [fin, proj, acc] = await Promise.all([
        finance.dashboard(),
        projectsApi.list(),
        adminClients.list(),
      ]);
      setD(fin);
      setProjectList(proj.projects);
      setAccounts(acc.clients);
    } catch (e) {
      toast.error(`Couldn't load clients: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const today = todayYmd();
  const rows = useMemo(() => {
    if (!d) return [];
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    return d.recurringClients
      .filter((c) =>
        segment === "current" ? c.isActive : segment === "past" ? !c.isActive : true,
      )
      .map((c) => {
        const own = projectList.filter((p) => p.clientId === c.id);
        const lastLaunch = own
          .map((p) => p.launchDate)
          .filter((x): x is string => !!x && x <= today)
          .sort()
          .pop();
        return {
          c,
          life: clientLifetime(c, d.oneOffInvoices, today, d.rateChanges),
          projects: own.length,
          lastLaunch,
          portal: c.portalClientId != null ? accountName.get(c.portalClientId) ?? null : null,
        };
      })
      .sort((a, b) => a.c.name.localeCompare(b.c.name));
  }, [d, projectList, accounts, segment, today]);

  const unlinked = useMemo(() => {
    const linked = new Set(d?.recurringClients.map((c) => c.portalClientId).filter((x) => x != null));
    return accounts.filter((a) => a.isActive && !linked.has(a.id));
  }, [d, accounts]);

  async function addFromPortal(a: AdminClient) {
    try {
      const { client } = await finance.createClient({
        name: a.name,
        monthlyAmount: 0,
        portalClientId: a.id,
      });
      toast.success(`${a.name} added`);
      navigate(`/admin/clients/${client.id}`);
    } catch (e) {
      toast.error(`Couldn't add: ${(e as Error).message}`);
    }
  }

  if (!d) return <div className="text-sm text-muted-foreground">Loading clients…</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clients"
        description="Every client, retainer or project, with their contract, projects and portal account."
        actions={<ClientDialog mode="create" d={d} onSaved={load} />}
      />

      <div className="inline-flex rounded-md border bg-card p-0.5" role="group" aria-label="Which clients">
        {SEGMENTS.map((sg) => (
          <button
            key={sg.id}
            type="button"
            onClick={() => setSegment(sg.id)}
            aria-pressed={segment === sg.id}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              segment === sg.id ? "bg-tmc-dark text-white" : "text-muted-foreground hover:text-tmc-dark"
            }`}
          >
            {sg.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Portal account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    {segment === "past" ? "No past clients." : "No clients yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ c, life, projects, lastLaunch, portal }) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/clients/${c.id}`)}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="text-tmc-dark hover:text-tmc-gold-dark"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </Link>
                      {!c.isActive && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          past
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.monthlyAmount > 0 ? (
                        <>
                          Retainer{" "}
                          <span className="text-muted-foreground tabular-nums">
                            {fmtMoney(c.monthlyAmount)}/mo
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Project client</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <RenewsCell life={life} today={today} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {projects === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          {projects}
                          {lastLaunch && (
                            <span className="text-muted-foreground">
                              {" "}
                              · last launch {fmtLongDay(lastLaunch)}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {portal ?? <span className="text-muted-foreground">Not linked</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {unlinked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In the portal, not in this list</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              These portal accounts aren't tied to a client yet. Add one as a client, or link it
              from an existing client's profile if it's the same business under another name.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {unlinked.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-tmc-dark">{a.name}</span>
                  <Button size="sm" variant="outline" onClick={() => void addFromPortal(a)}>
                    Add as client
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RenewsCell({ life, today }: { life: ReturnType<typeof clientLifetime>; today: string }) {
  const c = life.client;
  if (!c.isActive) {
    return c.endedDate ? (
      <span className="text-muted-foreground">Left {fmtLongDay(c.endedDate)}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }
  if (c.monthlyAmount <= 0) return <span className="text-muted-foreground">—</span>;
  if (c.termMonths === 0) return <span className="text-muted-foreground">Month-to-month</span>;
  if (!life.nextRenewal) {
    return <span className="text-xs text-amber-700">Needs dates</span>;
  }
  const days = daysBetween(today, life.nextRenewal);
  return (
    <span className="inline-flex items-center gap-1.5">
      {fmtLongDay(life.nextRenewal)}
      {days <= 45 && (
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            days <= 30 ? "bg-red-100 text-red-800" : "bg-tmc-gold/30 text-tmc-dark"
          }`}
        >
          {days === 0 ? "today" : `${days}d`}
        </span>
      )}
    </span>
  );
}
