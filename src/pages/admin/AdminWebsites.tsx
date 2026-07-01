import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Trash2, Pencil, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/lib/website";

export function AdminWebsites() {
  const [tab, setTab] = useState<"requests" | "sites">("requests");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-tmc-dark">Websites</h1>
        <p className="text-sm text-muted-foreground">
          Review client update requests and set up the sites they can edit.
        </p>
      </div>
      <div className="flex gap-1 border-b">
        {(["requests", "sites"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t
                ? "border-tmc-gold text-tmc-dark"
                : "border-transparent text-muted-foreground hover:text-tmc-dark"
            }`}
          >
            {t === "requests" ? "Update requests" : "Sites"}
          </button>
        ))}
      </div>
      {tab === "requests" ? <RequestsTab /> : <SitesTab />}
    </div>
  );
}

// ─── Requests / submissions dashboard ───────────────────────────────────────

function RequestsTab() {
  const [subs, setSubs] = useState<PendingSubmission[] | null>(null);
  const [reqs, setReqs] = useState<PendingRequest[] | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);

  async function load() {
    try {
      const [a, b] = await Promise.all([adminSite.listSubmissions(), adminSite.listRequests()]);
      setSubs(a.submissions);
      setReqs(b.requests);
    } catch (e) {
      toast.error(`Load failed: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (subs === null || reqs === null)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  // group by client
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
  const clients = [...byClient.keys()].sort();

  async function handleReq(id: number) {
    try {
      await adminSite.handleRequest(id);
      toast.success("Request marked handled");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {clients.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No pending updates right now. 🎉
        </div>
      )}
      {clients.map((name) => {
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
      })}
      {reviewId !== null && (
        <ReviewDialog
          submissionId={reviewId}
          onClose={() => setReviewId(null)}
          onResolved={() => {
            setReviewId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

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
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => copyBlock(i, b.code)}
                      >
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

// ─── Sites setup ────────────────────────────────────────────────────────────

function SitesTab() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [setupId, setSetupId] = useState<number | null>(null);

  async function load() {
    try {
      setProjects((await adminSite.listProjects()).projects);
    } catch (e) {
      toast.error(`Load failed: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setNewOpen(true)}>
          <Plus size={16} /> New project
        </Button>
      </div>
      {projects === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No sites yet. Create one, then paste in the header, footer, and pages.
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {projects.map((p) => (
            <div key={p.project.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-tmc-dark">{p.project.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.clientName} · {p.pageCount} page{p.pageCount !== 1 && "s"}
                  {p.project.domain ? ` · ${p.project.domain}` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSetupId(p.project.id)}>
                Set up
              </Button>
            </div>
          ))}
        </div>
      )}
      {newOpen && (
        <NewProjectDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            load();
            setSetupId(id);
          }}
        />
      )}
      {setupId !== null && (
        <ProjectSetupDialog projectId={setupId} onClose={() => setSetupId(null)} onChanged={load} />
      )}
    </div>
  );
}

function NewProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
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
          <DialogDescription>Create a site for a client, then add its pages.</DialogDescription>
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
      load();
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
            Paste the universal header/footer and each page's body HTML. Mark editable spots with{" "}
            <code>data-edit="text"</code> / <code>data-edit="image"</code> and global header/footer zones
            with <code>data-scope="global"</code>.
          </DialogDescription>
        </DialogHeader>
        {!data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-tmc-dark mb-2">
                Pages{" "}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 gap-1"
                  onClick={() => setEditPage("new")}
                >
                  <Plus size={13} /> Add page
                </Button>
              </h3>
              <div className="rounded-md border divide-y">
                {data.pages.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No pages yet.</div>
                )}
                {data.pages.map((pg) => (
                  <div key={pg.id} className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium text-tmc-dark">{pg.title}</span>
                      <span className="text-muted-foreground text-xs ml-2">{pg.slug}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditPage(pg)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removePage(pg.id)}>
                        <Trash2 size={14} className="text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <Label>Universal header HTML</Label>
              <textarea
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                className="w-full h-40 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
              />
              <Label>Universal footer HTML</Label>
              <textarea
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
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
              load();
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

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
      if (page) {
        await adminSite.updatePage(page.id, { title: title.trim(), slug: slug.trim(), bodyHtml: body });
      } else {
        await adminSite.addPage(projectId, { title: title.trim(), slug: slug.trim(), bodyHtml: body });
      }
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
