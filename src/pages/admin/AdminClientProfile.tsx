// One client, everything in one place: contract and renewal, what they've
// been worth, the projects we've shipped (with launch dates, for knowing
// where analytics should look back to), their portal account and requests,
// and their content schedule. Edits save straight to the same records the
// Finance pages use.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminClients,
  type AdminClient,
  type AdminClientUser,
} from "@/lib/admin-api";
import { clientLifetime, formatTenure } from "@/lib/clientLifetime";
import { submissions, type AdminSubmission } from "@/lib/clientSubmissions";
import {
  finance,
  fmtMoney,
  type FinanceDashboard,
  type OneOffInvoice,
  type RecurringClient,
} from "@/lib/finance";
import {
  PROJECT_KIND_LABELS,
  projectHref,
  projects as projectsApi,
  type ClientProject,
} from "@/lib/projects";
import { todayYmd } from "@/lib/tasks";
import { AdminPageHeader } from "@/pages/admin/AdminPageHeader";
import {
  ActiveToggle,
  ClientDialog,
  DeleteAlert,
  InvoiceDialog,
  InlineDate,
  RenewalCell,
  TermSelect,
} from "@/pages/admin/AdminFinance";
import { ProjectDialog } from "@/pages/admin/ProjectDialog";
import { RateHistoryList, RecordRateChangeDialog } from "@/pages/admin/RateHistory";
import { LaunchLabel, fmtLongDay } from "@/pages/admin/ProjectParts";

const DAY_NAMES: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

