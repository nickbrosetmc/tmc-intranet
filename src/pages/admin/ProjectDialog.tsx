// Add or edit a client project. Used on a client's profile (client fixed)
// and on the Projects page (client chosen here).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_KIND_LABELS,
  projects,
  type ClientProject,
  type ProjectKind,
} from "@/lib/projects";

export function ProjectDialog({
  project,
  clientId,
  clients,
  trigger,
  onSaved,
}: {
  /** Editing this project; omit to add one. */
  project?: ClientProject;
  /** The client a new project belongs to, when it's already known. */
  clientId?: number;
  /** Choices for the client, when it isn't. */
  clients?: { id: number; name: string }[];
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const blank = {
    clientId: project?.clientId ?? clientId ?? null,
    name: project?.name ?? "",
    kind: project?.kind ?? ("website" as ProjectKind),
    launchDate: project?.launchDate ?? "",
    price: project?.price != null ? String(project.price) : "",
    url: project?.url ?? "",
    notes: project?.notes ?? "",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (form.clientId == null) {
      toast.error("Pick a client");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Give the project a name");
      return;
    }
    setSaving(true);
    try {
      const data = {
        clientId: form.clientId,
        name: form.name,
        kind: form.kind,
        launchDate: form.launchDate || null,
        price: form.price.trim() === "" ? null : Math.max(0, Math.round(Number(form.price) || 0)),
        url: form.url || null,
        notes: form.notes || null,
      };
      if (project) {
        await projects.update(project.id, data);
        toast.success("Project saved");
      } else {
        await projects.create(data);
        toast.success(`${form.name.trim()} added`);
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? `Edit ${project.name}` : "Add a project"}</DialogTitle>
          <DialogDescription>
            The price counts toward the client's lifetime value. The launch date is where
            analytics for this work should look back to.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {clients && (
            <div className="space-y-1.5 col-span-2">
              <Label>Client</Label>
              <Select
                value={form.clientId != null ? String(form.clientId) : ""}
                onValueChange={(v) => setForm({ ...form, clientId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
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
          )}
          <div className="space-y-1.5 col-span-2">
            <Label>Project</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Website rebuild"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as ProjectKind })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROJECT_KIND_LABELS) as ProjectKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PROJECT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Launch date</Label>
            <Input
              type="date"
              value={form.launchDate}
              onChange={(e) => setForm({ ...form, launchDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Price ($)</Label>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="One-off price, e.g. 3500"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>URL</Label>
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="example.com"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Replaced the old Wix site; GA4 property switched over"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-tmc-gold text-tmc-dark hover:bg-tmc-gold-dark"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
