import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Undo2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/useUser";
import { adminSite, type ProjectWithPages } from "@/lib/website";
import { SiteEditor } from "@/lib/siteEditor";

/**
 * Team-side visual editor: renders the client's site exactly as the client
 * sees it (same engine), lets any team member click-to-edit, then hands back
 * complete GHL blocks to copy — and saves the edits to the site records so
 * the portal copy stays in sync with what's pasted into GHL.
 */
export function WebsiteEditorPage({ params }: { params: { id: string } }) {
  const state = useUser();
  const isTeam = state.status === "authenticated" && state.user.type === "team";

  if (state.status === "loading") return <Centered>Loading…</Centered>;
  if (!isTeam) return <Centered>The Websites workspace is for TMC team members.</Centered>;
  return <TeamEditor projectId={Number(params.id)} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

function TeamEditor({ projectId }: { projectId: number }) {
  const [data, setData] = useState<ProjectWithPages | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState("");
  const [editor, setEditor] = useState<SiteEditor | null>(null);
  const [changes, setChanges] = useState<
    { key: string; label: string; from: string; to: string; global: boolean }[]
  >([]);
  const [publishOpen, setPublishOpen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    adminSite
      .getProject(projectId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => !cancelled && setLoadError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!data || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const ed = new SiteEditor({
      doc,
      project: data,
      uploadImage: async (file) => (await adminSite.uploadAsset(projectId, file)).url,
      onChange: () => setChanges(ed.changeList()),
    });
    ed.mount();
    setEditor(ed);
    setActiveKey(ed.getActiveKey());
    setChanges(ed.changeList());
    return () => {
      setEditor(null);
      setChanges([]);
    };
  }, [data, projectId]);

  function selectView(key: string) {
    editor?.showView(key);
    setActiveKey(key);
  }

  if (loadError) return <Centered>Couldn't load this site: {loadError}</Centered>;
  if (!data) return <Centered>Loading site…</Centered>;

  const activePage = data.pages.find((p) => `page:${p.id}` === activeKey);
  const activeBlock = data.contentBlocks.find((b) => `block:${b.id}` === activeKey);
  const domain = data.project.domain ?? "";

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/websites"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-tmc-dark mb-1"
          >
            <ArrowLeft size={13} /> All websites
          </Link>
          <h1 className="text-2xl font-semibold text-tmc-dark">{data.project.name}</h1>
          <p className="text-sm text-muted-foreground">
            Live preview — click any highlighted text or image to edit, exactly like the client can.
          </p>
        </div>
        <Button
          className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark gap-2"
          disabled={changes.length === 0}
          onClick={() => setPublishOpen(true)}
        >
          <Rocket size={16} /> Get GHL blocks {changes.length > 0 && `(${changes.length})`}
        </Button>
      </div>

      <div className="flex gap-4 items-start">
        {/* page + content-block rail */}
        <aside className="w-44 shrink-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-2">Pages</p>
          {data.pages.map((p) => {
            const key = `page:${p.id}`;
            return (
              <button
                key={key}
                onClick={() => selectView(key)}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  key === activeKey
                    ? "bg-tmc-gold/25 text-tmc-dark font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-tmc-dark"
                }`}
              >
                {p.title}
                <span className="block text-xs opacity-70">{p.slug}</span>
              </button>
            );
          })}
          {data.contentBlocks.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-2 mt-4">
              Content blocks
            </p>
          )}
          {data.contentBlocks.map((b) => {
            const key = `block:${b.id}`;
            return (
              <button
                key={key}
                onClick={() => selectView(key)}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  key === activeKey
                    ? "bg-tmc-gold/25 text-tmc-dark font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-tmc-dark"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </aside>

        {/* preview */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg border overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="ml-2">
                {activeBlock
                  ? `Content block · ${activeBlock.name}`
                  : `${domain}${activePage ? (activePage.slug === "/" ? "/" : activePage.slug) : ""}`}
              </span>
            </div>
            <iframe ref={iframeRef} title="Site preview" className="w-full h-[72vh] border-0" />
          </div>
        </div>

        {/* pending changes */}
        <aside className="w-72 shrink-0">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-3">
              Pending changes
            </p>
            {changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No changes yet. Click any highlighted text or image in the preview to edit it.
              </p>
            ) : (
              <ul className="space-y-2">
                {changes.map((c) => (
                  <li key={c.key} className="relative pr-8 text-sm border-b border-dashed pb-2">
                    <button
                      onClick={() => editor?.revert(c.key)}
                      title="Undo this change"
                      className="absolute top-0 right-0 w-6 h-6 rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                    >
                      <Undo2 size={13} />
                    </button>
                    <span className="font-medium text-tmc-dark">{c.label}</span>
                    {c.global && (
                      <span className="ml-1.5 text-[10px] font-bold bg-tmc-gold/30 text-tmc-slate rounded px-1.5 py-0.5">
                        GLOBAL
                      </span>
                    )}
                    <div className="text-xs mt-0.5">
                      {c.from && <span className="text-red-600 line-through">{c.from}</span>}
                      {c.from && c.to && " → "}
                      {c.to && <span className="text-green-700">{c.to}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {publishOpen && editor && (
        <PublishDialog
          editor={editor}
          projectId={projectId}
          onClose={() => setPublishOpen(false)}
          onFinished={() => {
            setPublishOpen(false);
            toast.success("Saved — site records now match what you pasted into GHL.");
          }}
        />
      )}
      <Toaster />
    </div>
  );
}

function PublishDialog({
  editor,
  projectId,
  onClose,
  onFinished,
}: {
  editor: SiteEditor;
  projectId: number;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [blocks] = useState(() => editor.buildBlocks());
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function saveAndFinish() {
    setSaving(true);
    try {
      const changed = editor.exportChanged();
      const chrome: { headerHtml?: string; footerHtml?: string } = {};
      for (const { scope, code } of changed) {
        if (scope === "header") chrome.headerHtml = code;
        else if (scope === "footer") chrome.footerHtml = code;
        else if (scope.startsWith("page:")) {
          await adminSite.updatePage(Number(scope.slice(5)), { bodyHtml: code });
        } else if (scope.startsWith("block:")) {
          await adminSite.updateContentBlock(Number(scope.slice(6)), { html: code });
        }
      }
      if (Object.keys(chrome).length) await adminSite.updateProject(projectId, chrome);
      editor.reset();
      onFinished();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>GHL blocks — ready to paste</DialogTitle>
          <DialogDescription>
            Each block is the complete, full-length code with your edits applied. Copy each one into
            GHL, then hit Save so the portal's records match the live site.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {done.length} of {blocks.length} blocks pasted
          </div>
          {blocks.map((b, i) => {
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
                      onClick={() =>
                        setDone((d) => (d.includes(b.title) ? d.filter((x) => x !== b.title) : [...d, b.title]))
                      }
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
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Keep editing
          </Button>
          <Button
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
            disabled={saving}
            onClick={saveAndFinish}
          >
            {saving ? "Saving…" : "Save to site records & finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