export function AdminClientProfile({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [d, setD] = useState<FinanceDashboard | null>(null);
  const [projectList, setProjectList] = useState<ClientProject[]>([]);
  const [accounts, setAccounts] = useState<AdminClient[]>([]);
  const [users, setUsers] = useState<AdminClientUser[]>([]);
  const [requests, setRequests] = useState<AdminSubmission[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const [fin, proj, acc, subs] = await Promise.all([
        finance.dashboard(),
        projectsApi.list(id),
        adminClients.list(),
        submissions.teamList(),
      ]);
      setD(fin);
      setProjectList(proj.projects);
      setAccounts(acc.clients);
      const portalId = fin.recurringClients.find((c) => c.id === id)?.portalClientId ?? null;
      setRequests(portalId != null ? subs.submissions.filter((s) => s.clientId === portalId) : []);
      setUsers(portalId != null ? (await adminClients.listUsers(portalId)).users : []);
    } catch (e) {
      toast.error(`Couldn't load this client: ${(e as Error).message}`);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  const today = todayYmd();
  const client = d?.recurringClients.find((c) => c.id === id) ?? null;
  const life = useMemo(
    () => (client && d ? clientLifetime(client, d.oneOffInvoices, today, d.rateChanges, d.projects) : null),
    [client, d, today],
  );

  if (!loaded) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!d || !client || !life) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        That client doesn't exist.{" "}
        <Link href="/admin/clients" className="text-tmc-gold-dark hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  async function save(patch: Partial<RecurringClient>) {
    try {
      await finance.updateClient(id, patch);
    } catch (e) {
      toast.error(`Couldn't save: ${(e as Error).message}`);
    }
    await load();
  }

  const retainer = client.monthlyAmount > 0;
  const since = client.signedDate ? ` · client since ${fmtLongDay(client.signedDate)}` : "";
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));
  const invoices = d.oneOffInvoices.filter(
    (i) =>
      (i.projectId != null && projectNames.has(i.projectId)) ||
      i.clientName.trim().toLowerCase() === client.name.trim().toLowerCase(),
  );
  const valueParts = [
    life.projectRevenue ? `${fmtMoney(life.projectRevenue)} in projects` : "",
    life.invoiceRevenue ? `${fmtMoney(life.invoiceRevenue)} other one-off` : "",
  ].filter(Boolean);
  const portal = accounts.find((a) => a.id === client.portalClientId) ?? null;
  const openRequests = requests.filter((r) => r.status !== "done").length;
  const rateChanges = d.rateChanges.filter((r) => r.clientId === client.id);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-tmc-dark"
      >
        <ArrowLeft size={12} /> All clients
      </Link>

      <AdminPageHeader
        title={client.name}
        description={
          (retainer ? `Retainer · ${fmtMoney(client.monthlyAmount)} a month` : "Project client") +
          since
        }
        actions={
          <>
            <ActiveToggle client={client} onChanged={load} />
            <ClientDialog mode="edit" client={client} d={d} onSaved={load} />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Contract">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Signed">
                <InlineDate
                  value={client.signedDate}
                  max={client.endedDate ?? undefined}
                  label="Signed date"
                  onSave={(v) => save({ signedDate: v })}
                />
              </Field>
              <Field label="Term">
                <TermSelect value={client.termMonths} onChange={(v) => void save({ termMonths: v })} />
                {life.termStart && life.termStart !== client.signedDate && (
                  <p className="text-[11px] text-muted-foreground">
                    Current term began {fmtLongDay(life.termStart)}
                  </p>
                )}
              </Field>
              {client.isActive ? (
                <Field label="Next renewal">
                  {retainer ? (
                    <RenewalCell r={life} today={today} />
                  ) : (
                    <span className="text-sm text-muted-foreground">No retainer</span>
                  )}
                </Field>
              ) : (
                <Field label="Left on">
                  <InlineDate
                    value={client.endedDate}
                    min={client.signedDate ?? undefined}
                    label="Left on"
                    onSave={(v) => save({ endedDate: v })}
                  />
                </Field>
              )}
            </div>
          </Section>

          {/* Project-only clients have no monthly rate to track. Giving one a
              monthly amount (Edit) records that change and shows this. */}
          {life.gap !== "no_retainer" && (
            <Section
              title="Rate history"
              action={
                <RecordRateChangeDialog client={client} changes={rateChanges} onSaved={load} />
              }
            >
              <RateHistoryList client={client} changes={rateChanges} onChanged={load} />
            </Section>
          )}

          <Section
            title="Projects"
            action={
              <ProjectDialog
                clientId={client.id}
                onSaved={load}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1">
                    <Plus size={14} /> Add project
                  </Button>
                }
              />
            }
          >
            {projectList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No projects yet. Add the websites and campaigns you ship, with their launch dates,
                so it's clear where analytics should look back to. A project's price counts toward
                lifetime value.
              </p>
            ) : (
              <ul className="divide-y">
                {projectList.map((p) => (
                  <li key={p.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-tmc-slate px-1.5 py-0.5 rounded">
                          {PROJECT_KIND_LABELS[p.kind]}
                        </span>
                        <span className="text-sm font-medium text-tmc-dark">{p.name}</span>
                        <ProjectValue project={p} invoices={d.oneOffInvoices} />
                        {p.url && (
                          <a
                            href={projectHref(p.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-tmc-gold-dark hover:underline"
                          >
                            {p.url.replace(/^https?:\/\//i, "")}
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    <div className="flex items-start gap-3 shrink-0">
                      <LaunchLabel launchDate={p.launchDate} today={today} />
                      <ProjectDialog
                        project={p}
                        onSaved={load}
                        trigger={
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Edit ${p.name}`}>
                            <Pencil size={13} />
                          </Button>
                        }
                      />
                      <DeleteAlert
                        title={`Delete ${p.name}?`}
                        description="Removes the project and its launch date from this client."
                        trigger={
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-700" aria-label={`Delete ${p.name}`}>
                            <Trash2 size={13} />
                          </Button>
                        }
                        onConfirm={async () => {
                          await projectsApi.remove(p.id);
                          toast.success("Project deleted");
                          await load();
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Notes" action={<ClientDialog mode="edit" client={client} d={d} onSaved={load} />}>
            {client.notes ? (
              <p className="text-sm text-tmc-dark whitespace-pre-wrap">{client.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes. Add them with Edit.</p>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Value">
            <div className="space-y-3">
              {retainer ? (
                <>
                  <Figure
                    label="Lifetime value"
                    value={life.gap ? "—" : fmtMoney(life.ltv)}
                    note={
                      life.gap
                        ? "Add the signed date to estimate it"
                        : [
                            `${life.cyclesBilled} ${life.cyclesBilled === 1 ? "month" : "months"} billed` +
                              (life.rateVaried ? " at the rate each month" : ""),
                            ...valueParts,
                          ].join(" + ")
                    }
                  />
                  <Figure
                    label={client.isActive ? "With us for" : "Stayed"}
                    value={formatTenure(life.tenureMonths)}
                  />
                </>
              ) : (
                <Figure
                  label="Project work"
                  value={fmtMoney(life.oneOffRevenue + life.adjustment)}
                  note={valueParts.length ? valueParts.join(" + ") : "Add a price to a project below"}
                />
              )}
            </div>
            {/* Payments for one-off work. They land on the cash flow chart on
                their payout date. One paying for a project is counted through
                that project's price; any other counts toward lifetime value. */}
            <div className="mt-4 pt-3 border-t space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-tmc-slate">
                  One-off invoices
                </div>
                <InvoiceDialog
                  mode="create"
                  d={d}
                  clientName={client.name}
                  projects={projectList}
                  onSaved={load}
                  trigger={
                    <button type="button" className="text-xs text-tmc-gold-dark hover:underline">
                      + Log an invoice
                    </button>
                  }
                />
              </div>
              {invoices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  None yet. Payments for projects, or any other one-off work.
                </p>
              ) : (
                invoices.map((i) => (
                  <InvoiceDialog
                    key={i.id}
                    mode="edit"
                    invoice={i}
                    d={d}
                    projects={projectList}
                    onSaved={load}
                    trigger={
                      <button
                        type="button"
                        className="w-full flex justify-between gap-3 text-sm text-left rounded px-1 -mx-1 py-0.5 hover:bg-muted/60"
                        title="Edit this invoice"
                      >
                        <span className="min-w-0">
                          <span className="text-muted-foreground">
                            {fmtLongDay(i.invoiceDate ?? i.payoutDate)}
                          </span>
                          {i.projectId != null && projectNames.has(i.projectId) && (
                            <span className="block text-xs text-tmc-gold-dark truncate">
                              for {projectNames.get(i.projectId)}
                            </span>
                          )}
                          {i.notes && (
                            <span className="block text-xs text-muted-foreground truncate">{i.notes}</span>
                          )}
                        </span>
                        <span className="tabular-nums shrink-0">{fmtMoney(i.grossAmount)}</span>
                      </button>
                    }
                  />
                ))
              )}
            </div>
          </Section>

          <Section
            title="Portal account"
            action={
              portal ? (
                <Link href="/admin/portal-accounts" className="text-xs text-tmc-gold-dark hover:underline">
                  Manage →
                </Link>
              ) : undefined
            }
          >
            <Select
              value={client.portalClientId != null ? String(client.portalClientId) : "none"}
              onValueChange={(v) => void save({ portalClientId: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {portal && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {users.length} {users.length === 1 ? "login" : "logins"}
                  {users.length > 0 && `: ${users.map((u) => u.name).join(", ")}`}
                </p>
                <p>
                  <Link href="/requests" className="text-tmc-gold-dark hover:underline">
                    {openRequests > 0
                      ? `${openRequests} open ${openRequests === 1 ? "request" : "requests"}`
                      : `${requests.length} ${requests.length === 1 ? "request" : "requests"}, none open`}
                  </Link>
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {portal.filesUrl && <ExtLink href={portal.filesUrl}>Files</ExtLink>}
                  {portal.ghlUrl && <ExtLink href={portal.ghlUrl}>GoHighLevel</ExtLink>}
                  {portal.passwordVaultUrl && <ExtLink href={portal.passwordVaultUrl}>Password vault</ExtLink>}
                </div>
              </div>
            )}
          </Section>

          <Section
            title="Content"
            action={
              <Link href="/content" className="text-xs text-tmc-gold-dark hover:underline">
                Planner →
              </Link>
            }
          >
            {client.weeklyPostTarget ? (
              <p className="text-sm text-tmc-dark">
                {client.weeklyPostTarget} {client.weeklyPostTarget === 1 ? "post" : "posts"} a week
                {client.postingDays && (
                  <span className="text-muted-foreground">
                    {" "}
                    on {client.postingDays.split(",").map((x) => DAY_NAMES[x] ?? x).join(", ")}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not in the content planner.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** A project's price, or what its invoices add up to when it has none. */
function ProjectValue({ project, invoices }: { project: ClientProject; invoices: OneOffInvoice[] }) {
  if (project.price != null) {
    return <span className="text-sm tabular-nums text-tmc-slate">{fmtMoney(project.price)}</span>;
  }
  const paid = invoices.filter((i) => i.projectId === project.id).reduce((s, i) => s + i.grossAmount, 0);
  return paid > 0 ? (
    <span className="text-sm tabular-nums text-tmc-slate">{fmtMoney(paid)} invoiced</span>
  ) : null;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-tmc-slate">
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-bold tracking-tight tabular-nums text-tmc-dark mt-0.5">{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-tmc-gold-dark hover:underline"
    >
      {children}
      <ExternalLink size={11} />
    </a>
  );
}
