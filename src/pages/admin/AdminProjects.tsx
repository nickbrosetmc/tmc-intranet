// Every client project with its launch date, across all clients: what's
// launching soon, and for what's live, where its analytics look back to.

import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { finance, type RecurringClient } from "@/lib/finance";
import {
  PROJECT_KIND_LABELS,
  launchState,
  projectHref,
  projects as projectsApi,
  type ClientProject,
} from "@/lib/projects";
import { todayYmd } from "@/lib/tasks";
import { AdminPageHeader } from "@/pages/admin/AdminPageHeader";
import { DeleteAlert } from "@/pages/admin/AdminFinance";
import { ProjectDialog } from "@/pages/admin/ProjectDialog";
import { LaunchLabel } from "@/pages/admin/ProjectParts";

type Segment = "all" | "upcoming" | "launched";
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "launched", label: "Launched" },
];

export function AdminProjects() {
  const [list, setList] = useState<ClientProject[] | null>(null);
  const [clients, setClients] = useState<RecurringClient[]>([]);
  const [segment, setSegment] = useState<Segment>("all");

  async function load() {
    try {
      const [p, fin] = await Promise.all([projectsApi.list(), finance.dashboard()]);
      setList(p.projects);
      setClients(fin.recurringClients);
    } catch (e) {
      toast.error(`Couldn't load projects: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const today = todayYmd();
  const visible = useMemo(() => {
    if (!list) return [];
    return list.filter((p) => {
      const s = launchState(p.launchDate, today).state;
      if (segment === "upcoming") return s !== "launched";
      if (segment === "launched") return s === "launched";
      return true;
    });
  }, [list, segment, today]);

  // Current clients first in the picker; past ones still selectable.
  const choices = useMemo(
    () =>
      [...clients]
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.isActive ? c.name : `${c.name} (past)` })),
    [clients],
  );

  if (!list) return <div className="text-sm text-muted-foreground">Loading projects…</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Projects"
        description="Launch dates for the work we ship, so analytics know where to look back to."
        actions={
          <ProjectDialog
            clients={choices}
            onSaved={load}
            trigger={
              <Button size="sm" className="gap-1 bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark">
                <Plus size={14} /> Add project
              </Button>
            }
          />
        }
      />

      <div className="inline-flex rounded-md border bg-card p-0.5" role="group" aria-label="Which projects">
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
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Launch</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    {list.length === 0
                      ? "No projects yet. Add one here or from a client's profile."
                      : segment === "upcoming"
                        ? "Nothing scheduled to launch."
                        : "Nothing launched yet."}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium text-tmc-dark">{p.name}</div>
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
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/admin/clients/${p.clientId}`} className="hover:text-tmc-gold-dark">
                        {p.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {PROJECT_KIND_LABELS[p.kind]}
                    </TableCell>
                    <TableCell>
                      <LaunchLabel launchDate={p.launchDate} today={today} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
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
                        description={`Removes the project and its launch date from ${p.clientName}.`}
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
