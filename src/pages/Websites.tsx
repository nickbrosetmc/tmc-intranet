import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Trash2,
  Pencil,
  Plus,
  ExternalLink,
  Upload,
  Globe,
  Inbox,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/lib/useUser";
import { adminClients, type AdminClient } from "@/lib/admin-api";
import {
  adminSite,
  parseChanges,
  type PendingSubmission,
  type PendingRequest,
  type ProjectSummary,
  type Submission,
  type ProjectWithPages,
  type SitePage,
  type SiteContentBlock,
  type ImportItem,
} from "@/lib/website";

export function WebsitesPage() {
  const state = useUser();
  const isTeam = state.status === "authenticated" && state.user.type === "team";

  if (state.status === "loading")
    return <Centered>Loading…</Centered>;
  if (!isTeam)
    return <Centered>The Websites workspace is for TMC team members.</Centered>;
  return <Dashboard />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [subs, setSubs] = useState<PendingSubmission[]>([]);
  const [reqs, setReqs] = useState<PendingRequest[]>([]);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [setupId, setSetupId] = useState<number | null>(null);

  async function load() {
    try {
      const [p, s, r] = await Promise.all([
        adminSite.listProjects(),
        adminSite.listSubmissions(),
        adminSite.listRequests(),
      ]);
      setProjects(p.projects);
      setSubs(s.submissions);
      setReqs(r.requests);
    } catch (e) {
      toast.error(`Load failed: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleReq(id: number) {
    try {
      await adminSite.handleRequest(id);
      toast.success("Request marked handled");
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // group pending items by client
  const byClient = new Map<string, { subs: PendingSubmission[]; reqs: PendingRequest[] }>();
  for (const s of subs) {
    const g = byClient.get(s.clientName) ?? { subs: [], reqs: [] };
    g.subs.push(s);
    byClient.set(s.clientName, g);
  }
  for (const r of reqs) {
    const g = byClient.get(r.clientName) ?? { subs: [], reqs: [] };
    g.reqs.push(r);
    byClient.set(r.clientName, g);
  }
  const clientNames = [...byClient.keys()].sort();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-tmc-dark">Websites</h1>
        <p className="text-sm text-muted-foreground">
          Set up client sites and review the updates they submit.
        </p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Globe size={18} />} label="Sites" value={projects?.length ?? "—"} />
        <Stat icon={<Inbox size={18} />} label="Pending submissions" value={subs.length} />
        <Stat icon={<FileCode size={18} />} label="Pending requests" value={reqs.length} />
      </div>

      {/* pending updates inbox */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">
          Pending updates
        </h2>
        {clientNames.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            Nothing waiting. 🎉
          </div>
        ) : (
          clientNames.map((name) => {
            const g = byClient.get(name)!;
            return (
              <div key={name} className="rounded-lg border bg-card px-4 pb-3">
                <div className="flex items-center gap-2 py-3 border-b mb-1">
                  <h3 className="font-semibold text-tmc-dark">{name}</h3>
                  <span className="text-xs bg-tmc-gold/30 text-tmc-slate rounded-full px-2 py-0.5">
                    {g.subs.length + g.reqs.length}
                  </span>
                </div>
                {g.subs.map((s) => {
                  const count = parseChanges(s.submission).length;
                  return (
                    <div
                      key={`s${s.submission.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed last:border-0"
                    >
                      <div className="text-sm">
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 mr-2">
                          SUBMISSION
                        </span>
                        <span className="font-medium text-tmc-dark">
                          {count} change{count !== 1 && "s"}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {s.submission.submittedByName} · {timeAgo(s.submission.createdAt)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
                        onClick={() => setReviewId(s.submission.id)}
                      >
                        Review &amp; publish
                      </Button>
                    </div>
                  );
                })}
                {g.reqs.map((r) => (
                  <div
                    key={`r${r.request.id}`}
                    className="flex items-start justify-between gap-3 py-2.5 border-b border-dashed last:border-0"
                  >
                    <div className="text-sm">
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 mr-2">
                        REQUEST
                      </span>
                      <span className="font-medium text-tmc-dark">{r.request.submittedByName}</span>
                      <span className="text-muted-foreground"> · {timeAgo(r.request.createdAt)}</span>
                      <div className="italic text-muted-foreground mt-1 max-w-xl">
                        “{r.request.body}”
                        {r.request.assetKey && (
                          <a
                            href={`/api/website/assets/${r.request.assetKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="not-italic text-tmc-gold-dark hover:underline ml-2 inline-flex items-center gap-1"
                          >
                            <ExternalLink size={12} /> {r.request.assetName ?? "attachment"}
                          </a>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleReq(r.request.id)}>
                      Mark handled
                    </Button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>

      {/* sites */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-tmc-slate">Sites</h2>
          <Button size="sm" className="gap-2" onClick={() => setNewOpen(true)}>
            <Plus size={16} /> New project
          </Button>
        </div>
        {projects === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No sites yet. Create one, then bulk-import the header, footer, and pages.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <button
                key={p.project.id}
                onClick={() => setSetupId(p.project.id)}
                className="text-left rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="font-medium text-tmc-dark">{p.project.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.clientName} · {p.pageCount} page{p.pageCount !== 1 && "s"}
                  {p.project.domain ? ` · ${p.project.domain}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {reviewId !== null && (
        <ReviewDialog
          submissionId={reviewId}
          onClose={() => setReviewId(null)}
          onResolved={() => {
            setReviewId(null);
            void load();
          }}
        />
      )}
      {newOpen && (
        <NewProjectDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            void load();
            setSetupId(id);
          }}
        />
      )}
      {setupId !== null && (
        <ProjectSetupDialog projectId={setupId} onClose={() => setSetupId(null)} onChanged={load} />
      )}
      <Toaster />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-tmc-gold/20 text-tmc-slate flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xl font-semibold text-tmc-dark leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}

// ─── Review submission ───────────────────────────────────────────────────────

function ReviewDialog({
  submissionId,
  onClose,
  onResolved,
}: {
  submissionId: number;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [sub, setSub] = useState<Submission | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    adminSite
      .getSubmission(submissionId)
      .then((r) => {
        setSub(r.submission);
        setDone(r.submission.done ?? []);
      })
      .catch((e) => toast.error((e as Error).message));
  }, [submissionId]);

  async function copyBlock(i: number, code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  async function toggleDone(title: string) {
    const next = done.includes(title) ? done.filter((d) => d !== title) : [...done, title];
    setDone(next);
    try {
      await adminSite.patchSubmission(submissionId, { done: next });
    } catch {
      /* non-fatal */
    }
  }

  async function act(action: "publish" | "dismiss") {
    try {
      await adminSite.patchSubmission(submissionId, { action });
      toast.success(action === "publish" ? "Marked as published" : "Dismissed");
      onResolved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; publish to GHL</DialogTitle>
          <DialogDescription>
            Each block is the complete, full-length code for that block with the edits applied.
            Copy it and paste it over the existing block in GHL.
          </DialogDescription>
        </DialogHeader>
        {!sub ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Submitted by <b className="text-tmc-dark">{sub.submittedByName}</b> ·{" "}
              {timeAgo(sub.createdAt)} · {done.length} of {sub.blocks.length} blocks pasted
            </div>
            {sub.blocks.map((b, i) => {
              const isDone = done.includes(b.title);
              const lines = b.code.split("\n").length;
              return (
                <div key={i} className={isDone ? "opacity-60" : ""}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className={`font-semibold text-sm ${isDone ? "line-through" : "text-tmc-dark"}`}>
                        {b.title}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {b.note} · full block, {lines} lines
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyBlock(i, b.code)}>
                        {copied === i ? <Check size={14} /> : <Copy size={14} />}
                        {copied === i ? "Copied" : "Copy entire block"}
                      </Button>
                      <Button
                        size="sm"
                        variant={isDone ? "default" : "outline"}
                        className={isDone ? "bg-green-700 hover:bg-green-700" : ""}
                        onClick={() => toggleDone(b.title)}
                      >
                        {isDone ? "✓ Done" : "Mark done"}
                      </Button>
                    </div>
                  </div>
                  <pre className="bg-tmc-dark text-tmc-offwhite text-xs rounded-md p-3 overflow-auto max-h-56 whitespace-pre-wrap">
                    {b.code}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => act("dismiss")}>
            Dismiss
          </Button>
          <Button className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark" onClick={() => act("publish")}>
            Mark as published
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New project ─────────────────────────────────────────────────────────────

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminClients
      .list()
      .then((r) => setClients(r.clients))
      .catch((e) => toast.error((e as Error).message));
  }, []);

  async function create() {
    if (!clientId || !name.trim()) {
      toast.error("Pick a client and enter a name");
      return;
    }
    setSaving(true);
    try {
      const r = await adminSite.createProject({
        clientId: Number(clientId),
        name: name.trim(),
        domain: domain.trim() || null,
      });
      toast.success("Project created");
      onCreated(r.project.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New website project</DialogTitle>
          <DialogDescription>Create a site for a client, then bulk-import its files.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
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
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Project name</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hold My Beer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-domain">Domain (optional)</Label>
            <Input id="np-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="holdmybeer.com" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project setup ───────────────────────────────────────────────────────────

function ProjectSetupDialog({
  projectId,
  onClose,
  onChanged,
}: {
  projectId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<ProjectWithPages | null>(null);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [savingChrome, setSavingChrome] = useState(false);
  const [editPage, setEditPage] = useState<SitePage | "new" | null>(null);
  const [editBlock, setEditBlock] = useState<SiteContentBlock | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    const r = await adminSite.getProject(projectId);
    setData(r);
    setHeader(r.project.headerHtml);
    setFooter(r.project.footerHtml);
  }
  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message));
  }, [projectId]);

  async function saveChrome() {
    setSavingChrome(true);
    try {
      await adminSite.updateProject(projectId, { headerHtml: header, footerHtml: footer });
      toast.success("Header & footer saved");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingChrome(false);
    }
  }

  async function removePage(id: number) {
    try {
      await adminSite.deletePage(id);
      toast.success("Page deleted");
      await load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function removeBlock(id: number) {
    try {
      await adminSite.deleteContentBlock(id);
      toast.success("Content block deleted");
      await load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{data ? `Set up: ${data.project.name}` : "Set up"}</DialogTitle>
          <DialogDescription>
            Bulk-import the site's files, or edit the header/footer and pages by hand. Mark editable spots
            with <code>data-edit="text"</code> / <code>data-edit="image"</code> and global header/footer
            zones with <code>data-scope="global"</code>.
          </DialogDescription>
        </DialogHeader>
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <Button className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Bulk import files
            </Button>

            <SetupList
              title="Pages"
              onAdd={() => setEditPage("new")}
              rows={data.pages.map((pg) => ({
                id: pg.id,
                primary: pg.title,
                secondary: pg.slug,
                onEdit: () => setEditPage(pg),
                onDelete: () => removePage(pg.id),
              }))}
              emptyLabel="No pages yet."
            />

            <SetupList
              title="Content blocks"
              onAdd={() => setEditBlock("new")}
              rows={data.contentBlocks.map((b) => ({
                id: b.id,
                primary: b.name,
                secondary: "standalone block",
                onEdit: () => setEditBlock(b),
                onDelete: () => removeBlock(b.id),
              }))}
              emptyLabel="No content blocks yet."
            />

            <section className="space-y-2">
              <Label>Universal header HTML</Label>
              <textarea
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                className="w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              />
              <Label>Universal footer HTML</Label>
              <textarea
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full h-28 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button onClick={saveChrome} disabled={savingChrome}>
                  {savingChrome ? "Saving…" : "Save header & footer"}
                </Button>
              </div>
            </section>
          </div>
        )}
        {editPage && (
          <PageEditDialog
            projectId={projectId}
            page={editPage === "new" ? null : editPage}
            onClose={() => setEditPage(null)}
            onSaved={() => {
              setEditPage(null);
              void load();
              onChanged();
            }}
          />
        )}
        {editBlock && (
          <ContentBlockEditDialog
            projectId={projectId}
            block={editBlock === "new" ? null : editBlock}
            onClose={() => setEditBlock(null)}
            onSaved={() => {
              setEditBlock(null);
              void load();
              onChanged();
            }}
          />
        )}
        {importOpen && (
          <BulkImportDialog
            projectId={projectId}
            onClose={() => setImportOpen(false)}
            onImported={() => {
              setImportOpen(false);
              void load();
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetupList({
  title,
  rows,
  onAdd,
  emptyLabel,
}: {
  title: string;
  rows: { id: number; primary: string; secondary: string; onEdit: () => void; onDelete: () => void }[];
  onAdd: () => void;
  emptyLabel: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-tmc-dark mb-2">
        {title}
        <Button size="sm" variant="outline" className="ml-2 gap-1" onClick={onAdd}>
          <Plus size={13} /> Add
        </Button>
      </h3>
      <div className="rounded-md border divide-y">
        {rows.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-tmc-dark">{r.primary}</span>
              <span className="text-muted-foreground text-xs ml-2">{r.secondary}</span>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={r.onEdit}>
                <Pencil size={14} />
              </Button>
              <Button size="icon" variant="ghost" onClick={r.onDelete}>
                <Trash2 size={14} className="text-red-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Bulk import ─────────────────────────────────────────────────────────────

type Kind = "header" | "footer" | "page" | "block";
interface ImportRow {
  file: string;
  html: string;
  kind: Kind;
  title: string;
  slug: string;
  name: string;
}

function BulkImportDialog({
  projectId,
  onClose,
  onImported,
}: {
  projectId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const parsed: ImportRow[] = [];
    for (const f of Array.from(files)) {
      const html = await f.text();
      parsed.push({ file: f.name, html, ...detect(f.name, html) });
    }
    setRows((prev) => [...prev, ...parsed]);
  }

  function update(i: number, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function doImport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const items: ImportItem[] = rows.map((r) => {
        if (r.kind === "header") return { kind: "header", html: r.html };
        if (r.kind === "footer") return { kind: "footer", html: r.html };
        if (r.kind === "block") return { kind: "block", name: r.name || r.file, html: r.html };
        return { kind: "page", title: r.title || r.file, slug: r.slug, html: r.html };
      });
      const { result } = await adminSite.importItems(projectId, items);
      const parts = [
        result.header && "header",
        result.footer && "footer",
        result.pages && `${result.pages} page${result.pages !== 1 ? "s" : ""}`,
        result.blocks && `${result.blocks} block${result.blocks !== 1 ? "s" : ""}`,
      ].filter(Boolean);
      toast.success(`Imported ${parts.join(", ")}.`);
      onImported();
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Bulk import files</DialogTitle>
          <DialogDescription>
            Drop in the header, footer, page, and content-block HTML files. I'll guess each one's type and
            slug from the filename and code — confirm or fix them below, then import.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input py-8 cursor-pointer hover:border-tmc-gold transition-colors">
          <Upload size={22} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Click to choose .html files (you can select many)</span>
          <input
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-tmc-dark truncate">{r.file}</span>
                  <div className="flex items-center gap-2">
                    <Select value={r.kind} onValueChange={(v) => update(i, { kind: v as Kind })}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">Header</SelectItem>
                        <SelectItem value="footer">Footer</SelectItem>
                        <SelectItem value="page">Page Block</SelectItem>
                        <SelectItem value="block">Individual Content Block</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} className="text-red-600" />
                    </Button>
                  </div>
                </div>
                {r.kind === "page" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={r.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                      placeholder="Page title"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={r.slug}
                      onChange={(e) => update(i, { slug: e.target.value })}
                      placeholder="/slug"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {r.kind === "block" && (
                  <Input
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    placeholder="Block name (e.g. Holiday popup)"
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={doImport} disabled={busy || rows.length === 0}>
            {busy ? "Importing…" : `Import ${rows.length || ""} file${rows.length !== 1 ? "s" : ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page / block edit dialogs ───────────────────────────────────────────────

function PageEditDialog({
  projectId,
  page,
  onClose,
  onSaved,
}: {
  projectId: number;
  page: SitePage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.bodyHtml ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (page) await adminSite.updatePage(page.id, { title: title.trim(), slug: slug.trim(), bodyHtml: body });
      else await adminSite.addPage(projectId, { title: title.trim(), slug: slug.trim(), bodyHtml: body });
      toast.success(page ? "Page updated" : "Page added");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{page ? "Edit page" : "Add page"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pe-title">Page title</Label>
              <Input id="pe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Home" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe-slug">URL slug</Label>
              <Input id="pe-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="/" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-body">Body HTML</Label>
            <textarea
              id="pe-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-64 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              placeholder="<section>…</section>"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContentBlockEditDialog({
  projectId,
  block,
  onClose,
  onSaved,
}: {
  projectId: number;
  block: SiteContentBlock | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(block?.name ?? "");
  const [html, setHtml] = useState(block?.html ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (block) await adminSite.updateContentBlock(block.id, { name: name.trim(), html });
      else await adminSite.createContentBlock(projectId, { name: name.trim(), html });
      toast.success(block ? "Content block updated" : "Content block added");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{block ? "Edit content block" : "Add content block"}</DialogTitle>
          <DialogDescription>
            A standalone snippet (popup, promo bar, announcement…) you can log now and update later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cb-name">Name</Label>
            <Input id="cb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday hours popup" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-html">Block HTML</Label>
            <textarea
              id="cb-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="w-full h-64 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              placeholder="<div>…</div>"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function detect(filename: string, html: string): { kind: Kind; title: string; slug: string; name: string } {
  const base = filename.replace(/\.[^.]+$/, "");
  const low = filename.toLowerCase();
  const trimmed = html.trimStart().toLowerCase();

  let kind: Kind = "page";
  if (low.includes("header") || trimmed.startsWith("<header")) kind = "header";
  else if (low.includes("footer") || trimmed.startsWith("<footer")) kind = "footer";

  let slug: string;
  const slugComment = html.match(/<!--\s*slug:\s*(\/[^\s>]*)\s*-->/i);
  if (slugComment) slug = slugComment[1];
  else if (/^(index|home)$/i.test(base)) slug = "/";
  else slug = "/" + slugify(base);

  let title = "";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (h1) title = stripTags(h1[1]).trim().slice(0, 80);
  if (!title && titleTag) title = stripTags(titleTag[1]).trim().slice(0, 80);
  if (!title) title = titleCase(base);

  return { kind, title, slug, name: title };
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}
function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
