import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Undo2, Send, MessageSquarePlus } from "lucide-react";
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
import { useUser, type ClientUser } from "@/lib/useUser";
import { clientSite, type ProjectWithPages } from "@/lib/website";
import { SiteEditor } from "@/lib/siteEditor";

export function WebsitePage() {
  const state = useUser();

  if (state.status === "loading") {
    return <Centered>Loading…</Centered>;
  }
  if (state.status === "anonymous") {
    return <Centered>Please sign in to edit your website.</Centered>;
  }
  if (state.user.type !== "client") {
    return (
      <Centered>
        <div className="text-center space-y-2">
          <p>The website editor is for client accounts.</p>
          <Link href="/admin/websites" className="text-tmc-gold-dark hover:underline text-sm">
            Go to the admin dashboard →
          </Link>
        </div>
      </Centered>
    );
  }
  return <ClientEditor user={state.user} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

function ClientEditor({ user }: { user: ClientUser }) {
  const [data, setData] = useState<ProjectWithPages | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noSite, setNoSite] = useState(false);
  const [activeId, setActiveId] = useState(0);
  const [editor, setEditor] = useState<SiteEditor | null>(null);
  const [changes, setChanges] = useState<
    { key: string; label: string; from: string; to: string; global: boolean }[]
  >([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientSite
      .getProject()
      .then((res) => {
        if (cancelled) return;
        if (!res.project) {
          setNoSite(true);
          return;
        }
        setData(res as ProjectWithPages);
      })
      .catch((e) => !cancelled && setLoadError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const ed = new SiteEditor({
      doc,
      project: data,
      uploadImage: async (file) => (await clientSite.uploadAsset(file)).url,
      onChange: () => setChanges(ed.changeList()),
    });
    ed.mount();
    setEditor(ed);
    setActiveId(ed.getActivePageId());
    setChanges(ed.changeList());
    return () => {
      setEditor(null);
      setChanges([]);
    };
  }, [data]);

  function selectPage(id: number) {
    editor?.showPage(id);
    setActiveId(id);
  }

  async function doSubmit() {
    if (!editor || editor.changeCount() === 0) return;
    setSending(true);
    try {
      await clientSite.submit({
        changes: editor.getChanges(),
        blocks: editor.buildBlocks(),
        submittedByName: user.name,
      });
      editor.reset();
      setSendOpen(false);
      toast.success("Sent to your team at TMC — they'll review and publish it.");
    } catch (e) {
      toast.error(`Submit failed: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  if (loadError) return <Centered>Couldn't load your site: {loadError}</Centered>;
  if (noSite)
    return (
      <Centered>
        <div className="max-w-sm text-center space-y-2">
          <p className="text-tmc-dark font-medium">Your website isn't set up here yet.</p>
          <p>TMC will load your site so you can start making edits. Hang tight!</p>
        </div>
      </Centered>
    );
  if (!data) return <Centered>Loading your site…</Centered>;

  const activePage = data.pages.find((p) => p.id === activeId);
  const domain = data.project.domain ?? "";

  return (
    <div className="w-full max-w-7xl flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-tmc-dark">Update My Website</h1>
          <p className="text-sm text-muted-foreground">
            Click any highlighted text or image to edit. Nothing goes live until TMC reviews it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReqOpen(true)} className="gap-2">
            <MessageSquarePlus size={16} /> Request a change
          </Button>
          <Button
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark gap-2"
            disabled={changes.length === 0}
            onClick={() => setSendOpen(true)}
          >
            <Send size={16} /> Submit {changes.length > 0 && `(${changes.length})`}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* page rail */}
        <aside className="w-44 shrink-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-tmc-slate mb-2">Pages</p>
          {data.pages.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPage(p.id)}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                p.id === activeId
                  ? "bg-tmc-gold/25 text-tmc-dark font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-tmc-dark"
              }`}
            >
              {p.title}
              <span className="block text-xs opacity-70">{p.slug}</span>
            </button>
          ))}
        </aside>

        {/* preview */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg border overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="w-2.5 h-2.5 rounded-full bg-tmc-silver" />
              <span className="ml-2">
                {domain}
                {activePage ? (activePage.slug === "/" ? "/" : activePage.slug) : ""}
              </span>
            </div>
            <iframe ref={iframeRef} title="Site preview" className="w-full h-[70vh] border-0" />
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
                No changes yet. Click any highlighted text or image to edit.
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

      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        changes={editor?.getChanges() ?? []}
        sending={sending}
        onConfirm={doSubmit}
      />
      <RequestDialog open={reqOpen} onOpenChange={setReqOpen} />
      <Toaster />
    </div>
  );
}

function SendDialog({
  open,
  onOpenChange,
  changes,
  sending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  changes: { label: string; group: string }[];
  sending: boolean;
  onConfirm: () => void;
}) {
  const groups = new Map<string, string[]>();
  for (const c of changes) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c.label);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send changes to your team</DialogTitle>
          <DialogDescription>
            TMC will review these updates and publish them to your live site.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-auto space-y-3">
          {[...groups.entries()].map(([group, labels]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-tmc-dark">
                {group} <span className="font-normal text-muted-foreground">— {labels.length}</span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {labels.map((l, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
            disabled={sending}
            onClick={onConfirm}
          >
            {sending ? "Sending…" : "Send to team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) {
      toast.error("Add a short description first");
      return;
    }
    setSending(true);
    try {
      let assetKey: string | null = null;
      let assetName: string | null = null;
      if (file) {
        const up = await clientSite.uploadAsset(file);
        assetKey = up.key;
        assetName = file.name;
      }
      await clientSite.request({ body: text.trim(), assetKey, assetName });
      toast.success("Request sent to your team.");
      setText("");
      setFile(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Request failed: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>
            For anything outside your editable areas. Attach a file if you have one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="req-text">What would you like changed or added?</Label>
            <textarea
              id="req-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="e.g. Add a holiday hours popup using the graphic attached."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-file">Attach a photo or graphic (optional)</Label>
            <Input
              id="req-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-tmc-slate text-white hover:bg-tmc-dark"
            disabled={sending}
            onClick={send}
          >
            {sending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
